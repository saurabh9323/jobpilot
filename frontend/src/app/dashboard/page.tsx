import { Sidebar } from "@/components/layout/sidebar";
import { TopBar } from "@/components/layout/topbar";
import { FunnelCard } from "@/components/dashboard/funnel-card";
import { TopMatchesCard } from "@/components/dashboard/top-matches-card";
import { EngineStatusCard } from "@/components/dashboard/engine-status-card";
import { RecentActivityCard } from "@/components/dashboard/recent-activity-card";

export default function DashboardPage() {
  return (
    <div className="flex h-screen overflow-hidden bg-white">
      <Sidebar />

      <div className="flex flex-col flex-1 overflow-hidden">
        <TopBar />

        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-7xl mx-auto space-y-6">

            {/* Page header */}
            <div>
              <h1 className="text-xl font-medium tracking-tight">Dashboard</h1>
              <p className="text-sm text-gray-500 font-mono mt-0.5">
                autonomous job hunt · live feed
              </p>
            </div>

            {/* Top row: Engine status + quick stats */}
            <EngineStatusCard />

            {/* Middle row: funnel + top matches */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              <FunnelCard />
              <TopMatchesCard />
            </div>

            {/* Bottom: recent activity */}
            <RecentActivityCard />
          </div>
        </main>
      </div>
    </div>
  );
}
