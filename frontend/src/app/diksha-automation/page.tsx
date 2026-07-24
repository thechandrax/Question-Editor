"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "https://question-editor-production-b815.up.railway.app";

type Stage = "form" | "progress";
type StatusType = { running: boolean; status: string; step: string; progress: number; started_at: string | null; logs: string[] };

const STEP_KEYWORDS: { keywords: string[]; label: string; icon: string }[] = [
  { keywords: ["starting", "launching", "bot"], label: "Launching bot on Railway", icon: "🚀" },
  { keywords: ["login", "authenticat", "signing"], label: "Authenticating with DIKSHA", icon: "🔐" },
  { keywords: ["course", "navig", "diksha", "explore", "learning"], label: "Navigating to courses", icon: "🌐" },
  { keywords: ["incomplete", "scanning", "check"], label: "Scanning incomplete modules", icon: "🔍" },
  { keywords: ["playing", "video", "module", "content"], label: "Playing module content", icon: "▶️" },
  { keywords: ["pdf", "document", "reading"], label: "Reading PDF material", icon: "📄" },
  { keywords: ["assessment", "quiz", "question"], label: "Completing assessment", icon: "📝" },
  { keywords: ["completed", "finished", "done", "next module"], label: "Module completed", icon: "✅" },
];

function inferStep(logs: string[]): number {
  const combined = logs.slice(-30).join(" ").toLowerCase();
  for (let i = STEP_KEYWORDS.length - 1; i >= 0; i--) {
    if (STEP_KEYWORDS[i].keywords.some((k) => combined.includes(k))) return i;
  }
  return 0;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export default function DikshaAutomationPage() {
  const [stage, setStage] = useState<Stage>("form");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [status, setStatus] = useState<StatusType | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [currentStepIdx, setCurrentStepIdx] = useState(0);
  const logRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  useEffect(() => {
    if (stage !== "progress") return;
    setElapsed(0);

    timerRef.current = setInterval(() => setElapsed((p) => p + 1), 1000);

    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`${BACKEND}/api/diksha/status`);
        if (!res.ok) return;
        const data: StatusType = await res.json();
        setStatus(data);
        setCurrentStepIdx(inferStep(data.logs));
        if (data.status === "done" || data.status === "error") stopPolling();
      } catch { /* network hiccup — keep polling */ }
    }, 2500);

    return stopPolling;
  }, [stage, stopPolling]);

  // Auto-scroll logs
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [status?.logs]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    if (!username || !password) { setFormError("Enter both username and password."); return; }
    setSubmitting(true);
    try {
      const res = await fetch(`${BACKEND}/api/diksha/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to start");
      setStage("progress");
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Connection failed. Is Railway backend live?");
    } finally {
      setSubmitting(false);
    }
  };

  /* ── FORM VIEW ────────────────────────────────────────────────────── */
  if (stage === "form") {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="w-full max-w-sm">
          {/* Logo + title */}
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-400 shadow-lg shadow-orange-500/30 mb-3">
              <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>
            </div>
            <h1 className="text-xl font-bold text-white tracking-tight">DIKSHA Automation</h1>
            <p className="text-xs text-slate-400 mt-1">Cloud bot — completes your courses in the background</p>
          </div>

          {/* Card */}
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5 shadow-xl">
            {formError && (
              <div className="mb-4 bg-red-500/10 border border-red-500/30 rounded-xl px-3 py-2 flex gap-2 items-start">
                <span className="text-red-400 text-xs mt-0.5">⚠</span>
                <p className="text-red-400 text-xs leading-relaxed">{formError}</p>
              </div>
            )}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="dik-user" className="block text-xs font-semibold text-slate-300 mb-1.5">Username / Mobile</label>
                <input id="dik-user" type="text" required placeholder="e.g. 9876543210"
                  value={username} onChange={(e) => setUsername(e.target.value)} disabled={submitting}
                  className="w-full bg-slate-700 border border-slate-600 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent disabled:opacity-40 transition-all" />
              </div>
              <div>
                <label htmlFor="dik-pass" className="block text-xs font-semibold text-slate-300 mb-1.5">Password</label>
                <input id="dik-pass" type="password" required placeholder="Your DIKSHA password"
                  value={password} onChange={(e) => setPassword(e.target.value)} disabled={submitting}
                  className="w-full bg-slate-700 border border-slate-600 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent disabled:opacity-40 transition-all" />
              </div>
              <button type="submit" disabled={submitting}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-orange-500/20 transition-all focus:outline-none focus:ring-2 focus:ring-orange-500">
                {submitting ? (
                  <><svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>Connecting…</>
                ) : (
                  <><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="6 3 20 12 6 21 6 3"/></svg>Start Automation</>
                )}
              </button>
            </form>
          </div>

          {/* Footer note */}
          <p className="text-center text-xs text-slate-500 mt-4 leading-relaxed">
            🔒 Runs on Railway cloud · You can close this page safely
          </p>
        </div>
      </div>
    );
  }

  /* ── PROGRESS VIEW ────────────────────────────────────────────────── */
  const isDone = status?.status === "done";
  const isError = status?.status === "error";
  const progress = status?.progress ?? 5;
  const step = status?.step || "Starting bot…";
  const logs = status?.logs ?? [];

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center py-8 px-4">
      <div className="w-full max-w-2xl space-y-4">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-orange-500 to-amber-400 flex items-center justify-center shadow-lg shadow-orange-500/30">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>
            </div>
            <div>
              <h1 className="text-sm font-bold text-white">DIKSHA Automation</h1>
              <p className="text-xs text-slate-400">Running on Railway</p>
            </div>
          </div>
          {/* Status badge */}
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border ${
            isDone ? "bg-green-500/10 border-green-500/30 text-green-400"
            : isError ? "bg-red-500/10 border-red-500/30 text-red-400"
            : "bg-orange-500/10 border-orange-500/30 text-orange-400"
          }`}>
            {!isDone && !isError && <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse"/>}
            {isDone ? "✅ Done" : isError ? "❌ Error" : "⚙ Running"}
          </div>
        </div>

        {/* Server info bar */}
        <div className="bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-slate-300">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"/>
            <span className="font-mono text-slate-400 truncate max-w-[200px]">question-editor-production-b815.up.railway.app</span>
          </div>
          <div className="flex items-center gap-3 text-slate-400">
            <span>⏱ {formatTime(elapsed)}</span>
            {status?.started_at && <span className="hidden sm:inline">{new Date(status.started_at).toLocaleTimeString()}</span>}
          </div>
        </div>

        {/* Progress bar */}
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 space-y-2">
          <div className="flex justify-between text-xs text-slate-400 mb-1">
            <span className="font-medium text-white truncate pr-2">{step}</span>
            <span className="flex-shrink-0 font-bold text-orange-400">{progress}%</span>
          </div>
          <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-1000 ${isDone ? "bg-green-500" : isError ? "bg-red-500" : "bg-gradient-to-r from-orange-500 to-amber-400"}`}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Steps list */}
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Bot Steps</p>
          <div className="space-y-1.5">
            {STEP_KEYWORDS.map((s, i) => {
              const done = isDone ? true : i < currentStepIdx;
              const active = !isDone && i === currentStepIdx;
              return (
                <div key={i} className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs transition-all ${
                  active ? "bg-orange-500/10 border border-orange-500/20"
                  : done ? "opacity-60"
                  : "opacity-30"
                }`}>
                  <span className="text-sm">{done ? "✅" : active ? "⚙️" : "⏳"}</span>
                  <span className={active ? "font-semibold text-orange-300" : done ? "text-slate-300 line-through" : "text-slate-500"}>
                    {s.icon} {s.label}
                  </span>
                  {active && <span className="ml-auto text-orange-400 animate-pulse">●</span>}
                </div>
              );
            })}
          </div>
        </div>

        {/* Live terminal logs */}
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Live Server Logs</p>
            <span className="text-xs text-slate-500">{logs.length} lines</span>
          </div>
          <div ref={logRef} className="bg-slate-950 rounded-lg p-3 h-48 overflow-y-auto font-mono text-xs text-slate-300 space-y-0.5 border border-slate-800">
            {logs.length === 0 ? (
              <p className="text-slate-600 italic">Waiting for logs from Railway server…</p>
            ) : (
              logs.map((line, i) => {
                const isWarn = line.includes("[WARNING]") || line.includes("[WARN]");
                const isErr = line.includes("[ERROR]") || line.includes("[CRITICAL]");
                const isInfo = line.includes("[INFO]");
                return (
                  <p key={i} className={`leading-relaxed ${isErr ? "text-red-400" : isWarn ? "text-yellow-400" : isInfo ? "text-green-300" : "text-slate-400"}`}>
                    {line}
                  </p>
                );
              })
            )}
          </div>
        </div>

        {/* Done / Error message */}
        {isDone && (
          <div className="bg-green-500/10 border border-green-500/30 rounded-xl px-4 py-3 text-center">
            <p className="text-green-400 font-bold text-sm">🎉 All courses completed successfully!</p>
            <p className="text-green-500/70 text-xs mt-1">DIKSHA progress has been saved. You can close this page.</p>
            <button onClick={() => { setStage("form"); setStatus(null); setElapsed(0); }}
              className="mt-3 text-xs px-4 py-1.5 rounded-lg bg-green-500/20 hover:bg-green-500/30 text-green-400 border border-green-500/30 transition-all">
              Run Again
            </button>
          </div>
        )}
        {isError && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-center">
            <p className="text-red-400 font-bold text-sm">❌ Automation stopped with an error</p>
            <p className="text-red-500/70 text-xs mt-1 font-mono">{step}</p>
            <button onClick={() => { setStage("form"); setStatus(null); setElapsed(0); }}
              className="mt-3 text-xs px-4 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 transition-all">
              Try Again
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
