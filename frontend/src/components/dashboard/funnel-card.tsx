"use client";

import { useQuery } from "@tanstack/react-query";
import { jobsApi, FunnelStats } from "@/lib/api";
import { clsx } from "clsx";

const FUNNEL_STAGES = [
  { key: "discovered",  label: "Discovered",  color: "#C4C0F9", width: 100 },
  { key: "scored",      label: "AI Scored",   color: "#9B95F5", width: 85  },
  { key: "applied",     label: "Applied",     color: "#7F77DD", width: 60  },
  { key: "screening",   label: "Screening",   color: "#059669", width: 35  },
  { key: "interview",   label: "Interview",   color: "#D97706", width: 20  },
  { key: "offer",       label: "Offer",       color: "#16A34A", width: 8   },
] as const;

function FunnelBar({
  label,
  count,
  color,
  widthPct,
}: {
  label: string;
  count: number;
  color: string;
  widthPct: number;
}) {
  return (
    <div className="flex items-center gap-3 py-1">
      <div
        className="h-7 rounded flex items-center px-3 transition-all duration-700"
        style={{ width: `${widthPct}%`, backgroundColor: color, minWidth: 80 }}
      >
        <span className="text-xs font-medium text-white truncate">{label}</span>
      </div>
      <span className="text-sm font-mono text-gray-500 tabular-nums">
        {count.toLocaleString()}
      </span>
    </div>
  );
}

export function FunnelCard() {
  const { data, isLoading } = useQuery({
    queryKey: ["funnel"],
    queryFn: jobsApi.funnel,
    refetchInterval: 60_000,
  });

  const total = data?.discovered ?? 1;

  return (
    <div className="border border-gray-200 rounded-xl p-5 bg-white">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-[10px] font-mono font-medium uppercase tracking-widest text-gray-500">
            Application Funnel
          </p>
          <h3 className="text-sm font-medium mt-0.5">Full pipeline overview</h3>
        </div>
        {data && (
          <div className="text-right">
            <p className="text-xl font-medium tabular-nums">{data.offer ?? 0}</p>
            <p className="text-xs text-gray-500">offers</p>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-2 animate-pulse">
          {[100, 85, 60, 35, 20, 8].map((w, i) => (
            <div key={i} className="h-7 rounded bg-gray-100" style={{ width: `${w}%` }} />
          ))}
        </div>
      ) : (
        <div className="space-y-1">
          {FUNNEL_STAGES.map(({ key, label, color, width }) => {
            const count = data?.[key as keyof FunnelStats] ?? 0;
            const scaledWidth = (count / total) * 100;
            // Use max of computed and minimum visual width so even small counts are visible
            const displayWidth = Math.max((scaledWidth / 100) * width + width * 0.1, 8);
            return (
              <FunnelBar
                key={key}
                label={label}
                count={count}
                color={color}
                widthPct={Math.min(displayWidth, 100)}
              />
            );
          })}
        </div>
      )}

      {data && (
        <p className="text-xs text-gray-500 font-mono mt-4">
          conversion: {((data.offer / Math.max(data.applied, 1)) * 100).toFixed(1)}% offer rate
        </p>
      )}
    </div>
  );
}
