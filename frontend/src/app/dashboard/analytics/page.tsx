"use client";

import { useQuery } from "@tanstack/react-query";
import { jobsApi, applicationsApi } from "@/lib/api";
import { Sidebar } from "@/components/layout/sidebar";
import { TopBar } from "@/components/layout/topbar";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";

const PORTAL_COLORS: Record<string, string> = {
  linkedin:  "#0077B5",
  naukri:    "#FF7555",
  indeed:    "#003A9B",
  wellfound: "#E8504A",
  instahyre: "#00BCD4",
  direct:    "#6B7280",
};

// Mock weekly data — replace with real API call in Week 2
const WEEKLY_DATA = [
  { week: "Apr 1", applied: 18, responses: 2 },
  { week: "Apr 8", applied: 24, responses: 5 },
  { week: "Apr 15", applied: 31, responses: 8 },
  { week: "Apr 22", applied: 22, responses: 4 },
  { week: "Apr 29", applied: 32, responses: 11 },
];

function StatBox({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="border border-gray-200 rounded-xl p-5 bg-white">
      <p className="text-[10px] font-mono uppercase tracking-widest text-gray-500 mb-1">{label}</p>
      <p className="text-2xl font-medium tabular-nums">{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}
    </div>
  );
}

export default function AnalyticsPage() {
  const { data: funnel } = useQuery({ queryKey: ["funnel"], queryFn: jobsApi.funnel });
  const { data: appSummary } = useQuery({ queryKey: ["app-summary"], queryFn: applicationsApi.summary });

  const total = funnel?.discovered ?? 0;
  const applied = funnel?.applied ?? 0;
  const offer = funnel?.offer ?? 0;
  const offerRate = applied > 0 ? ((offer / applied) * 100).toFixed(1) : "0.0";
  const responseRate = applied > 0
    ? ((((funnel?.screening ?? 0) + (funnel?.interview ?? 0) + offer) / applied) * 100).toFixed(1)
    : "0.0";

  // Build portal breakdown from funnel (mock — real data comes from scrape_runs in Week 2)
  const portalData = [
    { name: "LinkedIn",  value: Math.round(total * 0.45) },
    { name: "Naukri",    value: Math.round(total * 0.30) },
    { name: "Indeed",    value: Math.round(total * 0.15) },
    { name: "Wellfound", value: Math.round(total * 0.07) },
    { name: "Instahyre", value: Math.round(total * 0.03) },
  ];

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex flex-col flex-1 overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-7xl mx-auto space-y-6">
            <div>
              <h1 className="text-xl font-medium tracking-tight">Analytics</h1>
              <p className="text-sm text-gray-500 font-mono mt-0.5">full funnel performance</p>
            </div>

            {/* KPI row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatBox label="Discovered"   value={total.toLocaleString()} sub="all portals" />
              <StatBox label="Applied"       value={applied}               sub="auto + manual" />
              <StatBox label="Response rate" value={`${responseRate}%`}    sub="screen + interview + offer" />
              <StatBox label="Offers"        value={offer}                 sub={`${offerRate}% offer rate`} />
            </div>

            {/* Charts row */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              {/* Weekly applications bar chart */}
              <div className="border border-gray-200 rounded-xl p-5 bg-white">
                <p className="text-[10px] font-mono uppercase tracking-widest text-gray-500 mb-1">
                  Weekly Activity
                </p>
                <h3 className="text-sm font-medium mb-4">Applications + responses per week</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={WEEKLY_DATA} barGap={4}>
                    <XAxis dataKey="week" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e7eb" }}
                    />
                    <Bar dataKey="applied"   fill="#7F77DD" radius={[4, 4, 0, 0]} name="Applied" />
                    <Bar dataKey="responses" fill="#10B981" radius={[4, 4, 0, 0]} name="Responses" />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Portal breakdown pie chart */}
              <div className="border border-gray-200 rounded-xl p-5 bg-white">
                <p className="text-[10px] font-mono uppercase tracking-widest text-gray-500 mb-1">
                  Portal Breakdown
                </p>
                <h3 className="text-sm font-medium mb-4">Jobs discovered by source</h3>
                <div className="flex items-center justify-center">
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie
                        data={portalData}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={90}
                        paddingAngle={3}
                        dataKey="value"
                        nameKey="name"
                      >
                        {portalData.map((entry) => (
                          <Cell
                            key={entry.name}
                            fill={PORTAL_COLORS[entry.name.toLowerCase()] ?? "#9B95F5"}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ fontSize: 12, borderRadius: 8 }}
                        formatter={(v: number) => [v.toLocaleString(), "Jobs"]}
                      />
                      <Legend
                        iconSize={10}
                        iconType="circle"
                        formatter={(v) => <span style={{ fontSize: 11 }}>{v}</span>}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Funnel conversion table */}
            <div className="border border-gray-200 rounded-xl p-5 bg-white">
              <p className="text-[10px] font-mono uppercase tracking-widest text-gray-500 mb-1">
                Conversion Table
              </p>
              <h3 className="text-sm font-medium mb-4">Stage-by-stage drop-off</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-gray-500 font-mono border-b border-gray-200">
                      <th className="pb-2 font-medium">Stage</th>
                      <th className="pb-2 font-medium tabular-nums text-right">Count</th>
                      <th className="pb-2 font-medium tabular-nums text-right">From prev</th>
                      <th className="pb-2 font-medium tabular-nums text-right">From total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {[
                      { stage: "Discovered",  key: "discovered" },
                      { stage: "AI Scored",   key: "scored" },
                      { stage: "Applied",     key: "applied" },
                      { stage: "Screening",   key: "screening" },
                      { stage: "Interview",   key: "interview" },
                      { stage: "Offer",       key: "offer" },
                    ].map(({ stage, key }, idx, arr) => {
                      const count = funnel?.[key as keyof typeof funnel] ?? 0;
                      const prev = idx > 0 ? (funnel?.[arr[idx - 1].key as keyof typeof funnel] ?? 0) : count;
                      const fromPrev = prev > 0 ? ((count / prev) * 100).toFixed(0) : "—";
                      const fromTotal = total > 0 ? ((count / total) * 100).toFixed(1) : "—";
                      return (
                        <tr key={key}>
                          <td className="py-2.5">{stage}</td>
                          <td className="py-2.5 text-right tabular-nums font-mono">{count.toLocaleString()}</td>
                          <td className="py-2.5 text-right tabular-nums font-mono text-gray-500">{fromPrev}%</td>
                          <td className="py-2.5 text-right tabular-nums font-mono text-gray-500">{fromTotal}%</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
