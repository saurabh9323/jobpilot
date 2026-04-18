/**
 * JobPilot AI — Scraper Orchestrator
 *
 * Usage:
 *   npx ts-node src/index.ts --portals linkedin,naukri
 *   npx ts-node src/index.ts --portals all
 */

import { chromium } from "playwright-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import { scrapeLinkedIn } from "./linkedin";
import { scrapeNaukri } from "./naukri";
import { JobRaw, ScrapeResult } from "./types";
import { parseSalaryLakhs, parseExperienceYears, parseRelativeDate, stripHtml } from "./utils";

chromium.use(StealthPlugin());

// ── Config — pull from env ─────────────────────────────────────────────────
const CONFIG = {
  djangoApiUrl: process.env.DJANGO_URL ?? "http://localhost:8000",
  internalApiKey: process.env.SCRAPER_API_KEY ?? "dev-scraper-key",
  keywords: (process.env.SEARCH_KEYWORDS ?? "Senior Backend Engineer,Staff Engineer,Principal Engineer")
    .split(","),
  locations: (process.env.SEARCH_LOCATIONS ?? "Bengaluru,Mumbai,Remote")
    .split(","),
  experienceYears: parseInt(process.env.EXPERIENCE_YEARS ?? "6"),
  linkedinCookieFile: process.env.LINKEDIN_COOKIE_FILE ?? "/scraper/cookies/linkedin.json",
  maxPages: parseInt(process.env.MAX_PAGES ?? "5"),
  headless: process.env.HEADLESS !== "false",   // default headless=true in prod
};

async function main() {
  const args = process.argv.slice(2);
  const portalsArg = args.find((a) => a.startsWith("--portals="))?.split("=")[1] ?? "all";
  const portals = portalsArg === "all" ? ["linkedin", "naukri"] : portalsArg.split(",");

  console.log(`\n🚀 JobPilot Scraper — portals: ${portals.join(", ")}`);
  console.log(`   Keywords : ${CONFIG.keywords.join(", ")}`);
  console.log(`   Locations: ${CONFIG.locations.join(", ")}\n`);

  const browser = await chromium.launch({
    headless: CONFIG.headless,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-blink-features=AutomationControlled"],
  });

  const results: ScrapeResult[] = [];

  try {
    for (const portal of portals) {
      const t0 = Date.now();
      let jobs: JobRaw[] = [];
      let errors: string[] = [];

      try {
        if (portal === "linkedin") {
          jobs = await scrapeLinkedIn(browser, {
            ...CONFIG,
            cookieFile: CONFIG.linkedinCookieFile,
            experienceLevel: ["3", "4"],   // mid-senior
            datePosted: "r604800",
          });
        } else if (portal === "naukri") {
          jobs = await scrapeNaukri(browser, {
            ...CONFIG,
            experience: CONFIG.experienceYears,
          });
        }
      } catch (err) {
        errors.push(String(err));
        console.error(`Error scraping ${portal}:`, err);
      }

      // Normalise + deduplicate
      const normalised = jobs.map(normaliseJob).filter((j) => isValidJob(j));
      const { saved, skipped } = await postJobsBatch(normalised, CONFIG);

      results.push({
        portal,
        total: jobs.length,
        new_jobs: saved,
        errors,
        duration_ms: Date.now() - t0,
      });

      console.log(`✅ ${portal}: ${jobs.length} found, ${saved} new, ${skipped} dupes (${Date.now() - t0}ms)\n`);
    }
  } finally {
    await browser.close();
  }

  // Print summary
  console.log("\n── Summary ──────────────────────────────");
  for (const r of results) {
    console.log(`  ${r.portal.padEnd(12)} ${r.new_jobs} new jobs  (${r.duration_ms}ms)`);
  }
  console.log("─────────────────────────────────────────\n");

  // Report to Django
  await reportRunToApi(results);
}

// ── Normalise raw scraped job into clean shape ─────────────────────────────
function normaliseJob(raw: JobRaw): Record<string, unknown> {
  const salary = parseSalaryLakhs(raw.salary_raw);
  const experience = parseExperienceYears(raw.experience_raw);

  return {
    source: raw.source,
    source_job_id: raw.source_job_id,
    source_url: raw.source_url,
    title: raw.title.trim(),
    company_name: raw.company_name.trim(),
    location: raw.location.trim(),
    description: stripHtml(raw.description),
    remote: raw.remote ?? false,
    salary_min: salary.min,
    salary_max: salary.max,
    experience_min: experience.min,
    experience_max: experience.max,
    skills_required: raw.skills_required ?? [],
    posted_at: raw.posted_at ?? parseRelativeDate(raw.posted_raw),
  };
}

function isValidJob(job: Record<string, unknown>): boolean {
  return Boolean(
    job.title &&
    job.company_name &&
    job.source_url &&
    (job.title as string).length >= 3,
  );
}

// ── POST jobs to Django in batches of 50 ──────────────────────────────────
async function postJobsBatch(
  jobs: Record<string, unknown>[],
  config: typeof CONFIG,
): Promise<{ saved: number; skipped: number }> {
  if (jobs.length === 0) return { saved: 0, skipped: 0 };

  const BATCH_SIZE = 50;
  let saved = 0;
  let skipped = 0;

  for (let i = 0; i < jobs.length; i += BATCH_SIZE) {
    const batch = jobs.slice(i, i + BATCH_SIZE);

    try {
      const response = await fetch(`${config.djangoApiUrl}/api/ai/jobs/ingest/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Scraper-Key": config.internalApiKey,
        },
        body: JSON.stringify({ jobs: batch }),
      });

      if (!response.ok) {
        console.error(`Ingest API error: ${response.status}`, await response.text());
        continue;
      }

      const result = await response.json();
      saved += result.created ?? 0;
      skipped += result.skipped ?? 0;
    } catch (err) {
      console.error("Failed to POST batch:", err);
    }
  }

  return { saved, skipped };
}

async function reportRunToApi(results: ScrapeResult[]) {
  try {
    await fetch(`${CONFIG.djangoApiUrl}/api/ai/scrape-runs/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Scraper-Key": CONFIG.internalApiKey,
      },
      body: JSON.stringify({ results }),
    });
  } catch {
    // Non-critical — don't crash
  }
}

main().catch((err) => {
  console.error("Fatal scraper error:", err);
  process.exit(1);
});
