"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { authApi } from "@/lib/api";
import axios from "axios";
import { Sidebar } from "@/components/layout/sidebar";
import { TopBar } from "@/components/layout/topbar";
import { clsx } from "clsx";
import toast from "react-hot-toast";

interface Profile {
  current_role: string;
  target_roles: string[];
  years_experience: number;
  skills: string[];
  salary_floor: number;
  salary_ceiling: number;
  preferred_locations: string[];
  remote_only: boolean;
  auto_apply: boolean;
  auto_outreach: boolean;
  resume_text: string;
}

function Toggle({
  label,
  sub,
  value,
  onChange,
}: {
  label: string;
  sub?: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-border last:border-0">
      <div>
        <p className="text-sm font-medium">{label}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </div>
      <button
        onClick={() => onChange(!value)}
        className={clsx(
          "w-9 h-5 rounded-full relative transition-colors border",
          value ? "bg-brand-500 border-brand-600" : "bg-muted border-border",
        )}
      >
        <span
          className={clsx(
            "absolute top-0.5 w-3.5 h-3.5 rounded-full bg-white transition-transform shadow-sm",
            value ? "translate-x-[18px]" : "translate-x-0.5",
          )}
        />
      </button>
    </div>
  );
}

function TagInput({
  label,
  values,
  onChange,
  placeholder,
}: {
  label: string;
  values: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
}) {
  const [input, setInput] = useState("");

  function add() {
    const v = input.trim();
    if (v && !values.includes(v)) onChange([...values, v]);
    setInput("");
  }

  return (
    <div>
      <label className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-1.5 block">
        {label}
      </label>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {values.map((v) => (
          <span
            key={v}
            className="flex items-center gap-1 text-xs bg-brand-50 text-brand-700 px-2 py-0.5 rounded-full font-mono"
          >
            {v}
            <button onClick={() => onChange(values.filter((x) => x !== v))} className="opacity-60 hover:opacity-100">×</button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), add())}
          placeholder={placeholder ?? "Type and press Enter"}
          className="flex-1 text-sm px-3 py-1.5 border border-border rounded-lg bg-background focus:outline-none focus:ring-1 focus:ring-brand-400"
        />
        <button
          onClick={add}
          className="px-3 py-1.5 text-sm bg-muted hover:bg-muted/80 rounded-lg border border-border transition-colors"
        >
          Add
        </button>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const djangoUrl = process.env.NEXT_PUBLIC_DJANGO_URL ?? "http://localhost:8000";
  const qc = useQueryClient();

  const { data: user } = useQuery({
    queryKey: ["me"],
    queryFn: () => axios.get(`${djangoUrl}/api/users/me/`, { withCredentials: true }).then((r) => r.data),
  });

  const [profile, setProfile] = useState<Partial<Profile>>({});

  // Merge server data into local state on first load
  const merged: Profile = {
    current_role: "",
    target_roles: [],
    years_experience: 0,
    skills: [],
    salary_floor: 15,
    salary_ceiling: 60,
    preferred_locations: [],
    remote_only: false,
    auto_apply: false,
    auto_outreach: false,
    resume_text: "",
    ...user?.profile,
    ...profile,
  };

  const saveMutation = useMutation({
    mutationFn: () =>
      axios.patch(`${djangoUrl}/api/users/me/`, merged, { withCredentials: true }),
    onSuccess: () => {
      toast.success("Profile saved");
      qc.invalidateQueries({ queryKey: ["me"] });
    },
    onError: () => toast.error("Failed to save"),
  });

  function set<K extends keyof Profile>(key: K, value: Profile[K]) {
    setProfile((p) => ({ ...p, [key]: value }));
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex flex-col flex-1 overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-2xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl font-medium">Settings</h1>
                <p className="text-sm text-muted-foreground font-mono mt-0.5">AI brain profile + automation</p>
              </div>
              <button
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending}
                className="px-4 py-2 text-sm bg-brand-500 hover:bg-brand-600 text-white rounded-lg transition-colors disabled:opacity-50"
              >
                {saveMutation.isPending ? "Saving..." : "Save changes"}
              </button>
            </div>

            {/* Career section */}
            <section className="border border-border rounded-xl p-5 space-y-4 bg-card">
              <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Career profile</p>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-1.5 block">
                    Current role
                  </label>
                  <input
                    value={merged.current_role}
                    onChange={(e) => set("current_role", e.target.value)}
                    className="w-full text-sm px-3 py-1.5 border border-border rounded-lg bg-background focus:outline-none focus:ring-1 focus:ring-brand-400"
                    placeholder="e.g. Senior Backend Engineer"
                  />
                </div>
                <div>
                  <label className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-1.5 block">
                    Years of experience
                  </label>
                  <input
                    type="number"
                    value={merged.years_experience}
                    onChange={(e) => set("years_experience", parseInt(e.target.value))}
                    className="w-full text-sm px-3 py-1.5 border border-border rounded-lg bg-background focus:outline-none focus:ring-1 focus:ring-brand-400"
                  />
                </div>
              </div>

              <TagInput
                label="Target roles"
                values={merged.target_roles}
                onChange={(v) => set("target_roles", v)}
                placeholder="e.g. Staff Engineer"
              />

              <TagInput
                label="Skills"
                values={merged.skills}
                onChange={(v) => set("skills", v)}
                placeholder="e.g. Python, Django, PostgreSQL"
              />

              <TagInput
                label="Preferred locations"
                values={merged.preferred_locations}
                onChange={(v) => set("preferred_locations", v)}
                placeholder="e.g. Bengaluru, Remote"
              />
            </section>

            {/* Salary section */}
            <section className="border border-border rounded-xl p-5 bg-card">
              <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-4">
                Salary range (₹ lakhs/yr)
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Floor (min)</label>
                  <input
                    type="number"
                    value={merged.salary_floor}
                    onChange={(e) => set("salary_floor", parseInt(e.target.value))}
                    className="w-full text-sm px-3 py-1.5 border border-border rounded-lg bg-background focus:outline-none focus:ring-1 focus:ring-brand-400"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Ceiling (target)</label>
                  <input
                    type="number"
                    value={merged.salary_ceiling}
                    onChange={(e) => set("salary_ceiling", parseInt(e.target.value))}
                    className="w-full text-sm px-3 py-1.5 border border-border rounded-lg bg-background focus:outline-none focus:ring-1 focus:ring-brand-400"
                  />
                </div>
              </div>
            </section>

            {/* Automation toggles */}
            <section className="border border-border rounded-xl p-5 bg-card">
              <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-2">
                Automation
              </p>
              <Toggle
                label="Auto-apply"
                sub="Automatically submit applications for jobs with AI score ≥ 80%"
                value={merged.auto_apply}
                onChange={(v) => set("auto_apply", v)}
              />
              <Toggle
                label="Auto HR outreach"
                sub="Send personalised cold emails to HR contacts after applying"
                value={merged.auto_outreach}
                onChange={(v) => set("auto_outreach", v)}
              />
              <Toggle
                label="Remote only"
                sub="Skip all on-site listings"
                value={merged.remote_only}
                onChange={(v) => set("remote_only", v)}
              />
            </section>

            {/* Resume text */}
            <section className="border border-border rounded-xl p-5 bg-card">
              <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-3">
                Resume text (used for AI scoring)
              </p>
              <textarea
                rows={10}
                value={merged.resume_text}
                onChange={(e) => set("resume_text", e.target.value)}
                placeholder="Paste your resume text here. The AI uses this to compute match scores, generate cover letters, and identify ATS gaps."
                className="w-full text-sm px-3 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-1 focus:ring-brand-400 font-mono resize-none"
              />
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}
