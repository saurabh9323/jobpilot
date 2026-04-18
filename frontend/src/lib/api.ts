/**
 * JobPilot AI — typed API client
 * All requests go through the Express gateway at /api/
 * AI/ML endpoints (cover letter, scoring) go directly to /api/ai/
 */
import axios, { AxiosInstance } from "axios";

const gateway: AxiosInstance = axios.create({
  baseURL: process.env.NEXT_PUBLIC_GATEWAY_URL ?? "http://localhost:4000",
  withCredentials: true,
  timeout: 15_000,
});

const django: AxiosInstance = axios.create({
  baseURL: process.env.NEXT_PUBLIC_DJANGO_URL ?? "http://localhost:8000",
  withCredentials: true,
  timeout: 30_000,   // AI tasks can be slower
});

// ── Auth token injection ─────────────────────────────────────────────────────
function getToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("jp_token");
}

[gateway, django].forEach((instance) => {
  instance.interceptors.request.use((config) => {
    const token = getToken();
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  });

  instance.interceptors.response.use(
    (r) => r,
    (err) => {
      if (err.response?.status === 401 && typeof window !== "undefined") {
        localStorage.removeItem("jp_token");
        window.location.href = "/login";
      }
      return Promise.reject(err);
    },
  );
});

// ── Types ────────────────────────────────────────────────────────────────────
export interface Job {
  id: string;
  title: string;
  company_name: string;
  company_logo: string;
  location: string;
  remote: boolean;
  salary_min: number | null;
  salary_max: number | null;
  experience_min: number | null;
  experience_max: number | null;
  skills_required: string[];
  source: string;
  source_url: string;
  status: string;
  ai_match_score: number | null;
  ats_score: number | null;
  posted_at: string | null;
  discovered_at: string;
}

export interface Application {
  id: string;
  job: Job;
  cover_letter: string;
  hr_email: string;
  hr_name: string;
  outreach_sent: boolean;
  outreach_sent_at: string | null;
  applied_at: string;
  last_activity_at: string;
  notes: string;
}

export interface FunnelStats {
  discovered: number;
  scored: number;
  queued: number;
  applied: number;
  viewed: number;
  screening: number;
  interview: number;
  offer: number;
  rejected: number;
}

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

// ── Jobs API ─────────────────────────────────────────────────────────────────
export const jobsApi = {
  list: (params?: Record<string, unknown>) =>
    django.get<PaginatedResponse<Job>>("/api/ai/jobs/", { params }).then((r) => r.data),

  detail: (id: string) =>
    django.get<Job>(`/api/ai/jobs/${id}/`).then((r) => r.data),

  funnel: () =>
    django.get<FunnelStats>("/api/ai/jobs/funnel/").then((r) => r.data),

  topMatches: () =>
    django.get<Job[]>("/api/ai/jobs/top_matches/").then((r) => r.data),

  scoreJob: (id: string) =>
    django.post(`/api/ai/jobs/${id}/score/`).then((r) => r.data),
};

// ── Applications API ─────────────────────────────────────────────────────────
export const applicationsApi = {
  list: () =>
    django.get<PaginatedResponse<Application>>("/api/ai/applications/").then((r) => r.data),

  summary: () =>
    django.get("/api/ai/applications/summary/").then((r) => r.data),

  create: (jobId: string) =>
    django.post<Application>("/api/ai/applications/", { job: jobId }).then((r) => r.data),

  update: (id: string, data: Partial<Application>) =>
    django.patch<Application>(`/api/ai/applications/${id}/`, data).then((r) => r.data),
};

// ── Scraper API (via Gateway) ────────────────────────────────────────────────
export const scraperApi = {
  trigger: (portal: string) =>
    gateway.post("/api/scraper/trigger", { portal }).then((r) => r.data),

  status: () =>
    gateway.get("/api/scraper/status").then((r) => r.data),

  runs: () =>
    django.get("/api/ai/scrape-runs/").then((r) => r.data),
};

// ── AI API ───────────────────────────────────────────────────────────────────
export const aiApi = {
  generateCoverLetter: (jobId: string) =>
    django.post<{ cover_letter: string }>("/api/ai/cover-letter/", { job_id: jobId }).then((r) => r.data),

  atsScore: (jobId: string, resumeText: string) =>
    django.post<{ score: number; gaps: string[] }>("/api/ai/ats-score/", {
      job_id: jobId,
      resume_text: resumeText,
    }).then((r) => r.data),

  findHrContact: (companyDomain: string) =>
    gateway.post<{ name: string; email: string; confidence: number }>(
      "/api/hr-finder/lookup",
      { domain: companyDomain },
    ).then((r) => r.data),
};

// ── Auth API ─────────────────────────────────────────────────────────────────
export const authApi = {
  login: (email: string, password: string) =>
    gateway.post<{ token: string; user: unknown }>("/api/auth/login", { email, password }).then((r) => {
      localStorage.setItem("jp_token", r.data.token);
      return r.data;
    }),

  logout: () => {
    localStorage.removeItem("jp_token");
    return gateway.post("/api/auth/logout");
  },
};
