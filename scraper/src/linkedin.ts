/**
 * JobPilot AI — LinkedIn Job Scraper
 * Uses Playwright with stealth mode to avoid bot detection.
 *
 * Strategy:
 *  1. Cookie-based session auth (no password stored)
 *  2. Scroll through search results pages
 *  3. Extract structured job data from each card
 *  4. POST to Django API for deduplication + storage
 */

import { Browser, BrowserContext, Page } from "playwright";
import { chromium } from "playwright-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import { JobRaw, ScraperConfig } from "./types";
import { postJobsBatch } from "./api-client";
import { humanDelay, randomUserAgent } from "./utils";

// Apply stealth plugin to avoid Cloudflare / LinkedIn bot detection
chromium.use(StealthPlugin());

const LINKEDIN_BASE = "https://www.linkedin.com";

export interface LinkedInConfig extends ScraperConfig {
  cookieFile: string;           // path to exported cookie JSON (use browser extension)
  keywords: string[];           // e.g. ["Senior Backend Engineer", "Staff Engineer"]
  locations: string[];          // e.g. ["Bengaluru", "Mumbai", "Remote"]
  experienceLevel: ("1" | "2" | "3" | "4")[];  // 1=intern 2=entry 3=assoc 4=mid 5=director
  datePosted?: "r86400" | "r604800" | "r2592000";  // 24h / 7d / 30d
  maxPages?: number;
}

export async function scrapeLinkedIn(
  browser: Browser,
  config: LinkedInConfig,
): Promise<JobRaw[]> {
  const context = await browser.newContext({
    userAgent: randomUserAgent(),
    viewport: { width: 1440, height: 900 },
    locale: "en-IN",
    timezoneId: "Asia/Kolkata",
  });

  // Load saved cookies so we skip login entirely
  await loadCookies(context, config.cookieFile);

  const page = await context.newPage();
  const allJobs: JobRaw[] = [];

  try {
    for (const keyword of config.keywords) {
      for (const location of config.locations) {
        const jobs = await scrapeSearchPage(page, config, keyword, location);
        allJobs.push(...jobs);
        console.log(`  LinkedIn: "${keyword}" in "${location}" → ${jobs.length} jobs`);
        await humanDelay(3000, 6000);
      }
    }
  } finally {
    await context.close();
  }

  return allJobs;
}

async function scrapeSearchPage(
  page: Page,
  config: LinkedInConfig,
  keyword: string,
  location: string,
): Promise<JobRaw[]> {
  const jobs: JobRaw[] = [];
  const maxPages = config.maxPages ?? 5;

  for (let pageNum = 0; pageNum < maxPages; pageNum++) {
    const start = pageNum * 25;
    const url = buildLinkedInSearchUrl(keyword, location, config, start);

    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });
      await humanDelay(2000, 4000);

      // Check if we've been redirected to login — cookies may have expired
      if (page.url().includes("/login") || page.url().includes("/authwall")) {
        console.warn("LinkedIn: session expired — cookie refresh needed");
        break;
      }

      // Wait for job cards to appear
      const hasResults = await page
        .waitForSelector(".jobs-search__results-list", { timeout: 8000 })
        .then(() => true)
        .catch(() => false);

      if (!hasResults) break;  // no more results

      // Scroll to load all lazy-loaded cards
      await scrollToBottom(page);

      // Extract job cards from this page
      const pageJobs = await extractJobCards(page, keyword, location);
      jobs.push(...pageJobs);

      // Fetch full descriptions for each job (rate-limited)
      for (const job of pageJobs) {
        await enrichJobDescription(page, job);
        await humanDelay(1500, 3000);
      }

      if (pageJobs.length < 10) break;   // last page has fewer results
    } catch (err) {
      console.error(`LinkedIn scrape error (page ${pageNum}):`, err);
      break;
    }
  }

  return jobs;
}

