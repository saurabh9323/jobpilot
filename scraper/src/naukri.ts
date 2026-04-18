/**
 * JobPilot AI — Naukri.com Job Scraper
 *
 * Naukri has aggressive bot detection.
 * Mitigation:
 *  - Stealth plugin (already loaded by main runner)
 *  - Random delays between requests
 *  - Rotate user-agents
 *  - Use Naukri's public JSON search API where available,
 *    fall back to DOM scraping when blocked
 */

import { Browser, Page } from "playwright";
import { JobRaw, ScraperConfig } from "./types";
import { humanDelay, randomUserAgent, parseSalaryRange, parseExperience } from "./utils";

const NAUKRI_API = "https://www.naukri.com/jobapi/v3/search";
const NAUKRI_BASE = "https://www.naukri.com";

export interface NaukriConfig extends ScraperConfig {
  keywords: string[];
  locations: string[];
  experience?: number;    // years — filters to experience ± 2y
  maxPages?: number;
}

export async function scrapeNaukri(
  browser: Browser,
  config: NaukriConfig,
): Promise<JobRaw[]> {
  const context = await browser.newContext({
    userAgent: randomUserAgent(),
    viewport: { width: 1366, height: 768 },
    locale: "en-IN",
    timezoneId: "Asia/Kolkata",
    extraHTTPHeaders: {
      "Accept-Language": "en-IN,en;q=0.9",
      "sec-ch-ua-platform": '"Windows"',
    },
  });

  const page = await context.newPage();
  const allJobs: JobRaw[] = [];

  // Intercept XHR to capture Naukri's own JSON API response
  // This is much more reliable than DOM scraping
  const capturedJobs: NaukriApiJob[] = [];

  await page.route("**/jobapi/v3/search**", async (route) => {
    const response = await route.fetch();
    try {
      const json = await response.json();
      if (json?.jobDetails) {
        capturedJobs.push(...json.jobDetails);
      }
    } catch {
      // ignore parse errors
    }
    await route.fulfill({ response });
  });

  try {
    for (const keyword of config.keywords) {
      for (const location of config.locations) {
        const jobs = await scrapeKeywordLocation(
          page, config, keyword, location, capturedJobs,
        );
        allJobs.push(...jobs);
        capturedJobs.length = 0;   // reset for next keyword
        console.log(`  Naukri: "${keyword}" in "${location}" → ${jobs.length} jobs`);
        await humanDelay(4000, 8000);  // longer delay — Naukri is aggressive
      }
    }
  } finally {
    await context.close();
  }

  return allJobs;
}

async function scrapeKeywordLocation(
  page: Page,
  config: NaukriConfig,
  keyword: string,
  location: string,
  capturedJobs: NaukriApiJob[],
): Promise<JobRaw[]> {
  const maxPages = config.maxPages ?? 4;
  const jobs: JobRaw[] = [];

  for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
    const url = buildNaukriUrl(keyword, location, config.experience, pageNum);

    try {
      await page.goto(url, { waitUntil: "networkidle", timeout: 30_000 });
      await humanDelay(2000, 4000);

      // Check for bot-block page
      const title = await page.title();
      if (title.includes("Access Denied") || title.includes("captcha")) {
        console.warn("Naukri: bot detected on page", pageNum);
        await humanDelay(10_000, 20_000);  // back off
        break;
      }

      // Prefer API-intercepted data; fall back to DOM
      let pageJobs: JobRaw[];
      if (capturedJobs.length > 0) {
        pageJobs = capturedJobs.splice(0).map((j) => mapNaukriApiJob(j, keyword));
      } else {
        pageJobs = await scrapeNaukriDOM(page, keyword, location);
      }

      jobs.push(...pageJobs);
      if (pageJobs.length < 10) break;

    } catch (err) {
      console.error(`Naukri scrape error (page ${pageNum}):`, err);
      break;
    }
  }

  return jobs;
}

// ── DOM fallback scraper ──────────────────────────────────────────────────────
async function scrapeNaukriDOM(
  page: Page,
  keyword: string,
  location: string,
): Promise<JobRaw[]> {
  return page.evaluate(
    ({ keyword }) => {
      const cards = document.querySelectorAll("article.jobTuple");

      return Array.from(cards).map((card) => {
        const titleEl = card.querySelector(".title");
        const companyEl = card.querySelector(".companyInfo .company-name");
        const locationEl = card.querySelector(".location");
        const salaryEl = card.querySelector(".salary");
        const expEl = card.querySelector(".experience");
        const linkEl = titleEl as HTMLAnchorElement;
        const tagsEls = card.querySelectorAll(".tags li");
        const dateEl = card.querySelector(".footerDetails .fl-right");

        const url = linkEl?.href ?? "";
        const jobId = url.match(/(\d{5,})/)?.[1] ?? "";

        return {
          source: "naukri" as const,
          source_job_id: jobId,
          source_url: url.split("?")[0],
          title: titleEl?.textContent?.trim() ?? "",
          company_name: companyEl?.textContent?.trim() ?? "",
          location: locationEl?.textContent?.trim() ?? "",
          description: "",
          salary_raw: salaryEl?.textContent?.trim() ?? null,
          experience_raw: expEl?.textContent?.trim() ?? null,
          skills_required: Array.from(tagsEls)
            .map((t) => t.textContent?.trim() ?? "")
            .filter(Boolean),
          posted_raw: dateEl?.textContent?.trim() ?? null,
          search_keyword: keyword,
          remote: false,
        };
      }).filter((j) => j.title && j.company_name && j.source_job_id);
    },
    { keyword, location },
  );
}

// ── Map Naukri's internal API response shape to our JobRaw ────────────────────
function mapNaukriApiJob(j: NaukriApiJob, keyword: string): JobRaw {
  const { salary, exp } = parseSalaryRange(j.placeholders ?? []);

  return {
    source: "naukri",
    source_job_id: String(j.jobId),
    source_url: `${NAUKRI_BASE}/job-listings-${j.jobId}`,
    title: j.title ?? "",
    company_name: j.companyName ?? "",
    location: j.placeholders?.find((p) => p.type === "location")?.label ?? "",
    description: j.jobDescription ?? "",
    salary_raw: salary ?? null,
    experience_raw: exp ?? null,
    skills_required: j.tagsAndSkills?.split(",").map((s) => s.trim()) ?? [],
    posted_raw: j.footerPlaceholderLabel ?? null,
    remote: j.title?.toLowerCase().includes("remote") ?? false,
    search_keyword: keyword,
  };
}

function buildNaukriUrl(
  keyword: string,
  location: string,
  experience?: number,
  page: number = 1,
): string {
  const slug = keyword.toLowerCase().replace(/\s+/g, "-");
  const locSlug = location.toLowerCase().replace(/\s+/g, "-");
  const expParam = experience ? `-${experience - 2}-${experience + 2}` : "";
  const pageParam = page > 1 ? `?pageNo=${page}` : "";

  return `${NAUKRI_BASE}/${slug}-jobs-in-${locSlug}${expParam}${pageParam}`;
}

// ── Naukri API type ───────────────────────────────────────────────────────────
interface NaukriApiJob {
  jobId: number;
  title?: string;
  companyName?: string;
  jobDescription?: string;
  tagsAndSkills?: string;
  footerPlaceholderLabel?: string;
  placeholders?: Array<{ type: string; label: string }>;
}
