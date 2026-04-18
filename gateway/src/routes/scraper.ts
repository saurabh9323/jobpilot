// ── routes/scraper.ts ────────────────────────────────────────────────────────
import { Router } from "express";
import { scrapeQueue } from "../index";

export const scraperRouter = Router();

const VALID_PORTALS = ["linkedin", "naukri", "indeed", "wellfound", "instahyre", "all"] as const;

scraperRouter.post("/trigger", async (req, res) => {
  const portal = req.body.portal ?? "all";

  if (!VALID_PORTALS.includes(portal)) {
    return res.status(400).json({
      error: `Invalid portal. Choose from: ${VALID_PORTALS.join(", ")}`,
    });
  }

  const portals = portal === "all" ? ["linkedin", "naukri", "indeed"] : [portal];
  const jobs = await Promise.all(
    portals.map((p) =>
      scrapeQueue.add(`scrape-${p}`, { portal: p }, { priority: 1 }),
    ),
  );

  res.json({
    message: "Scrape queued",
    portals,
    job_ids: jobs.map((j) => j.id),
  });
});

scraperRouter.get("/status", async (_req, res) => {
  const [waiting, active, completed, failed] = await Promise.all([
    scrapeQueue.getWaitingCount(),
    scrapeQueue.getActiveCount(),
    scrapeQueue.getCompletedCount(),
    scrapeQueue.getFailedCount(),
  ]);

  res.json({ waiting, active, completed, failed });
});


// ── routes/hr-finder.ts ──────────────────────────────────────────────────────
import { Router as ExpressRouter } from "express";
import axios from "axios";

export const hrFinderRouter = ExpressRouter();

hrFinderRouter.post("/lookup", async (req, res) => {
  const { domain, company_name } = req.body;

  if (!domain && !company_name) {
    return res.status(400).json({ error: "domain or company_name required" });
  }

  const results: Array<{ name: string; email: string; role: string; confidence: number; source: string }> = [];

  // 1. Try Hunter.io
  if (process.env.HUNTER_API_KEY) {
    try {
      const { data } = await axios.get("https://api.hunter.io/v2/domain-search", {
        params: {
          domain: domain ?? company_name,
          api_key: process.env.HUNTER_API_KEY,
          limit: 5,
          type: "personal",
        },
        timeout: 8000,
      });

      const hrTitles = ["talent", "recruit", "hr", "people", "hiring"];

      data.data?.emails
        ?.filter((e: { position?: string }) =>
          hrTitles.some((t) =>
            e.position?.toLowerCase().includes(t),
          ),
        )
        .forEach((e: { first_name?: string; last_name?: string; value: string; position?: string; confidence: number }) => {
          results.push({
            name: `${e.first_name ?? ""} ${e.last_name ?? ""}`.trim(),
            email: e.value,
            role: e.position ?? "HR",
            confidence: e.confidence / 100,
            source: "hunter",
          });
        });
    } catch (err) {
      console.warn("[HR Finder] Hunter.io error:", (err as Error).message);
    }
  }

  // 2. Try Apollo.io
  if (process.env.APOLLO_API_KEY && results.length === 0) {
    try {
      const { data } = await axios.post(
        "https://api.apollo.io/v1/mixed_people/search",
        {
          api_key: process.env.APOLLO_API_KEY,
          q_organization_domains: [domain],
          person_titles: [
            "Talent Acquisition", "Recruiter", "HR Manager",
            "People Operations", "Technical Recruiter",
          ],
          per_page: 5,
        },
        { timeout: 10_000 },
      );

      data.people?.forEach((p: { name?: string; email?: string; title?: string }) => {
        if (p.email) {
          results.push({
            name: p.name ?? "",
            email: p.email,
            role: p.title ?? "HR",
            confidence: 0.8,
            source: "apollo",
          });
        }
      });
    } catch (err) {
      console.warn("[HR Finder] Apollo error:", (err as Error).message);
    }
  }

  // Sort by confidence descending
  results.sort((a, b) => b.confidence - a.confidence);

  res.json({
    domain,
    contacts: results.slice(0, 3),
    total_found: results.length,
  });
});
