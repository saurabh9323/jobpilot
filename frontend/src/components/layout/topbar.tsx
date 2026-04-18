"use client";

import { useState } from "react";
import { Play, Pause, RefreshCw } from "lucide-react";
import { clsx } from "clsx";
import { scraperApi } from "@/lib/api";
import toast from "react-hot-toast";

export function TopBar() {
  const [engineRunning, setEngineRunning] = useState(false);
  const [scraping, setScraping] = useState(false);

  async function triggerScrape() {
    setScraping(true);
    try {
      await scraperApi.trigger("all");
      toast.success("Scraper started — jobs will appear in real time");
    } catch {
      toast.error("Failed to start scraper");
    } finally {
      setScraping(false);
    }
  }

  return (
    <header className="h-14 border-b border-gray-200 flex items-center px-6 gap-4 shrink-0 bg-white/50 backdrop-blur-sm">
      {/* Engine toggle */}
      <button
        onClick={() => setEngineRunning((v) => !v)}
        className={clsx(
          "flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-medium border transition-all",
          engineRunning
            ? "bg-brand-500 border-brand-600 text-white"
            : "bg-white border-gray-200 text-gray-500 hover:border-brand-400 hover:text-brand-600",
        )}
      >
        {engineRunning ? (
          <>
            <Pause size={12} />
            Engine running
            <span className="w-1.5 h-1.5 rounded-full bg-white/80 animate-pulse" />
          </>
        ) : (
          <>
            <Play size={12} />
            Start engine
          </>
        )}
      </button>

      {/* Manual scrape trigger */}
      <button
        onClick={triggerScrape}
        disabled={scraping}
        className={clsx(
          "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border transition-all",
          "text-gray-500 border-gray-200 hover:border-gray-200/80 hover:text-gray-900",
          scraping && "opacity-50 cursor-not-allowed",
        )}
      >
        <RefreshCw size={11} className={scraping ? "animate-spin" : ""} />
        Scrape now
      </button>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Quick stats pill */}
      <div className="flex items-center gap-4 text-xs font-mono text-gray-500">
        <span>2,840 discovered</span>
        <span className="text-border">·</span>
        <span>127 applied</span>
        <span className="text-border">·</span>
        <span className="text-green-600 font-medium">3 offers</span>
      </div>
    </header>
  );
}
