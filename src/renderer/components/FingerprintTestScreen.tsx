import { useState } from 'react';
import { useProfilesStore } from '../stores/profiles-store';
import { validateFingerprint } from '../../main/services/fingerprint-validator';
import type { Profile, ValidationIssue } from '../../shared/types';

export function FingerprintTestScreen() {
  const profiles = useProfilesStore((s) => s.profiles);
  const launchProfile = useProfilesStore((s) => s.launchProfile);
  const stopProfile = useProfilesStore((s) => s.stopProfile);

  const [selectedProfileId, setSelectedProfileId] = useState<string>(
    profiles.length > 0 ? profiles[0].id : ''
  );
  const [launching, setLaunching] = useState(false);

  const selectedProfile: Profile | undefined = profiles.find((p) => p.id === selectedProfileId);
  const fp = selectedProfile?.fingerprint;

  const issues: ValidationIssue[] = fp ? validateFingerprint(fp) : [];
  const errors = issues.filter((i) => i.severity === 'error');
  const warnings = issues.filter((i) => i.severity === 'warn');

  async function handleToggleLaunch() {
    if (!selectedProfile) return;
    setLaunching(true);
    try {
      if (selectedProfile.status === 'running') {
        await stopProfile(selectedProfile.id);
      } else {
        await launchProfile(selectedProfile.id);
      }
    } finally {
      setLaunching(false);
    }
  }

  return (
    <div className="space-y-6 max-w-5xl text-[#e2f9ed]">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-black text-white tracking-tight drop-shadow-[0_0_10px_rgba(255,255,255,0.15)]">
            Fingerprint Diagnostics & Verification
          </h1>
          <span className="text-xs bg-[#00ff88]/10 text-[#00ff88] border border-[#00ff88]/30 px-3 py-0.5 rounded-full font-mono font-bold uppercase tracking-wider">
            Integrity Check
          </span>
        </div>
        <p className="text-xs text-emerald-500/80 font-mono mt-1 tracking-wide">
          CONSISTENCY AUDIT • USER-AGENT CLIENT HINTS • HARDWARE INTEGRITY
        </p>
      </div>

      {/* Profile Selector & Launch Bar */}
      <div className="bg-[#06140e] p-4 rounded-2xl border border-[#103425] shadow-xl flex flex-wrap items-center justify-between gap-4 font-mono text-xs">
        <div className="flex items-center gap-3">
          <label className="font-bold text-gray-300">Select Profile:</label>
          <select
            value={selectedProfileId}
            onChange={(e) => setSelectedProfileId(e.target.value)}
            className="rounded-xl bg-[#081b13] border border-[#143d2c] focus:border-[#00ff88] px-3.5 py-2 text-xs text-emerald-300 outline-none font-mono cursor-pointer"
          >
            {profiles.length === 0 && <option value="">— No profiles created —</option>}
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.status.toUpperCase()})
              </option>
            ))}
          </select>

          {selectedProfile && (
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-bold uppercase tracking-wider ${
                selectedProfile.status === 'running'
                  ? 'bg-[#00ff88]/15 text-[#00ff88] border border-[#00ff88]/40 shadow-[0_0_10px_rgba(0,255,136,0.2)]'
                  : 'bg-[#081812] text-gray-400 border border-[#14382a]'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${selectedProfile.status === 'running' ? 'bg-[#00ff88] animate-pulse' : 'bg-gray-500'}`} />
              {selectedProfile.status}
            </span>
          )}
        </div>

        {selectedProfile && (
          <button
            onClick={() => void handleToggleLaunch()}
            disabled={launching}
            className={`px-5 py-2 rounded-xl text-xs font-black transition-all shadow-md flex items-center gap-2 uppercase tracking-wider font-mono ${
              selectedProfile.status === 'running'
                ? 'bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 shadow-rose-950/20'
                : 'bg-gradient-to-r from-[#00ff88] to-[#10b981] hover:brightness-110 text-gray-950 shadow-[0_0_14px_rgba(0,255,136,0.3)]'
            }`}
          >
            {launching ? (
              <span>Working…</span>
            ) : selectedProfile.status === 'running' ? (
              <>
                <span>■</span>
                <span>Stop Session</span>
              </>
            ) : (
              <>
                <span>▶</span>
                <span>Launch for Live Check</span>
              </>
            )}
          </button>
        )}
      </div>

      {!selectedProfile && (
        <div className="p-12 text-center bg-[#06140e] rounded-2xl border border-dashed border-[#143d2c] text-emerald-800/80 font-mono text-xs">
          Please create a profile in the Profiles tab first to test fingerprint consistency.
        </div>
      )}

      {selectedProfile && !fp && (
        <div className="p-8 text-center bg-amber-950/30 rounded-2xl border border-amber-500/30 text-amber-300 font-mono text-xs">
          This profile does not have a fingerprint configuration assigned. Open it in the Profile editor to generate one.
        </div>
      )}

      {selectedProfile && fp && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Consistency Validator Results */}
          <div className="bg-[#06140e] p-5 rounded-2xl border border-[#103425] shadow-xl flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-[#103425]">
                <h2 className="text-xs font-mono font-bold text-white uppercase tracking-wider">Consistency Audit</h2>
                <div className="flex items-center gap-2 font-mono">
                  {errors.length === 0 ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-[#00ff88]/10 text-[#00ff88] border border-[#00ff88]/30 shadow-[0_0_8px_rgba(0,255,136,0.15)]">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#00ff88]" />
                      0 Errors
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-950/40 text-rose-300 border border-rose-500/40">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                      {errors.length} {errors.length === 1 ? 'Error' : 'Errors'}
                    </span>
                  )}
                  {warnings.length > 0 && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-950/40 text-amber-300 border border-amber-500/30">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                      {warnings.length} {warnings.length === 1 ? 'Warning' : 'Warnings'}
                    </span>
                  )}
                </div>
              </div>

              <div className="mt-4 space-y-2 text-xs font-mono">
                {issues.length === 0 && (
                  <p className="text-emerald-400/90 leading-relaxed bg-[#081b13] p-3 rounded-xl border border-[#143d2c]">
                    ✓ All consistency checks passed: UA matches OS, fonts match platform, GPU renderer is compatible, and hardware ranges are realistic.
                  </p>
                )}
                {issues.map((issue, idx) => (
                  <div
                    key={idx}
                    className={`p-2.5 rounded-xl border flex items-start gap-2 ${
                      issue.severity === 'error'
                        ? 'bg-rose-950/40 border-rose-500/40 text-rose-300'
                        : 'bg-amber-950/40 border-amber-500/30 text-amber-300'
                    }`}
                  >
                    <span className="font-bold uppercase text-[10px] px-1.5 py-0.5 rounded bg-black/50">
                      {issue.severity}
                    </span>
                    <div>
                      <span className="font-bold">{issue.field}: </span>
                      {issue.message}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Recommended External Test Checkpoints */}
            <div className="mt-6 pt-4 border-t border-[#103425]">
              <span className="text-xs font-mono font-bold text-gray-400 block mb-2 uppercase tracking-wider">
                External Verification Suites:
              </span>
              <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                <a
                  href="https://browserleaks.com/canvas"
                  target="_blank"
                  rel="noreferrer"
                  className="p-2.5 bg-[#081b13] hover:bg-[#0e2c20] rounded-xl border border-[#143d2c] text-emerald-300 hover:text-white block truncate transition-colors"
                >
                  🌐 BrowserLeaks (Canvas)
                </a>
                <a
                  href="https://browserleaks.com/webrtc"
                  target="_blank"
                  rel="noreferrer"
                  className="p-2.5 bg-[#081b13] hover:bg-[#0e2c20] rounded-xl border border-[#143d2c] text-emerald-300 hover:text-white block truncate transition-colors"
                >
                  🛡️ BrowserLeaks (WebRTC)
                </a>
                <a
                  href="https://creepjs-fork.github.io/creepjs/"
                  target="_blank"
                  rel="noreferrer"
                  className="p-2.5 bg-[#081b13] hover:bg-[#0e2c20] rounded-xl border border-[#143d2c] text-emerald-300 hover:text-white block truncate transition-colors"
                >
                  🕵️ CreepJS Diagnostics
                </a>
                <a
                  href="https://pixelscan.net/"
                  target="_blank"
                  rel="noreferrer"
                  className="p-2.5 bg-[#081b13] hover:bg-[#0e2c20] rounded-xl border border-[#143d2c] text-[#00ff88] hover:brightness-125 block truncate transition-colors font-bold"
                >
                  🔍 Pixelscan Check
                </a>
              </div>
            </div>
          </div>

          {/* Stored Config Identity Breakdown */}
          <div className="bg-[#06140e] p-5 rounded-2xl border border-[#103425] shadow-xl space-y-3.5 text-xs font-mono">
            <h2 className="text-xs font-bold text-white uppercase tracking-wider pb-3 border-b border-[#103425]">
              Stored Identity Configuration
            </h2>

            <div>
              <span className="text-emerald-600 block text-[10px] uppercase font-bold tracking-wider">Seed (PRNG Driver):</span>
              <span className="text-emerald-300 break-all">{fp.seed}</span>
            </div>

            <div>
              <span className="text-emerald-600 block text-[10px] uppercase font-bold tracking-wider mb-1">User-Agent:</span>
              <p className="text-emerald-200 bg-[#040e09] p-2.5 rounded-xl border border-[#103425] break-all select-all leading-relaxed">
                {fp.userAgent}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <span className="text-emerald-600 block text-[10px] uppercase font-bold tracking-wider">Platform:</span>
                <span className="font-semibold text-white">
                  {fp.uaMetadata.platform} ({fp.uaMetadata.architecture})
                </span>
              </div>
              <div>
                <span className="text-emerald-600 block text-[10px] uppercase font-bold tracking-wider">Screen:</span>
                <span className="font-semibold text-white">
                  {fp.screen.width} × {fp.screen.height} @ {fp.screen.dpr}x
                </span>
              </div>
              <div>
                <span className="text-emerald-600 block text-[10px] uppercase font-bold tracking-wider">CPU & RAM:</span>
                <span className="font-semibold text-white">
                  {fp.hardwareConcurrency} Cores / {fp.deviceMemory} GB
                </span>
              </div>
              <div>
                <span className="text-emerald-600 block text-[10px] uppercase font-bold tracking-wider">Timezone:</span>
                <span className="font-semibold text-white">{fp.timezone}</span>
              </div>
            </div>

            <div className="pt-2">
              <span className="text-emerald-600 block text-[10px] uppercase font-bold tracking-wider">WebGL Hardware:</span>
              <span className="font-semibold text-white block truncate">{fp.webgl.vendor}</span>
              <span className="text-[11px] text-emerald-400/80 block truncate mt-0.5">
                {fp.webgl.renderer}
              </span>
            </div>

            <div className="pt-2 flex flex-wrap gap-2">
              <span className="px-2.5 py-1 rounded-lg bg-[#00ff88]/10 text-[#00ff88] border border-[#00ff88]/30 font-medium">
                Canvas: {fp.canvas}
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-[#00ff88]/10 text-[#00ff88] border border-[#00ff88]/30 font-medium">
                Audio: {fp.audio}
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-[#00ff88]/10 text-[#00ff88] border border-[#00ff88]/30 font-medium">
                WebRTC: {fp.webrtc}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
