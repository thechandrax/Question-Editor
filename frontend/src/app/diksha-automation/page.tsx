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

/* ─── SVG Icons ────────────────────────────────────────────────────────── */
const IconGraduate = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/>
  </svg>
);
const IconLogin = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/>
  </svg>
);
const IconScan = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
  </svg>
);
const IconPlay = ({ size = 12 }: { size?: number }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <polygon points="5 3 19 12 5 21 5 3"/>
  </svg>
);
const IconExternal = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
  </svg>
);
const IconSpinner = () => (
  <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
  </svg>
);
const IconCheck = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);

/* ─── Main Component ───────────────────────────────────────────────────── */
export default function DikshaAutomationPage() {
  const [stage, setStage] = useState<Stage>("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginVerified, setLoginVerified] = useState(false);

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
  const [showLogs, setShowLogs] = useState(false);

  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [courseDetails, setCourseDetails] = useState<any | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [detailsError, setDetailsError] = useState("");

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
        if (data.courses && data.courses.length > 0) {
          setCourses(data.courses);
          setHasScanned(true);
        }
      } catch { /* silent */ }
    }, 2000);
    return stopPolling;
  }, [stage, stopPolling]);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [status?.logs]);

  const handleSimpleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");
    if (!username || !password) {
      setLoginError("Please enter your DIKSHA username and password.");
      return;
    }
    setLoginLoading(true);
    setLoginVerified(false);
    try {
      const res = await fetch("/api/diksha/verify-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (data.valid) {
        setLoginVerified(true);
        // Brief success flash before opening dashboard
        setTimeout(() => {
          setLoginLoading(false);
          setLoginVerified(false);
          setStage("dashboard");
          setElapsed(0);
        }, 900);
      } else {
        setLoginError(data.message || "Invalid credentials. Please try again.");
        setLoginLoading(false);
      }
    } catch {
      setLoginError("Could not reach the server. Please check your internet connection.");
      setLoginLoading(false);
    }
  };

  const handleScanCourses = async () => {
    setScanning(true);
    setScanMessage("🔐 Authenticating & scanning DIKSHA account... (may take 60-90 seconds)");
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 150000); // 150s timeout
    try {
      const res = await fetch("/api/diksha/fetch-courses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to scan enrolled courses.");
      const ongoing: Course[] = (data.ongoing || []).map((c: Course) => ({ ...c, status: "ongoing" }));
      const finished: Course[] = (data.finished || []).map((c: Course) => ({ ...c, status: "finished" }));
      const fetchedList: Course[] = [...ongoing, ...finished];
      setCourses(fetchedList);
      setHasScanned(true);
      if (fetchedList.length === 0) {
        setScanMessage("⚠️ Scan complete but no courses found. Check Railway logs for details.");
      } else {
        setScanMessage(`✅ Scan complete! Found ${ongoing.length} ongoing + ${finished.length} finished course(s).`);
      }
    } catch (err: unknown) {
      clearTimeout(timeout);
      if (err instanceof Error && err.name === "AbortError") {
        setScanMessage("⏱️ Scan timed out after 150s. Railway may be starting up — try again in 30 seconds.");
      } else {
        setScanMessage(err instanceof Error ? `❌ ${err.message}` : "❌ Error scanning courses.");
      }
    } finally {
      setScanning(false);
    }
  };

  const handleStartAutomation = async (targetUrl?: string) => {
    setActionLoading(true);
    setAutomatingCourseUrl(targetUrl || "all");
    try {
      const res = await fetch("/api/diksha/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, target_course_url: targetUrl || null }),
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
    try { await fetch("/api/diksha/pause", { method: "POST" }); } catch { /* silent */ }
    finally { setActionLoading(false); }
  };

  const handleStop = async () => {
    if (!confirm("Stop the current automation?")) return;
    setActionLoading(true);
    try { await fetch("/api/diksha/stop", { method: "POST" }); } catch { /* silent */ }
    finally { setActionLoading(false); }
  };

  const handleViewCourseDetails = async (course: Course) => {
    setSelectedCourse(course);
    setCourseDetails(null);
    setDetailsError("");
    setDetailsLoading(true);
    setShowDetailsModal(true);

    try {
      const res = await fetch("/api/diksha/course-details", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, course_url: course.url }),
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to load course details.");
      if (data.success === false) throw new Error(data.error || "Failed to scrape course details.");
      setCourseDetails(data);
    } catch (err: unknown) {
      setDetailsError(err instanceof Error ? err.message : "Error fetching course details.");
    } finally {
      setDetailsLoading(false);
    }
  };

  /* ─── LOGIN PAGE ──────────────────────────────────────────────────────── */
  if (stage === "login") {
    return (
      <>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap');
          .diksha-root * { font-family: 'Plus Jakarta Sans', sans-serif; box-sizing: border-box; }
          @keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-10px)} }
          @keyframes glow-pulse { 0%,100%{opacity:0.25} 50%{opacity:0.55} }
          .float-anim { animation: float 6s ease-in-out infinite; }
          .glow-orb { animation: glow-pulse 4s ease-in-out infinite; }
          .glass-card {
            background: #ffffff;
            border: 1px solid #e2e8f0;
            box-shadow: 0 25px 60px -15px rgba(79, 70, 229, 0.12), 0 10px 25px -5px rgba(0, 0, 0, 0.04);
          }
          .input-field {
            background: #f8fafc;
            border: 1.5px solid #cbd5e1;
            color: #0f172a;
            width: 100%;
            padding: 14px 16px;
            border-radius: 14px;
            font-size: 15px;
            font-weight: 500;
            outline: none;
            transition: all 0.2s ease;
          }
          .input-field:focus { border-color: #4f46e5; background: #ffffff; box-shadow: 0 0 0 4px rgba(79, 70, 229, 0.15); }
          .input-field::placeholder { color: #94a3b8; }
          .btn-primary {
            width: 100%;
            padding: 15px;
            border-radius: 14px;
            font-weight: 800;
            font-size: 15px;
            color: white;
            background: linear-gradient(135deg, #4f46e5 0%, #6366f1 50%, #7c3aed 100%);
            border: none;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            transition: all 0.25s ease;
            box-shadow: 0 10px 28px rgba(79, 70, 229, 0.35);
          }
          .btn-primary:hover { transform: translateY(-2px); box-shadow: 0 16px 36px rgba(79, 70, 229, 0.45); }
          .btn-primary:active { transform: translateY(0); }
        `}</style>
        <div className="diksha-root" style={{minHeight:'100vh',background:'linear-gradient(135deg, #f8fafc 0%, #eef2ff 50%, #f1f5f9 100%)',display:'flex',alignItems:'center',justifyContent:'center',padding:'24px',position:'relative',overflow:'hidden'}}>
          {/* Animated background glowing gradient orbs */}
          <div className="glow-orb" style={{position:'absolute',top:'5%',left:'15%',width:'550px',height:'550px',background:'radial-gradient(circle,rgba(99,102,241,0.20) 0%,transparent 70%)',borderRadius:'50%',pointerEvents:'none'}}/>
          <div className="glow-orb" style={{position:'absolute',bottom:'5%',right:'10%',width:'450px',height:'450px',background:'radial-gradient(circle,rgba(124,58,237,0.15) 0%,transparent 70%)',borderRadius:'50%',pointerEvents:'none',animationDelay:'2s'}}/>

          {/* Grid pattern overlay */}
          <div style={{position:'absolute',inset:0,backgroundImage:'linear-gradient(rgba(99,102,241,0.04) 1px,transparent 1px),linear-gradient(90deg,rgba(99,102,241,0.04) 1px,transparent 1px)',backgroundSize:'48px 48px',pointerEvents:'none'}}/>

          <div style={{width:'100%',maxWidth:'460px',position:'relative',zIndex:10}}>
            {/* Logo & Title */}
            <div className="float-anim" style={{textAlign:'center',marginBottom:'36px'}}>
              <div style={{display:'inline-flex',alignItems:'center',justifyContent:'center',width:'80px',height:'80px',borderRadius:'24px',background:'linear-gradient(135deg,#4f46e5,#7c3aed)',padding:'3px',boxShadow:'0 18px 44px rgba(79,70,229,0.35)',marginBottom:'22px'}}>
                <div style={{width:'100%',height:'100%',background:'#ffffff',borderRadius:'21px',display:'flex',alignItems:'center',justifyContent:'center',color:'#4f46e5'}}>
                  <IconGraduate/>
                </div>
              </div>
              <h1 style={{fontSize:'32px',fontWeight:'800',color:'#0f172a',margin:'0 0 8px',letterSpacing:'-0.5px'}}>
                DIKSHA Automation
              </h1>
              <p style={{color:'#64748b',fontSize:'15px',margin:0,lineHeight:'1.6',fontWeight:'600'}}>
                Ultra Pro Course Automation Platform
              </p>
            </div>

            {/* Glass Card */}
            <div className="glass-card" style={{borderRadius:'28px',padding:'38px'}}>
              {loginError && (
                <div style={{marginBottom:'22px',background:'#fef2f2',border:'1px solid #fecaca',borderRadius:'14px',padding:'14px 18px',display:'flex',gap:'12px',alignItems:'flex-start'}}>
                  <span style={{fontSize:'18px'}}>⚠️</span>
                  <p style={{color:'#dc2626',fontSize:'13px',margin:0,lineHeight:'1.5',fontWeight:'700'}}>{loginError}</p>
                </div>
              )}

              <form onSubmit={handleSimpleLogin} style={{display:'flex',flexDirection:'column',gap:'22px'}}>
                <div>
                  <label style={{display:'block',fontSize:'12px',fontWeight:'800',color:'#475569',marginBottom:'8px',textTransform:'uppercase',letterSpacing:'0.06em'}}>
                    DIKSHA Username / Mobile
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. teacher@example.com"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="input-field"
                  />
                </div>

                <div>
                  <label style={{display:'block',fontSize:'12px',fontWeight:'800',color:'#475569',marginBottom:'8px',textTransform:'uppercase',letterSpacing:'0.06em'}}>
                    Password
                  </label>
                  <div style={{position:'relative'}}>
                    <input
                      type={showPass ? "text" : "password"}
                      required
                      placeholder="••••••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="input-field"
                      style={{paddingRight:'46px'}}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass(!showPass)}
                      style={{position:'absolute',right:'14px',top:'50%',transform:'translateY(-50%)',background:'none',border:'none',color:'#94a3b8',cursor:'pointer',fontSize:'18px',padding:'4px'}}
                    >
                      {showPass ? '🙈' : '👁️'}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  className="btn-primary"
                  disabled={loginLoading}
                  style={{
                    marginTop: '6px',
                    background: loginVerified
                      ? 'linear-gradient(135deg,#10b981,#059669)'
                      : loginLoading
                      ? 'linear-gradient(135deg,#818cf8,#6366f1)'
                      : undefined,
                    cursor: loginLoading ? 'not-allowed' : 'pointer',
                  }}
                >
                  {loginVerified ? (
                    <>
                      <span style={{fontSize:'18px'}}>✅</span>
                      Verified! Opening Dashboard…
                    </>
                  ) : loginLoading ? (
                    <>
                      <span style={{
                        display:'inline-block',
                        width:'18px', height:'18px',
                        border:'2px solid rgba(255,255,255,0.3)',
                        borderTop:'2px solid #fff',
                        borderRadius:'50%',
                        animation:'spin 0.8s linear infinite',
                        flexShrink:0,
                      }}/>
                      Verifying credentials…
                    </>
                  ) : (
                    <>
                      <IconLogin/>
                      Login to Dashboard
                    </>
                  )}
                </button>
              </form>

              {/* Security note */}
              <div style={{marginTop:'26px',paddingTop:'22px',borderTop:'1px solid #f1f5f9',display:'flex',alignItems:'center',justifyContent:'center',gap:'8px'}}>
                <span style={{fontSize:'14px'}}>🔒</span>
                <span style={{fontSize:'12px',color:'#64748b',fontWeight:'600'}}>Secured via Keycloak SSO · DIKSHA Portal</span>
              </div>
            </div>

            {/* Feature pills */}
            <div style={{display:'flex',justifyContent:'center',gap:'10px',marginTop:'26px',flexWrap:'wrap'}}>
              {['Auto-Login','Course Scan','Progress Track','Pause & Stop'].map((f) => (
                <span key={f} style={{fontSize:'12px',fontWeight:'700',color:'#4338ca',background:'#e0e7ff',border:'1px solid #c7d2fe',borderRadius:'20px',padding:'6px 14px'}}>
                  {f}
                </span>
              ))}
            </div>
          </div>
        </div>
      </>
    );
  }

  /* ─── DASHBOARD ───────────────────────────────────────────────────────── */
  const isRunning = status?.running ?? false;
  const isPaused = status?.paused ?? false;
  const isDone = status?.status === "done";
  const isStopped = status?.status === "stopped";
  const isError = status?.status === "error";
  const overallProgress = status?.progress ?? 0;
  const currentStepMsg = status?.step || "Idle — click 'Scan Enrolled Courses' to begin";
  const logsList = status?.logs || [];

  const ongoingCourses  = courses.filter((c) => c.status === "ongoing");
  const finishedCourses = courses.filter((c) => c.status === "finished");
  const displayedCourses = activeTab === "ongoing" ? ongoingCourses : finishedCourses;

  const statusColor = isDone ? "#10b981" : isPaused ? "#f59e0b" : isStopped ? "#64748b" : isError ? "#ef4444" : "#6366f1";
  const statusLabel = isDone ? "Completed" : isPaused ? "Paused" : isStopped ? "Stopped" : isError ? "Error" : isRunning ? "Running" : "Idle";

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap');
        .dash-root * { font-family: 'Plus Jakarta Sans', sans-serif; box-sizing: border-box; }
        @keyframes pulse-dot { 0%,100%{transform:scale(1);opacity:1} 50%{transform:scale(1.5);opacity:0.7} }
        @keyframes progress-shine { 0%{background-position:-200% 0} 100%{background-position:200% 0} }
        @keyframes fade-in-up { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
        .fade-in-up { animation: fade-in-up 0.35s ease both; }
        .glass-card-light {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          box-shadow: 0 10px 30px -5px rgba(15, 23, 42, 0.05), 0 4px 12px -2px rgba(0, 0, 0, 0.02);
        }
        .card-hover { transition: transform 0.25s ease, border-color 0.25s ease, box-shadow 0.25s ease; }
        .card-hover:hover { transform: translateY(-3px); box-shadow: 0 16px 36px -8px rgba(79, 70, 229, 0.12); }
        .progress-bar-animated {
          background-size: 200% 100%;
          background-image: linear-gradient(90deg, #4f46e5 0%, #8b5cf6 40%, #4f46e5 80%, #8b5cf6 100%);
          animation: progress-shine 2s linear infinite;
        }
        .btn { border:none; cursor:pointer; display:inline-flex; align-items:center; justify-content:center; gap:6px; font-weight:700; border-radius:10px; transition:all 0.2s ease; font-family:'Plus Jakarta Sans',sans-serif; }
        .btn:hover { filter: brightness(1.05); transform: translateY(-1px); }
        .btn:active { transform: translateY(0); }
        .btn:disabled { opacity:0.45; cursor:not-allowed; transform:none; filter:none; }
        .tab-active { background: #4f46e5 !important; border-color: #4f46e5 !important; color: #ffffff !important; box-shadow: 0 4px 14px rgba(79,70,229,0.3) !important; }
        .log-line { padding: 3px 0; font-size:12px; line-height:1.6; font-family:'JetBrains Mono',monospace; }
        ::-webkit-scrollbar { width:6px; height:6px; }
        ::-webkit-scrollbar-track { background: #f1f5f9; }
        ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius:4px; }
      `}</style>

      <div className="dash-root" style={{minHeight:'100vh',background:'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 50%, #e2e8f0 100%)',color:'#0f172a',padding:'24px 16px',position:'relative'}}>
        {/* Subtle grid background */}
        <div style={{position:'fixed',inset:0,backgroundImage:'linear-gradient(rgba(99,102,241,0.03) 1px,transparent 1px),linear-gradient(90deg,rgba(99,102,241,0.03) 1px,transparent 1px)',backgroundSize:'48px 48px',pointerEvents:'none',zIndex:0}}/>
        {/* Top ambient blur */}
        <div style={{position:'fixed',top:'-100px',left:'50%',transform:'translateX(-50%)',width:'800px',height:'300px',background:'radial-gradient(ellipse,rgba(99,102,241,0.10) 0%,transparent 70%)',pointerEvents:'none',zIndex:0}}/>

        <div style={{maxWidth:'1200px',margin:'0 auto',position:'relative',zIndex:1,display:'flex',flexDirection:'column',gap:'20px'}}>

          {/* ── TOP NAVBAR ─────────────────────────────────────────────── */}
          <div className="glass-card-light" style={{borderRadius:'20px',padding:'16px 24px',display:'flex',flexWrap:'wrap',alignItems:'center',justifyContent:'space-between',gap:'16px'}}>
            <div style={{display:'flex',alignItems:'center',gap:'14px'}}>
              <div style={{width:'44px',height:'44px',borderRadius:'14px',background:'linear-gradient(135deg,#4f46e5,#6366f1)',padding:'2px',boxShadow:'0 6px 20px rgba(79,70,229,0.3)',flexShrink:0}}>
                <div style={{width:'100%',height:'100%',background:'#ffffff',borderRadius:'12px',display:'flex',alignItems:'center',justifyContent:'center',color:'#4f46e5'}}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/>
                  </svg>
                </div>
              </div>
              <div>
                <div style={{display:'flex',alignItems:'center',gap:'10px'}}>
                  <h1 style={{margin:0,fontSize:'17px',fontWeight:'800',color:'#0f172a',letterSpacing:'-0.3px'}}>DIKSHA Automation Portal</h1>
                  <span style={{fontSize:'11px',fontWeight:'700',color:'#4f46e5',background:'rgba(99,102,241,0.1)',border:'1px solid rgba(99,102,241,0.2)',borderRadius:'20px',padding:'3px 10px'}}>
                    {username || "User"}
                  </span>
                </div>
                <p style={{margin:'2px 0 0',fontSize:'12px',color:'#64748b',fontWeight:'500'}}>My Learning Journey & Course Automation</p>
              </div>
            </div>

            <div style={{display:'flex',alignItems:'center',gap:'10px',flexWrap:'wrap'}}>
              {/* Status pill */}
              <div style={{display:'flex',alignItems:'center',gap:'8px',background:'#f1f5f9',border:'1px solid #e2e8f0',borderRadius:'20px',padding:'6px 14px'}}>
                <div style={{width:'8px',height:'8px',borderRadius:'50%',background:statusColor,position:'relative',flexShrink:0}}/>
                <span style={{fontSize:'12px',fontWeight:'700',color:statusColor}}>{statusLabel}</span>
              </div>

              {isRunning && (
                <>
                  <button
                    onClick={handlePauseToggle}
                    disabled={actionLoading}
                    className="btn"
                    style={{padding:'8px 16px',fontSize:'12px',background: isPaused ? '#fef3c7' : '#f1f5f9',border:`1px solid ${isPaused ? '#fcd34d' : '#cbd5e1'}`,color: isPaused ? '#b45309' : '#334155'}}
                  >
                    {isPaused ? '▶ Resume' : '⏸ Pause'}
                  </button>
                  <button
                    onClick={handleStop}
                    disabled={actionLoading}
                    className="btn"
                    style={{padding:'8px 16px',fontSize:'12px',background:'#fef2f2',border:'1px solid #fecaca',color:'#dc2626'}}
                  >
                    ⏹ Stop
                  </button>
                </>
              )}

              <button
                onClick={() => { setStage("login"); setCourses([]); setHasScanned(false); setStatus(null); stopPolling(); }}
                className="btn"
                style={{padding:'8px 16px',fontSize:'12px',background:'#f1f5f9',border:'1px solid #e2e8f0',color:'#475569'}}
              >
                🚪 Logout
              </button>
            </div>
          </div>

          {/* ── AUTOMATION STATUS BANNER ──────────────────────────────── */}
          {(isRunning || isDone || isStopped || isError) && (
            <div className="glass-card-light fade-in-up" style={{borderRadius:'20px',padding:'24px',border:`1px solid ${statusColor}40`}}>
              <div style={{display:'flex',flexWrap:'wrap',alignItems:'center',justifyContent:'space-between',gap:'16px',marginBottom:'16px'}}>
                <div style={{display:'flex',alignItems:'center',gap:'14px'}}>
                  <div style={{width:'42px',height:'42px',borderRadius:'12px',background:`${statusColor}15`,border:`1px solid ${statusColor}30`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'20px',flexShrink:0}}>
                    {isDone ? '🎉' : isPaused ? '⏸' : isError ? '⚠️' : isStopped ? '⏹' : '⚙️'}
                  </div>
                  <div>
                    <p style={{margin:0,fontSize:'11px',fontWeight:'800',color:'#64748b',textTransform:'uppercase',letterSpacing:'0.06em'}}>Bot Status</p>
                    <p style={{margin:'4px 0 0',fontSize:'14px',fontWeight:'700',color:'#0f172a'}}>{currentStepMsg}</p>
                  </div>
                </div>

                <div style={{display:'flex',alignItems:'center',gap:'20px'}}>
                  <div style={{textAlign:'right'}}>
                    <p style={{margin:0,fontSize:'11px',color:'#64748b',fontWeight:'700',textTransform:'uppercase'}}>Elapsed</p>
                    <p style={{margin:'2px 0 0',fontSize:'18px',fontWeight:'800',color:'#0f172a',fontFamily:'JetBrains Mono, monospace'}}>{formatTime(elapsed)}</p>
                  </div>
                  <div style={{textAlign:'right'}}>
                    <p style={{margin:0,fontSize:'11px',color:'#64748b',fontWeight:'700',textTransform:'uppercase'}}>Progress</p>
                    <p style={{margin:'2px 0 0',fontSize:'28px',fontWeight:'800',color:statusColor,lineHeight:1}}>{overallProgress}%</p>
                  </div>
                </div>
              </div>

              {/* Progress bar */}
              <div style={{background:'#e2e8f0',borderRadius:'100px',height:'12px',overflow:'hidden'}}>
                <div
                  className={isRunning && !isPaused ? 'progress-bar-animated' : ''}
                  style={{
                    height:'100%',
                    width:`${overallProgress}%`,
                    borderRadius:'100px',
                    transition:'width 0.7s ease',
                    background: !isRunning || isPaused
                      ? isDone ? 'linear-gradient(90deg,#10b981,#059669)'
                        : isPaused ? '#f59e0b'
                        : isError ? '#ef4444'
                        : '#64748b'
                      : undefined
                  }}
                />
              </div>
            </div>
          )}

          {/* ── COURSES SECTION ───────────────────────────────────────── */}
          <div className="glass-card-light" style={{borderRadius:'20px',padding:'28px'}}>
            {/* Header */}
            <div style={{display:'flex',flexWrap:'wrap',alignItems:'center',justifyContent:'space-between',gap:'16px',marginBottom:'20px',paddingBottom:'20px',borderBottom:'1px solid #e2e8f0'}}>
              <div>
                <h2 style={{margin:'0 0 4px',fontSize:'22px',fontWeight:'800',color:'#0f172a',letterSpacing:'-0.4px'}}>My Learning Journey</h2>
                <p style={{margin:0,fontSize:'13px',color:'#64748b',fontWeight:'500'}}>Enrolled courses · Progress tracking · Automation</p>
              </div>

              <div style={{display:'flex',gap:'12px',flexWrap:'wrap'}}>
                <button
                  onClick={handleScanCourses}
                  disabled={scanning || isRunning}
                  className="btn"
                  style={{padding:'12px 20px',fontSize:'13px',color:'white',background:'linear-gradient(135deg,#4f46e5,#6366f1)',boxShadow:'0 6px 20px rgba(79,70,229,0.25)'}}
                >
                  {scanning ? <><IconSpinner/> Scanning...</> : <><IconScan/> Scan Enrolled Courses</>}
                </button>

                {hasScanned && ongoingCourses.length > 0 && (
                  <button
                    onClick={() => handleStartAutomation()}
                    disabled={isRunning || actionLoading}
                    className="btn"
                    style={{padding:'12px 20px',fontSize:'13px',color:'white',background:'linear-gradient(135deg,#ea580c,#f59e0b)',boxShadow:'0 6px 20px rgba(234,88,12,0.25)'}}
                  >
                    {actionLoading && automatingCourseUrl === 'all' ? <><IconSpinner/> Starting...</> : <><IconPlay size={14}/> Start All Automation ({ongoingCourses.length})</>}
                  </button>
                )}
              </div>
            </div>

            {/* Scan status toast */}
            {scanMessage && (
              <div style={{
                marginBottom:'20px',padding:'12px 16px',borderRadius:'12px',fontSize:'13px',fontWeight:'600',
                display:'flex',alignItems:'center',gap:'10px',
                background: scanning ? '#eff6ff' : scanMessage.includes('Error') ? '#fef2f2' : '#ecfdf5',
                border: `1px solid ${scanning ? '#bfdbfe' : scanMessage.includes('Error') ? '#fecaca' : '#a7f3d0'}`,
                color: scanning ? '#1d4ed8' : scanMessage.includes('Error') ? '#dc2626' : '#047857'
              }}>
                <span>{scanning ? '⚙️' : scanMessage.includes('Error') ? '❌' : '✅'}</span>
                {scanMessage}
              </div>
            )}

            {/* Tabs */}
            <div style={{display:'flex',gap:'10px',marginBottom:'24px'}}>
              {(['ongoing','finished'] as const).map((tab) => {
                const count = tab === 'ongoing' ? ongoingCourses.length : finishedCourses.length;
                const isActive = activeTab === tab;
                return (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`btn ${isActive ? 'tab-active' : ''}`}
                    style={{
                      padding:'10px 20px',fontSize:'13px',fontWeight:'700',
                      background: isActive ? '' : '#f8fafc',
                      border:`1px solid ${isActive ? '' : '#e2e8f0'}`,
                      color: isActive ? '' : '#475569',
                      borderRadius:'12px'
                    }}
                  >
                    <span style={{marginRight:'6px'}}>{tab === 'ongoing' ? '📚' : '🏆'}</span>
                    {tab === 'ongoing' ? 'Ongoing' : 'Finished'} Courses
                    <span style={{
                      marginLeft:'8px',fontSize:'11px',fontWeight:'800',padding:'2px 8px',borderRadius:'20px',
                      background: isActive ? 'rgba(255,255,255,0.25)' : '#e2e8f0',
                      color: isActive ? '#ffffff' : '#64748b'
                    }}>{count}</span>
                  </button>
                );
              })}
            </div>

            {/* Course Cards */}
            {!hasScanned && !scanning ? (
              <div style={{padding:'56px 24px',textAlign:'center',background:'#f8fafc',borderRadius:'20px',border:'1px solid #e2e8f0'}}>
                <div style={{width:'80px',height:'80px',borderRadius:'24px',background:'linear-gradient(135deg,#e0e7ff,#c7d2fe)',border:'1px solid #a5b4fc',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 18px',fontSize:'36px'}}>
                  🔍
                </div>
                <h3 style={{margin:'0 0 8px',fontSize:'18px',fontWeight:'800',color:'#0f172a'}}>Scan Your Enrolled Courses</h3>
                <p style={{margin:'0 0 24px',fontSize:'14px',color:'#64748b',maxWidth:'400px',lineHeight:'1.6',marginLeft:'auto',marginRight:'auto',fontWeight:'500'}}>
                  The bot will login to DIKSHA and fetch all your ongoing and finished enrolled courses.
                </p>
                <button onClick={handleScanCourses} className="btn" style={{padding:'12px 28px',fontSize:'14px',color:'white',background:'linear-gradient(135deg,#4f46e5,#6366f1)',boxShadow:'0 8px 24px rgba(79,70,229,0.3)'}}>
                  <IconScan/> Scan Enrolled Courses Now
                </button>
              </div>
            ) : displayedCourses.length === 0 ? (
              <div style={{padding:'48px 24px',textAlign:'center',background:'#f8fafc',borderRadius:'20px',border:'1px solid #e2e8f0'}}>
                <div style={{fontSize:'44px',marginBottom:'12px'}}>{activeTab === 'ongoing' ? '📚' : '🏆'}</div>
                <h3 style={{margin:'0 0 6px',fontSize:'16px',fontWeight:'800',color:'#475569'}}>No {activeTab} courses found</h3>
                <p style={{margin:0,fontSize:'13px',color:'#94a3b8'}}>Try scanning again or switch tabs.</p>
              </div>
            ) : (
              <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(340px,1fr))',gap:'20px'}}>
                {displayedCourses.map((c, idx) => {
                  const pct = c.pct ?? c.progress ?? 0;
                  const isFinished = pct === 100;
                  const isCurrent = c.current;
                  return (
                    <div
                      key={idx}
                      className="card-hover fade-in-up"
                      style={{
                        background:'#ffffff',
                        borderRadius:'20px',
                        overflow:'hidden',
                        display:'flex',flexDirection:'column',
                        border: isCurrent ? '2px solid #6366f1' : isFinished ? '1px solid #a7f3d0' : '1px solid #e2e8f0',
                        boxShadow: isCurrent ? '0 12px 30px rgba(99,102,241,0.15)' : '0 4px 16px rgba(15,23,42,0.04)',
                        animationDelay:`${idx * 0.06}s`
                      }}
                    >
                      {/* Course banner */}
                      <div style={{height:'130px',background: isCurrent ? 'linear-gradient(135deg,#e0e7ff,#c7d2fe)' : isFinished ? 'linear-gradient(135deg,#d1fae5,#a7f3d0)' : 'linear-gradient(135deg,#f1f5f9,#e2e8f0)',display:'flex',alignItems:'center',justifyContent:'center',position:'relative',borderBottom:'1px solid #e2e8f0'}}>
                        {c.image_url ? (
                          <img src={c.image_url} alt={c.title} style={{width:'100%',height:'100%',objectFit:'cover'}}/>
                        ) : (
                          <div style={{textAlign:'center'}}>
                            <div style={{width:'52px',height:'52px',borderRadius:'16px',background: isFinished ? '#ecfdf5' : '#e0e7ff',border:`1px solid ${isFinished ? '#6ee7b7' : '#a5b4fc'}`,display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 6px',fontSize:'24px'}}>
                              {isFinished ? '🏆' : isCurrent ? '▶️' : '🎓'}
                            </div>
                            <p style={{margin:0,fontSize:'10px',color:'#64748b',fontWeight:'700',textTransform:'uppercase',letterSpacing:'0.05em'}}>DIKSHA Digital Learning</p>
                          </div>
                        )}

                        {/* Status badge */}
                        <div style={{position:'absolute',top:'12px',right:'12px'}}>
                          <span style={{
                            fontSize:'11px',fontWeight:'800',padding:'4px 12px',borderRadius:'20px',
                            background: isFinished ? '#d1fae5' : isCurrent ? '#e0e7ff' : '#fef3c7',
                            border: `1px solid ${isFinished ? '#6ee7b7' : isCurrent ? '#818cf8' : '#fcd34d'}`,
                            color: isFinished ? '#047857' : isCurrent ? '#4338ca' : '#b45309',
                            display:'flex',alignItems:'center',gap:'4px'
                          }}>
                            {isFinished ? <><IconCheck/> 100% Done</> : isCurrent ? '⚡ Automating' : `${pct}% In Progress`}
                          </span>
                        </div>
                      </div>

                      {/* Body */}
                      <div style={{padding:'20px',flex:1,display:'flex',flexDirection:'column',gap:'14px'}}>
                        <div>
                          <h3 style={{margin:'0 0 6px',fontSize:'15px',fontWeight:'800',color:'#0f172a',lineHeight:'1.5',display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical',overflow:'hidden'}}>
                            {c.title}
                          </h3>
                          {c.ends_on && (
                            <p style={{margin:0,fontSize:'12px',color:'#64748b',fontWeight:'600'}}>
                              📅 Ends: <span style={{color:'#334155'}}>{c.ends_on}</span>
                            </p>
                          )}
                        </div>

                        {/* Progress bar */}
                        <div>
                          <div style={{display:'flex',justifyContent:'space-between',marginBottom:'8px'}}>
                            <span style={{fontSize:'11px',color:'#64748b',fontWeight:'700',textTransform:'uppercase',letterSpacing:'0.04em'}}>Progress</span>
                            <span style={{fontSize:'12px',fontWeight:'800',color: isFinished ? '#10b981' : '#4f46e5'}}>{pct}%</span>
                          </div>
                          <div style={{background:'#e2e8f0',borderRadius:'100px',height:'8px',overflow:'hidden'}}>
                            <div style={{height:'100%',width:`${pct}%`,borderRadius:'100px',background: isFinished ? 'linear-gradient(90deg,#10b981,#059669)' : isCurrent ? 'linear-gradient(90deg,#ea580c,#f59e0b)' : 'linear-gradient(90deg,#4f46e5,#6366f1)',transition:'width 0.6s ease'}}/>
                          </div>
                        </div>
                      </div>

                      {/* Footer actions */}
                      <div style={{padding:'14px 20px',borderTop:'1px solid #e2e8f0',display:'flex',gap:'10px',background:'#f8fafc'}}>
                        <button
                          onClick={() => handleViewCourseDetails(c)}
                          style={{
                            flex:1,padding:'10px',borderRadius:'10px',
                            background:'#ffffff',
                            border:'1px solid #cbd5e1',
                            color:'#334155',fontSize:'12px',fontWeight:'700',
                            display:'flex',alignItems:'center',justifyContent:'center',gap:'6px',
                            cursor:'pointer',transition:'all 0.2s'
                          }}
                        >
                          <IconExternal/> View Course
                        </button>

                        <button
                          onClick={() => handleStartAutomation(c.url)}
                          disabled={isRunning || actionLoading || isFinished}
                          className="btn"
                          style={{
                            flex:1,padding:'10px',fontSize:'12px',
                            color: isFinished ? '#94a3b8' : 'white',
                            background: isFinished ? '#f1f5f9' : 'linear-gradient(135deg,#ea580c,#f59e0b)',
                            border: isFinished ? '1px solid #e2e8f0' : 'none',
                            boxShadow: isFinished ? 'none' : '0 4px 14px rgba(234,88,12,0.25)'
                          }}
                        >
                          {automatingCourseUrl === c.url ? (
                            <><IconSpinner/> Starting...</>
                          ) : isFinished ? (
                            <><IconCheck/> Completed</>
                          ) : (
                            <><IconPlay size={12}/> Start Automation</>
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── FULL WIDTH LIVE LOGS (REMOVED BOT EXECUTION STEPS PANEL PER USER DIRECTIVE) ── */}
          <div className="glass-card-light" style={{borderRadius:'20px',padding:'24px',display:'flex',flexDirection:'column',gap:'14px'}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
              <h3 style={{margin:0,fontSize:'13px',fontWeight:'800',color:'#0f172a',textTransform:'uppercase',letterSpacing:'0.06em',display:'flex',alignItems:'center',gap:'8px'}}>
                💻 Live Server Output Logs
                <span style={{width:'8px',height:'8px',borderRadius:'50%',background:'#10b981',display:'inline-block',boxShadow:'0 0 8px rgba(16,185,129,0.6)'}}/>
              </h3>
              <div style={{display:'flex',alignItems:'center',gap:'10px'}}>
                <span style={{fontSize:'12px',color:'#64748b',fontFamily:'JetBrains Mono, monospace',fontWeight:'600'}}>{logsList.length} lines</span>
                <button
                  onClick={() => setShowLogs(!showLogs)}
                  style={{fontSize:'11px',fontWeight:'700',color:'#475569',background:'#f1f5f9',border:'1px solid #cbd5e1',borderRadius:'8px',padding:'4px 10px',cursor:'pointer'}}
                >
                  {showLogs ? 'Collapse' : 'Expand'}
                </button>
              </div>
            </div>

            <div
              ref={logRef}
              style={{
                background:'#0f172a',border:'1px solid #1e293b',borderRadius:'14px',padding:'16px',
                height: showLogs ? '420px' : '260px',
                overflowY:'auto',
                transition:'height 0.3s ease'
              }}
            >
              {logsList.length === 0 ? (
                <p style={{margin:0,color:'#64748b',fontSize:'12px',fontStyle:'italic',fontFamily:'JetBrains Mono, monospace'}}>
                  Waiting for live log stream from Railway automation backend...
                </p>
              ) : (
                logsList.map((line, i) => {
                  const isErr = line.includes('[ERROR]') || line.includes('[CRITICAL]') || line.includes('❌');
                  const isWarn = line.includes('[WARNING]');
                  const isInfo = line.includes('[INFO]') || line.includes('✔') || line.includes('100%');
                  return (
                    <p key={i} className="log-line" style={{
                      margin:0,
                      color: isErr ? '#f87171' : isWarn ? '#fbbf24' : isInfo ? '#34d399' : '#cbd5e1'
                    }}>
                      {line}
                    </p>
                  );
                })
              )}
            </div>
          </div>

        </div>
      </div>

      {/* ─── COURSE DETAILS MODAL ─── */}
      {showDetailsModal && (
        <div style={{
          position:'fixed',inset:0,zIndex:9999,
          background:'rgba(15,23,42,0.6)',backdropFilter:'blur(10px)',
          display:'flex',alignItems:'center',justifyContent:'center',padding:'16px'
        }}>
          <div className="glass-card-light fade-in-up" style={{
            width:'100%',maxWidth:'820px',borderRadius:'24px',overflow:'hidden',
            display:'flex',flexDirection:'column',maxHeight:'85vh',
            boxShadow:'0 25px 50px -12px rgba(0,0,0,0.15)',
            border:'1px solid #e2e8f0'
          }}>
            {/* Header */}
            <div style={{
              padding:'20px 24px',borderBottom:'1px solid #e2e8f0',
              display:'flex',alignItems:'center',justifyContent:'space-between',
              background:'#f8fafc'
            }}>
              <div>
                <span style={{fontSize:'11px',fontWeight:'800',color:'#4f46e5',textTransform:'uppercase',letterSpacing:'0.06em'}}>DIKSHA Course Details</span>
                <h2 style={{margin:'4px 0 0',fontSize:'18px',fontWeight:'800',color:'#0f172a'}}>{selectedCourse?.title}</h2>
              </div>
              <button 
                onClick={() => { setShowDetailsModal(false); setSelectedCourse(null); setCourseDetails(null); }}
                style={{
                  background:'#ffffff',border:'1px solid #cbd5e1',
                  color:'#475569',borderRadius:'50%',width:'34px',height:'34px',
                  display:'flex',alignItems:'center',justifyContent:'center',fontSize:'16px',
                  cursor:'pointer',fontWeight:'700',transition:'all 0.2s'
                }}
              >
                ✕
              </button>
            </div>

            {/* Content Area */}
            <div style={{padding:'24px',overflowY:'auto',flex:1,display:'flex',flexDirection:'column',gap:'20px'}}>
              {detailsLoading ? (
                <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'80px 0',gap:'16px'}}>
                  <IconSpinner />
                  <p style={{margin:0,fontSize:'14px',color:'#64748b',fontWeight:'600'}}>Fetching course content & details from DIKSHA portal...</p>
                </div>
              ) : detailsError ? (
                <div style={{textAlign:'center',padding:'40px 0'}}>
                  <div style={{fontSize:'36px',marginBottom:'12px'}}>⚠️</div>
                  <h3 style={{color:'#0f172a',margin:'0 0 8px',fontSize:'16px'}}>{detailsError}</h3>
                  <p style={{color:'#64748b',fontSize:'13px',maxWidth:'450px',margin:'0 auto'}}>
                    Please make sure the bot has completed initial scanning and that your session is still active.
                  </p>
                </div>
              ) : courseDetails ? (
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'24px',alignItems:'start'}}>
                  
                  {/* Left Column: Info & Description */}
                  <div style={{display:'flex',flexDirection:'column',gap:'16px'}}>
                    <div>
                      <h4 style={{margin:'0 0 8px',fontSize:'12px',fontWeight:'800',color:'#64748b',textTransform:'uppercase',letterSpacing:'0.04em'}}>About this Course</h4>
                      <p style={{
                        margin:0,fontSize:'13px',color:'#334155',
                        lineHeight:'1.6',whiteSpace:'pre-wrap',background:'#f8fafc',
                        padding:'16px',borderRadius:'14px',border:'1px solid #e2e8f0',
                        maxHeight:'320px',overflowY:'auto',fontWeight:'500'
                      }}>
                        {courseDetails.description || "No description provided by the DIKSHA portal."}
                      </p>
                    </div>

                    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',background:'#eff6ff',border:'1px solid #bfdbfe',borderRadius:'14px',padding:'14px 18px'}}>
                      <div>
                        <p style={{margin:0,fontSize:'11px',color:'#1d4ed8',fontWeight:'800',textTransform:'uppercase'}}>Course Status</p>
                        <p style={{margin:0,fontSize:'15px',color:'#0f172a',fontWeight:'800'}}>{selectedCourse?.progress}% Complete</p>
                      </div>
                      <button
                        onClick={() => { setShowDetailsModal(false); handleStartAutomation(selectedCourse?.url); }}
                        disabled={isRunning || actionLoading || selectedCourse?.progress === 100}
                        style={{
                          background:'linear-gradient(135deg,#ea580c,#f59e0b)',
                          color:'white',border:'none',padding:'10px 18px',borderRadius:'10px',
                          fontSize:'12px',fontWeight:'800',cursor:'pointer',
                          opacity: (isRunning || actionLoading || selectedCourse?.progress === 100) ? 0.5 : 1
                        }}
                      >
                        ⚡ Start Automation
                      </button>
                    </div>
                  </div>

                  {/* Right Column: Lessons / Modules */}
                  <div style={{display:'flex',flexDirection:'column',gap:'12px'}}>
                    <h4 style={{margin:'0 0 4px',fontSize:'12px',fontWeight:'800',color:'#64748b',textTransform:'uppercase',letterSpacing:'0.04em'}}>Course Lessons & Modules</h4>
                    <div style={{
                      display:'flex',flexDirection:'column',gap:'10px',
                      maxHeight:'400px',overflowY:'auto',paddingRight:'4px'
                    }}>
                      {courseDetails.modules && courseDetails.modules.length > 0 ? (
                        courseDetails.modules.map((m: any, idx: number) => {
                          const pct = m.progress ?? 0;
                          const isDone = m.iscompleted || pct === 100;
                          return (
                            <div key={idx} style={{
                              background:'#f8fafc',border:'1px solid #e2e8f0',
                              borderRadius:'12px',padding:'12px 16px',display:'flex',alignItems:'center',
                              justifyContent:'space-between',gap:'12px'
                            }}>
                              <div style={{flex:1,minWidth:0}}>
                                <p style={{margin:'0 0 6px',fontSize:'13px',fontWeight:'700',color:'#0f172a',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}} title={m.name}>
                                  {m.name}
                                </p>
                                <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
                                  <div style={{flex:1,background:'#e2e8f0',height:'5px',borderRadius:'10px',overflow:'hidden'}}>
                                    <div style={{width:`${pct}%`,height:'100%',background: isDone ? '#10b981' : '#4f46e5'}} />
                                  </div>
                                  <span style={{fontSize:'11px',fontWeight:'800',color: isDone ? '#10b981' : '#64748b'}}>{pct}%</span>
                                </div>
                              </div>
                              <span style={{
                                width:'24px',height:'24px',borderRadius:'50%',
                                background: isDone ? '#d1fae5' : '#e2e8f0',
                                border:`1px solid ${isDone ? '#6ee7b7' : '#cbd5e1'}`,
                                display:'flex',alignItems:'center',justifyContent:'center',
                                color: isDone ? '#047857' : '#64748b',fontSize:'11px',fontWeight:'bold'
                              }}>
                                {isDone ? '✓' : idx + 1}
                              </span>
                            </div>
                          );
                        })
                      ) : (
                        <div style={{textAlign:'center',padding:'30px 0',color:'#94a3b8',fontSize:'13px',fontStyle:'italic'}}>
                          No modules returned from DIKSHA API.
                        </div>
                      )}
                    </div>
                  </div>

                </div>
              ) : null}
            </div>
            
            {/* Footer */}
            <div style={{
              padding:'16px 24px',borderTop:'1px solid #e2e8f0',
              display:'flex',justifyContent:'flex-end',background:'#f8fafc'
            }}>
              <button 
                onClick={() => { setShowDetailsModal(false); setSelectedCourse(null); setCourseDetails(null); }}
                style={{
                  background:'#ffffff',border:'1px solid #cbd5e1',
                  color:'#334155',borderRadius:'10px',padding:'8px 18px',fontSize:'12px',
                  fontWeight:'700',cursor:'pointer'
                }}
              >
                Close Details
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}    {logsList.length === 0 ? (
                  <p style={{margin:0,color:'rgba(100,116,139,0.5)',fontSize:'11px',fontStyle:'italic',fontFamily:'monospace'}}>
                    Waiting for bot output from Railway backend...
                  </p>
                ) : (
                  logsList.map((line, i) => {
                    const isErr = line.includes('[ERROR]') || line.includes('[CRITICAL]');
                    const isWarn = line.includes('[WARNING]');
                    const isInfo = line.includes('[INFO]');
                    return (
                      <p key={i} className="log-line" style={{
                        margin:0,
                        color: isErr ? '#f87171' : isWarn ? '#fbbf24' : isInfo ? '#6ee7b7' : 'rgba(148,163,184,0.7)'
                      }}>
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

      {/* ─── COURSE DETAILS MODAL ─── */}
      {showDetailsModal && (
        <div style={{
          position:'fixed',inset:0,zIndex:9999,
          background:'rgba(2,6,23,0.75)',backdropFilter:'blur(12px)',
          display:'flex',alignItems:'center',justifyContent:'center',padding:'16px'
        }}>
          <div className="glass fade-in-up" style={{
            width:'100%',maxWidth:'800px',borderRadius:'24px',overflow:'hidden',
            display:'flex',flexDirection:'column',maxHeight:'85vh',
            boxShadow:'0 25px 50px -12px rgba(0,0,0,0.5), 0 0 40px rgba(249,115,22,0.05)',
            border:'1px solid rgba(255,255,255,0.08)'
          }}>
            {/* Header */}
            <div style={{
              padding:'20px 24px',borderBottom:'1px solid rgba(255,255,255,0.07)',
              display:'flex',alignItems:'center',justifyContent:'space-between',
              background:'rgba(15,23,42,0.4)'
            }}>
              <div>
                <span style={{fontSize:'10px',fontWeight:'800',color:'#ea580c',textTransform:'uppercase',letterSpacing:'0.05em'}}>DIKSHA Course Details</span>
                <h2 style={{margin:'4px 0 0',fontSize:'16px',fontWeight:'700',color:'white'}}>{selectedCourse?.title}</h2>
              </div>
              <button 
                onClick={() => { setShowDetailsModal(false); setSelectedCourse(null); setCourseDetails(null); }}
                style={{
                  background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.08)',
                  color:'rgba(148,163,184,0.8)',borderRadius:'50%',width:'32px',height:'32px',
                  display:'flex',alignItems:'center',justifyContent:'center',fontSize:'16px',
                  cursor:'pointer',fontWeight:'700',transition:'all 0.2s'
                }}
              >
                ✕
              </button>
            </div>

            {/* Content Area */}
            <div style={{padding:'24px',overflowY:'auto',flex:1,display:'flex',flexDirection:'column',gap:'20px'}}>
              {detailsLoading ? (
                <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'80px 0',gap:'16px'}}>
                  <IconSpinner />
                  <p style={{margin:0,fontSize:'13px',color:'rgba(148,163,184,0.8)',fontWeight:'500'}}>Fetching course content & details from DIKSHA portal...</p>
                </div>
              ) : detailsError ? (
                <div style={{textAlign:'center',padding:'40px 0'}}>
                  <div style={{fontSize:'36px',marginBottom:'12px'}}>⚠️</div>
                  <h3 style={{color:'white',margin:'0 0 8px',fontSize:'15px'}}>{detailsError}</h3>
                  <p style={{color:'rgba(148,163,184,0.6)',fontSize:'12px',maxWidth:'450px',margin:'0 auto'}}>
                    Please make sure the bot has completed initial scanning and that your session is still active.
                  </p>
                </div>
              ) : courseDetails ? (
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'24px',alignItems:'start'}}>
                  
                  {/* Left Column: Info & Description */}
                  <div style={{display:'flex',flexDirection:'column',gap:'16px'}}>
                    <div>
                      <h4 style={{margin:'0 0 8px',fontSize:'12px',fontWeight:'700',color:'rgba(100,116,139,0.8)',textTransform:'uppercase',letterSpacing:'0.04em'}}>About this Course</h4>
                      <p style={{
                        margin:0,fontSize:'13px',color:'rgba(148,163,184,0.85)',
                        lineHeight:'1.6',whiteSpace:'pre-wrap',background:'rgba(255,255,255,0.02)',
                        padding:'14px',borderRadius:'12px',border:'1px solid rgba(255,255,255,0.04)',
                        maxHeight:'320px',overflowY:'auto'
                      }}>
                        {courseDetails.description || "No description provided by the DIKSHA portal."}
                      </p>
                    </div>

                    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',background:'rgba(249,115,22,0.04)',border:'1px solid rgba(249,115,22,0.1)',borderRadius:'12px',padding:'12px 16px'}}>
                      <div>
                        <p style={{margin:0,fontSize:'10px',color:'rgba(249,115,22,0.7)',fontWeight:'700',textTransform:'uppercase'}}>Course Status</p>
                        <p style={{margin:0,fontSize:'14px',color:'white',fontWeight:'700'}}>{selectedCourse?.progress}% Complete</p>
                      </div>
                      <button
                        onClick={() => { setShowDetailsModal(false); handleStartAutomation(selectedCourse?.url); }}
                        disabled={isRunning || actionLoading || selectedCourse?.progress === 100}
                        style={{
                          background:'linear-gradient(135deg,#ea580c,#f59e0b)',
                          color:'white',border:'none',padding:'8px 16px',borderRadius:'8px',
                          fontSize:'11px',fontWeight:'700',cursor:'pointer',
                          opacity: (isRunning || actionLoading || selectedCourse?.progress === 100) ? 0.5 : 1
                        }}
                      >
                        ⚡ Start Automation
                      </button>
                    </div>
                  </div>

                  {/* Right Column: Lessons / Modules */}
                  <div style={{display:'flex',flexDirection:'column',gap:'12px'}}>
                    <h4 style={{margin:'0 0 4px',fontSize:'12px',fontWeight:'700',color:'rgba(100,116,139,0.8)',textTransform:'uppercase',letterSpacing:'0.04em'}}>Course Lessons & Modules</h4>
                    <div style={{
                      display:'flex',flexDirection:'column',gap:'10px',
                      maxHeight:'400px',overflowY:'auto',paddingRight:'4px'
                    }}>
                      {courseDetails.modules && courseDetails.modules.length > 0 ? (
                        courseDetails.modules.map((m: any, idx: number) => {
                          const pct = m.progress ?? 0;
                          const isDone = m.iscompleted || pct === 100;
                          return (
                            <div key={idx} style={{
                              background:'rgba(2,6,23,0.4)',border:'1px solid rgba(255,255,255,0.04)',
                              borderRadius:'12px',padding:'12px 14px',display:'flex',alignItems:'center',
                              justifyContent:'space-between',gap:'12px'
                            }}>
                              <div style={{flex:1,minWidth:0}}>
                                <p style={{margin:'0 0 6px',fontSize:'12px',fontWeight:'600',color:'white',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}} title={m.name}>
                                  {m.name}
                                </p>
                                <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
                                  <div style={{flex:1,background:'rgba(255,255,255,0.03)',height:'4px',borderRadius:'10px',overflow:'hidden'}}>
                                    <div style={{width:`${pct}%`,height:'100%',background: isDone ? '#10b981' : '#f97316'}} />
                                  </div>
                                  <span style={{fontSize:'10px',fontWeight:'700',color: isDone ? '#10b981' : 'rgba(148,163,184,0.6)'}}>{pct}%</span>
                                </div>
                              </div>
                              <span style={{
                                width:'22px',height:'22px',borderRadius:'50%',
                                background: isDone ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.03)',
                                border:`1px solid ${isDone ? 'rgba(16,185,129,0.3)' : 'rgba(255,255,255,0.06)'}`,
                                display:'flex',alignItems:'center',justifyContent:'center',
                                color: isDone ? '#34d399' : 'rgba(148,163,184,0.3)',fontSize:'10px',fontWeight:'bold'
                              }}>
                                {isDone ? '✓' : idx + 1}
                              </span>
                            </div>
                          );
                        })
                      ) : (
                        <div style={{textAlign:'center',padding:'30px 0',color:'rgba(148,163,184,0.5)',fontSize:'12px',fontStyle:'italic'}}>
                          No modules returned from Moodle API.
                        </div>
                      )}
                    </div>
                  </div>

                </div>
              ) : null}
            </div>
            
            {/* Footer */}
            <div style={{
              padding:'14px 24px',borderTop:'1px solid rgba(255,255,255,0.07)',
              display:'flex',justifyContent:'flex-end',background:'rgba(15,23,42,0.2)'
            }}>
              <button 
                onClick={() => { setShowDetailsModal(false); setSelectedCourse(null); setCourseDetails(null); }}
                style={{
                  background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.08)',
                  color:'white',borderRadius:'8px',padding:'6px 14px',fontSize:'11px',
                  fontWeight:'600',cursor:'pointer'
                }}
              >
                Close Details
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