async function extractJobCards(
  page: Page,
  keyword: string,
  location: string,
): Promise<JobRaw[]> {
  return page.evaluate(
    ({ keyword, location }) => {
      const cards = document.querySelectorAll(
        ".jobs-search__results-list > li",
      );

      return Array.from(cards).map((card) => {
        const titleEl = card.querySelector(".base-search-card__title");
        const companyEl = card.querySelector(".base-search-card__subtitle a");
        const locationEl = card.querySelector(".job-search-card__location");
        const linkEl = card.querySelector("a.base-card__full-link");
        const timeEl = card.querySelector("time");
        const salaryEl = card.querySelector(".job-search-card__salary-info");

        const url = linkEl?.getAttribute("href") ?? "";
        // Extract clean job ID from URL: /jobs/view/1234567890/
        const jobIdMatch = url.match(/\/jobs\/view\/(\d+)/);

        return {
          source: "linkedin" as const,
          source_job_id: jobIdMatch?.[1] ?? "",
          source_url: url.split("?")[0],    // strip tracking params
          title: titleEl?.textContent?.trim() ?? "",
          company_name: companyEl?.textContent?.trim() ?? "",
          location: locationEl?.textContent?.trim() ?? location,
          description: "",                   // populated by enrichJobDescription
          posted_at: timeEl?.getAttribute("datetime") ?? null,
          salary_raw: salaryEl?.textContent?.trim() ?? null,
          search_keyword: keyword,
        };
      }).filter((j) => j.title && j.company_name && j.source_job_id);
    },
    { keyword, location },
  );
}

async function enrichJobDescription(page: Page, job: JobRaw): Promise<void> {
  if (!job.source_url) return;

  try {
    await page.goto(job.source_url, {
      waitUntil: "domcontentloaded",
      timeout: 20_000,
    });
    await humanDelay(1000, 2000);

    const data = await page.evaluate(() => {
      const descEl = document.querySelector(".show-more-less-html__markup");
      const skillsEls = document.querySelectorAll(".job-details-skill-match-status-list li");
      const remoteEl = document.querySelector(".jobs-unified-top-card__workplace-type");
      const expEl = document.querySelector(".description__job-criteria-text--criteria");

      return {
        description: descEl?.textContent?.trim() ?? "",
        skills: Array.from(skillsEls).map((el) => el.textContent?.trim() ?? ""),
        remote: remoteEl?.textContent?.toLowerCase().includes("remote") ?? false,
        experience_raw: expEl?.textContent?.trim() ?? "",
      };
    });

    job.description = data.description;
    job.skills_required = data.skills;
    job.remote = data.remote;
    job.experience_raw = data.experience_raw;
  } catch {
    // Non-fatal: job still usable without full description
  }
}

async function scrollToBottom(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await new Promise<void>((resolve) => {
      let totalHeight = 0;
      const distance = 300;
      const timer = setInterval(() => {
        window.scrollBy(0, distance);
        totalHeight += distance;
        if (totalHeight >= document.body.scrollHeight) {
          clearInterval(timer);
          resolve();
        }
      }, 150);
    });
  });
  await humanDelay(500, 1000);
}

async function loadCookies(context: BrowserContext, cookieFile: string): Promise<void> {
  const fs = await import("fs/promises");
  try {
    const raw = await fs.readFile(cookieFile, "utf-8");
    const cookies = JSON.parse(raw);
    await context.addCookies(cookies);
  } catch {
    console.warn("LinkedIn: could not load cookies from", cookieFile);
  }
}

function buildLinkedInSearchUrl(
  keyword: string,
  location: string,
  config: LinkedInConfig,
  start: number,
): string {
  const params = new URLSearchParams({
    keywords: keyword,
    location,
    f_TPR: config.datePosted ?? "r604800",  // default: past 7 days
    start: String(start),
  });

  if (config.experienceLevel?.length) {
    params.set("f_E", config.experienceLevel.join(","));
  }

  return `${LINKEDIN_BASE}/jobs/search/?${params.toString()}`;
}
