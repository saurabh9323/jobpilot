"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { jobsApi, applicationsApi, Job } from "@/lib/api";
import { Sidebar } from "@/components/layout/sidebar";
import { TopBar } from "@/components/layout/topbar";
import { Search, Filter, ExternalLink, Zap, MapPin, Briefcase } from "lucide-react";
import { clsx } from "clsx";
import toast from "react-hot-toast";
import { formatDistanceToNow } from "date-fns";

const SOURCE_COLORS: Record<string, string> = {
  linkedin:  "bg-blue-50 text-blue-700",
  naukri:    "bg-orange-50 text-orange-700",
  indeed:    "bg-purple-50 text-purple-700",
  wellfound: "bg-pink-50 text-pink-700",
  instahyre: "bg-teal-50 text-teal-700",
  direct:    "bg-gray-100 text-gray-600",
};

const STATUS_COLORS: Record<string, string> = {
  discovered: "bg-slate-100 text-slate-600",
  scored:     "bg-brand-50 text-brand-700",
  applied:    "bg-blue-50 text-blue-700",
  screening:  "bg-emerald-50 text-emerald-700",
  interview:  "bg-amber-50 text-amber-700",
  offer:      "bg-green-50 text-green-700",
  rejected:   "bg-red-50 text-red-600",
};

function JobCard({ job }: { job: Job }) {
  const qc = useQueryClient();
  const applyMutation = useMutation({
    mutationFn: () => applicationsApi.create(job.id),
    onSuccess: () => {
      toast.success(`Applied to ${job.title} @ ${job.company_name}`);
      qc.invalidateQueries({ queryKey: ["jobs"] });
      qc.invalidateQueries({ queryKey: ["funnel"] });
    },
    onError: () => toast.error("Failed to create application"),
  });

  const matchPct = job.ai_match_score != null ? Math.round(job.ai_match_score * 100) : null;

  return (
    <div className="border border-gray-200 rounded-xl p-4 bg-white hover:border-brand-300 transition-colors group">
      {/* Header row */}
      <div className="flex items-start gap-3 mb-3">
        <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center text-xs font-semibold text-gray-500 shrink-0">
          {job.company_name.slice(0, 2).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-medium truncate">{job.title}</h3>
          <p className="text-xs text-gray-500">{job.company_name}</p>
        </div>
        {matchPct != null && (
          <span
            className={clsx(
              "text-xs font-mono font-semibold px-2 py-0.5 rounded-full",
              matchPct >= 85 ? "bg-green-50 text-green-700" :
              matchPct >= 70 ? "bg-brand-50 text-brand-700" :
                               "bg-gray-100 text-gray-500",
            )}
          >
            {matchPct}%
          </span>
        )}
      </div>

      {/* Meta row */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        {job.location && (
          <span className="flex items-center gap-1 text-xs text-gray-500">
            <MapPin size={10} />
            {job.location.split(",")[0]}
          </span>
        )}
        {job.remote && (
          <span className="text-[10px] bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded-full font-mono">
            remote
          </span>
        )}
        {job.salary_max && (
          <span className="text-xs text-gray-500 font-mono">
            ₹{job.salary_min}–{job.salary_max}L
          </span>
        )}
        {job.experience_min != null && (
          <span className="text-xs text-gray-500 font-mono">
            {job.experience_min}–{job.experience_max ?? "∞"}y exp
          </span>
        )}
      </div>

      {/* Skills */}
      {job.skills_required.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {job.skills_required.slice(0, 5).map((skill) => (
            <span
              key={skill}
              className="text-[10px] font-mono bg-gray-100 text-gray-500 px-2 py-0.5 rounded"
            >
              {skill}
            </span>
          ))}
          {job.skills_required.length > 5 && (
            <span className="text-[10px] font-mono text-gray-500">
              +{job.skills_required.length - 5}
            </span>
          )}
        </div>
      )}

      {/* Footer row */}
      <div className="flex items-center gap-2 mt-auto">
        <span className={clsx("text-[10px] font-mono px-2 py-0.5 rounded-full", SOURCE_COLORS[job.source] ?? "bg-gray-100 text-gray-500")}>
          {job.source}
        </span>
        <span className={clsx("text-[10px] font-mono px-2 py-0.5 rounded-full", STATUS_COLORS[job.status] ?? "bg-gray-100 text-gray-500")}>
          {job.status}
        </span>
        {job.discovered_at && (
          <span className="text-[10px] text-gray-500 ml-auto">
            {formatDistanceToNow(new Date(job.discovered_at), { addSuffix: true })}
          </span>
        )}

        <a
          href={job.source_url}
          target="_blank"
          rel="noopener noreferrer"
          className="p-1 text-gray-500 hover:text-gray-900 transition-colors"
          title="Open original listing"
        >
          <ExternalLink size={12} />
        </a>

        {job.status === "scored" && (
          <button
            onClick={() => applyMutation.mutate()}
            disabled={applyMutation.isPending}
            className="flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 bg-brand-500 hover:bg-brand-600 text-white rounded-lg transition-colors disabled:opacity-50"
          >
            <Zap size={10} />
            {applyMutation.isPending ? "..." : "Apply"}
          </button>
        )}
      </div>
    </div>
  );
}

const STATUS_FILTERS = ["all", "scored", "applied", "screening", "interview", "offer", "rejected"];

export default function JobsPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [remoteOnly, setRemoteOnly] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["jobs", { search, status: statusFilter, remote: remoteOnly }],
    queryFn: () =>
      jobsApi.list({
        search: search || undefined,
        status: statusFilter === "all" ? undefined : statusFilter,
        remote: remoteOnly || undefined,
        page_size: 50,
      }),
    placeholderData: (prev) => prev,
  });

  const jobs = data?.results ?? [];

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex flex-col flex-1 overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-7xl mx-auto">
            {/* Page header */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-xl font-medium tracking-tight">Jobs</h1>
                <p className="text-sm text-gray-500 font-mono mt-0.5">
                  {data?.count ?? 0} discovered
                </p>
              </div>
            </div>

            {/* Filters */}
            <div className="flex items-center gap-3 mb-5 flex-wrap">
              {/* Search */}
              <div className="relative flex-1 min-w-56">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                  type="text"
                  placeholder="Search title, company, skills..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-brand-400"
                />
              </div>

              {/* Status filters */}
              <div className="flex gap-1">
                {STATUS_FILTERS.map((s) => (
                  <button
                    key={s}
                    onClick={() => setStatusFilter(s)}
                    className={clsx(
                      "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                      statusFilter === s
                        ? "bg-brand-500 text-white"
                        : "bg-gray-100 text-gray-500 hover:text-gray-900",
                    )}
                  >
                    {s}
                  </button>
                ))}
              </div>

              {/* Remote toggle */}
              <button
                onClick={() => setRemoteOnly((v) => !v)}
                className={clsx(
                  "px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors",
                  remoteOnly
                    ? "border-emerald-500 text-emerald-700 bg-emerald-50"
                    : "border-gray-200 text-gray-500 hover:text-gray-900",
                )}
              >
                Remote only
              </button>
            </div>

            {/* Job grid */}
            {isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {Array.from({ length: 9 }).map((_, i) => (
                  <div key={i} className="h-48 rounded-xl bg-gray-100 animate-pulse" />
                ))}
              </div>
            ) : jobs.length === 0 ? (
              <div className="text-center py-20 text-gray-500">
                <Briefcase size={32} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm">No jobs match your filters</p>
                <p className="text-xs mt-1">Try scraping to discover new listings</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {jobs.map((job) => <JobCard key={job.id} job={job} />)}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
