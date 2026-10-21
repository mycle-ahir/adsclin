import React, { useState } from 'react';
import { useAuthStore } from '../stores/auth-store';
import adsclinLogo from '../assets/adsclin-logo.png';

export function LoginScreen() {
  const [identifier, setIdentifier] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const { login, submitting, error, clearError } = useAuthStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    clearError();

    const trimmed = identifier.trim();
    if (!trimmed) {
      setLocalError('Please enter a valid email address or phone number.');
      return;
    }

    try {
      await login(trimmed);
    } catch (err: any) {
      // Error is already stored in store
    }
  };

  const displayError = localError || error;

  return (
    <div className="min-h-screen w-full bg-[#040807] flex items-center justify-center p-6 select-none relative overflow-hidden">
      {/* Background cyber radial glow & grid */}
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_80%_80%_at_50%_35%,rgba(0,255,136,0.06),transparent)]" />
      <div className="absolute inset-0 pointer-events-none cyber-grid opacity-50" />

      {/* Main cyber card */}
      <div className="w-full max-w-md bg-[#06140e]/95 backdrop-blur-xl border border-[#103425] rounded-3xl p-8 shadow-2xl relative z-10 flex flex-col items-center">
        {/* Brand Logo & Name */}
        <div className="flex flex-col items-center mb-7">
          <div className="relative mb-3 group">
            <img
              src={adsclinLogo}
              alt="Adsclin Logo"
              className="h-16 w-auto object-contain drop-shadow-[0_0_20px_rgba(0,255,136,0.6)]"
            />
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2 font-sans drop-shadow-[0_0_10px_rgba(255,255,255,0.15)]">
            Adsclin <span className="text-[#00ff88] font-mono text-[10px] px-2 py-0.5 rounded-full bg-[#00ff88]/10 border border-[#00ff88]/30 font-bold tracking-wider">ANTI-DETECT</span>
          </h1>
          <p className="text-xs text-emerald-500/80 mt-1 font-mono text-center tracking-wide">
            ENTERPRISE BROWSER STEALTH • HARDWARE ISOLATION
          </p>
        </div>

        {/* 1 Month Free Trial Banner */}
        <div className="w-full bg-[#081b13] border border-[#143d2c] rounded-2xl p-4 mb-6 shadow-[0_0_15px_rgba(0,255,136,0.08)]">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-xl bg-[#00ff88]/15 border border-[#00ff88]/30 flex items-center justify-center text-[#00ff88] text-lg flex-shrink-0 mt-0.5">
              🎁
            </div>
            <div>
              <div className="text-sm font-bold text-white flex items-center gap-2 font-mono">
                1 Month Free Trial
                <span className="text-[10px] bg-[#00ff88] text-gray-950 font-black px-1.5 py-0.2 rounded uppercase tracking-wider">
                  30 Days
                </span>
              </div>
              <p className="text-xs text-emerald-300/80 mt-1 leading-relaxed">
                Enjoy 30 days of full access completely free. Hardware locked: exactly 1 free trial account per physical machine.
              </p>
            </div>
          </div>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="w-full flex flex-col gap-4 font-mono">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-300 mb-2">
              Email Address or Phone Number
            </label>
            <div className="relative">
              <input
                type="text"
                autoFocus
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="name@domain.com or +1234567890"
                className="w-full bg-[#081b13] border border-[#143d2c] focus:border-[#00ff88] focus:shadow-[0_0_12px_rgba(0,255,136,0.25)] text-white rounded-xl px-4 py-3 text-sm placeholder-emerald-900/60 outline-none transition-all font-mono"
                disabled={submitting}
              />
            </div>
            <p className="text-[11px] text-emerald-700 mt-1.5">
              Enter your email or mobile phone with country code.
            </p>
          </div>

          {displayError && (
            <div className="bg-rose-950/40 border border-rose-500/40 rounded-xl p-3 text-xs text-rose-300 flex items-start gap-2">
              <span className="text-rose-400 font-bold">⚠️</span>
              <span className="leading-tight">{displayError}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full mt-2 bg-gradient-to-r from-[#00ff88] to-[#10b981] hover:brightness-110 text-gray-950 font-black py-3.5 px-4 rounded-xl text-xs uppercase tracking-wider transition-all shadow-[0_0_18px_rgba(0,255,136,0.35)] active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {submitting ? (
              <>
                <svg className="animate-spin h-4 w-4 text-gray-950" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span>Verifying Device & Signing in…</span>
              </>
            ) : (
              <>
                <span>Continue to Adsclin</span>
                <span className="text-base font-black">→</span>
              </>
            )}
          </button>
        </form>

        {/* Pricing notice */}
        <div className="mt-6 pt-5 border-t border-[#103425] w-full text-center font-mono">
          <div className="text-xs text-gray-400 flex items-center justify-center gap-2">
            <span>After trial:</span>
            <span className="text-[#00ff88] font-bold">$9.00 / month</span>
            <span>•</span>
            <span className="text-gray-400">Crypto (USDT, BTC, ETH, SOL)</span>
          </div>
          <p className="text-[11px] text-emerald-700 mt-2">
            Protected by Adsclin Hardware Fingerprint ID
          </p>
          <p className="text-[11px] text-gray-400 mt-3 font-sans">
            Made with <span className="text-rose-500 animate-pulse">❤️</span> by{' '}
            <span className="font-semibold text-[#00ff88]">Growdemy</span>
          </p>
        </div>
      </div>
    </div>
  );
}
