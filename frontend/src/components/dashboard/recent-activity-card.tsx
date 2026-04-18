"use client";

import { useQuery } from "@tanstack/react-query";
import { scraperApi } from "@/lib/api";
import { Activity, CheckCircle2, Clock, XCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface ScrapeRun {
  id: number;
  portal: string;
  status: "running" | "done" | "failed";
  jobs_found: number;
  jobs_new: number;
  started_at: string;
  finished_at: string | null;
  error: string;
}

const STATUS_ICON: Record<string, React.ReactNode> = {
  done:    <CheckCircle2 size={14} className="text-green-500" />,
  running: <Clock        size={14} className="text-amber-500 animate-pulse" />,
  failed:  <XCircle      size={14} className="text-red-500" />,
};

const PORTAL_LABELS: Record<string, string> = {
  linkedin:  "LinkedIn",
  naukri:    "Naukri",
  indeed:    "Indeed",
  wellfound: "Wellfound",
  instahyre: "Instahyre",
};

export function RecentActivityCard() {
  const { data, isLoading } = useQuery<{ results: ScrapeRun[] }>({
    queryKey: ["scrape-runs"],
    queryFn: scraperApi.runs,
    refetchInterval: 30_000,
  });

  const runs = data?.results?.slice(0, 8) ?? [];

  return (
    <div className="border border-gray-200 rounded-xl p-5 bg-white">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-[10px] font-mono font-medium uppercase tracking-widest text-gray-500">
            Scrape History
          </p>
          <h3 className="text-sm font-medium mt-0.5">Recent portal runs</h3>
        </div>
        <Activity size={15} className="text-gray-500" />
      </div>

      {isLoading ? (
        <div className="space-y-2 animate-pulse">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-10 bg-gray-100 rounded-lg" />
          ))}
        </div>
      ) : runs.length === 0 ? (
        <p className="text-sm text-gray-500 py-6 text-center">
          No scrape runs yet — click &quot;Scrape now&quot; or wait for the scheduled run
        </p>
      ) : (
        <div className="space-y-1">
          {runs.map((run) => (
            <div
              key={run.id}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-100 transition-colors"
            >
              {STATUS_ICON[run.status] ?? STATUS_ICON.running}

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">
                    {PORTAL_LABELS[run.portal] ?? run.portal}
                  </span>
                  {run.status === "done" && (
                    <span className="text-xs font-mono text-gray-500">
                      +{run.jobs_new} new / {run.jobs_found} found
                    </span>
                  )}
                  {run.status === "failed" && (
                    <span className="text-xs text-red-500 truncate max-w-[180px]">
                      {run.error}
                    </span>
                  )}
                </div>
              </div>

              <span className="text-[11px] font-mono text-gray-500 shrink-0">
                {formatDistanceToNow(new Date(run.started_at), { addSuffix: true })}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
