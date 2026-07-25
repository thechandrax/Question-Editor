"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";

type Stage = "login" | "dashboard";

interface Course {
  title: string;
  ends_on?: string;
  pct?: number;
  progress: number;
  url: string;
  status: "ongoing" | "finished" | "pending" | "running" | "done";
  image_url?: string;
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
  const [stage, setStage] = useState<Stage>("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");

  const [scanning, setScanning] = useState(false);
  const [scanMessage, setScanMessage] = useState("");
  const [courses, setCourses] = useState<Course[]>([]);
  const [hasScanned, setHasScanned] = useState(false);
  const [activeTab, setActiveTab] = useState<"ongoing" | "finished">("ongoing");

  const [status, setStatus] = useState<StatusType | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [currentStepIdx, setCurrentStepIdx] = useState(0);
  const [actionLoading, setActionLoading] = useState(false);
  const [automatingCourseUrl, setAutomatingCourseUrl] = useState<string | null>(null);

  const logRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  // Polling for status when dashboard is active
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
        if (data.courses && data.courses.length > 0) {
          setCourses(data.courses);
          setHasScanned(true);
        }
      } catch {
        /* silent polling error */
      }
    }, 2000);

    return stopPolling;
  }, [stage, stopPolling]);

  // Auto-scroll log console
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [status?.logs]);

  // Step 1: Simple Login -> Opens Dashboard
  const handleSimpleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");
    if (!username || !password) {
      setLoginError("Please enter your DIKSHA username and password.");
      return;
    }
    setStage("dashboard");
    setElapsed(0);
  };

  // Step 2: Click "Scan Enrolled Courses" on Dashboard
  const handleScanCourses = async () => {
    setScanning(true);
    setScanMessage("Authenticating & scanning DIKSHA account for courses...");
    try {
      const res = await fetch("/api/diksha/fetch-courses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to scan enrolled courses.");

      const fetchedList: Course[] = data.courses || [];
      setCourses(fetchedList);
      setHasScanned(true);
      setScanMessage(`Scan complete! Found ${fetchedList.length} course(s).`);
    } catch (err: unknown) {
      setScanMessage(err instanceof Error ? err.message : "Error scanning courses.");
    } finally {
      setScanning(false);
    }
  };

  // Step 3: Start Automation (All courses or specific target_course_url)
  const handleStartAutomation = async (targetUrl?: string) => {
    setActionLoading(true);
    setAutomatingCourseUrl(targetUrl || "all");
    try {
      const res = await fetch("/api/diksha/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username,
          password,
          target_course_url: targetUrl || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to start automation.");
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Error starting automation.");
    } finally {
      setActionLoading(false);
      setAutomatingCourseUrl(null);
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
    if (!confirm("Are you sure you want to stop the current automation?")) return;
    setActionLoading(true);
    try {
      await fetch("/api/diksha/stop", { method: "POST" });
    } catch {
      /* silent */
    } finally {
      setActionLoading(false);
    }
  };

  /* ── 1. SIMPLE LOGIN VIEW ───────────────────────────────────────────── */
  if (stage === "login") {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 relative overflow-hidden font-sans text-slate-100">
        {/* Glow backdrop */}
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
              DIKSHA Automation Portal
            </h1>
            <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
              Login to access your dashboard &amp; scan enrolled courses
            </p>
          </div>

          {/* Form Card */}
          <div className="bg-slate-900/90 border border-slate-800 backdrop-blur-xl rounded-2xl p-6 shadow-2xl shadow-black/50">
            {loginError && (
              <div className="mb-5 bg-red-500/10 border border-red-500/30 rounded-xl p-3 flex gap-2.5 items-start">
                <span className="text-red-400 text-sm mt-0.5">⚠️</span>
                <p className="text-red-300 text-xs leading-relaxed">{loginError}</p>
              </div>
            )}

            <form onSubmit={handleSimpleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
                  DIKSHA Username / Mobile
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. borkej@smanthaai.online"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/80 transition-all"
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
                  className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/80 transition-all"
                />
              </div>

              <button
                type="submit"
                className="w-full mt-2 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-orange-600 via-amber-500 to-yellow-500 hover:from-orange-700 hover:to-amber-600 shadow-lg shadow-orange-500/25 transition-all focus:outline-none focus:ring-2 focus:ring-orange-500 cursor-pointer"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>
                <span>Login to Dashboard</span>
              </button>
            </form>
          </div>

          <div className="mt-5 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
            <span>🔒 Secure Keycloak Authentication</span>
          </div>
        </div>
      </div>
    );
  }

  /* ── 2. DASHBOARD VIEW (SCAN ENROLLED COURSES + COURSES LIST) ────────── */
  const isRunning = status?.running ?? false;
  const isPaused = status?.paused ?? false;
  const isDone = status?.status === "done";
  const isStopped = status?.status === "stopped";
  const isError = status?.status === "error";
  const overallProgress = status?.progress ?? 0;
  const currentStepMsg = status?.step || "Idle - Click 'Scan Enrolled Courses' to discover your courses";
  const logsList = status?.logs || [];

  const ongoingCourses = courses.filter((c) => (c.status === "ongoing" || (c.pct ?? c.progress ?? 0) < 100));
  const finishedCourses = courses.filter((c) => (c.status === "finished" || (c.pct ?? c.progress ?? 0) === 100));

  const displayedCourses = activeTab === "ongoing" ? ongoingCourses : finishedCourses;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 py-6 px-4 font-sans">
      <div className="max-w-6xl mx-auto space-y-6">

        {/* Top Header Navigation Bar */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4 backdrop-blur-md shadow-xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-orange-500 to-amber-400 p-0.5 shadow-md shadow-orange-500/20">
              <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold text-white">DIKSHA Courses Dashboard</h1>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-400 border border-orange-500/20 font-mono">
                  {username || "User Account"}
                </span>
              </div>
              <p className="text-xs text-slate-400">My Learning Journey &amp; Course Automation</p>
            </div>
          </div>

          {/* Controls Header */}
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
              onClick={() => { setStage("login"); setCourses([]); setHasScanned(false); }}
              className="px-3.5 py-1.5 rounded-xl text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-all"
            >
              🚪 Logout
            </button>
          </div>
        </div>

        {/* Status Banner (When Automation is Active or Finished) */}
        {isRunning || isDone || isStopped || isError ? (
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
                  <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Bot Status</p>
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
        ) : null}

        {/* Main Section: My Learning Journey */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">

          {/* Section Header with "Scan Enrolled Courses" Button */}
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
            <div>
              <h2 className="text-xl font-bold text-white tracking-tight">My Learning Journey</h2>
              <p className="text-xs text-slate-400 mt-1">
                Home &gt; My Learning Journey
              </p>
            </div>

            {/* Action Buttons: Scan Enrolled Courses & Start All Automation */}
            <div className="flex items-center gap-3 flex-wrap">
              <button
                onClick={handleScanCourses}
                disabled={scanning || isRunning}
                className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg shadow-indigo-500/20 disabled:opacity-40 transition-all flex items-center gap-2 cursor-pointer"
              >
                {scanning ? (
                  <>
                    <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                    <span>Scanning Courses...</span>
                  </>
                ) : (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                    <span>🔍 Scan Enrolled Courses</span>
                  </>
                )}
              </button>

              {hasScanned && (
                <button
                  onClick={() => handleStartAutomation()}
                  disabled={isRunning || actionLoading || ongoingCourses.length === 0}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-orange-600 via-amber-500 to-yellow-500 hover:from-orange-700 hover:to-amber-600 shadow-lg shadow-orange-500/20 disabled:opacity-40 transition-all flex items-center gap-2 cursor-pointer"
                >
                  {actionLoading && automatingCourseUrl === "all" ? (
                    <span>Starting All...</span>
                  ) : (
                    <>
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                      <span>🚀 Start All Automation ({ongoingCourses.length})</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>

          {/* Scan Status Toast Message */}
          {scanMessage && (
            <div className={`p-3 rounded-xl text-xs flex items-center gap-2 border ${
              scanning
                ? "bg-blue-500/10 border-blue-500/30 text-blue-300"
                : scanMessage.includes("Error")
                ? "bg-red-500/10 border-red-500/30 text-red-300"
                : "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
            }`}>
              <span>{scanning ? "⚙️" : scanMessage.includes("Error") ? "❌" : "✅"}</span>
              <p className="font-medium">{scanMessage}</p>
            </div>
          )}

          {/* DIKSHA Style Tab Buttons: Ongoing Courses vs Finished Courses */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setActiveTab("ongoing")}
              className={`px-5 py-2 rounded-xl text-xs font-bold transition-all border ${
                activeTab === "ongoing"
                  ? "bg-amber-900/80 border-amber-600 text-amber-200 shadow-md shadow-amber-900/40 ring-1 ring-amber-500/40"
                  : "bg-slate-950 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700"
              }`}
            >
              Ongoing Courses ({ongoingCourses.length})
            </button>

            <button
              onClick={() => setActiveTab("finished")}
              className={`px-5 py-2 rounded-xl text-xs font-bold transition-all border ${
                activeTab === "finished"
                  ? "bg-amber-900/80 border-amber-600 text-amber-200 shadow-md shadow-amber-900/40 ring-1 ring-amber-500/40"
                  : "bg-slate-950 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700"
              }`}
            >
              Finished Courses ({finishedCourses.length})
            </button>
          </div>

          {/* Course Cards Grid */}
          {!hasScanned && !scanning ? (
            <div className="py-14 text-center text-slate-500 text-xs space-y-3 bg-slate-950/50 rounded-2xl border border-slate-800/60 p-6">
              <div className="w-16 h-16 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mx-auto text-2xl">
                🔍
              </div>
              <p className="text-sm font-bold text-white">Click &quot;Scan Enrolled Courses&quot; to fetch your courses</p>
              <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
                The bot will log in to DIKSHA and extract your enrolled courses under Ongoing and Finished tabs.
              </p>
              <button
                onClick={handleScanCourses}
                className="mt-2 px-6 py-2.5 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-500/20 transition-all inline-flex items-center gap-2 cursor-pointer"
              >
                <span>🔍 Scan Enrolled Courses Now</span>
              </button>
            </div>
          ) : displayedCourses.length === 0 ? (
            <div className="py-12 text-center text-slate-500 text-xs space-y-2 bg-slate-950/50 rounded-2xl border border-slate-800/60">
              <p className="text-3xl">📚</p>
              <p className="font-semibold text-slate-300">No {activeTab} courses found in this category.</p>
              <p className="text-[11px] text-slate-500">
                Click &quot;Scan Enrolled Courses&quot; above to re-scan.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-5">
              {displayedCourses.map((c, idx) => {
                const currentPct = c.pct ?? c.progress ?? 0;
                const isFinished = currentPct === 100 || c.status === "finished";

                return (
                  <div
                    key={idx}
                    className={`bg-slate-950 border rounded-2xl overflow-hidden flex flex-col justify-between transition-all duration-300 ${
                      c.current
                        ? "border-orange-500 shadow-lg shadow-orange-500/10 ring-2 ring-orange-500/30"
                        : isFinished
                        ? "border-slate-800 opacity-90 hover:border-emerald-500/40"
                        : "border-slate-800 hover:border-amber-500/40"
                    }`}
                  >
                    {/* Image Preview Banner */}
                    <div className="w-full h-36 bg-gradient-to-br from-slate-900 to-slate-950 flex items-center justify-center p-4 relative border-b border-slate-800/80 overflow-hidden">
                      {c.image_url ? (
                        /* eslint-disable-next-html-element-for-img */
                        <img
                          src={c.image_url}
                          alt={c.title}
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <div className="flex flex-col items-center justify-center text-center space-y-2">
                          <div className="w-12 h-12 rounded-full bg-orange-500/10 border border-orange-500/20 flex items-center justify-center">
                            <span className="text-2xl">🎓</span>
                          </div>
                          <span className="text-[10px] text-slate-500 font-medium">DIKSHA Digital Learning</span>
                        </div>
                      )}

                      {/* Status Tag Badge */}
                      <div className="absolute top-3 right-3">
                        <span className={`text-[10px] px-2.5 py-1 rounded-full font-bold shadow-md ${
                          isFinished
                            ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                            : c.current
                            ? "bg-orange-500/30 text-orange-200 border border-orange-500/50 animate-pulse"
                            : "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                        }`}>
                          {isFinished ? "✓ 100% Completed" : c.current ? "▶ Automating Now" : `${currentPct}% Completed`}
                        </span>
                      </div>
                    </div>

                    {/* Card Content Body */}
                    <div className="p-5 space-y-3 flex-1 flex flex-col justify-between">
                      <div className="space-y-2">
                        <h3 className="text-xs font-bold text-white leading-relaxed line-clamp-2">
                          Course Title : <span className="text-slate-200 font-semibold">{c.title}</span>
                        </h3>

                        {c.ends_on && (
                          <p className="text-[11px] text-slate-400 font-medium">
                            Ends on : <span className="text-slate-300">{c.ends_on}</span>
                          </p>
                        )}
                      </div>

                      {/* Course Progress Bar */}
                      <div className="space-y-1.5 pt-2">
                        <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-slate-800">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              isFinished
                                ? "bg-emerald-400"
                                : "bg-gradient-to-r from-emerald-500 via-amber-500 to-orange-500"
                            }`}
                            style={{ width: `${currentPct}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-[10px] text-slate-400 font-medium">
                          <span>Progress</span>
                          <span className={isFinished ? "text-emerald-400 font-bold" : "text-orange-400 font-bold"}>
                            {currentPct}% Completed
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Card Footer Actions: View Course + Start Automation */}
                    <div className="px-5 py-3.5 bg-slate-900/60 border-t border-slate-800/80 flex items-center justify-between gap-2">
                      <a
                        href={c.url}
                        target="_blank"
                        rel="noreferrer"
                        className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700 transition-all flex items-center gap-1.5"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                        <span>View Course</span>
                      </a>

                      <button
                        onClick={() => handleStartAutomation(c.url)}
                        disabled={isRunning || actionLoading || isFinished}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm ${
                          isFinished
                            ? "bg-slate-800 text-slate-500 border border-slate-700 opacity-50 cursor-not-allowed"
                            : "bg-gradient-to-r from-orange-600 to-amber-500 hover:from-orange-700 hover:to-amber-600 text-white shadow-orange-500/20 cursor-pointer"
                        }`}
                      >
                        {automatingCourseUrl === c.url ? (
                          <span>Starting...</span>
                        ) : (
                          <>
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                            <span>{isFinished ? "Completed" : "Start Automation"}</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Bot Workflow Steps & Server Log Console */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Left: Workflow Steps */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-3">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              ⚙️ Bot Execution Steps
            </h3>
            <div className="space-y-2">
              {STEP_KEYWORDS.map((s, i) => {
                const isStepDone = isDone ? true : i < currentStepIdx;
                const isStepActive = isRunning && i === currentStepIdx;
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

          {/* Right: Live Railway Server Console */}
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
