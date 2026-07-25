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

  /* ─── LOGIN PAGE ──────────────────────────────────────────────────────── */
  if (stage === "login") {
    return (
      <>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap');
          .diksha-root * { font-family: 'Inter', sans-serif; box-sizing: border-box; }
          @keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-12px)} }
          @keyframes glow-pulse { 0%,100%{opacity:0.15} 50%{opacity:0.35} }
          @keyframes spin-slow { to{transform:rotate(360deg)} }
          .float-anim { animation: float 6s ease-in-out infinite; }
          .glow-orb { animation: glow-pulse 4s ease-in-out infinite; }
          .spin-ring { animation: spin-slow 8s linear infinite; }
          .glass-card {
            background: rgba(15,23,42,0.80);
            backdrop-filter: blur(24px);
            -webkit-backdrop-filter: blur(24px);
            border: 1px solid rgba(255,255,255,0.07);
          }
          .input-field {
            background: rgba(2,6,23,0.70);
            border: 1px solid rgba(255,255,255,0.08);
            color: white;
            width: 100%;
            padding: 12px 16px;
            border-radius: 12px;
            font-size: 14px;
            outline: none;
            transition: border-color 0.2s, box-shadow 0.2s;
          }
          .input-field:focus { border-color: rgba(249,115,22,0.6); box-shadow: 0 0 0 3px rgba(249,115,22,0.1); }
          .input-field::placeholder { color: rgba(148,163,184,0.5); }
          .btn-primary {
            width: 100%;
            padding: 13px;
            border-radius: 12px;
            font-weight: 700;
            font-size: 14px;
            color: white;
            background: linear-gradient(135deg, #ea580c 0%, #f59e0b 100%);
            border: none;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            transition: all 0.2s;
            box-shadow: 0 8px 24px rgba(234,88,12,0.3);
          }
          .btn-primary:hover { transform: translateY(-1px); box-shadow: 0 12px 32px rgba(234,88,12,0.4); }
          .btn-primary:active { transform: translateY(0); }
        `}</style>
        <div className="diksha-root" style={{minHeight:'100vh',background:'#020617',display:'flex',alignItems:'center',justifyContent:'center',padding:'24px',position:'relative',overflow:'hidden'}}>
          {/* Animated background orbs */}
          <div className="glow-orb" style={{position:'absolute',top:'10%',left:'20%',width:'500px',height:'500px',background:'radial-gradient(circle,rgba(234,88,12,0.2) 0%,transparent 70%)',borderRadius:'50%',pointerEvents:'none'}}/>
          <div className="glow-orb" style={{position:'absolute',bottom:'10%',right:'15%',width:'400px',height:'400px',background:'radial-gradient(circle,rgba(245,158,11,0.15) 0%,transparent 70%)',borderRadius:'50%',pointerEvents:'none',animationDelay:'2s'}}/>
          <div className="glow-orb" style={{position:'absolute',top:'50%',right:'25%',width:'300px',height:'300px',background:'radial-gradient(circle,rgba(139,92,246,0.1) 0%,transparent 70%)',borderRadius:'50%',pointerEvents:'none',animationDelay:'1s'}}/>

          {/* Grid pattern overlay */}
          <div style={{position:'absolute',inset:0,backgroundImage:'linear-gradient(rgba(255,255,255,0.015) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.015) 1px,transparent 1px)',backgroundSize:'48px 48px',pointerEvents:'none'}}/>

          <div style={{width:'100%',maxWidth:'440px',position:'relative',zIndex:10}}>
            {/* Logo & Title */}
            <div className="float-anim" style={{textAlign:'center',marginBottom:'32px'}}>
              <div style={{display:'inline-flex',alignItems:'center',justifyContent:'center',width:'72px',height:'72px',borderRadius:'20px',background:'linear-gradient(135deg,#ea580c,#f59e0b)',padding:'2px',boxShadow:'0 16px 48px rgba(234,88,12,0.4)',marginBottom:'20px'}}>
                <div style={{width:'100%',height:'100%',background:'#030712',borderRadius:'18px',display:'flex',alignItems:'center',justifyContent:'center',color:'#f97316'}}>
                  <IconGraduate/>
                </div>
              </div>
              <h1 style={{fontSize:'28px',fontWeight:'900',color:'white',margin:'0 0 8px',letterSpacing:'-0.5px',background:'linear-gradient(135deg,#ffffff 30%,rgba(255,255,255,0.6))',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent'}}>
                DIKSHA Automation
              </h1>
              <p style={{color:'rgba(148,163,184,0.8)',fontSize:'13px',margin:0,lineHeight:'1.6'}}>
                Complete your courses automatically — fast, reliable & secure
              </p>
            </div>

            {/* Glass Card */}
            <div className="glass-card" style={{borderRadius:'24px',padding:'32px',boxShadow:'0 24px 80px rgba(0,0,0,0.6)'}}>
              {loginError && (
                <div style={{marginBottom:'20px',background:'rgba(239,68,68,0.08)',border:'1px solid rgba(239,68,68,0.25)',borderRadius:'12px',padding:'12px 16px',display:'flex',gap:'10px',alignItems:'flex-start'}}>
                  <span style={{fontSize:'16px'}}>⚠️</span>
                  <p style={{color:'#fca5a5',fontSize:'12px',margin:0,lineHeight:'1.5'}}>{loginError}</p>
                </div>
              )}

              <form onSubmit={handleSimpleLogin} style={{display:'flex',flexDirection:'column',gap:'18px'}}>
                <div>
                  <label style={{display:'block',fontSize:'11px',fontWeight:'600',color:'rgba(148,163,184,0.9)',marginBottom:'8px',textTransform:'uppercase',letterSpacing:'0.08em'}}>
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
                  <label style={{display:'block',fontSize:'11px',fontWeight:'600',color:'rgba(148,163,184,0.9)',marginBottom:'8px',textTransform:'uppercase',letterSpacing:'0.08em'}}>
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
                      style={{paddingRight:'44px'}}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass(!showPass)}
                      style={{position:'absolute',right:'12px',top:'50%',transform:'translateY(-50%)',background:'none',border:'none',color:'rgba(148,163,184,0.6)',cursor:'pointer',fontSize:'16px',padding:'4px'}}
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
                    marginTop: '4px',
                    background: loginVerified
                      ? 'linear-gradient(135deg,#22c55e,#16a34a)'
                      : loginLoading
                      ? 'linear-gradient(135deg,rgba(251,146,60,0.6),rgba(245,101,46,0.6))'
                      : undefined,
                    cursor: loginLoading ? 'not-allowed' : 'pointer',
                    transition: 'all 0.3s ease',
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
                        width:'16px', height:'16px',
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

                {/* Error message */}
                {loginError && (
                  <div style={{
                    marginTop:'12px',
                    padding:'10px 14px',
                    background:'rgba(239,68,68,0.12)',
                    border:'1px solid rgba(239,68,68,0.3)',
                    borderRadius:'10px',
                    color:'#fca5a5',
                    fontSize:'13px',
                    lineHeight:'1.5',
                    display:'flex',
                    alignItems:'flex-start',
                    gap:'8px',
                  }}>
                    <span style={{flexShrink:0,marginTop:'1px'}}>⚠️</span>
                    <span>{loginError}</span>
                  </div>
                )}
              </form>

              {/* Security note */}
              <div style={{marginTop:'20px',paddingTop:'20px',borderTop:'1px solid rgba(255,255,255,0.06)',display:'flex',alignItems:'center',justifyContent:'center',gap:'8px'}}>
                <span style={{fontSize:'12px'}}>🔒</span>
                <span style={{fontSize:'11px',color:'rgba(100,116,139,0.8)'}}>Secured via Keycloak SSO · DIKSHA Portal</span>
              </div>
            </div>

            {/* Feature pills */}
            <div style={{display:'flex',justifyContent:'center',gap:'8px',marginTop:'20px',flexWrap:'wrap'}}>
              {['Auto-Login','Course Scan','Progress Track','Pause & Stop'].map((f) => (
                <span key={f} style={{fontSize:'10px',fontWeight:'600',color:'rgba(148,163,184,0.6)',background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.07)',borderRadius:'20px',padding:'4px 10px'}}>
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

  const ongoingCourses = courses.filter((c) => c.status === "ongoing" || (c.pct ?? c.progress ?? 0) < 100);
  const finishedCourses = courses.filter((c) => c.status === "finished" || (c.pct ?? c.progress ?? 0) === 100);
  const displayedCourses = activeTab === "ongoing" ? ongoingCourses : finishedCourses;

  const statusColor = isDone ? "#10b981" : isPaused ? "#f59e0b" : isStopped ? "#64748b" : isError ? "#ef4444" : "#f97316";
  const statusLabel = isDone ? "Completed" : isPaused ? "Paused" : isStopped ? "Stopped" : isError ? "Error" : isRunning ? "Running" : "Idle";

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap');
        .dash-root * { font-family: 'Inter', sans-serif; box-sizing: border-box; }
        @keyframes pulse-dot { 0%,100%{transform:scale(1);opacity:1} 50%{transform:scale(1.5);opacity:0.7} }
        @keyframes progress-shine { 0%{background-position:-200% 0} 100%{background-position:200% 0} }
        @keyframes fade-in-up { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
        @keyframes ping { 0%{transform:scale(1);opacity:1} 75%,100%{transform:scale(2);opacity:0} }
        .pulse-dot { animation: pulse-dot 2s ease-in-out infinite; }
        .fade-in-up { animation: fade-in-up 0.4s ease both; }
        .ping-anim::after { content:''; position:absolute; inset:0; border-radius:50%; background:inherit; animation: ping 1.2s cubic-bezier(0,0,0.2,1) infinite; }
        .glass { background:rgba(15,23,42,0.85); backdrop-filter:blur(20px); -webkit-backdrop-filter:blur(20px); border:1px solid rgba(255,255,255,0.07); }
        .glass-dark { background:rgba(2,6,23,0.70); backdrop-filter:blur(12px); border:1px solid rgba(255,255,255,0.05); }
        .card-hover { transition: transform 0.2s, border-color 0.2s, box-shadow 0.2s; }
        .card-hover:hover { transform: translateY(-2px); box-shadow: 0 12px 40px rgba(0,0,0,0.4); }
        .progress-bar-animated {
          background-size: 200% 100%;
          background-image: linear-gradient(90deg, #ea580c 0%, #f59e0b 40%, #ea580c 80%, #f59e0b 100%);
          animation: progress-shine 2s linear infinite;
        }
        .btn { border:none; cursor:pointer; display:inline-flex; align-items:center; justify-content:center; gap:6px; font-weight:600; border-radius:10px; transition:all 0.2s; font-family:'Inter',sans-serif; }
        .btn:hover { filter: brightness(1.1); transform: translateY(-1px); }
        .btn:active { transform: translateY(0); }
        .btn:disabled { opacity:0.4; cursor:not-allowed; transform:none; filter:none; }
        .tab-active { background: linear-gradient(135deg,rgba(234,88,12,0.2),rgba(245,158,11,0.15)) !important; border-color: rgba(249,115,22,0.5) !important; color: #fdba74 !important; }
        .log-line { padding: 2px 0; border-radius:4px; font-size:11px; line-height:1.6; font-family:'Courier New',monospace; }
        ::-webkit-scrollbar { width:4px; height:4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius:4px; }
        input[type=text],input[type=password] { font-family:'Inter',sans-serif; }
      `}</style>

      <div className="dash-root" style={{minHeight:'100vh',background:'#020617',color:'white',padding:'20px 16px',position:'relative'}}>
        {/* Subtle BG grid */}
        <div style={{position:'fixed',inset:0,backgroundImage:'linear-gradient(rgba(255,255,255,0.012) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.012) 1px,transparent 1px)',backgroundSize:'48px 48px',pointerEvents:'none',zIndex:0}}/>
        {/* Orange glow top */}
        <div style={{position:'fixed',top:'-100px',left:'50%',transform:'translateX(-50%)',width:'700px',height:'300px',background:'radial-gradient(ellipse,rgba(234,88,12,0.12) 0%,transparent 70%)',pointerEvents:'none',zIndex:0}}/>

        <div style={{maxWidth:'1200px',margin:'0 auto',position:'relative',zIndex:1,display:'flex',flexDirection:'column',gap:'20px'}}>

          {/* ── TOP NAVBAR ─────────────────────────────────────────────── */}
          <div className="glass" style={{borderRadius:'18px',padding:'14px 20px',display:'flex',flexWrap:'wrap',alignItems:'center',justifyContent:'space-between',gap:'12px'}}>
            <div style={{display:'flex',alignItems:'center',gap:'12px'}}>
              <div style={{width:'40px',height:'40px',borderRadius:'12px',background:'linear-gradient(135deg,#ea580c,#f59e0b)',padding:'2px',boxShadow:'0 6px 20px rgba(234,88,12,0.35)',flexShrink:0}}>
                <div style={{width:'100%',height:'100%',background:'#030712',borderRadius:'10px',display:'flex',alignItems:'center',justifyContent:'center',color:'#f97316'}}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/>
                  </svg>
                </div>
              </div>
              <div>
                <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
                  <h1 style={{margin:0,fontSize:'15px',fontWeight:'800',color:'white',letterSpacing:'-0.3px'}}>DIKSHA Automation Portal</h1>
                  <span style={{fontSize:'10px',fontWeight:'700',color:'#fb923c',background:'rgba(249,115,22,0.1)',border:'1px solid rgba(249,115,22,0.25)',borderRadius:'20px',padding:'2px 8px',letterSpacing:'0.05em'}}>
                    {username || "User"}
                  </span>
                </div>
                <p style={{margin:0,fontSize:'11px',color:'rgba(100,116,139,0.9)'}}>My Learning Journey & Course Automation</p>
              </div>
            </div>

            <div style={{display:'flex',alignItems:'center',gap:'8px',flexWrap:'wrap'}}>
              {/* Status pill */}
              <div style={{display:'flex',alignItems:'center',gap:'6px',background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.07)',borderRadius:'20px',padding:'5px 12px'}}>
                <div className={isRunning && !isPaused ? 'ping-anim' : ''} style={{width:'7px',height:'7px',borderRadius:'50%',background:statusColor,position:'relative',flexShrink:0}}/>
                <span style={{fontSize:'11px',fontWeight:'600',color:statusColor}}>{statusLabel}</span>
              </div>

              {isRunning && (
                <>
                  <button
                    onClick={handlePauseToggle}
                    disabled={actionLoading}
                    className="btn"
                    style={{padding:'7px 14px',fontSize:'12px',background: isPaused ? 'rgba(245,158,11,0.15)' : 'rgba(255,255,255,0.06)',border:`1px solid ${isPaused ? 'rgba(245,158,11,0.4)' : 'rgba(255,255,255,0.1)'}`,color: isPaused ? '#fcd34d' : '#cbd5e1'}}
                  >
                    {isPaused ? '▶ Resume' : '⏸ Pause'}
                  </button>
                  <button
                    onClick={handleStop}
                    disabled={actionLoading}
                    className="btn"
                    style={{padding:'7px 14px',fontSize:'12px',background:'rgba(239,68,68,0.08)',border:'1px solid rgba(239,68,68,0.25)',color:'#fca5a5'}}
                  >
                    ⏹ Stop
                  </button>
                </>
              )}

              <button
                onClick={() => { setStage("login"); setCourses([]); setHasScanned(false); setStatus(null); stopPolling(); }}
                className="btn"
                style={{padding:'7px 14px',fontSize:'12px',background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.08)',color:'rgba(148,163,184,0.8)'}}
              >
                🚪 Logout
              </button>
            </div>
          </div>

          {/* ── AUTOMATION STATUS BANNER ──────────────────────────────── */}
          {(isRunning || isDone || isStopped || isError) && (
            <div className="glass fade-in-up" style={{borderRadius:'18px',padding:'20px 24px',border:`1px solid ${statusColor}22`}}>
              <div style={{display:'flex',flexWrap:'wrap',alignItems:'center',justifyContent:'space-between',gap:'16px',marginBottom:'14px'}}>
                <div style={{display:'flex',alignItems:'center',gap:'12px'}}>
                  <div style={{width:'38px',height:'38px',borderRadius:'10px',background:`${statusColor}15`,border:`1px solid ${statusColor}30`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'18px',flexShrink:0}}>
                    {isDone ? '🎉' : isPaused ? '⏸' : isError ? '⚠️' : isStopped ? '⏹' : '⚙️'}
                  </div>
                  <div>
                    <p style={{margin:0,fontSize:'10px',fontWeight:'700',color:'rgba(100,116,139,0.9)',textTransform:'uppercase',letterSpacing:'0.08em'}}>Bot Status</p>
                    <p style={{margin:'3px 0 0',fontSize:'13px',fontWeight:'700',color:'white'}}>{currentStepMsg}</p>
                  </div>
                </div>

                <div style={{display:'flex',alignItems:'center',gap:'16px'}}>
                  <div style={{textAlign:'right'}}>
                    <p style={{margin:0,fontSize:'10px',color:'rgba(100,116,139,0.8)',textTransform:'uppercase',letterSpacing:'0.05em'}}>Elapsed</p>
                    <p style={{margin:0,fontSize:'16px',fontWeight:'800',color:'white',fontFamily:'monospace'}}>{formatTime(elapsed)}</p>
                  </div>
                  <div style={{textAlign:'right'}}>
                    <p style={{margin:0,fontSize:'10px',color:'rgba(100,116,139,0.8)',textTransform:'uppercase',letterSpacing:'0.05em'}}>Progress</p>
                    <p style={{margin:0,fontSize:'26px',fontWeight:'900',color:statusColor,lineHeight:1}}>{overallProgress}%</p>
                  </div>
                </div>
              </div>

              {/* Progress bar */}
              <div style={{background:'rgba(2,6,23,0.7)',borderRadius:'100px',height:'10px',border:'1px solid rgba(255,255,255,0.06)',overflow:'hidden'}}>
                <div
                  className={isRunning && !isPaused ? 'progress-bar-animated' : ''}
                  style={{
                    height:'100%',
                    width:`${overallProgress}%`,
                    borderRadius:'100px',
                    transition:'width 0.7s ease',
                    background: !isRunning || isPaused
                      ? isDone ? 'linear-gradient(90deg,#10b981,#34d399)'
                        : isPaused ? '#f59e0b'
                        : isError ? '#ef4444'
                        : '#64748b'
                      : undefined
                  }}
                />
              </div>

              {/* Step indicator dots */}
              <div style={{display:'flex',gap:'4px',marginTop:'10px',alignItems:'center'}}>
                {STEP_KEYWORDS.map((_, i) => (
                  <div key={i} style={{flex:1,height:'3px',borderRadius:'2px',background: i <= currentStepIdx ? statusColor : 'rgba(255,255,255,0.07)',transition:'background 0.5s',opacity: i <= currentStepIdx ? 1 : 0.4}}/>
                ))}
              </div>
            </div>
          )}

          {/* ── COURSES SECTION ───────────────────────────────────────── */}
          <div className="glass" style={{borderRadius:'18px',padding:'24px'}}>
            {/* Header */}
            <div style={{display:'flex',flexWrap:'wrap',alignItems:'center',justifyContent:'space-between',gap:'16px',marginBottom:'20px',paddingBottom:'20px',borderBottom:'1px solid rgba(255,255,255,0.06)'}}>
              <div>
                <h2 style={{margin:'0 0 4px',fontSize:'20px',fontWeight:'800',color:'white',letterSpacing:'-0.3px'}}>My Learning Journey</h2>
                <p style={{margin:0,fontSize:'12px',color:'rgba(100,116,139,0.8)'}}>Enrolled courses · Progress tracking · Automation</p>
              </div>

              <div style={{display:'flex',gap:'10px',flexWrap:'wrap'}}>
                <button
                  onClick={handleScanCourses}
                  disabled={scanning || isRunning}
                  className="btn"
                  style={{padding:'10px 18px',fontSize:'12px',color:'white',background:'linear-gradient(135deg,#3b82f6,#6366f1)',boxShadow:'0 6px 20px rgba(99,102,241,0.25)'}}
                >
                  {scanning ? <><IconSpinner/> Scanning...</> : <><IconScan/> Scan Enrolled Courses</>}
                </button>

                {hasScanned && ongoingCourses.length > 0 && (
                  <button
                    onClick={() => handleStartAutomation()}
                    disabled={isRunning || actionLoading}
                    className="btn"
                    style={{padding:'10px 18px',fontSize:'12px',color:'white',background:'linear-gradient(135deg,#ea580c,#f59e0b)',boxShadow:'0 6px 20px rgba(234,88,12,0.25)'}}
                  >
                    {actionLoading && automatingCourseUrl === 'all' ? <><IconSpinner/> Starting...</> : <><IconPlay size={13}/> Start All Automation ({ongoingCourses.length})</>}
                  </button>
                )}
              </div>
            </div>

            {/* Scan status toast */}
            {scanMessage && (
              <div style={{
                marginBottom:'16px',padding:'10px 14px',borderRadius:'10px',fontSize:'12px',fontWeight:'500',
                display:'flex',alignItems:'center',gap:'8px',
                background: scanning ? 'rgba(59,130,246,0.08)' : scanMessage.includes('Error') ? 'rgba(239,68,68,0.08)' : 'rgba(16,185,129,0.08)',
                border: `1px solid ${scanning ? 'rgba(59,130,246,0.25)' : scanMessage.includes('Error') ? 'rgba(239,68,68,0.25)' : 'rgba(16,185,129,0.25)'}`,
                color: scanning ? '#93c5fd' : scanMessage.includes('Error') ? '#fca5a5' : '#6ee7b7'
              }}>
                <span>{scanning ? '⚙️' : scanMessage.includes('Error') ? '❌' : '✅'}</span>
                {scanMessage}
              </div>
            )}

            {/* Tabs */}
            <div style={{display:'flex',gap:'8px',marginBottom:'20px'}}>
              {(['ongoing','finished'] as const).map((tab) => {
                const count = tab === 'ongoing' ? ongoingCourses.length : finishedCourses.length;
                const isActive = activeTab === tab;
                return (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`btn ${isActive ? 'tab-active' : ''}`}
                    style={{
                      padding:'8px 16px',fontSize:'12px',fontWeight:'700',
                      background: isActive ? '' : 'rgba(255,255,255,0.03)',
                      border:`1px solid ${isActive ? '' : 'rgba(255,255,255,0.07)'}`,
                      color: isActive ? '' : 'rgba(100,116,139,0.9)',
                      borderRadius:'10px'
                    }}
                  >
                    <span style={{marginRight:'6px'}}>{tab === 'ongoing' ? '📚' : '🏆'}</span>
                    {tab === 'ongoing' ? 'Ongoing' : 'Finished'} Courses
                    <span style={{
                      marginLeft:'6px',fontSize:'10px',fontWeight:'800',padding:'1px 7px',borderRadius:'20px',
                      background: isActive ? 'rgba(249,115,22,0.2)' : 'rgba(255,255,255,0.06)',
                      color: isActive ? '#fb923c' : 'rgba(148,163,184,0.7)'
                    }}>{count}</span>
                  </button>
                );
              })}
            </div>

            {/* Course Cards */}
            {!hasScanned && !scanning ? (
              <div style={{padding:'48px 24px',textAlign:'center',background:'rgba(2,6,23,0.5)',borderRadius:'16px',border:'1px solid rgba(255,255,255,0.05)'}}>
                <div style={{width:'72px',height:'72px',borderRadius:'20px',background:'linear-gradient(135deg,rgba(59,130,246,0.15),rgba(99,102,241,0.1))',border:'1px solid rgba(99,102,241,0.2)',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 16px',fontSize:'32px'}}>
                  🔍
                </div>
                <h3 style={{margin:'0 0 8px',fontSize:'16px',fontWeight:'700',color:'white'}}>Scan Your Enrolled Courses</h3>
                <p style={{margin:'0 0 20px',fontSize:'13px',color:'rgba(100,116,139,0.8)',maxWidth:'380px',lineHeight:'1.7',marginLeft:'auto',marginRight:'auto'}}>
                  The bot will login to DIKSHA and fetch all your ongoing and finished enrolled courses.
                </p>
                <button onClick={handleScanCourses} className="btn" style={{padding:'11px 24px',fontSize:'13px',color:'white',background:'linear-gradient(135deg,#3b82f6,#6366f1)',boxShadow:'0 8px 24px rgba(99,102,241,0.3)'}}>
                  <IconScan/> Scan Enrolled Courses Now
                </button>
              </div>
            ) : displayedCourses.length === 0 ? (
              <div style={{padding:'40px 24px',textAlign:'center',background:'rgba(2,6,23,0.5)',borderRadius:'16px',border:'1px solid rgba(255,255,255,0.05)'}}>
                <div style={{fontSize:'40px',marginBottom:'12px'}}>{activeTab === 'ongoing' ? '📚' : '🏆'}</div>
                <h3 style={{margin:'0 0 6px',fontSize:'15px',fontWeight:'700',color:'rgba(148,163,184,0.8)'}}>No {activeTab} courses found</h3>
                <p style={{margin:0,fontSize:'12px',color:'rgba(100,116,139,0.7)'}}>Try scanning again or switch tabs.</p>
              </div>
            ) : (
              <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(320px,1fr))',gap:'16px'}}>
                {displayedCourses.map((c, idx) => {
                  const pct = c.pct ?? c.progress ?? 0;
                  const isFinished = pct === 100 || c.status === "finished";
                  const isCurrent = c.current;
                  return (
                    <div
                      key={idx}
                      className="card-hover fade-in-up glass-dark"
                      style={{
                        borderRadius:'16px',
                        overflow:'hidden',
                        display:'flex',flexDirection:'column',
                        border: isCurrent ? '1px solid rgba(249,115,22,0.4)' : isFinished ? '1px solid rgba(16,185,129,0.2)' : '1px solid rgba(255,255,255,0.05)',
                        boxShadow: isCurrent ? '0 0 30px rgba(249,115,22,0.1),inset 0 0 30px rgba(249,115,22,0.03)' : 'none',
                        animationDelay:`${idx * 0.06}s`
                      }}
                    >
                      {/* Course image / banner */}
                      <div style={{height:'120px',background: isCurrent ? 'linear-gradient(135deg,rgba(234,88,12,0.15),rgba(245,158,11,0.08))' : isFinished ? 'linear-gradient(135deg,rgba(16,185,129,0.1),rgba(5,150,105,0.05))' : 'linear-gradient(135deg,rgba(15,23,42,0.9),rgba(2,6,23,0.95))',display:'flex',alignItems:'center',justifyContent:'center',position:'relative',borderBottom:'1px solid rgba(255,255,255,0.05)'}}>
                        {c.image_url ? (
                          <img src={c.image_url} alt={c.title} style={{width:'100%',height:'100%',objectFit:'cover',opacity:0.85}}/>
                        ) : (
                          <div style={{textAlign:'center'}}>
                            <div style={{width:'48px',height:'48px',borderRadius:'14px',background: isFinished ? 'rgba(16,185,129,0.15)' : 'rgba(249,115,22,0.1)',border:`1px solid ${isFinished ? 'rgba(16,185,129,0.25)' : 'rgba(249,115,22,0.2)'}`,display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 6px',fontSize:'22px'}}>
                              {isFinished ? '🏆' : isCurrent ? '▶️' : '🎓'}
                            </div>
                            <p style={{margin:0,fontSize:'9px',color:'rgba(100,116,139,0.7)',fontWeight:'600',textTransform:'uppercase',letterSpacing:'0.05em'}}>DIKSHA Digital Learning</p>
                          </div>
                        )}

                        {/* Status badge */}
                        <div style={{position:'absolute',top:'10px',right:'10px'}}>
                          <span style={{
                            fontSize:'10px',fontWeight:'700',padding:'3px 9px',borderRadius:'20px',
                            background: isFinished ? 'rgba(16,185,129,0.2)' : isCurrent ? 'rgba(249,115,22,0.3)' : 'rgba(245,158,11,0.15)',
                            border: `1px solid ${isFinished ? 'rgba(16,185,129,0.35)' : isCurrent ? 'rgba(249,115,22,0.5)' : 'rgba(245,158,11,0.3)'}`,
                            color: isFinished ? '#6ee7b7' : isCurrent ? '#fdba74' : '#fcd34d',
                            display:'flex',alignItems:'center',gap:'4px'
                          }}>
                            {isFinished ? <><IconCheck/> 100% Done</> : isCurrent ? '⚡ Automating' : `${pct}%`}
                          </span>
                        </div>

                        {/* Currently automating pulse ring */}
                        {isCurrent && (
                          <div className="pulse-dot" style={{position:'absolute',bottom:'10px',left:'10px',width:'8px',height:'8px',borderRadius:'50%',background:'#f97316',boxShadow:'0 0 8px rgba(249,115,22,0.6)'}}/>
                        )}
                      </div>

                      {/* Body */}
                      <div style={{padding:'16px',flex:1,display:'flex',flexDirection:'column',gap:'12px'}}>
                        <div>
                          <h3 style={{margin:'0 0 4px',fontSize:'13px',fontWeight:'700',color:'white',lineHeight:'1.5',display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical',overflow:'hidden'}}>
                            {c.title}
                          </h3>
                          {c.ends_on && (
                            <p style={{margin:0,fontSize:'11px',color:'rgba(100,116,139,0.8)',fontWeight:'500'}}>
                              📅 Ends: <span style={{color:'rgba(148,163,184,0.9)'}}>{c.ends_on}</span>
                            </p>
                          )}
                        </div>

                        {/* Progress bar */}
                        <div>
                          <div style={{display:'flex',justifyContent:'space-between',marginBottom:'6px'}}>
                            <span style={{fontSize:'10px',color:'rgba(100,116,139,0.8)',fontWeight:'600',textTransform:'uppercase',letterSpacing:'0.04em'}}>Progress</span>
                            <span style={{fontSize:'11px',fontWeight:'800',color: isFinished ? '#10b981' : '#f97316'}}>{pct}%</span>
                          </div>
                          <div style={{background:'rgba(2,6,23,0.8)',borderRadius:'100px',height:'6px',border:'1px solid rgba(255,255,255,0.06)',overflow:'hidden'}}>
                            <div style={{height:'100%',width:`${pct}%`,borderRadius:'100px',background: isFinished ? 'linear-gradient(90deg,#10b981,#34d399)' : isCurrent ? 'linear-gradient(90deg,#ea580c,#f59e0b)' : 'linear-gradient(90deg,#3b82f6,#6366f1)',transition:'width 0.6s ease'}}/>
                          </div>
                        </div>
                      </div>

                      {/* Footer actions */}
                      <div style={{padding:'12px 16px',borderTop:'1px solid rgba(255,255,255,0.05)',display:'flex',gap:'8px',background:'rgba(2,6,23,0.4)'}}>
                        <a
                          href={c.url}
                          target="_blank"
                          rel="noreferrer"
                          style={{flex:1,padding:'8px',borderRadius:'9px',background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.08)',color:'rgba(148,163,184,0.9)',fontSize:'11px',fontWeight:'600',display:'flex',alignItems:'center',justifyContent:'center',gap:'5px',textDecoration:'none',transition:'all 0.2s'}}
                        >
                          <IconExternal/> View Course
                        </a>

                        <button
                          onClick={() => handleStartAutomation(c.url)}
                          disabled={isRunning || actionLoading || isFinished}
                          className="btn"
                          style={{
                            flex:1,padding:'8px',fontSize:'11px',
                            color: isFinished ? 'rgba(100,116,139,0.6)' : 'white',
                            background: isFinished ? 'rgba(255,255,255,0.03)' : 'linear-gradient(135deg,#ea580c,#f59e0b)',
                            border: isFinished ? '1px solid rgba(255,255,255,0.06)' : 'none',
                            boxShadow: isFinished ? 'none' : '0 4px 14px rgba(234,88,12,0.25)'
                          }}
                        >
                          {automatingCourseUrl === c.url ? (
                            <><IconSpinner/> Starting...</>
                          ) : isFinished ? (
                            <><IconCheck/> Completed</>
                          ) : (
                            <><IconPlay size={11}/> Start Automation</>
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── BOTTOM: Steps + Logs ──────────────────────────────────── */}
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'16px'}}>

            {/* Bot Execution Steps */}
            <div className="glass" style={{borderRadius:'18px',padding:'20px'}}>
              <h3 style={{margin:'0 0 14px',fontSize:'11px',fontWeight:'700',color:'rgba(100,116,139,0.8)',textTransform:'uppercase',letterSpacing:'0.08em'}}>
                ⚙️ Bot Execution Steps
              </h3>
              <div style={{display:'flex',flexDirection:'column',gap:'6px'}}>
                {STEP_KEYWORDS.map((s, i) => {
                  const done = isDone ? true : i < currentStepIdx;
                  const active = isRunning && i === currentStepIdx;
                  return (
                    <div
                      key={i}
                      style={{
                        display:'flex',alignItems:'center',gap:'10px',padding:'9px 12px',borderRadius:'10px',fontSize:'12px',
                        background: active ? 'rgba(249,115,22,0.08)' : done ? 'rgba(16,185,129,0.04)' : 'rgba(255,255,255,0.02)',
                        border: `1px solid ${active ? 'rgba(249,115,22,0.25)' : done ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.04)'}`,
                        color: active ? '#fdba74' : done ? 'rgba(52,211,153,0.9)' : 'rgba(100,116,139,0.7)',
                        transition:'all 0.3s'
                      }}
                    >
                      <span style={{fontSize:'14px',flexShrink:0}}>
                        {done ? '✅' : active ? '⚙️' : '⏳'}
                      </span>
                      <span style={{flex:1,fontWeight: active ? '600' : '500'}}>{s.icon} {s.label}</span>
                      {active && <div className="pulse-dot" style={{width:'6px',height:'6px',borderRadius:'50%',background:'#f97316',flexShrink:0}}/>}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Live Logs */}
            <div className="glass" style={{borderRadius:'18px',padding:'20px',display:'flex',flexDirection:'column',gap:'12px'}}>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                <h3 style={{margin:0,fontSize:'11px',fontWeight:'700',color:'rgba(100,116,139,0.8)',textTransform:'uppercase',letterSpacing:'0.08em',display:'flex',alignItems:'center',gap:'6px'}}>
                  💻 Live Server Logs
                  <span style={{width:'6px',height:'6px',borderRadius:'50%',background:'#10b981',display:'inline-block',boxShadow:'0 0 6px rgba(16,185,129,0.6)'}}/>
                </h3>
                <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
                  <span style={{fontSize:'10px',color:'rgba(100,116,139,0.6)',fontFamily:'monospace'}}>{logsList.length} lines</span>
                  <button
                    onClick={() => setShowLogs(!showLogs)}
                    style={{fontSize:'10px',fontWeight:'600',color:'rgba(100,116,139,0.7)',background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.07)',borderRadius:'6px',padding:'3px 8px',cursor:'pointer'}}
                  >
                    {showLogs ? 'Collapse' : 'Expand'}
                  </button>
                </div>
              </div>

              <div
                ref={logRef}
                style={{
                  background:'rgba(2,6,23,0.8)',border:'1px solid rgba(255,255,255,0.05)',borderRadius:'10px',padding:'12px',
                  height: showLogs ? '320px' : '220px',
                  overflowY:'auto',
                  transition:'height 0.3s ease'
                }}
              >
                {logsList.length === 0 ? (
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
    </>
  );
}
