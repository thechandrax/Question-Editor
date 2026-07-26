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
  <svg xmlns="http://www.w3.org/2000/svg" width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/>
    <circle cx="12" cy="12" r="1.5" fill="#f59e0b"/>
  </svg>
);
const IconEye = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#4f46e5" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
    <circle cx="12" cy="12" r="3.5" fill="#e0e7ff"/>
  </svg>
);
const IconEyeOff = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 19c-7 0-10-7-10-7a19.4 19.4 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 10 7 10 7a19.5 19.5 0 0 1-4.29 5.34"/>
    <line x1="1" y1="1" x2="23" y2="23"/>
  </svg>
);
const IconLogin = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/>
  </svg>
);
const IconLogout = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
  </svg>
);
const IconBook = ({ size = 16 }: { size?: number }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z"/>
    <path d="M6.5 6H20"/>
  </svg>
);
const IconTrophy = ({ size = 16 }: { size?: number }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/>
    <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/>
    <path d="M4 22h16"/>
    <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/>
    <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/>
    <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>
  </svg>
);
const IconScan = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
  </svg>
);
const IconTerminal = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4f46e5" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="4 17 10 11 4 5"/>
    <line x1="12" y1="19" x2="20" y2="19"/>
  </svg>
);
const IconCopy = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
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
interface ModalConfig {
  open: boolean;
  title: string;
  subtitle: string;
  confirmText: string;
  cancelText?: string;
  variant: "danger" | "warning" | "info";
  icon: React.ReactNode;
  onConfirm: () => void | Promise<void>;
}

interface ConfirmModalProps {
  modal: ModalConfig;
  onClose: () => void;
  actionLoading: boolean;
}

