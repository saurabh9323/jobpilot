"use client";

import { useQuery } from "@tanstack/react-query";
import { jobsApi, Job } from "@/lib/api";
import { ExternalLink, MapPin, Zap } from "lucide-react";
import { clsx } from "clsx";

function MatchScore({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const color =
    pct >= 85 ? "text-green-600 bg-green-50" :
    pct >= 70 ? "text-brand-600 bg-brand-50" :
                "text-muted-foreground bg-muted";
  return (
    <span className={clsx("text-xs font-mono font-medium px-2 py-0.5 rounded-full", color)}>
      {pct}%
    </span>
  );
}

function JobRow({ job }: { job: Job }) {
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-border last:border-0">
      {/* Company logo placeholder */}
      <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0 text-xs font-medium text-muted-foreground">
        {job.company_name.slice(0, 2).toUpperCase()}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium truncate">{job.title}</p>
          {job.remote && (
            <span className="text-[10px] bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded-full font-mono shrink-0">
              remote
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <p className="text-xs text-muted-foreground">{job.company_name}</p>
          {job.location && (
            <>
              <span className="text-border text-xs">·</span>
              <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
                <MapPin size={10} />
                {job.location.split(",")[0]}
              </span>
            </>
          )}
        </div>
        {job.salary_max && (
          <p className="text-xs text-muted-foreground font-mono mt-0.5">
            ₹{job.salary_min}–{job.salary_max}L
          </p>
        )}
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {job.ai_match_score != null && <MatchScore score={job.ai_match_score} />}
        <a
          href={job.source_url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <ExternalLink size={13} />
        </a>
      </div>
    </div>
  );
}

export function TopMatchesCard() {
  const { data: jobs, isLoading } = useQuery({
    queryKey: ["top-matches"],
    queryFn: jobsApi.topMatches,
    refetchInterval: 120_000,
  });

  return (
    <div className="border border-border rounded-xl p-5 bg-card">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-[10px] font-mono font-medium uppercase tracking-widest text-muted-foreground">
            Top Matches
          </p>
          <h3 className="text-sm font-medium mt-0.5">AI score ≥ 75%</h3>
        </div>
        <Zap size={15} className="text-brand-500" />
      </div>

      {isLoading ? (
        <div className="space-y-3 animate-pulse">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex gap-3">
              <div className="w-8 h-8 rounded-lg bg-muted" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3.5 bg-muted rounded w-3/4" />
                <div className="h-3 bg-muted rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : jobs?.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">
          No high-match jobs yet — run the scraper to discover jobs
        </p>
      ) : (
        <div>
          {jobs?.map((job) => <JobRow key={job.id} job={job} />)}
        </div>
      )}
    </div>
  );
}
