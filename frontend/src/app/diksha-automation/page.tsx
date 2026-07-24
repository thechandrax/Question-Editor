"use client";

import React, { useState } from "react";

export default function DikshaAutomationPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      setMessage("Please enter both username and password.");
      setStatus("error");
      return;
    }

    setStatus("loading");
    setMessage("");

    try {
      const backendUrl =
        process.env.NEXT_PUBLIC_BACKEND_URL ||
        "https://question-editor-production-b815.up.railway.app";
      const res = await fetch(`${backendUrl}/api/diksha/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.detail || "Failed to start automation");
      }

      setStatus("success");
      setMessage(
        data.message ||
          "Automation started! The bot is now logging in and completing your courses in the background."
      );
      setUsername("");
      setPassword("");
    } catch (err: unknown) {
      console.error(err);
      setStatus("error");
      setMessage(
        err instanceof Error ? err.message : "An unexpected error occurred while connecting to the backend."
      );
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center py-20 px-4 font-sans text-slate-800">
      <div className="w-full max-w-xl">

        {/* Header */}
        <div className="text-center mb-12 group cursor-default">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-gradient-to-br from-orange-500 to-amber-400 text-white mb-6 shadow-xl shadow-orange-400/40 group-hover:-translate-y-2 group-hover:scale-110 transition-all duration-500 ease-out">
            <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/>
            </svg>
          </div>
          <h1 className="text-5xl font-black tracking-tight mb-4 bg-clip-text text-transparent bg-gradient-to-r from-orange-600 via-amber-500 to-orange-600">
            DIKSHA Automation
          </h1>
          <p className="text-lg text-slate-600 max-w-lg mx-auto leading-relaxed font-medium">
            Enter your DIKSHA credentials and the bot will{" "}
            <span className="font-bold text-orange-500">automatically complete</span> all your
            pending courses{" "}
            <span className="font-bold text-amber-600">silently in the cloud</span>.
          </p>
        </div>

        {/* Success alert */}
        {status === "success" && (
          <div className="mb-6 bg-green-50 border border-green-200 rounded-2xl px-5 py-4 flex gap-3 items-start shadow-sm">
            <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0 mt-0.5">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
            </div>
            <div>
              <p className="font-bold text-green-700 text-sm">Started Successfully! 🎉</p>
              <p className="text-green-600 text-sm mt-0.5">{message}</p>
            </div>
          </div>
        )}

        {/* Error alert */}
        {status === "error" && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-2xl px-5 py-4 flex gap-3 items-start shadow-sm">
            <div className="w-6 h-6 rounded-full bg-red-500 flex items-center justify-center flex-shrink-0 mt-0.5">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
            </div>
            <div>
              <p className="font-bold text-red-700 text-sm">Error</p>
              <p className="text-red-600 text-sm mt-0.5">{message}</p>
            </div>
          </div>
        )}

        {/* Card */}
        <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 p-8 mb-6 border border-slate-100">
          <form onSubmit={handleSubmit} className="space-y-5">

            {/* Username */}
            <div>
              <label htmlFor="diksha-username" className="block text-sm font-semibold text-slate-700 mb-2">
                DIKSHA Username / Mobile Number
              </label>
              <input
                id="diksha-username"
                type="text"
                required
                placeholder="e.g. 9876543210"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={status === "loading"}
                className="block w-full px-4 py-4 border-2 border-slate-200 rounded-2xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-orange-500/20 focus:border-orange-500 transition-all text-base disabled:opacity-50"
              />
            </div>

            {/* Password */}
            <div>
              <label htmlFor="diksha-password" className="block text-sm font-semibold text-slate-700 mb-2">
                Password
              </label>
              <input
                id="diksha-password"
                type="password"
                required
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={status === "loading"}
                className="block w-full px-4 py-4 border-2 border-slate-200 rounded-2xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-orange-500/20 focus:border-orange-500 transition-all text-base disabled:opacity-50"
              />
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={status === "loading"}
              className="w-full flex items-center justify-center gap-2 py-4 px-6 rounded-2xl text-lg font-bold text-white bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 shadow-lg shadow-orange-500/30 focus:outline-none focus:ring-4 focus:ring-orange-500/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {status === "loading" ? (
                <>
                  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                  Launching Bot...
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polygon points="6 3 20 12 6 21 6 3"/></svg>
                  Start Automation
                </>
              )}
            </button>
          </form>
        </div>

        {/* Info box */}
        <div className="bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4 text-sm text-amber-800">
          <p className="font-bold mb-1">⚠️ Important</p>
          <ul className="list-disc list-inside space-y-1 text-amber-700">
            <li>You can safely close this page after starting.</li>
            <li>The bot runs on the cloud server — <strong>not your device</strong>.</li>
            <li>Do <strong>not</strong> click Start multiple times. Wait for one course to finish.</li>
          </ul>
        </div>

      </div>
    </div>
  );
}
