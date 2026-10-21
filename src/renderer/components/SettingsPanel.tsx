import { useState, useEffect } from 'react';
import type { AppSettings } from '../../shared/types';
import { CyberLoadingScreen } from './CyberLoadingScreen';

export function SettingsPanel() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [customPath, setCustomPath] = useState('');
  const [apiPort, setApiPort] = useState(3001);
  const [apiEnabled, setApiEnabled] = useState(true);
  const [apiToken, setApiToken] = useState('');
  const [savingPath, setSavingPath] = useState(false);
  const [savedPathMessage, setSavedPathMessage] = useState(false);
  const [savingApi, setSavingApi] = useState(false);
  const [savedApiMessage, setSavedApiMessage] = useState(false);
  const [copiedToken, setCopiedToken] = useState(false);
  const [showBootPreview, setShowBootPreview] = useState(false);

  // Supabase cloud database states
  const [supabaseUrl, setSupabaseUrl] = useState('');
  const [supabaseAnonKey, setSupabaseAnonKey] = useState('');
  const [supabaseStatus, setSupabaseStatus] = useState<string | null>(null);
  const [supabaseTesting, setSupabaseTesting] = useState(false);
  const [supabaseSyncing, setSupabaseSyncing] = useState(false);
  const [supabaseMessage, setSupabaseMessage] = useState<string | null>(null);
  const [copiedSchema, setCopiedSchema] = useState(false);
  const [showAdvancedCloud, setShowAdvancedCloud] = useState(false);

  useEffect(() => {
    window.api
      ?.getSettings?.()
      .then((s) => {
        setSettings(s);
        setCustomPath(s.customExecutablePath ?? '');
        setApiPort(s.apiPort);
        setApiEnabled(s.apiEnabled);
        setApiToken(s.apiToken);
      })
      .catch((err: unknown) => {
        console.error('Failed to load settings', err);
      });

    window.api
      ?.getSupabaseConfig?.()
      .then((cfg) => {
        if (cfg) {
          setSupabaseUrl(cfg.url);
          setSupabaseAnonKey(cfg.anonKey);
          if (cfg.isConfigured) {
            setSupabaseStatus('Ready');
          }
        }
      })
      .catch(() => {});
  }, []);

  async function handleSavePath(e: React.FormEvent) {
    e.preventDefault();
    setSavingPath(true);
    setSavedPathMessage(false);
    try {
      const updated = await window.api.updateSettings({
        customExecutablePath: customPath.trim() !== '' ? customPath.trim() : null,
      });
      setSettings(updated);
      setSavedPathMessage(true);
      setTimeout(() => setSavedPathMessage(false), 3000);
    } catch (err) {
      console.error('Failed to update executable path', err);
    } finally {
      setSavingPath(false);
    }
  }

  async function handleSaveApi(e: React.FormEvent) {
    e.preventDefault();
    setSavingApi(true);
    setSavedApiMessage(false);
    try {
      const updated = await window.api.updateSettings({
        apiPort,
        apiEnabled,
        apiToken,
      });
      setSettings(updated);
      setSavedApiMessage(true);
      setTimeout(() => setSavedApiMessage(false), 3000);
    } catch (err) {
      console.error('Failed to update API settings', err);
    } finally {
      setSavingApi(false);
    }
  }

  async function handleRegenerateToken() {
    try {
      const newToken = await window.api.regenerateApiToken();
      setApiToken(newToken);
      if (settings) {
        setSettings({ ...settings, apiToken: newToken });
      }
    } catch (err) {
      console.error('Failed to regenerate API token', err);
    }
  }

  function handleCopyToken() {
    if (!apiToken) return;
    navigator.clipboard.writeText(apiToken).then(() => {
      setCopiedToken(true);
      setTimeout(() => setCopiedToken(false), 2000);
    });
  }

  async function handleSaveAndTestSupabase() {
    setSupabaseTesting(true);
    setSupabaseMessage(null);
    try {
      const res = await window.api.saveSupabaseConfig(supabaseUrl, supabaseAnonKey);
      if (res.success) {
        setSupabaseStatus('Connected');
        setSupabaseMessage(res.message);
      } else {
        setSupabaseStatus('Error');
        setSupabaseMessage(res.message);
      }
    } catch (err: any) {
      setSupabaseStatus('Error');
      setSupabaseMessage(err?.message || String(err));
    } finally {
      setSupabaseTesting(false);
    }
  }

  async function handleSyncToCloud() {
    setSupabaseSyncing(true);
    setSupabaseMessage(null);
    try {
      const resProf = await window.api.syncProfilesToCloud();
      const resProx = await window.api.syncProxiesToCloud();
      if (resProf.success && resProx.success) {
        setSupabaseMessage(`Successfully backed up ${resProf.count} profiles & ${resProx.count} proxies to Supabase!`);
      } else {
        setSupabaseMessage(resProf.error || resProx.error || 'Failed to sync to cloud');
      }
    } catch (err: any) {
      setSupabaseMessage(err?.message || String(err));
    } finally {
      setSupabaseSyncing(false);
    }
  }

  async function handlePullFromCloud() {
    setSupabaseSyncing(true);
    setSupabaseMessage(null);
    try {
      const res = await window.api.pullProfilesFromCloud();
      if (res.success) {
        setSupabaseMessage(`Pulled and updated ${res.count} profiles from Supabase!`);
      } else {
        setSupabaseMessage(res.error || 'Failed to pull from cloud');
      }
    } catch (err: any) {
      setSupabaseMessage(err?.message || String(err));
    } finally {
      setSupabaseSyncing(false);
    }
  }

  function handleCopySchemaPath() {
    navigator.clipboard.writeText('supabase-schema.sql').then(() => {
      setCopiedSchema(true);
      setTimeout(() => setCopiedSchema(false), 2500);
    });
  }

  return (
    <div className="flex flex-col gap-6 text-[#e2f9ed] max-w-4xl pb-12">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
          <span>Settings</span>
          <span className="text-[10px] font-mono font-bold text-[#00ff88] bg-[#00ff88]/10 border border-[#00ff88]/30 px-2 py-0.5 rounded uppercase tracking-wider">
            System Config
          </span>
        </h1>
        <p className="text-xs text-gray-400 mt-1 font-sans">
          Configure local REST automation, cloud database synchronization, storage paths, and browser engine.
        </p>
      </div>

      {/* Adsclin Cloud Sync (Production Ready) */}
      <section className="bg-[#06140e] rounded-2xl border border-[#103425] shadow-xl p-5 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#00ff88]/10 border border-[#00ff88]/30 flex items-center justify-center text-lg text-[#00ff88]">
              ☁️
            </div>
            <div>
              <h2 className="text-sm font-bold text-white tracking-wide flex items-center gap-2">
                <span>Adsclin Cloud Network</span>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-[#00ff88]/10 text-[#00ff88] border border-[#00ff88]/20">
                  PRODUCTION
                </span>
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">
                Multi-device profile synchronization, proxy integrity, and licensing are managed via the Adsclin Cloud.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-mono font-bold ${
                supabaseStatus === 'Connected' || supabaseStatus === 'Ready'
                  ? 'bg-[#00ff88]/15 border border-[#00ff88]/40 text-[#00ff88]'
                  : supabaseStatus === 'Error'
                  ? 'bg-red-950/40 border border-red-500/40 text-red-400'
                  : 'bg-[#00ff88]/15 border border-[#00ff88]/40 text-[#00ff88]'
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  supabaseStatus === 'Error'
                    ? 'bg-red-500 shadow-[0_0_6px_#ef4444]'
                    : 'bg-[#00ff88] shadow-[0_0_6px_#00ff88]'
                }`}
              />
              {supabaseStatus === 'Error' ? 'Connection Error' : 'Official Cloud Active'}
            </span>
          </div>
        </div>

        {/* Informational production banner */}
        <div className="bg-[#081b13] border border-[#123827] rounded-xl p-3.5 flex items-center justify-between gap-4 text-xs font-mono">
          <div className="flex items-center gap-2.5 text-gray-300">
            <span className="text-[#00ff88] text-base">🔒</span>
            <span>All profiles and hardware trial authorizations are securely encrypted and synchronized.</span>
          </div>
          <button
            type="button"
            onClick={() => setShowAdvancedCloud(!showAdvancedCloud)}
            className="text-[11px] text-gray-500 hover:text-emerald-400 underline font-sans transition-colors cursor-pointer shrink-0"
          >
            {showAdvancedCloud ? 'Hide Custom Endpoint' : 'Custom Endpoint (Enterprise)'}
          </button>
        </div>

        {/* Collapsible advanced endpoint configuration for private cloud customers */}
        {showAdvancedCloud && (
          <div className="p-4 rounded-xl bg-[#040e0a] border border-[#143d2c] flex flex-col gap-3 font-mono text-xs">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-gray-400 mb-1 font-sans">
                  Custom Supabase Project URL
                </label>
                <input
                  type="text"
                  value={supabaseUrl}
                  onChange={(e) => setSupabaseUrl(e.target.value)}
                  placeholder="https://xyzcompany.supabase.co"
                  className="w-full bg-[#081b13] border border-[#143d2c] focus:border-[#00ff88] rounded-lg px-3 py-1.5 text-xs text-white placeholder-gray-600 outline-none transition-colors"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-gray-400 mb-1 font-sans">
                  Custom Anon / Public API Key
                </label>
                <input
                  type="password"
                  value={supabaseAnonKey}
                  onChange={(e) => setSupabaseAnonKey(e.target.value)}
                  placeholder="sb_publishable_... or eyJhbGciOi..."
                  className="w-full bg-[#081b13] border border-[#143d2c] focus:border-[#00ff88] rounded-lg px-3 py-1.5 text-xs text-white placeholder-gray-600 outline-none transition-colors"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-[#103425]/50">
              <button
                type="button"
                onClick={handleCopySchemaPath}
                className="text-[11px] text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
              >
                <span>📄</span>
                <span>{copiedSchema ? 'Copied schema path!' : 'Copy supabase-schema.sql'}</span>
              </button>

              <button
                type="button"
                disabled={supabaseTesting}
                onClick={handleSaveAndTestSupabase}
                className="rounded-lg px-3 py-1 text-xs font-bold text-black bg-[#00ff88] hover:bg-[#05eb8a] disabled:opacity-50 transition-all cursor-pointer"
              >
                {supabaseTesting ? 'Connecting…' : 'Save & Test Custom Cloud'}
              </button>
            </div>
          </div>
        )}

        {supabaseMessage && (
          <div
            className={`border rounded-xl p-3 text-xs font-mono ${
              supabaseStatus === 'Connected'
                ? 'bg-[#081f16] border-[#00ff88]/40 text-[#00ff88]'
                : supabaseStatus === 'Error'
                ? 'bg-[#200e12] border-red-500/40 text-red-300'
                : 'bg-[#081a13] border-[#143d2c] text-emerald-300'
            }`}
          >
            {supabaseMessage}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-end gap-3 pt-2 border-t border-[#103425]/60 font-sans">
          <button
            type="button"
            disabled={supabaseSyncing}
            onClick={handlePullFromCloud}
            className="rounded-xl px-4 py-2 text-xs font-bold text-gray-300 hover:text-white bg-[#081a13] hover:bg-[#0c261c] border border-[#143d2c] disabled:opacity-50 transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
          >
            <span>⬇ Pull Cloud Data</span>
          </button>

          <button
            type="button"
            disabled={supabaseSyncing}
            onClick={handleSyncToCloud}
            className="rounded-xl px-4 py-2 text-xs font-black text-black bg-[#00ff88] hover:bg-[#05eb8a] disabled:opacity-50 transition-all shadow-[0_0_12px_rgba(0,255,136,0.3)] flex items-center gap-1.5 cursor-pointer"
          >
            <span>{supabaseSyncing ? 'Syncing…' : '⬆ Backup to Cloud'}</span>
          </button>
        </div>
      </section>

      {/* REST API Settings */}
      <section className="bg-[#06140e] rounded-2xl border border-[#103425] shadow-xl p-5 flex flex-col gap-4">
        <div>
          <h2 className="text-sm font-bold text-white tracking-wide">REST Automation API</h2>
          <p className="text-xs text-gray-400 mt-1 leading-relaxed">
            Local HTTP server enabling programmatic browser automation via Puppeteer, Playwright, or Selenium.
          </p>
        </div>

        <form onSubmit={handleSaveApi} className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <input
              id="api-enabled-toggle"
              type="checkbox"
              checked={apiEnabled}
              onChange={(e) => setApiEnabled(e.target.checked)}
              className="rounded border-[#164030] text-[#00ff88] focus:ring-0 h-4 w-4 accent-[#00ff88] bg-[#05110c] cursor-pointer"
            />
            <label htmlFor="api-enabled-toggle" className="text-xs font-semibold text-gray-200 cursor-pointer">
              Enable local REST automation API
            </label>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="api-port-input" className="block text-xs font-semibold text-gray-300 mb-1">
                Port
              </label>
              <input
                id="api-port-input"
                type="number"
                min={1024}
                max={65535}
                value={apiPort}
                onChange={(e) => setApiPort(parseInt(e.target.value, 10) || 3001)}
                className="w-full bg-[#081b13] border border-[#143d2c] focus:border-[#00ff88] focus:shadow-[0_0_10px_rgba(0,255,136,0.2)] rounded-xl px-3 py-2 text-xs text-white outline-none font-mono transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">Status</label>
              <div className="flex items-center gap-2 pt-2 text-xs font-mono">
                <span className={`w-2 h-2 rounded-full ${apiEnabled ? 'bg-[#00ff88] shadow-[0_0_8px_#00ff88]' : 'bg-gray-500'}`} />
                <span className={apiEnabled ? 'text-[#00ff88] font-bold' : 'text-gray-400'}>
                  {apiEnabled ? `Listening on http://127.0.0.1:${apiPort}` : 'Disabled'}
                </span>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-1">Bearer Auth Token</label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={apiToken}
                className="flex-1 bg-[#040e09] border border-[#103425] rounded-xl px-3 py-2 text-xs font-mono text-emerald-400 select-all outline-none"
              />
              <button
                type="button"
                onClick={handleCopyToken}
                className="rounded-xl px-3 py-2 text-xs font-bold text-emerald-300 bg-[#081a13] hover:bg-[#0c2419] border border-[#143d2c] hover:text-white transition-all font-mono"
              >
                {copiedToken ? '✓ Copied' : 'Copy'}
              </button>
              <button
                type="button"
                onClick={handleRegenerateToken}
                className="rounded-xl px-3 py-2 text-xs font-bold text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 transition-all font-mono"
              >
                Regenerate
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            {savedApiMessage ? (
              <span className="text-xs text-[#00ff88] font-bold font-mono">✓ Saved. Restart may be required.</span>
            ) : <span />}
            <button
              type="submit"
              disabled={savingApi}
              className="rounded-xl px-5 py-2 text-xs font-black text-black bg-[#00ff88] hover:bg-[#05eb8a] disabled:opacity-50 transition-all shadow-[0_0_12px_rgba(0,255,136,0.3)] uppercase tracking-wider cursor-pointer"
            >
              {savingApi ? 'Saving…' : 'Save API Settings'}
            </button>
          </div>
        </form>
      </section>

      {/* Custom Chromium Path */}
      <section className="bg-[#06140e] rounded-2xl border border-[#103425] shadow-xl p-5 flex flex-col gap-4">
        <div>
          <h2 className="text-sm font-bold text-white tracking-wide">Browser Binary Location</h2>
          <p className="text-xs text-gray-400 mt-1 leading-relaxed">
            By default, Playwright bundled Chromium is used. You can specify a custom Chrome or Chromium binary.
          </p>
        </div>

        <form onSubmit={handleSavePath} className="flex flex-col gap-3">
          <input
            type="text"
            value={customPath}
            onChange={(e) => setCustomPath(e.target.value)}
            placeholder="e.g. C:\Program Files\Google\Chrome\Application\chrome.exe"
            className="w-full bg-[#081b13] border border-[#143d2c] focus:border-[#00ff88] focus:shadow-[0_0_10px_rgba(0,255,136,0.2)] rounded-xl px-3 py-2 text-xs text-white placeholder-emerald-900/60 outline-none font-mono transition-all"
          />

          <div className="flex items-center justify-between">
            {savedPathMessage ? (
              <span className="text-xs text-[#00ff88] font-bold font-mono">✓ Executable path updated.</span>
            ) : <span />}
            <button
              type="submit"
              disabled={savingPath}
              className="ml-auto rounded-xl px-4 py-1.5 text-xs font-black text-black bg-[#00ff88] hover:bg-[#05eb8a] disabled:opacity-50 transition-all shadow-[0_0_12px_rgba(0,255,136,0.3)] uppercase tracking-wider cursor-pointer"
            >
              {savingPath ? 'Saving…' : 'Save Path'}
            </button>
          </div>
        </form>
      </section>

      {/* Data Storage Folder */}
      <section className="bg-[#06140e] rounded-2xl border border-[#103425] shadow-xl p-5 flex flex-col gap-3">
        <h2 className="text-sm font-bold text-white tracking-wide">User Data & Storage</h2>
        <p className="text-xs text-gray-400 leading-relaxed font-sans">
          Application SQLite database and isolated profile browsing contexts (cookies, cache, session storage) are stored locally in:
        </p>
        <div className="rounded-xl bg-[#040e09] border border-[#103425] px-3 py-2 text-xs font-mono text-[#00ff88] select-all break-all">
          {settings ? settings.userDataDir : 'Loading path…'}
        </div>
      </section>

      {/* Cyber Boot Experience Preview */}
      <section className="bg-[#06140e] rounded-2xl border border-[#103425] shadow-xl p-5 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold text-white tracking-wide">Cyber Boot Experience</h2>
          <p className="text-xs text-gray-400 mt-1 leading-relaxed">
            Preview the futuristic holographic 3D wireframe initialization sequence.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowBootPreview(true)}
          className="rounded-xl px-4 py-2 text-xs font-bold text-[#00ff88] bg-[#00ff88]/10 hover:bg-[#00ff88]/20 border border-[#00ff88]/30 transition-all shadow-[0_0_12px_rgba(0,255,136,0.15)] flex items-center gap-2 flex-shrink-0 font-mono uppercase tracking-wider cursor-pointer"
        >
          <span>⚡</span>
          <span>Preview Boot Screen</span>
        </button>
      </section>

      {/* Footer Branding */}
      <div className="pt-6 pb-2 flex flex-col items-center justify-center gap-2 text-center border-t border-[#103425]">
        <p className="text-sm font-semibold text-gray-300">
          Made with <span className="text-rose-500 animate-pulse inline-block">❤️</span> by <span className="font-bold text-[#00ff88]">Growdemy</span>
        </p>
        <p className="text-xs text-emerald-600/80 font-mono">
          Adsclin Anti-Detect Browser • Enterprise Multi-Profile Stealth Suite v1.0.2
        </p>
      </div>

      {/* Cyber Screen Preview Modal */}
      {showBootPreview && (
        <div className="fixed inset-0 z-50 flex flex-col">
          <div className="absolute top-4 right-6 z-50">
            <button
              onClick={() => setShowBootPreview(false)}
              className="bg-black/80 hover:bg-black text-gray-300 hover:text-white px-3 py-1.5 rounded-lg border border-emerald-500/40 text-xs font-mono transition-colors"
            >
              ✕ Exit Preview
            </button>
          </div>
          <CyberLoadingScreen onComplete={() => setShowBootPreview(false)} minDurationMs={3200} />
        </div>
      )}
    </div>
  );
}
