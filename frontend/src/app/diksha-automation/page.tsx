"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";

type Stage = "form" | "dashboard";

interface Course {
  title: string;
  progress: number;
  status: "pending" | "running" | "done" | "paused";
  current?: boolean;
}

interface StatusType {
  running: boolean;
  paused: boolean;
  status: string;
  step: string;
  progress: number;
  started_at: string | null;
  courses: Course[];
  current_course: string | null;
  logs: string[];
}

const STEP_KEYWORDS: { keywords: string[]; label: string; icon: string }[] = [
  { keywords: ["starting", "launching", "bot"], label: "Launching bot on Railway", icon: "🚀" },
  { keywords: ["login", "authenticat", "signing", "keycloak"], label: "Authenticating with DIKSHA", icon: "🔐" },
  { keywords: ["course", "navig", "diksha", "explore", "learning", "listing"], label: "Navigating to course listing", icon: "🌐" },
  { keywords: ["incomplete", "scanning", "check"], label: "Scanning incomplete modules", icon: "🔍" },
  { keywords: ["playing", "video", "module", "content", "opening"], label: "Playing module content", icon: "▶️" },
  { keywords: ["pdf", "document", "reading", "scrolling"], label: "Reading PDF material", icon: "📄" },
  { keywords: ["assessment", "quiz", "question"], label: "Completing assessment", icon: "📝" },
  { keywords: ["completed", "finished", "done", "next module"], label: "Module / Course completed", icon: "✅" },
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
  const [activeTab, setActiveTab] = useState<"all" | "ongoing" | "finished">("ongoing");
  const [actionLoading, setActionLoading] = useState(false);

  const logRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  useEffect(() => {
    if (stage !== "dashboard") return;

    timerRef.current = setInterval(() => setElapsed((p) => p + 1), 1000);

    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch("/api/diksha/status");
        if (!res.ok) return;
        const data: StatusType = await res.json();
        setStatus(data);
        setCurrentStepIdx(inferStep(data.logs || []));
        if (data.status === "done" || data.status === "error" || data.status === "stopped") {
          // Keep dashboard visible so user can see final results
        }
      } catch {
        /* silent catch for network polling */
      }
    }, 2000);

    return stopPolling;
  }, [stage, stopPolling]);

  // Auto-scroll logs terminal
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [status?.logs]);

  const handleStartAutomation = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setFormError("");
    if (!username || !password) {
      setFormError("Please enter your DIKSHA username and password.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/diksha/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to start automation.");
      setStage("dashboard");
      setElapsed(0);
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Connection failed to backend.");
    } finally {
      setSubmitting(false);
    }
  };

  const handlePauseToggle = async () => {
    setActionLoading(true);
    try {
      await fetch("/api/diksha/pause", { method: "POST" });
    } catch {
      /* silent */
    } finally {
      setActionLoading(false);
    }
  };

  const handleStop = async () => {
    if (!confirm("Are you sure you want to stop the automation?")) return;
    setActionLoading(true);
    try {
      await fetch("/api/diksha/stop", { method: "POST" });
    } catch {
      /* silent */
    } finally {
      setActionLoading(false);
    }
  };

  /* ── 1. LOGIN / CREDENTIALS FORM VIEW ──────────────────────────────── */
  if (stage === "form") {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 relative overflow-hidden font-sans">
        {/* Glowing background decor */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-orange-600/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-10 right-10 w-72 h-72 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />

        <div className="w-full max-w-md relative z-10">
          {/* Header */}
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-orange-600 via-amber-500 to-yellow-400 p-0.5 shadow-xl shadow-orange-500/20 mb-3">
              <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>
              </div>
            </div>
            <h1 className="text-2xl font-black text-white tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
              DIKSHA Automation Hub
            </h1>
            <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
              Cloud-powered course auto-completer &amp; learning tracker
            </p>
          </div>

          {/* Form Card */}
          <div className="bg-slate-900/90 border border-slate-800 backdrop-blur-xl rounded-2xl p-6 shadow-2xl shadow-black/50">
            {formError && (
              <div className="mb-5 bg-red-500/10 border border-red-500/30 rounded-xl p-3 flex gap-2.5 items-start">
                <span className="text-red-400 text-sm mt-0.5">⚠️</span>
                <p className="text-red-300 text-xs leading-relaxed">{formError}</p>
              </div>
            )}

            <form onSubmit={handleStartAutomation} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
                  DIKSHA Username / Mobile
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. borkej@smanthaai.online or Mobile No."
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={submitting}
                  className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/80 disabled:opacity-50 transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
                  Password
                </label>
                <input
                  type="password"
                  required
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={submitting}
                  className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/80 disabled:opacity-50 transition-all"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full mt-2 flex items-center justify-center gap-2.5 py-3 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-orange-500 via-amber-500 to-yellow-500 hover:from-orange-600 hover:to-amber-600 shadow-lg shadow-orange-500/25 disabled:opacity-50 transition-all focus:outline-none focus:ring-2 focus:ring-orange-500 cursor-pointer"
              >
                {submitting ? (
                  <>
                    <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                    <span>Authenticating &amp; Starting...</span>
                  </>
                ) : (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                    <span>Start Automation &amp; Track Courses</span>
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Security footnote */}
          <div className="mt-5 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
            <span>🔒 Runs 100% cloud side on Railway</span>
            <span>•</span>
            <span>No data stored</span>
          </div>
        </div>
      </div>
    );
  }

  /* ── 2. DASHBOARD VIEW (LIVE CONTROL & COURSE LISTING) ──────────────── */
  const isRunning = status?.running ?? true;
  const isPaused = status?.paused ?? false;
  const isDone = status?.status === "done";
  const isStopped = status?.status === "stopped";
  const isError = status?.status === "error";
  const overallProgress = status?.progress ?? 5;
  const currentStepMsg = status?.step || "Initializing cloud bot...";
  const coursesList = status?.courses || [];
  const logsList = status?.logs || [];

  const ongoingCourses = coursesList.filter((c) => c.status !== "done");
  const finishedCourses = coursesList.filter((c) => c.status === "done");

  const displayedCourses =
    activeTab === "ongoing"
      ? ongoingCourses
      : activeTab === "finished"
      ? finishedCourses
      : coursesList;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 py-6 px-4 font-sans">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* ── Top Header Navigation Bar ──────────────────────────────── */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4 backdrop-blur-md shadow-xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-orange-500 to-amber-400 p-0.5 shadow-md shadow-orange-500/20">
              <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold text-white">DIKSHA Learning Journey</h1>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700 font-mono">
                  Cloud Backend
                </span>
              </div>
              <p className="text-xs text-slate-400">User: <span className="text-orange-400 font-medium">{username || "Logged In"}</span></p>
            </div>
          </div>

          {/* Controls: Pause, Resume, Stop, New Session */}
          <div className="flex items-center gap-2 flex-wrap">
            {isRunning && (
              <>
                <button
                  onClick={handlePauseToggle}
                  disabled={actionLoading}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition-all ${
                    isPaused
                      ? "bg-amber-500/20 border-amber-500/40 text-amber-300 hover:bg-amber-500/30"
                      : "bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700"
                  }`}
                >
                  {isPaused ? "▶ Resume" : "⏸ Pause"}
                </button>

                <button
                  onClick={handleStop}
                  disabled={actionLoading}
                  className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 transition-all"
                >
                  ⏹ Stop Bot
                </button>
              </>
            )}

            <button
              onClick={() => setStage("form")}
              className="px-3.5 py-1.5 rounded-xl text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-all"
            >
              🔄 Change User
            </button>
          </div>
        </div>

        {/* ── Status Banner & Overall Progress ──────────────────────── */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className={`w-3 h-3 rounded-full ${
                isDone ? "bg-emerald-400 shadow-lg shadow-emerald-500/50" :
                isPaused ? "bg-amber-400 shadow-lg shadow-amber-500/50" :
                isStopped ? "bg-slate-500" :
                isError ? "bg-red-400 shadow-lg shadow-red-500/50" :
                "bg-orange-500 animate-pulse shadow-lg shadow-orange-500/50"
              }`} />
              <div>
                <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Current Activity</p>
                <p className="text-sm font-bold text-white mt-0.5">{currentStepMsg}</p>
              </div>
            </div>

            <div className="flex items-center gap-4 text-xs font-mono text-slate-400">
              <div>⏱ Elapsed: <span className="text-white font-semibold">{formatTime(elapsed)}</span></div>
              <div className="text-orange-400 font-bold text-base">{overallProgress}%</div>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-slate-950 rounded-full h-3 p-0.5 border border-slate-800 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ${
                isDone ? "bg-gradient-to-r from-emerald-500 to-teal-400" :
                isPaused ? "bg-amber-500" :
                isError ? "bg-red-500" :
                "bg-gradient-to-r from-orange-500 via-amber-500 to-yellow-400"
              }`}
              style={{ width: `${overallProgress}%` }}
            />
          </div>
        </div>

        {/* ── Enrolled Courses Section ──────────────────────────────── */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <span>📚 My Enrolled Courses</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-400 border border-orange-500/20 font-normal">
                  {coursesList.length} Found
                </span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">Click any course to automate specifically or run all automatically</p>
            </div>

            {/* Course Filter Tabs */}
            <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
              <button
                onClick={() => setActiveTab("ongoing")}
                className={`px-3 py-1 rounded-lg font-medium transition-all ${
                  activeTab === "ongoing"
                    ? "bg-orange-500 text-white font-semibold shadow-md shadow-orange-500/20"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Ongoing ({ongoingCourses.length})
              </button>
              <button
                onClick={() => setActiveTab("finished")}
                className={`px-3 py-1 rounded-lg font-medium transition-all ${
                  activeTab === "finished"
                    ? "bg-orange-500 text-white font-semibold shadow-md shadow-orange-500/20"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Finished ({finishedCourses.length})
              </button>
              <button
                onClick={() => setActiveTab("all")}
                className={`px-3 py-1 rounded-lg font-medium transition-all ${
                  activeTab === "all"
                    ? "bg-orange-500 text-white font-semibold shadow-md shadow-orange-500/20"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                All ({coursesList.length})
              </button>
            </div>
          </div>

          {/* Courses Cards Grid */}
          {displayedCourses.length === 0 ? (
            <div className="py-10 text-center text-slate-500 text-xs space-y-2">
              <p className="text-2xl">📖</p>
              <p>Scanning DIKSHA account for enrolled courses...</p>
              <p className="text-[11px] text-slate-600">Courses will populate automatically as the bot navigates your profile.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {displayedCourses.map((course, idx) => (
                <div
                  key={idx}
                  className={`bg-slate-950/80 border rounded-xl p-4 flex flex-col justify-between transition-all ${
                    course.current
                      ? "border-orange-500/70 shadow-lg shadow-orange-500/10 ring-1 ring-orange-500/30"
                      : course.status === "done"
                      ? "border-emerald-500/30 opacity-80"
                      : "border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-xs font-bold text-white leading-snug line-clamp-2">
                        {course.title}
                      </h3>
                      <span className={`shrink-0 text-[10px] px-2 py-0.5 rounded-full font-medium ${
                        course.status === "done"
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                          : course.current
                          ? "bg-orange-500/20 text-orange-300 border border-orange-500/40 animate-pulse"
                          : "bg-slate-800 text-slate-400"
                      }`}>
                        {course.status === "done" ? "✓ 100% Done" : course.current ? "▶ Running" : "Pending"}
                      </span>
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between text-[11px] text-slate-400">
                        <span>Progress</span>
                        <span className="font-semibold text-slate-200">{course.progress}%</span>
                      </div>
                      <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            course.status === "done" ? "bg-emerald-400" : "bg-orange-500"
                          }`}
                          style={{ width: `${course.progress}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-2 border-t border-slate-900 flex justify-between items-center text-[11px]">
                    <span className="text-slate-500">Auto-detected module</span>
                    <button
                      onClick={() => handleStartAutomation()}
                      disabled={isRunning && !isPaused}
                      className="px-2.5 py-1 rounded-lg bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 font-medium transition-all disabled:opacity-30"
                    >
                      {course.status === "done" ? "Re-Run" : "Automate This"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Bot Workflow Steps & Server Log Console Grid ──────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Left: Workflow Steps */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-3">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              ⚙️ Bot Execution Steps
            </h3>
            <div className="space-y-2">
              {STEP_KEYWORDS.map((s, i) => {
                const isStepDone = isDone ? true : i < currentStepIdx;
                const isStepActive = !isDone && i === currentStepIdx;
                return (
                  <div
                    key={i}
                    className={`flex items-center gap-3 p-2.5 rounded-xl border text-xs transition-all ${
                      isStepActive
                        ? "bg-orange-500/10 border-orange-500/30 text-orange-300 font-medium shadow-sm"
                        : isStepDone
                        ? "bg-slate-950/40 border-slate-800/80 text-slate-400"
                        : "bg-slate-950/20 border-slate-900 text-slate-600"
                    }`}
                  >
                    <span className="text-sm">{isStepDone ? "✅" : isStepActive ? "⚙️" : "⏳"}</span>
                    <span className="flex-1">{s.icon} {s.label}</span>
                    {isStepActive && (
                      <span className="w-2 h-2 rounded-full bg-orange-400 animate-ping" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right: Real-time Cloud Logs Terminal */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col justify-between space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                <span>💻 Live Railway Server Logs</span>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              </h3>
              <span className="text-[11px] text-slate-500 font-mono">{logsList.length} lines</span>
            </div>

            <div
              ref={logRef}
              className="bg-slate-950 border border-slate-800/90 rounded-xl p-3 h-64 overflow-y-auto font-mono text-[11px] leading-relaxed space-y-1 text-slate-300 shadow-inner"
            >
              {logsList.length === 0 ? (
                <p className="text-slate-600 italic">Waiting for log records from Railway backend...</p>
              ) : (
                logsList.map((line, idx) => {
                  const isErr = line.includes("[ERROR]") || line.includes("[CRITICAL]");
                  const isWarn = line.includes("[WARNING]") || line.includes("[WARN]");
                  const isInfo = line.includes("[INFO]");
                  return (
                    <p
                      key={idx}
                      className={
                        isErr
                          ? "text-red-400"
                          : isWarn
                          ? "text-amber-400"
                          : isInfo
                          ? "text-emerald-300/90"
                          : "text-slate-400"
                      }
                    >
                      {line}
                    </p>
                  );
                })
              )}
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
