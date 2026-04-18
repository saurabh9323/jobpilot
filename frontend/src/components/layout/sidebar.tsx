"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Briefcase,
  BarChart3,
  Brain,
  Settings,
  Zap,
  BookOpen,
  ChevronRight,
} from "lucide-react";
import { clsx } from "clsx";
import { useSocket } from "@/components/providers";

const NAV_ITEMS = [
  { href: "/dashboard",          label: "Dashboard",      icon: LayoutDashboard },
  { href: "/dashboard/jobs",     label: "Jobs",           icon: Briefcase },
  { href: "/dashboard/analytics",label: "Analytics",      icon: BarChart3 },
  { href: "/dashboard/ai-brain", label: "AI Brain",       icon: Brain },
  { href: "/dashboard/interview",label: "Interview Prep", icon: BookOpen },
  { href: "/dashboard/settings", label: "Settings",       icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const { connected } = useSocket();

  return (
    <aside className="w-56 border-r border-border flex flex-col shrink-0 bg-card">
      {/* Logo */}
      <div className="px-5 py-4 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-brand-500 flex items-center justify-center">
            <Zap size={14} className="text-white" />
          </div>
          <span className="font-semibold text-[15px] tracking-tight">JobPilot AI</span>
        </div>
        <p className="text-[10px] font-mono text-muted-foreground mt-1">v1.0 · week 1</p>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-3 space-y-0.5">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={clsx(
                "flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors",
                active
                  ? "bg-brand-50 text-brand-700 font-medium"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted",
              )}
            >
              <Icon size={15} />
              {label}
              {active && <ChevronRight size={12} className="ml-auto opacity-40" />}
            </Link>
          );
        })}
      </nav>

      {/* Engine status footer */}
      <div className="px-4 py-3 border-t border-border">
        <div className="flex items-center gap-2">
          <span
            className={clsx(
              "w-2 h-2 rounded-full",
              connected ? "bg-green-500 animate-pulse" : "bg-muted-foreground",
            )}
          />
          <span className="text-[11px] font-mono text-muted-foreground">
            {connected ? "engine live" : "connecting..."}
          </span>
        </div>
      </div>
    </aside>
  );
}