function ConfirmModalDialog({ modal, onClose, actionLoading }: ConfirmModalProps) {
  const isDanger = modal.variant === "danger";
  const isWarning = modal.variant === "warning";

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 10000,
      background: 'rgba(15, 23, 42, 0.65)',
      backdropFilter: 'blur(10px)',
      WebkitBackdropFilter: 'blur(10px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '20px',
      animation: 'fadein 0.2s ease-out'
    }}>
      <div style={{
        width: '100%', maxWidth: '440px',
        background: '#ffffff',
        borderRadius: '26px',
        padding: '32px 28px',
        border: isDanger
          ? '1.5px solid rgba(244, 63, 94, 0.3)'
          : isWarning
          ? '1.5px solid rgba(245, 158, 11, 0.3)'
          : '1.5px solid rgba(99, 102, 241, 0.3)',
        boxShadow: isDanger
          ? '0 25px 60px -15px rgba(225, 29, 72, 0.25), 0 10px 25px -5px rgba(0, 0, 0, 0.08)'
          : isWarning
          ? '0 25px 60px -15px rgba(245, 158, 11, 0.22), 0 10px 25px -5px rgba(0, 0, 0, 0.08)'
          : '0 25px 60px -15px rgba(79, 70, 229, 0.22), 0 10px 25px -5px rgba(0, 0, 0, 0.08)',
        position: 'relative',
        textAlign: 'center'
      }}>
        {/* Icon Badge */}
        <div style={{
          width: '68px', height: '68px', borderRadius: '22px',
          background: isDanger
            ? 'linear-gradient(135deg, #fff1f2 0%, #ffe4e6 100%)'
            : isWarning
            ? 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)'
            : 'linear-gradient(135deg, #e0e7ff 0%, #c7d2fe 100%)',
          border: `1.5px solid ${isDanger ? '#fecdd3' : isWarning ? '#fcd34d' : '#818cf8'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '30px',
          margin: '0 auto 20px',
          boxShadow: `0 10px 24px ${isDanger ? 'rgba(225,29,72,0.18)' : isWarning ? 'rgba(245,158,11,0.18)' : 'rgba(99,102,241,0.18)'}`
        }}>
          {modal.icon}
        </div>

        {/* Text Content */}
        <div style={{ marginBottom: '26px' }}>
          <h3 style={{ margin: '0 0 8px', fontSize: '20px', fontWeight: '800', color: '#0f172a', letterSpacing: '-0.3px' }}>
            {modal.title}
          </h3>
          <p style={{ margin: 0, fontSize: '14px', color: '#64748b', fontWeight: '500', lineHeight: '1.5' }}>
            {modal.subtitle}
          </p>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={onClose}
            className="btn"
            style={{
              flex: 1, padding: '13px',
              borderRadius: '14px',
              border: '1.5px solid #cbd5e1',
              background: '#f8fafc',
              color: '#475569',
              fontSize: '14px', fontWeight: '700',
              cursor: 'pointer'
            }}
          >
            {modal.cancelText || "Cancel"}
          </button>

          <button
            onClick={() => modal.onConfirm()}
            disabled={actionLoading}
            className="btn"
            style={{
              flex: 1, padding: '13px',
              borderRadius: '14px',
              border: 'none',
              background: isDanger
                ? 'linear-gradient(135deg, #f43f5e 0%, #e11d48 100%)'
                : isWarning
                ? 'linear-gradient(135deg, #d97706 0%, #b45309 100%)'
                : 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)',
              color: '#ffffff',
              fontSize: '14px', fontWeight: '800',
              cursor: 'pointer',
              boxShadow: isDanger
                ? '0 8px 20px rgba(225, 29, 72, 0.32)'
                : isWarning
                ? '0 8px 20px rgba(217, 119, 6, 0.32)'
                : '0 8px 20px rgba(79, 70, 229, 0.32)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px'
            }}
          >
            {actionLoading ? <IconSpinner /> : modal.confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function DikshaAutomationPage() {
  const [stage, setStage] = useState<Stage>("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [pin, setPin] = useState("");
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
  const [, setCurrentStepIdx] = useState(0);
  const [actionLoading, setActionLoading] = useState(false);
  const [automatingCourseUrl, setAutomatingCourseUrl] = useState<string | null>(null);
  const [showLogs, setShowLogs] = useState(false);

  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [courseDetails, setCourseDetails] = useState<Record<string, unknown> | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [detailsError, setDetailsError] = useState("");
  const [expandedModuleIdxs, setExpandedModuleIdxs] = useState<Record<number, boolean>>({});
  const [confirmModal, setConfirmModal] = useState<ModalConfig | null>(null);
  const [copiedLogs, setCopiedLogs] = useState(false);

  const handleCopyLogs = () => {
    const text = status?.logs ? status.logs.join('\n') : "";
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      setCopiedLogs(true);
      setTimeout(() => setCopiedLogs(false), 2000);
    }).catch(() => {});
  };

  const logRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  // Auto clear scan toast message after 30 seconds
  useEffect(() => {
    if (scanMessage && !scanning) {
      const timer = setTimeout(() => {
        setScanMessage("");
      }, 30000);
      return () => clearTimeout(timer);
    }
  }, [scanMessage, scanning]);

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
        // Only update courses from polling if automation is actively running
        if (data.running && data.courses && data.courses.length > 0) {
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
    if (!username || !password || !pin) {
      setLoginError("Please enter your username, password, and 6-digit Security PIN.");
      return;
    }
    if (pin.trim() !== "452389") {
      setLoginError("Invalid PIN. Access Denied.");
      return;
    }
    setLoginLoading(true);
    setLoginVerified(false);
    try {
      const res = await fetch("/api/diksha/verify-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, pin }),
      });
      const data = await res.json();
      if (data.valid) {
        setLoginVerified(true);
        // Clear old session state on new login
        try { await fetch("/api/diksha/reset", { method: "POST" }); } catch {}
        setTimeout(() => {
          setLoginLoading(false);
          setLoginVerified(false);
          setStage("dashboard");
          setElapsed(0);
          setCourses([]);
          setHasScanned(false);
          setStatus(null);
          setScanMessage("");
        }, 600);
      } else {
        setLoginLoading(false);
        setLoginError("Account verification failed. Please check credentials.");
      }
    } catch {
      setLoginLoading(false);
      setLoginError("Connection error. Check server status.");
    }
  };

  const handleScanCourses = async () => {
    setScanning(true);
    setScanMessage("Starting course discovery...");
    try {
      const res = await fetch("/api/diksha/fetch-courses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Scan request failed.");

      let fetchedCourses: Course[] = [];
      if (Array.isArray(data)) {
        fetchedCourses = data;
      } else if (data && typeof data === "object") {
        if (Array.isArray(data.courses) && data.courses.length > 0) {
          fetchedCourses = data.courses;
        } else if (Array.isArray(data.ongoing) || Array.isArray(data.finished)) {
          const ongoing = Array.isArray(data.ongoing) ? data.ongoing : [];
          const finished = Array.isArray(data.finished) ? data.finished : [];
          fetchedCourses = [...ongoing, ...finished];
        }
      }

      if (fetchedCourses.length > 0) {
        setCourses(fetchedCourses);
        setHasScanned(true);
        setScanMessage(`Successfully scanned ${fetchedCourses.length} course(s).`);
      } else {
        setCourses([]);
        setHasScanned(true);
        setScanMessage(data.message || "Scan finished: No enrolled courses found on this account.");
      }
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

  const handlePauseToggle = () => {
    const isCurrentlyPaused = status?.paused;
    setConfirmModal({
      open: true,
      title: isCurrentlyPaused ? "Resume Automation?" : "Pause Automation?",
      subtitle: isCurrentlyPaused
        ? "Do you want to resume the active DIKSHA course automation process now?"
        : "Are you sure you want to temporarily pause the current automation process?",
      confirmText: isCurrentlyPaused ? "▶ Resume" : "⏸ Pause",
      cancelText: "Cancel",
      variant: "warning",
      icon: isCurrentlyPaused ? (
        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="currentColor" color="#b45309">
          <polygon points="5 3 19 12 5 21 5 3"/>
        </svg>
      ) : (
        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="currentColor" color="#b45309">
          <rect x="6" y="4" width="4" height="16" rx="1"/>
          <rect x="14" y="4" width="4" height="16" rx="1"/>
        </svg>
      ),
      onConfirm: async () => {
        setActionLoading(true);
        setConfirmModal(null);
        try { await fetch("/api/diksha/pause", { method: "POST" }); } catch { /* silent */ }
        finally { setActionLoading(false); }
      }
    });
  };

  const handleStop = () => {
    setConfirmModal({
      open: true,
      title: "Stop Automation?",
      subtitle: "Are you sure you want to stop the active automation? Progress completed so far will be saved on the server.",
      confirmText: "Yes, Stop Automation",
      cancelText: "Cancel",
      variant: "danger",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 24 24" fill="currentColor" color="#e11d48">
          <rect x="4" y="4" width="16" height="16" rx="3"/>
        </svg>
      ),
      onConfirm: async () => {
        setActionLoading(true);
        setConfirmModal(null);
        try { await fetch("/api/diksha/stop", { method: "POST" }); } catch { /* silent */ }
        finally { setActionLoading(false); }
      }
    });
  };

  const handleLogoutClick = () => {
    setConfirmModal({
      open: true,
      title: "Confirm Logout",
      subtitle: "Are you sure you want to log out of DIKSHA Courses? Any unsaved session will end.",
      confirmText: "Yes, Logout",
      cancelText: "Cancel",
      variant: "danger",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#e11d48" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
          <polyline points="16 17 21 12 16 7"/>
          <line x1="21" y1="12" x2="9" y2="12"/>
        </svg>
      ),
      onConfirm: async () => {
        setConfirmModal(null);
        try { await fetch("/api/diksha/reset", { method: "POST" }); } catch {}
        setStage("login");
        setCourses([]);
        setHasScanned(false);
        setStatus(null);
        setScanMessage("");
        stopPolling();
      }
    });
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
      });
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
          .diksha-root * { font-family: 'Cambria', Georgia, serif !important; box-sizing: border-box; }
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

          <div style={{width:'100%',maxWidth:'440px',position:'relative',zIndex:10}}>
            {/* Logo & Title */}
            <div style={{textAlign:'center',marginBottom:'14px'}}>
              <div style={{
                display:'inline-flex',alignItems:'center',justifyContent:'center',
                width:'68px',height:'68px',borderRadius:'20px',
                background:'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
                padding:'10px',
                border:'1.5px solid rgba(99,102,241,0.25)',
                boxShadow:'0 12px 28px -8px rgba(79,70,229,0.22), 0 0 16px rgba(99,102,241,0.10)',
                marginBottom:'10px'
              }}>
                <img
                  src="/diksha-logo.png"
                  alt="DIKSHA Official Logo"
                  style={{width:'100%',height:'100%',objectFit:'contain',filter:'drop-shadow(0 3px 8px rgba(79,70,229,0.15))'}}
                />
              </div>
              <h1 style={{fontSize:'22px',fontWeight:'800',color:'#0f172a',margin:'0 0 2px',letterSpacing:'-0.4px'}}>
                DIKSHA COURSES
              </h1>
              <p style={{color:'#64748b',fontSize:'13.5px',margin:0,lineHeight:'1.3',fontWeight:'600'}}>
                Complete your courses automatically
              </p>
            </div>

            {/* Glass Card */}
            <div className="glass-card" style={{borderRadius:'24px',padding:'24px 28px'}}>
              {loginError && (
                <div style={{
                  marginBottom: '16px',
                  background: 'linear-gradient(135deg, #fff1f2 0%, #ffe4e6 100%)',
                  border: '1px solid #fecdd3',
                  borderRadius: '14px',
                  padding: '10px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  boxShadow: '0 4px 12px rgba(225,29,72,0.08)'
                }}>
                  <div style={{
                    width: '26px', height: '26px', borderRadius: '8px',
                    background: '#ffe4e6', border: '1px solid #fda4af',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#e11d48" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>
                      <line x1="12" y1="9" x2="12" y2="13"/>
                      <line x1="12" y1="17" x2="12.01" y2="17"/>
                    </svg>
                  </div>
                  <p style={{ color: '#e11d48', fontSize: '12.5px', margin: 0, fontWeight: '700', lineHeight: '1.4' }}>
                    {loginError}
                  </p>
                </div>
              )}

              <form onSubmit={handleSimpleLogin} style={{display:'flex',flexDirection:'column',gap:'16px'}}>
                <div>
                  <label style={{display:'block',fontSize:'11.5px',fontWeight:'800',color:'#475569',marginBottom:'5px',textTransform:'uppercase',letterSpacing:'0.06em'}}>
                    DIKSHA Username / Mobile
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="teacher@example.com"
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
                      style={{paddingRight:'52px'}}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass(!showPass)}
                      style={{
                        position:'absolute',right:'10px',top:'50%',transform:'translateY(-50%)',
                        background:'#ffffff',border:'1.5px solid #e2e8f0',borderRadius:'10px',
                        cursor:'pointer',padding:'7px 10px',display:'flex',alignItems:'center',justifyContent:'center',
                        boxShadow:'0 2px 8px rgba(79,70,229,0.08)',
                        transition:'all 0.2s ease'
                      }}
                      title={showPass ? "Hide password" : "Show password"}
                    >
                      {showPass ? <IconEyeOff /> : <IconEye />}
                    </button>
                  </div>
                </div>

                <div>
                  <label style={{display:'block',fontSize:'12px',fontWeight:'800',color:'#475569',marginBottom:'8px',textTransform:'uppercase',letterSpacing:'0.06em'}}>
                    Admin Security PIN
                  </label>
                  <input
                    type="password"
                    maxLength={6}
                    required
                    placeholder="••••••••••••"
                    value={pin}
                    onChange={(e) => setPin(e.target.value)}
                    className="input-field"
                  />
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
                    <>Verified! Opening Dashboard…</>
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
        .dash-root * { font-family: 'Cambria', Georgia, serif !important; box-sizing: border-box; }
        @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes pulse-dot { 0%,100%{transform:scale(1);opacity:1} 50%{transform:scale(1.4);opacity:0.6} }
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
        .btn { border:none; cursor:pointer; display:inline-flex; align-items:center; justify-content:center; gap:6px; font-weight:700; border-radius:10px; transition:all 0.2s ease; font-family:'Cambria',Georgia,serif !important; }
        .btn:hover { filter: brightness(1.05); transform: translateY(-1px); }
        .btn:active { transform: translateY(0); }
        .btn:disabled { opacity:0.45; cursor:not-allowed; transform:none; filter:none; }
        .tab-active { background: #4f46e5 !important; border-color: #4f46e5 !important; color: #ffffff !important; box-shadow: 0 4px 14px rgba(79,70,229,0.3) !important; }
        .log-line { padding: 3px 0; font-size:12px; line-height:1.6; font-family:'JetBrains Mono',monospace; word-break: break-all; }
        ::-webkit-scrollbar { width:6px; height:6px; }
        ::-webkit-scrollbar-track { background: #f1f5f9; }
        ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius:4px; }

        @media (max-width: 640px) {
          .dash-root { padding: 12px 10px !important; overflow-x: hidden !important; width: 100% !important; max-width: 100vw !important; }
          .mobile-card { padding: 14px 12px !important; border-radius: 18px !important; width: 100% !important; max-width: 100% !important; overflow: hidden !important; gap: 8px !important; }
          .mobile-header-row { flex-direction: column !important; align-items: stretch !important; gap: 8px !important; }
          .mobile-brand-block { width: 100% !important; gap: 8px !important; }
          .mobile-subtitle { white-space: nowrap !important; overflow: hidden !important; text-overflow: ellipsis !important; font-size: 11px !important; width: 100% !important; }
          .mobile-email-wrapper { width: 100% !important; display: flex !important; margin-top: 0 !important; margin-bottom: 0 !important; }
          .mobile-email-pill { width: 100% !important; max-width: 100% !important; height: 40px !important; min-height: 40px !important; justify-content: center !important; text-align: center !important; padding: 0 14px !important; font-size: 12px !important; border-radius: 14px !important; box-sizing: border-box !important; }
          .mobile-email-text { max-width: 85% !important; overflow: hidden !important; text-overflow: ellipsis !important; white-space: nowrap !important; }
          .mobile-btn-group { width: 100% !important; display: grid !important; grid-template-columns: 1fr 1fr !important; gap: 8px !important; margin-top: 0 !important; }
          .mobile-btn, .mobile-status-badge { width: 100% !important; height: 40px !important; min-height: 40px !important; padding: 0 10px !important; font-size: 12px !important; justify-content: center !important; border-radius: 14px !important; box-sizing: border-box !important; }
          .mobile-full-grid { grid-column: 1 / -1 !important; }
          .mobile-grid-2 { grid-template-columns: 1fr !important; }
          .mobile-tabs { width: 100% !important; display: grid !important; grid-template-columns: 1fr 1fr !important; gap: 6px !important; }
          .mobile-tab-btn { padding: 10px 6px !important; font-size: 11px !important; width: 100% !important; justify-content: center !important; }
          .mobile-log-box { height: 260px !important; padding: 10px !important; font-size: 10px !important; word-break: break-all !important; white-space: pre-wrap !important; overflow-x: auto !important; }
          .mobile-status-row { flex-direction: column !important; align-items: stretch !important; gap: 12px !important; }
          .mobile-stat-pills { display: grid !important; grid-template-columns: 1fr 1fr !important; width: 100% !important; gap: 10px !important; }
          .mobile-course-grid { grid-template-columns: 1fr !important; gap: 14px !important; }
          .mobile-modal-content { padding: 14px !important; grid-template-columns: 1fr !important; gap: 14px !important; }
          .mobile-modal-box { width: 95vw !important; max-width: 95vw !important; height: 92vh !important; border-radius: 18px !important; }
          .mobile-full-btn { width: 100% !important; }
        }
      `}</style>

      <div className="dash-root" style={{minHeight:'100vh',background:'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 50%, #e2e8f0 100%)',color:'#0f172a',padding:'24px 16px',position:'relative',width:'100%',maxWidth:'100vw',overflowX:'hidden'}}>
        {/* Subtle grid background */}
        <div style={{position:'fixed',inset:0,backgroundImage:'linear-gradient(rgba(99,102,241,0.03) 1px,transparent 1px),linear-gradient(90deg,rgba(99,102,241,0.03) 1px,transparent 1px)',backgroundSize:'48px 48px',pointerEvents:'none',zIndex:0}}/>
        {/* Top ambient blur */}
        <div style={{position:'fixed',top:'-100px',left:'50%',transform:'translateX(-50%)',width:'800px',height:'300px',background:'radial-gradient(ellipse,rgba(99,102,241,0.10) 0%,transparent 70%)',pointerEvents:'none',zIndex:0}}/>

        <div style={{maxWidth:'1200px',margin:'0 auto',position:'relative',zIndex:1,display:'flex',flexDirection:'column',gap:'20px',width:'100%'}}>

          {/* ── TOP NAVBAR ─────────────────────────────────────────────── */}
          <div className="glass-card-light mobile-card" style={{borderRadius:'20px',padding:'16px 24px',display:'flex',flexWrap:'wrap',alignItems:'center',justifyContent:'space-between',gap:'16px',width:'100%'}}>
            <div className="mobile-brand-block" style={{display:'flex',flexDirection:'column',gap:'10px',minWidth:0,flex:1}}>
              {/* Row 1: Logo emblem on left middle + Titles on right */}
              <div style={{display:'flex',alignItems:'center',gap:'12px',width:'100%'}}>
                <div style={{
                  width:'48px',height:'48px',borderRadius:'16px',
                  background:'#ffffff',padding:'6px',
                  border:'1.5px solid rgba(99,102,241,0.22)',
                  boxShadow:'0 8px 22px rgba(79,70,229,0.18)',
                  flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center',
                  overflow:'hidden'
                }}>
                  <img
                    src="/diksha-logo.png"
                    alt="DIKSHA Official Logo"
                    style={{width:'100%',height:'100%',objectFit:'contain',filter:'drop-shadow(0 2px 6px rgba(79,70,229,0.12))'}}
                  />
                </div>
                <div style={{minWidth:0,flex:1}}>
                  <h1 style={{margin:0,fontSize:'18px',fontWeight:'800',color:'#0f172a',letterSpacing:'-0.4px',lineHeight:'1.2'}}>DIKSHA COURSES</h1>
                  <p className="mobile-subtitle" style={{margin:'2px 0 0',fontSize:'12px',color:'#64748b',fontWeight:'600',lineHeight:'1.3'}}>My Learning Journey & Course Automation</p>
                </div>
              </div>

              {/* Row 2: Email Badge Pill (Below BOTH Logo & Titles!) */}
              <div className="mobile-email-wrapper" style={{display:'flex',alignItems:'center',gap:'6px',width:'100%'}}>
                <span className="mobile-email-pill" style={{
                  fontSize:'11px',
                  fontWeight:'700',
                  color:'#4f46e5',
                  background:'linear-gradient(135deg, rgba(99,102,241,0.08) 0%, rgba(139,92,246,0.12) 100%)',
                  border:'1px solid rgba(99,102,241,0.25)',
                  borderRadius:'20px',
                  padding:'5px 14px',
                  display:'inline-flex',
                  alignItems:'center',
                  gap:'6px',
                  boxShadow:'0 2px 6px rgba(79,70,229,0.06)'
                }}>
                  <span style={{width:'6px',height:'6px',borderRadius:'50%',background:'#22c55e',display:'inline-block',boxShadow:'0 0 6px #22c55e',flexShrink:0}}/>
                  <span className="mobile-email-text">{username || "User"}</span>
                </span>
              </div>
            </div>

            <div className="mobile-btn-group" style={{display:'flex',alignItems:'center',gap:'10px',flexWrap:'wrap'}}>
              {/* Status pill (Only shown when active/running/paused/done/error) */}
              {statusLabel !== "Idle" && (
                <div className="mobile-status-badge" style={{
                  display:'inline-flex',alignItems:'center',gap:'8px',
                  padding:'8px 16px',fontSize:'12px',fontWeight:'800',
                  background:'#ffffff',border:`1.5px solid ${statusColor}40`,
                  color:statusColor,borderRadius:'14px',
                  boxShadow:'0 2px 8px rgba(0,0,0,0.03)'
                }}>
                  <div style={{width:'8px',height:'8px',borderRadius:'50%',background:statusColor,flexShrink:0,boxShadow:`0 0 6px ${statusColor}`}}/>
                  <span>{statusLabel}</span>
                </div>
              )}

              {isRunning && (
                <>
                  <button
                    onClick={handlePauseToggle}
                    disabled={actionLoading}
                    className="btn mobile-btn"
                    style={{
                      padding:'8px 18px',fontSize:'12px',fontWeight:'800',
                      background: isPaused ? '#fffbeb' : '#ffffff',
                      border: `1.5px solid ${isPaused ? '#fcd34d' : '#cbd5e1'}`,
                      color: isPaused ? '#b45309' : '#334155',
                      borderRadius:'14px',
                      boxShadow:'0 2px 8px rgba(0,0,0,0.03)'
                    }}
                  >
                    {isPaused ? '▶ Resume' : '⏸ Pause'}
                  </button>
                  <button
                    onClick={handleStop}
                    disabled={actionLoading}
                    className="btn mobile-btn"
                    style={{
                      padding:'8px 18px',fontSize:'12px',fontWeight:'800',
                      background:'#fff1f2',
                      border:'1.5px solid #fecdd3',
                      color:'#dc2626',
                      borderRadius:'14px',
                      boxShadow:'0 2px 8px rgba(0,0,0,0.03)'
                    }}
                  >
                    ⏹ Stop
                  </button>
                </>
              )}

              <button
                onClick={handleLogoutClick}
                className={`btn mobile-btn ${!isRunning && statusLabel === "Idle" ? "mobile-full-grid" : ""}`}
                style={{
                  padding:'8px 18px',fontSize:'12px',fontWeight:'800',
                  background:'#ffffff',
                  border:'1.5px solid #cbd5e1',
                  color:'#e11d48',
                  borderRadius:'14px',
                  boxShadow:'0 2px 8px rgba(0,0,0,0.03)'
                }}
              >
                <IconLogout /> Logout
              </button>
            </div>
          </div>

          {/* ── AUTOMATION STATUS BANNER ──────────────────────────────── */}
          {(isRunning || isDone || isStopped || isError) && (
            <div className="glass-card-light fade-in-up mobile-card" style={{borderRadius:'20px',padding:'24px',border:`1px solid ${statusColor}40`,width:'100%'}}>
              <div className="mobile-status-row" style={{display:'flex',flexWrap:'wrap',alignItems:'center',justifyContent:'space-between',gap:'16px',marginBottom:'16px'}}>
                <div style={{display:'flex',alignItems:'center',gap:'14px',minWidth:0}}>
                  <div style={{width:'42px',height:'42px',borderRadius:'12px',background:`${statusColor}15`,border:`1px solid ${statusColor}30`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'20px',flexShrink:0}}>
                    {isDone ? '🎉' : isPaused ? '⏸' : isError ? '⚠️' : isStopped ? '⏹' : '⚙️'}
                  </div>
                  <div style={{minWidth:0}}>
                    <p style={{margin:0,fontSize:'11px',fontWeight:'800',color:'#64748b',textTransform:'uppercase',letterSpacing:'0.06em'}}>Automation Status</p>
                    <p style={{margin:'4px 0 0',fontSize:'14px',fontWeight:'700',color:'#0f172a',wordBreak:'break-word'}}>{currentStepMsg}</p>
                  </div>
                </div>

                <div className="mobile-stat-pills" style={{display:'flex',alignItems:'center',gap:'20px'}}>
                  <div style={{textAlign:'left',background:'#f8fafc',padding:'8px 14px',borderRadius:'12px',border:'1px solid #e2e8f0',flex:1}}>
                    <p style={{margin:0,fontSize:'10px',color:'#64748b',fontWeight:'700',textTransform:'uppercase'}}>Elapsed</p>
                    <p style={{margin:'2px 0 0',fontSize:'16px',fontWeight:'800',color:'#0f172a',fontFamily:'JetBrains Mono, monospace'}}>{formatTime(elapsed)}</p>
                  </div>
                  <div style={{textAlign:'left',background:'#f8fafc',padding:'8px 14px',borderRadius:'12px',border:'1px solid #e2e8f0',flex:1}}>
                    <p style={{margin:0,fontSize:'10px',color:'#64748b',fontWeight:'700',textTransform:'uppercase'}}>Progress</p>
                    <p style={{margin:'2px 0 0',fontSize:'22px',fontWeight:'800',color:statusColor,lineHeight:1}}>{overallProgress}%</p>
                  </div>
                </div>
              </div>

              {/* Progress bar */}
              <div style={{background:'#e2e8f0',borderRadius:'100px',height:'10px',overflow:'hidden',width:'100%'}}>
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
          <div className="glass-card-light mobile-card" style={{borderRadius:'20px',padding:'28px',width:'100%'}}>
            {/* Header */}
            <div className="mobile-header-row" style={{display:'flex',flexWrap:'wrap',alignItems:'center',justifyContent:'space-between',gap:'16px',marginBottom:'20px',paddingBottom:'20px',borderBottom:'1px solid #e2e8f0',width:'100%'}}>
              <div>
                <h2 style={{margin:'0 0 4px',fontSize:'22px',fontWeight:'800',color:'#0f172a',letterSpacing:'-0.4px'}}>My Learning Journey</h2>
                <p style={{margin:0,fontSize:'13px',color:'#64748b',fontWeight:'500'}}>Enrolled courses · Progress tracking · Automation</p>
              </div>

              <div className="mobile-btn-group" style={{display:'flex',gap:'12px',flexWrap:'wrap'}}>
                <button
                  onClick={handleScanCourses}
                  disabled={scanning || isRunning}
                  className="btn mobile-full-btn"
                  style={{padding:'12px 20px',fontSize:'13px',color:'white',background:'linear-gradient(135deg,#4f46e5,#6366f1)',boxShadow:'0 6px 20px rgba(79,70,229,0.25)'}}
                >
                  {scanning ? <><IconSpinner/> Scanning...</> : <><IconScan/> Scan Enrolled Courses</>}
                </button>

                {hasScanned && ongoingCourses.length > 0 && (
                  <button
                    onClick={() => handleStartAutomation()}
                    disabled={isRunning || actionLoading}
                    className="btn mobile-full-btn"
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
                marginBottom:'14px',
                padding:'8px 14px',
                borderRadius:'10px',
                fontSize:'12px',
                fontWeight:'700',
                display:'flex',
                alignItems:'center',
                gap:'8px',
                background: scanning ? '#eff6ff' : scanMessage.includes('Error') ? '#fff1f2' : '#ecfdf5',
                border: `1px solid ${scanning ? '#bfdbfe' : scanMessage.includes('Error') ? '#fecdd3' : '#a7f3d0'}`,
                color: scanning ? '#1e40af' : scanMessage.includes('Error') ? '#e11d48' : '#047857',
                wordBreak: 'break-word',
                width: '100%',
                boxShadow: '0 2px 6px rgba(0,0,0,0.02)'
              }}>
                {scanning ? (
                  <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" style={{color:'#2563eb',flexShrink:0}}>
                    <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                  </svg>
                ) : scanMessage.includes('Error') ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0}}>
                    <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
                  </svg>
                ) : (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0}}>
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                )}
                <span>{scanMessage.replace(/^✔\s*/, '')}</span>
              </div>
            )}

            {/* Tabs */}
            <div className="mobile-tabs" style={{display:'flex',gap:'10px',marginBottom:'24px',width:'100%'}}>
              {(['ongoing','finished'] as const).map((tab) => {
                const count = tab === 'ongoing' ? ongoingCourses.length : finishedCourses.length;
                const isActive = activeTab === tab;
                return (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`btn mobile-tab-btn ${isActive ? 'tab-active' : ''}`}
                    style={{
                      padding:'10px 18px',fontSize:'13px',fontWeight:'700',
                      background: isActive ? '' : '#f8fafc',
                      border:`1px solid ${isActive ? '' : '#e2e8f0'}`,
                      color: isActive ? '' : '#475569',
                      borderRadius:'12px',
                      display:'inline-flex',alignItems:'center',gap:'6px'
                    }}
                  >
                    {tab === 'ongoing' ? <IconBook size={15}/> : <IconTrophy size={15}/>}
                    <span>{tab === 'ongoing' ? 'Ongoing' : 'Finished'}</span>
                    <span style={{
                      marginLeft:'2px',fontSize:'11px',fontWeight:'800',padding:'2px 7px',borderRadius:'20px',
                      background: isActive ? 'rgba(255,255,255,0.25)' : '#e2e8f0',
                      color: isActive ? '#ffffff' : '#64748b'
                    }}>{count}</span>
                  </button>
                );
              })}
            </div>

            {/* Course Cards */}
            {!hasScanned && !scanning ? (
              <div style={{padding:'40px 16px',textAlign:'center',background:'#ffffff',borderRadius:'20px',border:'1px solid #e2e8f0',boxShadow:'0 4px 20px rgba(15,23,42,0.03)',width:'100%'}}>
                <div style={{
                  width:'68px',height:'68px',borderRadius:'20px',
                  background:'linear-gradient(135deg,#e0e7ff 0%,#c7d2fe 100%)',
                  border:'1px solid #a5b4fc',
                  display:'flex',alignItems:'center',justifyContent:'center',
                  margin:'0 auto 16px',color:'#4f46e5',
                  boxShadow:'0 10px 25px -5px rgba(79,70,229,0.2)'
                }}>
                  <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                  </svg>
                </div>
                <h3 style={{margin:'0 0 8px',fontSize:'18px',fontWeight:'800',color:'#0f172a',letterSpacing:'-0.3px'}}>Scan Your Enrolled Courses</h3>
                <p style={{margin:'0 0 20px',fontSize:'13px',color:'#64748b',fontWeight:'600',lineHeight:'1.4'}}>
                  Automatically scan your DIKSHA account to discover all active and completed enrolled courses.
                </p>
                <button onClick={handleScanCourses} className="btn mobile-full-btn" style={{padding:'12px 24px',fontSize:'13px',color:'white',background:'linear-gradient(135deg,#4f46e5,#6366f1)',boxShadow:'0 8px 24px rgba(79,70,229,0.3)'}}>
                  <IconScan/> Scan Enrolled Courses
                </button>
              </div>
            ) : displayedCourses.length === 0 ? (
              <div style={{padding:'40px 16px',textAlign:'center',background:'#ffffff',borderRadius:'20px',border:'1px solid #e2e8f0',width:'100%'}}>
                <div style={{display:'flex',justifyContent:'center',marginBottom:'12px',color:'#6366f1'}}>
                  {activeTab === 'ongoing' ? <IconBook size={36}/> : <IconTrophy size={36}/>}
                </div>
                <h3 style={{margin:'0 0 6px',fontSize:'15px',fontWeight:'800',color:'#475569'}}>No {activeTab} courses found</h3>
                <p style={{margin:0,fontSize:'12px',color:'#94a3b8'}}>Try scanning again or switch tabs.</p>
              </div>
            ) : (
              <div className="mobile-course-grid" style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(320px,1fr))',gap:'18px',width:'100%'}}>
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
                        borderRadius:'18px',
                        overflow:'hidden',
                        display:'flex',flexDirection:'column',
                        border: isCurrent ? '2px solid #6366f1' : isFinished ? '1px solid #a7f3d0' : '1px solid #e2e8f0',
                        boxShadow: isCurrent ? '0 12px 30px rgba(99,102,241,0.15)' : '0 4px 16px rgba(15,23,42,0.04)',
                        animationDelay:`${idx * 0.06}s`,
                        width:'100%',maxWidth:'100%'
                      }}
                    >
                      {/* Course banner */}
                      <div style={{height:'120px',background: isCurrent ? 'linear-gradient(135deg,#e0e7ff,#c7d2fe)' : isFinished ? 'linear-gradient(135deg,#d1fae5,#a7f3d0)' : 'linear-gradient(135deg,#f1f5f9,#e2e8f0)',display:'flex',alignItems:'center',justifyContent:'center',position:'relative',borderBottom:'1px solid #e2e8f0',width:'100%'}}>
                        {c.image_url ? (
                          <img src={c.image_url} alt={c.title} style={{width:'100%',height:'100%',objectFit:'cover'}}/>
                        ) : (
                          <div style={{textAlign:'center'}}>
                            <div style={{width:'48px',height:'48px',borderRadius:'14px',background: isFinished ? '#ecfdf5' : '#e0e7ff',border:`1px solid ${isFinished ? '#6ee7b7' : '#a5b4fc'}`,display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 4px',fontSize:'22px'}}>
                              {isFinished ? '🏆' : isCurrent ? '▶️' : '🎓'}
                            </div>
                            <p style={{margin:0,fontSize:'10px',color:'#64748b',fontWeight:'700',textTransform:'uppercase',letterSpacing:'0.05em'}}>DIKSHA Digital Learning</p>
                          </div>
                        )}

                        {/* Status badge */}
                        <div style={{position:'absolute',top:'10px',right:'10px'}}>
                          <span style={{
                            fontSize:'10px',fontWeight:'800',padding:'3px 10px',borderRadius:'20px',
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
                      <div style={{padding:'16px',flex:1,display:'flex',flexDirection:'column',gap:'12px',width:'100%'}}>
                        <div>
                          <h3 style={{margin:'0 0 4px',fontSize:'14px',fontWeight:'800',color:'#0f172a',lineHeight:'1.4',display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical',overflow:'hidden'}}>
                            {c.title}
                          </h3>
                          {c.ends_on && (
                            <p style={{margin:0,fontSize:'11px',color:'#64748b',fontWeight:'600'}}>
                              📅 Ends: <span style={{color:'#334155'}}>{c.ends_on}</span>
                            </p>
                          )}
                        </div>

                        {/* Progress bar */}
                        <div>
                          <div style={{display:'flex',justifyContent:'space-between',marginBottom:'6px'}}>
                            <span style={{fontSize:'10px',color:'#64748b',fontWeight:'700',textTransform:'uppercase',letterSpacing:'0.04em'}}>Progress</span>
                            <span style={{fontSize:'11px',fontWeight:'800',color: isFinished ? '#10b981' : '#4f46e5'}}>{pct}%</span>
                          </div>
                          <div style={{background:'#e2e8f0',borderRadius:'100px',height:'8px',overflow:'hidden',width:'100%'}}>
                            <div style={{height:'100%',width:`${pct}%`,borderRadius:'100px',background: isFinished ? 'linear-gradient(90deg,#10b981,#059669)' : isCurrent ? 'linear-gradient(90deg,#ea580c,#f59e0b)' : 'linear-gradient(90deg,#4f46e5,#6366f1)',transition:'width 0.6s ease'}}/>
                          </div>
                        </div>
                      </div>

                      {/* Footer actions */}
                      <div style={{padding:'12px 14px',borderTop:'1px solid #e2e8f0',display:'flex',gap:'8px',background:'#f8fafc',width:'100%'}}>
                        <button
                          onClick={() => handleViewCourseDetails(c)}
                          style={{
                            flex:1,padding:'9px',borderRadius:'10px',
                            background:'#ffffff',
                            border:'1px solid #cbd5e1',
                            color:'#334155',fontSize:'11px',fontWeight:'700',
                            display:'flex',alignItems:'center',justifyContent:'center',gap:'4px',
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
                            flex:1,padding:'9px',fontSize:'11px',
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

          {/* ── FULL WIDTH LIVE LOGS ── */}
          <div className="glass-card-light mobile-card" style={{borderRadius:'20px',padding:'20px 24px',display:'flex',flexDirection:'column',gap:'12px',width:'100%',overflow:'hidden'}}>
            <div className="mobile-header-row" style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:'10px',width:'100%'}}>
              <h3 style={{margin:0,fontSize:'13px',fontWeight:'800',color:'#0f172a',textTransform:'uppercase',letterSpacing:'0.06em',display:'flex',alignItems:'center',gap:'8px'}}>
                <IconTerminal /> Live Server Output Logs
                <span style={{width:'8px',height:'8px',borderRadius:'50%',background:'#10b981',display:'inline-block',boxShadow:'0 0 8px rgba(16,185,129,0.6)'}}/>
              </h3>
              <div style={{display:'flex',alignItems:'center',gap:'8px',flexWrap:'wrap'}}>
                <div style={{
                  fontSize:'11px',
                  fontWeight:'700',
                  color:'#475569',
                  background:'#f1f5f9',
                  border:'1px solid #cbd5e1',
                  borderRadius:'8px',
                  padding:'4px 10px',
                  display:'inline-flex',
                  alignItems:'center',
                  gap:'4px',
                  fontFamily:'JetBrains Mono, monospace'
                }}>
                  {logsList.length} lines
                </div>
                <button
                  onClick={() => setShowLogs(!showLogs)}
                  style={{fontSize:'11px',fontWeight:'700',color:'#475569',background:'#f1f5f9',border:'1px solid #cbd5e1',borderRadius:'8px',padding:'4px 10px',cursor:'pointer'}}
                >
                  {showLogs ? 'Collapse' : 'Expand'}
                </button>
                <button
                  onClick={handleCopyLogs}
                  disabled={logsList.length === 0}
                  style={{
                    fontSize:'11px',fontWeight:'700',
                    color: copiedLogs ? '#047857' : '#475569',
                    background: copiedLogs ? '#d1fae5' : '#f1f5f9',
                    border: `1px solid ${copiedLogs ? '#6ee7b7' : '#cbd5e1'}`,
                    borderRadius:'8px',padding:'4px 10px',cursor: logsList.length === 0 ? 'not-allowed' : 'pointer',
                    display:'inline-flex',alignItems:'center',gap:'4px',
                    transition:'all 0.2s ease',
                    opacity: logsList.length === 0 ? 0.5 : 1
                  }}
                >
                  {copiedLogs ? 'Copied! ✓' : <><IconCopy /> Copy Logs</>}
                </button>
              </div>
            </div>

            <div
              ref={logRef}
              className="mobile-log-box"
              style={{
                background:'#0f172a',border:'1px solid #1e293b',borderRadius:'14px',padding:'14px',
                height: showLogs ? '480px' : '260px',
                overflowY:'auto',overflowX:'hidden',
                transition:'height 0.3s ease',
                width:'100%'
              }}
            >
              {logsList.length === 0 ? (
                <p style={{margin:0,color:'#64748b',fontSize:'12px',fontStyle:'italic',fontFamily:'JetBrains Mono, monospace'}}>
                  Waiting for live log stream from Railway automation backend...
                </p>
              ) : (
                logsList.slice(-500).map((line, i) => {
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
      {showDetailsModal ? (
        <div style={{
          position:'fixed',inset:0,zIndex:9999,
          background:'rgba(15,23,42,0.65)',backdropFilter:'blur(12px)',
          display:'flex',alignItems:'center',justifyContent:'center',padding:'10px'
        }}>
          <div className="glass-card-light fade-in-up mobile-modal-box" style={{
            width:'100%',maxWidth:'1160px',height:'90vh',maxHeight:'92vh',borderRadius:'26px',overflow:'hidden',
            display:'flex',flexDirection:'column',
            boxShadow:'0 25px 60px -15px rgba(0,0,0,0.25)',
            border:'1px solid #e2e8f0'
          }}>
            {/* Header */}
            <div style={{
              padding:'18px 20px',borderBottom:'1px solid #e2e8f0',
              display:'flex',alignItems:'center',justifyContent:'space-between',
              background:'#ffffff',flexShrink:0
            }}>
              <div style={{minWidth:0,flex:1,paddingRight:'10px'}}>
                <span style={{fontSize:'11px',fontWeight:'800',color:'#4f46e5',textTransform:'uppercase',letterSpacing:'0.06em'}}>DIKSHA Course Details</span>
                <h2 style={{margin:'2px 0 0',fontSize:'16px',fontWeight:'800',color:'#0f172a',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{selectedCourse?.title}</h2>
              </div>
              <button 
                onClick={() => { setShowDetailsModal(false); setSelectedCourse(null); setCourseDetails(null); }}
                style={{
                  background:'#f1f5f9',border:'1px solid #cbd5e1',
                  color:'#475569',borderRadius:'50%',width:'34px',height:'34px',
                  display:'flex',alignItems:'center',justifyContent:'center',fontSize:'15px',
                  cursor:'pointer',fontWeight:'700',transition:'all 0.2s',flexShrink:0
                }}
              >
                ✕
              </button>
            </div>

            {/* Content Area */}
            <div className="mobile-modal-content" style={{padding:'20px',overflowY:'auto',flex:1,display:'flex',flexDirection:'column',gap:'16px'}}>
              {detailsLoading ? (
                <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'80px 16px',gap:'20px'}}>
                  {/* Glowing Badge */}
                  <div style={{
                    position:'relative',width:'68px',height:'68px',display:'flex',alignItems:'center',justifyContent:'center'
                  }}>
                    <div style={{
                      position:'absolute',inset:'-8px',borderRadius:'24px',
                      background:'linear-gradient(135deg,#4f46e5,#7c3aed)',
                      opacity:0.3,filter:'blur(14px)',animation:'pulse-dot 2s ease-in-out infinite'
                    }}/>
                    <div style={{
                      width:'60px',height:'60px',borderRadius:'20px',
                      background:'linear-gradient(135deg,#4f46e5 0%,#6366f1 50%,#7c3aed 100%)',
                      display:'flex',alignItems:'center',justifyContent:'center',color:'#ffffff',
                      boxShadow:'0 14px 32px -6px rgba(79,70,229,0.45)',position:'relative',zIndex:1
                    }}>
                      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{animation:'spin 1.2s linear infinite'}}>
                        <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                      </svg>
                    </div>
                  </div>

                  <div style={{textAlign:'center'}}>
                    <h4 style={{margin:'0 0 6px',fontSize:'16px',fontWeight:'800',color:'#0f172a',letterSpacing:'-0.3px'}}>
                      Fetching Course Content
                    </h4>
                    <p style={{margin:0,fontSize:'12px',color:'#64748b',fontWeight:'600'}}>
                      Syncing module structure & live progress directly from DIKSHA portal...
                    </p>
                  </div>

                  {/* Animated Progress Bar */}
                  <div style={{
                    width:'220px',height:'6px',background:'#e2e8f0',borderRadius:'10px',
                    overflow:'hidden',position:'relative',marginTop:'4px'
                  }}>
                    <div className="progress-bar-animated" style={{width:'100%',height:'100%',borderRadius:'10px'}}/>
                  </div>
                </div>
              ) : detailsError ? (
                <div style={{textAlign:'center',padding:'40px 0'}}>
                  <div style={{fontSize:'32px',marginBottom:'10px'}}>⚠️</div>
                  <h3 style={{color:'#0f172a',margin:'0 0 6px',fontSize:'15px'}}>{detailsError}</h3>
                  <p style={{color:'#64748b',fontSize:'12px',maxWidth:'400px',margin:'0 auto'}}>
                    Please make sure initial scanning was completed and your session is active.
                  </p>
                </div>
              ) : courseDetails ? (
                <div className="mobile-grid-2" style={{display:'grid',gridTemplateColumns:'320px 1fr',gap:'20px',alignItems:'start'}}>
                  
                  {/* Left Column: Info & Description */}
                  <div style={{display:'flex',flexDirection:'column',gap:'16px'}}>
                    <div>
                      <h4 style={{margin:'0 0 8px',fontSize:'11px',fontWeight:'800',color:'#64748b',textTransform:'uppercase',letterSpacing:'0.06em'}}>About this Course</h4>
                      <div style={{
                        background:'#f8fafc',padding:'16px',borderRadius:'14px',border:'1px solid #e2e8f0'
                      }}>
                        <p style={{
                          margin:0,fontSize:'12px',color:'#334155',
                          lineHeight:'1.6',fontWeight:'500'
                        }}>
                          {(courseDetails.description as string)?.split(/View more|Lesson Details|Course Overview/i)[0]?.trim() || "No description provided by the DIKSHA portal."}
                        </p>
                      </div>
                    </div>

                    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',background:'#eff6ff',border:'1px solid #bfdbfe',borderRadius:'14px',padding:'14px 18px'}}>
                      <div>
                        <p style={{margin:0,fontSize:'10px',color:'#1d4ed8',fontWeight:'800',textTransform:'uppercase',letterSpacing:'0.05em'}}>Course Status</p>
                        <p style={{margin:'2px 0 0',fontSize:'15px',color:'#0f172a',fontWeight:'800'}}>{selectedCourse?.progress}% Complete</p>
                      </div>
                      <button
                        onClick={() => { setShowDetailsModal(false); handleStartAutomation(selectedCourse?.url); }}
                        disabled={isRunning || actionLoading || selectedCourse?.progress === 100}
                        style={{
                          background:'linear-gradient(135deg,#ea580c,#f59e0b)',
                          color:'white',border:'none',padding:'10px 16px',borderRadius:'10px',
                          fontSize:'12px',fontWeight:'800',cursor:'pointer',
                          boxShadow:'0 4px 14px rgba(234,88,12,0.25)',
                          opacity: (isRunning || actionLoading || selectedCourse?.progress === 100) ? 0.5 : 1
                        }}
                      >
                        ⚡ Start Automation
                      </button>
                    </div>
                  </div>

                  {/* Right Column: Lessons / Modules */}
                  <div style={{display:'flex',flexDirection:'column',gap:'12px'}}>
                    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                      <h4 style={{margin:0,fontSize:'11px',fontWeight:'800',color:'#64748b',textTransform:'uppercase',letterSpacing:'0.06em'}}>Course Lessons & Modules</h4>
                      <span style={{fontSize:'10px',fontWeight:'700',color:'#6366f1',background:'rgba(99,102,241,0.08)',padding:'2px 8px',borderRadius:'10px'}}>
                        Click module for details
                      </span>
                    </div>
                    
                    <div style={{
                      display:'flex',flexDirection:'column',gap:'12px'
                    }}>
                      {Array.isArray(courseDetails.modules) && (courseDetails.modules as any[]).length > 0 ? (
                        (courseDetails.modules as any[]).map((m: any, idx: number) => {
                          const isCourseComplete = selectedCourse?.progress === 100;
                          const rawPct = m.progress ?? (isCourseComplete || m.iscompleted ? 100 : 0);
                          const isDone = isCourseComplete || m.iscompleted || rawPct === 100;
                          const displayPct = isDone ? 100 : rawPct;
                          const isExpanded = !!expandedModuleIdxs[idx];

                          return (
                            <div 
                              key={idx} 
                              style={{
                                background:'#ffffff',border:`1.5px solid ${isDone ? '#a7f3d0' : '#e2e8f0'}`,
                                borderRadius:'14px',overflow:'hidden',
                                boxShadow: isDone ? '0 2px 10px rgba(16,185,129,0.06)' : '0 2px 8px rgba(0,0,0,0.02)',
                                transition:'all 0.2s ease'
                              }}
                            >
                              {/* Module Header Row */}
                              <div 
                                onClick={() => setExpandedModuleIdxs(prev => ({ ...prev, [idx]: !prev[idx] }))}
                                style={{
                                  padding:'12px 16px',display:'flex',alignItems:'center',
                                  justifyContent:'space-between',gap:'10px',cursor:'pointer',
                                  background: isExpanded ? '#f8fafc' : '#ffffff'
                                }}
                              >
                                {/* LEFT SERIAL BADGE */}
                                <span style={{
                                  width:'28px',height:'28px',borderRadius:'50%',
                                  background: isDone ? '#d1fae5' : '#f1f5f9',
                                  border:`1.5px solid ${isDone ? '#34d399' : '#cbd5e1'}`,
                                  display:'flex',alignItems:'center',justifyContent:'center',
                                  color: isDone ? '#047857' : '#475569',fontSize:'12px',fontWeight:'800',
                                  flexShrink:0
                                }}>
                                  {isDone ? '✓' : idx + 1}
                                </span>

                                <div style={{flex:1,minWidth:0}}>
                                  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'4px'}}>
                                    <p style={{margin:0,fontSize:'13px',fontWeight:'800',color:'#0f172a',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}} title={m.name}>
                                      {m.name}
                                    </p>
                                    <div style={{display:'flex',alignItems:'center',gap:'6px'}}>
                                      <span style={{
                                        fontSize:'11px',fontWeight:'800',
                                        color: isDone ? '#059669' : '#4f46e5',
                                        background: isDone ? '#ecfdf5' : '#eff6ff',
                                        padding:'2px 8px',borderRadius:'10px',
                                        border: `1px solid ${isDone ? '#a7f3d0' : '#bfdbfe'}`
                                      }}>
                                        {displayPct}%
                                      </span>
                                      <span style={{fontSize:'11px',color:'#94a3b8',fontWeight:'800',width:'12px',textAlign:'center'}}>
                                        {isExpanded ? '▲' : '▼'}
                                      </span>
                                    </div>
                                  </div>

                                  <div style={{display:'flex',alignItems:'center',gap:'6px'}}>
                                    <div style={{flex:1,background:'#e2e8f0',height:'6px',borderRadius:'10px',overflow:'hidden'}}>
                                      <div style={{
                                        width:`${displayPct}%`,height:'100%',
                                        background: isDone ? 'linear-gradient(90deg,#10b981,#059669)' : 'linear-gradient(90deg,#4f46e5,#6366f1)',
                                        borderRadius:'10px',transition:'width 0.3s ease'
                                      }} />
                                    </div>
                                  </div>
                                </div>
                              </div>

                              {/* EXPANDABLE MODULE CONTENTS (PDF & VIDEO DETAILS) */}
                              {isExpanded && (
                                <div style={{
                                  padding:'14px 16px',borderTop:'1.5px solid #e2e8f0',
                                  background:'#f8fafc',display:'flex',flexDirection:'column',gap:'10px'
                                }}>
                                  <p style={{margin:0,fontSize:'11px',fontWeight:'800',color:'#64748b',textTransform:'uppercase',letterSpacing:'0.04em'}}>
                                    Module Resources & Content Breakdown
                                  </p>

                                  {/* PDF Material */}
                                  <div style={{
                                    background:'#ffffff',padding:'12px 16px',borderRadius:'12px',
                                    border:'1px solid #e2e8f0',display:'flex',alignItems:'center',justifyContent:'space-between'
                                  }}>
                                    <div style={{display:'flex',alignItems:'center',gap:'12px'}}>
                                      <div style={{width:'36px',height:'36px',borderRadius:'10px',background:'#fef2f2',border:'1px solid #fecaca',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'18px'}}>
                                        📄
                                      </div>
                                      <div>
                                        <p style={{margin:0,fontSize:'13px',fontWeight:'700',color:'#0f172a'}}>{m.name} — Reading Material (PDF)</p>
                                        <p style={{margin:'2px 0 0',fontSize:'11px',color:'#64748b'}}>DIKSHA Official PDF Guide & Notes</p>
                                      </div>
                                    </div>
                                    <span style={{
                                      fontSize:'11px',fontWeight:'800',padding:'3px 10px',borderRadius:'10px',
                                      background: isDone ? '#ecfdf5' : '#f1f5f9',
                                      color: isDone ? '#047857' : '#64748b',
                                      border: `1px solid ${isDone ? '#a7f3d0' : '#cbd5e1'}`
                                    }}>
                                      {isDone ? 'Completed 100%' : 'Pending'}
                                    </span>
                                  </div>

                                  {/* Video Lesson */}
                                  <div style={{
                                    background:'#ffffff',padding:'12px 16px',borderRadius:'12px',
                                    border:'1px solid #e2e8f0',display:'flex',alignItems:'center',justifyContent:'space-between'
                                  }}>
                                    <div style={{display:'flex',alignItems:'center',gap:'12px'}}>
                                      <div style={{width:'36px',height:'36px',borderRadius:'10px',background:'#eff6ff',border:'1px solid #bfdbfe',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'18px'}}>
                                        🎬
                                      </div>
                                      <div>
                                        <p style={{margin:0,fontSize:'13px',fontWeight:'700',color:'#0f172a'}}>{m.name} — Interactive Video Lecture</p>
                                        <p style={{margin:'2px 0 0',fontSize:'11px',color:'#64748b'}}>Full Video Playback & Audio Stream</p>
                                      </div>
                                    </div>
                                    <span style={{
                                      fontSize:'11px',fontWeight:'800',padding:'3px 10px',borderRadius:'10px',
                                      background: isDone ? '#ecfdf5' : '#f1f5f9',
                                      color: isDone ? '#047857' : '#64748b',
                                      border: `1px solid ${isDone ? '#a7f3d0' : '#cbd5e1'}`
                                    }}>
                                      {isDone ? 'Watched 100%' : 'Pending'}
                                    </span>
                                  </div>

                                  {/* Quiz / Assessment */}
                                  <div style={{
                                    background:'#ffffff',padding:'12px 16px',borderRadius:'12px',
                                    border:'1px solid #e2e8f0',display:'flex',alignItems:'center',justifyContent:'space-between'
                                  }}>
                                    <div style={{display:'flex',alignItems:'center',gap:'12px'}}>
                                      <div style={{width:'36px',height:'36px',borderRadius:'10px',background:'#fef3c7',border:'1px solid #fde68a',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'18px'}}>
                                        📝
                                      </div>
                                      <div>
                                        <p style={{margin:0,fontSize:'13px',fontWeight:'700',color:'#0f172a'}}>{m.name} — Assessment & Evaluation</p>
                                        <p style={{margin:'2px 0 0',fontSize:'11px',color:'#64748b'}}>Module Quiz & Question Submission</p>
                                      </div>
                                    </div>
                                    <span style={{
                                      fontSize:'11px',fontWeight:'800',padding:'3px 10px',borderRadius:'10px',
                                      background: isDone ? '#ecfdf5' : '#f1f5f9',
                                      color: isDone ? '#047857' : '#64748b',
                                      border: `1px solid ${isDone ? '#a7f3d0' : '#cbd5e1'}`
                                    }}>
                                      {isDone ? 'Submitted 100%' : 'Pending'}
                                    </span>
                                  </div>
                                </div>
                              )}
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
              padding:'20px 32px',borderTop:'1px solid #e2e8f0',
              display:'flex',justifyContent:'flex-end',background:'#ffffff',flexShrink:0
            }}>
              <button 
                onClick={() => { setShowDetailsModal(false); setSelectedCourse(null); setCourseDetails(null); }}
                style={{
                  background:'#f8fafc',border:'1.5px solid #cbd5e1',
                  color:'#334155',borderRadius:'12px',padding:'10px 24px',fontSize:'13px',
                  fontWeight:'800',cursor:'pointer',transition:'all 0.2s'
                }}
              >
                Close Details
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* ─── PREMIUM CUSTOM CONFIRMATION DIALOG MODAL ─── */}
      {confirmModal?.open ? (
        <ConfirmModalDialog
          modal={confirmModal}
          onClose={() => setConfirmModal(null)}
          actionLoading={actionLoading}
        />
      ) : null}
    </>
  );
}
