/**
 * JobPilot Scraper — Django API client
 * Handles batched job ingest with retry logic.
 */

import { JobRaw, ScrapeResult } from "./types";

export async function postJobsBatch(
  jobs: Record<string, unknown>[],
  config: { djangoApiUrl: string; internalApiKey: string },
): Promise<{ saved: number; skipped: number }> {
  if (jobs.length === 0) return { saved: 0, skipped: 0 };

  const BATCH_SIZE = 50;
  let saved = 0;
  let skipped = 0;

  for (let i = 0; i < jobs.length; i += BATCH_SIZE) {
    const batch = jobs.slice(i, i + BATCH_SIZE);
    const result = await postWithRetry(batch, config, 3);
    saved   += result.created ?? 0;
    skipped += result.skipped ?? 0;
  }

  return { saved, skipped };
}

async function postWithRetry(
  batch: Record<string, unknown>[],
  config: { djangoApiUrl: string; internalApiKey: string },
  retries: number,
): Promise<{ created: number; skipped: number }> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch(`${config.djangoApiUrl}/api/ai/jobs/ingest/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Scraper-Key": config.internalApiKey,
        },
        body: JSON.stringify({ jobs: batch }),
        signal: AbortSignal.timeout(30_000),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`HTTP ${response.status}: ${text.slice(0, 200)}`);
      }

      return response.json();
    } catch (err) {
      if (attempt === retries) {
        console.error(`Ingest failed after ${retries} attempts:`, err);
        return { created: 0, skipped: 0 };
      }
      await new Promise((r) => setTimeout(r, attempt * 2000));
    }
  }
  return { created: 0, skipped: 0 };
}
