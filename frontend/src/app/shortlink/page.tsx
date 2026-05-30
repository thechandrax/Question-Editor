'use client';

import React, { useState } from 'react';
import { Link2, ArrowRight, Loader2, Copy, CheckCircle2, ShieldCheck } from 'lucide-react';

export default function ShortlinkBypassPage() {
  const [url, setUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adViewLock, setAdViewLock] = useState<{message: string, url: string} | null>(null);
  const [copied, setCopied] = useState(false);

  const handleBypass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url) return;

    setIsLoading(true);
    setResult(null);
    setError(null);
    setAdViewLock(null);
    setCopied(false);
    
    // Special check for Cloudflare or JS protected domains like olamovies and fc-lc
    const lowerUrl = url.toLowerCase();
    if (lowerUrl.includes('links.olamovies.mov') || lowerUrl.includes('fc-lc.xyz') || lowerUrl.includes('fc.lc')) {
      setError("Security Lock Detected! 🛡️ This link uses Cloudflare Turnstile or a manual CAPTCHA that requires you to solve it in your browser first. Please open the link, solve the check, then paste the resulting link here!");
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/shortlink', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });

      const data = await response.json();

      // Handle special ad_view_lock error from backend
      if (data.error === 'ad_view_lock') {
        setAdViewLock({ message: data.message, url: data.intermediate_url || url });
        return;
      }

      if (!response.ok) {
        throw new Error(data.error || 'Failed to bypass link');
      }

      setResult(data.bypassed);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An error occurred while bypassing the link.');
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = () => {
    if (result) {
      navigator.clipboard.writeText(result);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center py-20 px-4 font-sans text-slate-800">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-12 group cursor-default">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-gradient-to-br from-blue-600 to-cyan-400 text-white mb-6 shadow-xl shadow-blue-500/40 group-hover:-translate-y-2 group-hover:scale-110 group-hover:rotate-6 transition-all duration-500 ease-out relative">
            <div className="absolute inset-0 bg-white/20 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
            <ShieldCheck size={40} className="drop-shadow-md relative z-10" />
          </div>
          <h1 className="text-5xl font-black tracking-tight mb-4 bg-clip-text text-transparent bg-gradient-to-r from-blue-900 via-blue-600 to-cyan-600">
            Deep Link Bypasser
          </h1>
          <p className="text-lg text-slate-600 max-w-lg mx-auto leading-relaxed font-medium transition-colors duration-500">
            Instantly bypass <span className="font-bold text-rose-500 drop-shadow-sm">ad-networks</span>, <span className="font-bold text-purple-600 drop-shadow-sm">tracking scripts</span>, and <span className="font-bold text-orange-500 drop-shadow-sm">countdown timers</span> to reveal the true destination link.
          </p>
        </div>

        {/* Main Card */}
        <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 p-8 mb-8 border border-slate-100 transition-all">
          <form onSubmit={handleBypass} className="space-y-6">
            <div>
              <label htmlFor="url" className="block text-sm font-semibold text-slate-700 mb-2">
                Paste Shortlink URL
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                  <Link2 size={20} />
                </div>
                <input
                  id="url"
                  type="url"
                  required
                  placeholder="https://gplinks.co/..."
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="block w-full pl-11 pr-4 py-4 border-2 border-slate-200 rounded-2xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-lg"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading || !url}
              className="w-full flex items-center justify-center gap-2 py-4 px-6 border border-transparent rounded-2xl shadow-sm text-lg font-bold text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-500/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {isLoading ? (
                <>
                  <Loader2 className="animate-spin" size={24} />
                  Bypassing Layers...
                </>
              ) : (
                <>
                  Bypass Link <ArrowRight size={20} />
                </>
              )}
            </button>
          </form>
        </div>

        {/* Ad-View Lock Warning */}
        {adViewLock && (
          <div className="p-6 bg-amber-50 text-amber-900 rounded-2xl border border-amber-200 animate-in fade-in slide-in-from-bottom-4">
            <h3 className="font-bold text-lg mb-3 flex items-center gap-2">
              <span className="text-2xl">🔒</span> Ad-View Lock Detected!
            </h3>
            <p className="text-amber-800 mb-4 text-sm leading-relaxed">
              This link (<strong>vplink.in</strong>) uses a special <strong>Ad-View Lock</strong> — it forces you to watch a real ad in your browser before giving you the next link. Our engine cannot simulate watching an ad!
            </p>
            <div className="bg-white rounded-xl border border-amber-200 p-4 mb-4">
              <p className="text-xs font-bold uppercase tracking-widest text-amber-600 mb-3">👉 How to solve this manually (3 steps):</p>
              <ol className="space-y-2 text-sm">
                <li className="flex gap-2"><span className="font-bold text-amber-700 shrink-0">1.</span> <span>Click the link below to open it in your browser</span></li>
                <li className="flex gap-2"><span className="font-bold text-amber-700 shrink-0">2.</span> <span>Wait for the countdown timer, then click <strong>CONTINUE</strong></span></li>
                <li className="flex gap-2"><span className="font-bold text-amber-700 shrink-0">3.</span> <span>Copy the new link you get (e.g. tpi.li/...) and paste it back here!</span></li>
              </ol>
            </div>
            <a href={url} target="_blank" rel="noreferrer"
              className="inline-flex items-center gap-2 px-5 py-3 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl transition-colors text-sm"
            >
              Open Link Manually <ArrowRight size={16} />
            </a>
          </div>
        )}

        {/* Error section */}
        {error && (
          <div className="p-6 bg-red-50 text-red-700 rounded-2xl border border-red-100 flex items-start gap-4 animate-in fade-in slide-in-from-bottom-4">
            <ShieldCheck size={24} className="text-red-500 shrink-0 mt-0.5" />
            <div>
              <h3 className="font-bold mb-1">Bypass Failed</h3>
              <p className="text-red-600/90">{error}</p>
            </div>
          </div>
        )}

        {result && (
          <div className="p-8 bg-green-50 text-green-900 rounded-3xl border-2 border-green-200 shadow-lg shadow-green-100/50 animate-in fade-in slide-in-from-bottom-4">
            <h3 className="text-sm font-bold tracking-widest uppercase text-green-600 mb-3 flex items-center gap-2">
              <CheckCircle2 size={18} />
              Destination Unlocked
            </h3>
            
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <div className="flex-1 w-full p-4 bg-white rounded-xl border border-green-200 font-mono text-sm break-all text-slate-800 shadow-sm">
                {result}
              </div>
              <button
                onClick={copyToClipboard}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-4 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-xl transition-colors shadow-sm whitespace-nowrap"
              >
                {copied ? <><CheckCircle2 size={18} /> Copied!</> : <><Copy size={18} /> Copy Link</>}
              </button>
            </div>
            
            <div className="mt-8 flex justify-center w-full">
               <a 
                href={result} 
                target="_blank" 
                rel="noreferrer"
                className="group relative inline-flex items-center justify-center gap-3 px-8 py-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold text-lg rounded-2xl shadow-lg shadow-green-500/30 hover:shadow-green-500/50 hover:-translate-y-1 transition-all w-full sm:w-auto"
               >
                 <span className="flex items-center gap-2">
                   Open Destination Link
                   <ArrowRight className="group-hover:translate-x-1 transition-transform" size={20} />
                 </span>
               </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
