// ─────────────────────────────────────────────────────────────────────────────
//  types.ts
// ─────────────────────────────────────────────────────────────────────────────
export interface JobRaw {
  source: "linkedin" | "naukri" | "indeed" | "wellfound" | "instahyre";
  source_job_id: string;
  source_url: string;
  title: string;
  company_name: string;
  location: string;
  description: string;
  remote?: boolean;
  salary_raw?: string | null;
  experience_raw?: string | null;
  skills_required?: string[];
  posted_raw?: string | null;
  posted_at?: string | null;
  search_keyword?: string;
}

export interface ScraperConfig {
  djangoApiUrl: string;
  userProfileId: number;
}

export interface ScrapeResult {
  portal: string;
  total: number;
  new_jobs: number;
  errors: string[];
  duration_ms: number;
}
