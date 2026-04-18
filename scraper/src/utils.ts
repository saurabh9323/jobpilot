// ─────────────────────────────────────────────────────────────────────────────
//  utils.ts — Scraper helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Random sleep between minMs and maxMs to mimic human behaviour */
export function humanDelay(minMs: number, maxMs: number): Promise<void> {
  const delay = Math.floor(Math.random() * (maxMs - minMs) + minMs);
  return new Promise((r) => setTimeout(r, delay));
}

/** Pool of real desktop user-agents — rotated per context */
const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4_1) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4.1 Safari/605.1.15",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:124.0) Gecko/20100101 Firefox/124.0",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 14.4; rv:124.0) Gecko/20100101 Firefox/124.0",
];

export function randomUserAgent(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

/** Parse "₹15 – 25 LPA" or "15,00,000 – 25,00,000 PA" → { min: 15, max: 25 } (lakhs) */
export function parseSalaryLakhs(raw: string | null | undefined): {
  min: number | null;
  max: number | null;
} {
  if (!raw) return { min: null, max: null };

  // Handle "X – Y LPA" format
  const lpaMatch = raw.match(/(\d+(?:\.\d+)?)\s*[–-]\s*(\d+(?:\.\d+)?)\s*[Ll][Pp][Aa]/);
  if (lpaMatch) {
    return { min: parseFloat(lpaMatch[1]), max: parseFloat(lpaMatch[2]) };
  }

  // Handle "Not Disclosed" / "Confidential"
  return { min: null, max: null };
}

/** Parse "2 – 5 Yrs" → { min: 2, max: 5 } */
export function parseExperienceYears(raw: string | null | undefined): {
  min: number | null;
  max: number | null;
} {
  if (!raw) return { min: null, max: null };

  const match = raw.match(/(\d+)\s*[–\-–]\s*(\d+)/);
  if (match) return { min: parseInt(match[1]), max: parseInt(match[2]) };

  const singleMatch = raw.match(/(\d+)\+?\s*[Yy]r/);
  if (singleMatch) return { min: parseInt(singleMatch[1]), max: null };

  return { min: null, max: null };
}

/** Parse Naukri API placeholders array */
export function parseSalaryRange(
  placeholders: Array<{ type: string; label: string }>,
): { salary: string | null; exp: string | null } {
  const sal = placeholders.find((p) => p.type === "salary")?.label ?? null;
  const exp = placeholders.find((p) => p.type === "experience")?.label ?? null;
  return { salary: sal, exp };
}

/** Strip HTML tags from description */
export function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Normalise "2 days ago", "30+ days ago" → ISO date string */
export function parseRelativeDate(raw: string | null): string | null {
  if (!raw) return null;

  const now = Date.now();
  const match = raw.match(/(\d+)\s*(hour|day|week|month)/i);
  if (!match) return null;

  const n = parseInt(match[1]);
  const unit = match[2].toLowerCase();
  const multipliers: Record<string, number> = {
    hour: 3_600_000,
    day: 86_400_000,
    week: 604_800_000,
    month: 2_592_000_000,
  };

  return new Date(now - n * (multipliers[unit] ?? 86_400_000)).toISOString();
}
