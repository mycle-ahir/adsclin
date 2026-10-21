import { useState, useEffect } from 'react';
import type { Profile, Proxy, Group, FingerprintConfig, CookieFormat, FingerprintOS, WebRtcPolicy, NoiseMode } from '../../shared/types';
import type { CreateProfileInput, UpdateProfileInput } from '../../shared/schemas';
import { useProfilesStore } from '../stores/profiles-store';
import { generateFingerprint, repairFingerprintConsistency } from '../../main/services/fingerprint-generator';
import { FINGERPRINT_TEMPLATES } from '../../main/services/fingerprint-templates';
import { validateFingerprint } from '../../main/services/fingerprint-validator';
import { adjustFingerprintToGeo } from '../../shared/geo-utils';

interface ProfileEditorModalProps {
  mode: 'create' | 'edit';
  profile?: Profile;
  onClose: () => void;
}

export function ProfileEditorModal({ mode, profile, onClose }: ProfileEditorModalProps) {
  const createProfile = useProfilesStore((s) => s.createProfile);
  const updateProfile = useProfilesStore((s) => s.updateProfile);
  const groups = useProfilesStore((s) => s.groups);

  const initialOs: FingerprintOS = 'windows';
  const initialTemplate = 'windows-11-desktop-intel';

  // Form states
  const [name, setName] = useState(profile?.name ?? 'Profile 1');
  const [groupId, setGroupId] = useState<string>(profile?.groupId ?? '');
  const [notes, setNotes] = useState(profile?.notes ?? '');
  const [proxyId, setProxyId] = useState<string>(profile?.proxyId ?? '');
  const [tagsRaw, setTagsRaw] = useState(profile?.tags.join(', ') ?? '');
  const [fingerprint, setFingerprint] = useState<FingerprintConfig>(() => {
    if (profile?.fingerprint) {
      const errs = validateFingerprint(profile.fingerprint);
      if (errs.length > 0) {
        return repairFingerprintConsistency(profile.fingerprint, profile.fingerprint.os);
      }
      return profile.fingerprint;
    }
    return generateFingerprint({ templateId: 'windows-11-desktop-intel' });
  });
  const [selectedTemplate, setSelectedTemplate] = useState(initialTemplate);
  const [proxies, setProxies] = useState<Proxy[]>([]);
  const [nameError, setNameError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  // Active navigation tab
  const [activeTab, setActiveTab] = useState<'basic' | 'proxy' | 'fingerprint' | 'preferences' | 'cookies' | 'extensions'>('basic');

  // OS selection
  const [selectedOs, setSelectedOs] = useState<FingerprintOS>(initialOs);

  // Proxy tab states
  const [proxyMode, setProxyMode] = useState<'custom' | 'saved' | 'rotating' | 'provider'>('custom');
  const [customScheme, setCustomScheme] = useState<'http' | 'https' | 'socks5'>('http');
  const [customHost, setCustomHost] = useState('');
  const [customPort, setCustomPort] = useState('8080');
  const [customUsername, setCustomUsername] = useState('');
  const [customPassword, setCustomPassword] = useState('');
  const [changeIpUrl, setChangeIpUrl] = useState('');
  const [proxyChecking, setProxyChecking] = useState(false);
  const [proxyCheckResult, setProxyCheckResult] = useState<{ ok: boolean; message: string } | null>(null);

  // Fingerprint options pills
  const [webrtcMode, setWebrtcMode] = useState<WebRtcPolicy>(fingerprint.webrtc);
  const [timezoneMode, setTimezoneMode] = useState<'ip' | 'custom'>('ip');
  const [locationMode, setLocationMode] = useState<'ip' | 'custom' | 'block'>('ip');
  const [locationPermission, setLocationPermission] = useState<'ask' | 'allow'>('ask');
  const [languageMode, setLanguageMode] = useState<'ip' | 'custom'>('ip');
  const [resolutionMode, setResolutionMode] = useState<'ua' | 'custom'>('ua');
  const [canvasNoise, setCanvasNoise] = useState<NoiseMode>(fingerprint.canvas);
  const [audioNoise, setAudioNoise] = useState<NoiseMode>(fingerprint.audio);

  // Preferences toggles (iOS-style blue switches)
  const [prefSyncBookmarks, setPrefSyncBookmarks] = useState(true);
  const [prefSyncPasswords, setPrefSyncPasswords] = useState(true);
  const [prefSyncHistory, setPrefSyncHistory] = useState(true);
  const [prefSyncStorage, setPrefSyncStorage] = useState(true);
  const [prefSyncExtensions, setPrefSyncExtensions] = useState(true);
  const [prefHardwareAccel, setPrefHardwareAccel] = useState(true);
  const [prefDisableImages, setPrefDisableImages] = useState(false);
  const [prefDisableVideo, setPrefDisableVideo] = useState(false);
  const [prefDontCloseLastTab, setPrefDontCloseLastTab] = useState(true);
  const [prefGostSsl, setPrefGostSsl] = useState(false);
  const [prefHideSpoofing, setPrefHideSpoofing] = useState(true);
  const [prefTaskbarName, setPrefTaskbarName] = useState(true);
  const [prefProfileLock, setPrefProfileLock] = useState(true);

  // Cookie management states
  const [cookieFormat, setCookieFormat] = useState<CookieFormat>('json');
  const [cookieInput, setCookieInput] = useState('');
  const [cookieStatus, setCookieStatus] = useState<string | null>(null);
  const [cookieLoading, setCookieLoading] = useState(false);

  // Extensions
  const [extensions, setExtensions] = useState<string[]>(profile?.extensions ?? []);

  // Copied alert state
  const [copiedUa, setCopiedUa] = useState(false);

  useEffect(() => {
    document.body.classList.add('overflow-hidden');
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.classList.remove('overflow-hidden');
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  useEffect(() => {
    window.api
      .listProxies()
      .then((list) => {
        setProxies(list);
        if (profile?.proxyId) {
          const match = list.find((p) => p.id === profile.proxyId);
          if (match) {
            setCustomScheme(match.scheme);
            setCustomHost(match.host);
            setCustomPort(String(match.port));
            setCustomUsername(match.username ?? '');
          }
        }
      })
      .catch((err: unknown) => {
        console.error('Failed to load proxies', err);
      });
  }, [profile?.proxyId]);

  // Handle re-rolling fingerprint
  function handleRegenerateFingerprint() {
    let tpl = selectedTemplate;
    const currentTpl = FINGERPRINT_TEMPLATES[tpl];
    if (!currentTpl || currentTpl.os !== selectedOs) {
      if (selectedOs === 'macos') tpl = 'macos-sonoma-arm';
      else if (selectedOs === 'linux') tpl = 'linux-ubuntu-intel';
      else tpl = 'windows-11-desktop-intel';
      setSelectedTemplate(tpl);
    }
    const newFp = generateFingerprint({ templateId: tpl, os: selectedOs });
    newFp.timezone = fingerprint.timezone;
    newFp.languages = fingerprint.languages;
    if (fingerprint.geolocation) newFp.geolocation = fingerprint.geolocation;
    setFingerprint(newFp);
    setWebrtcMode(newFp.webrtc);
    setCanvasNoise(newFp.canvas);
    setAudioNoise(newFp.audio);
  }

  // Auto-fix all inconsistencies
  function handleFixConsistency() {
    const repaired = repairFingerprintConsistency(fingerprint, selectedOs);
    setFingerprint(repaired);
    let tpl = selectedTemplate;
    if (selectedOs === 'macos') tpl = 'macos-sonoma-arm';
    else if (selectedOs === 'linux') tpl = 'linux-ubuntu-intel';
    else tpl = 'windows-11-desktop-intel';
    setSelectedTemplate(tpl);
  }

  // Handle copying UA
  function handleCopyUa() {
    void navigator.clipboard.writeText(fingerprint.userAgent);
    setCopiedUa(true);
    setTimeout(() => setCopiedUa(false), 2000);
  }

  // Check proxy
  async function handleCheckProxy() {
    if (!customHost.trim() || !customPort.trim()) {
      setProxyCheckResult({ ok: false, message: 'Please enter a valid host and port.' });
      return;
    }
    const portNum = parseInt(customPort, 10);
    if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
      setProxyCheckResult({ ok: false, message: 'Invalid port number (1-65535).' });
      return;
    }

    setProxyChecking(true);
    setProxyCheckResult(null);

    try {
      // Find or create temporary/saved proxy to run live test
      let targetProxyId = proxyId;
      if (!targetProxyId || proxyMode === 'custom') {
        const created = await window.api.createProxy({
          name: `Proxy ${customHost}:${portNum}`,
          scheme: customScheme,
          host: customHost.trim(),
          port: portNum,
          username: customUsername.trim() || null,
          password: customPassword || null,
        });
        targetProxyId = created.id;
        setProxyId(created.id);
      }

      const res = await window.api.testProxy(targetProxyId);
      const updatedFp = adjustFingerprintToGeo(fingerprint, {
        country: res.country,
        timezone: res.timezone,
        loc: res.loc,
        ip: res.ip,
      });
      setFingerprint(updatedFp);
      setProxyCheckResult({
        ok: true,
        message: `✓ Connected! IP: ${res.ip} | Country: ${res.country} (${res.latencyMs}ms) — Timezone (${updatedFp.timezone}) & language (${updatedFp.languages.slice(0, 2).join(', ')}) auto-adjusted!`,
      });
    } catch (err) {
      setProxyCheckResult({
        ok: false,
        message: `✕ Proxy test failed: ${String(err)}`,
      });
    } finally {
      setProxyChecking(false);
    }
  }

  // Handle Export Cookies
  async function handleExportCookies() {
    if (!profile?.id) {
      setCookieStatus('Export is available after creating and saving the profile.');
      return;
    }
    setCookieLoading(true);
    setCookieStatus(null);
    try {
      const data = await window.api.exportCookies(profile.id, cookieFormat);
      setCookieInput(data);
      setCookieStatus(`✓ Exported cookies in ${cookieFormat.toUpperCase()} format`);
    } catch (err) {
      setCookieStatus(`Export error: ${String(err)}`);
    } finally {
      setCookieLoading(false);
    }
  }

  // Handle Import Cookies
  async function handleImportCookies() {
    if (!cookieInput.trim()) {
      setCookieStatus('Error: Paste cookie data into the text box first.');
      return;
    }
    if (!profile?.id) {
      setCookieStatus('✓ Cookies will be saved and imported on creation.');
      return;
    }
    setCookieLoading(true);
    setCookieStatus(null);
    try {
      const res = await window.api.importCookies(profile.id, cookieInput.trim(), cookieFormat);
      setCookieStatus(`✓ Successfully imported ${res.count} cookies into profile`);
    } catch (err) {
      setCookieStatus(`Import error: ${String(err)}`);
    } finally {
      setCookieLoading(false);
    }
  }

  // Save profile
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setNameError('');
    setSubmitError('');

    if (name.trim().length === 0) {
      setNameError('Name is required.');
      return;
    }

    const tags = tagsRaw
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    // If custom proxy was filled out but not yet created
    let activeProxyId = proxyId !== '' ? proxyId : null;
    if (proxyMode === 'custom' && customHost.trim()) {
      const portNum = parseInt(customPort, 10);
      if (!isNaN(portNum) && portNum >= 1 && portNum <= 65535) {
        try {
          const created = await window.api.createProxy({
            name: `${name.trim()} Proxy`,
            scheme: customScheme,
            host: customHost.trim(),
            port: portNum,
            username: customUsername.trim() || null,
            password: customPassword || null,
          });
          activeProxyId = created.id;
        } catch {
          // Ignore if exists or creation fails
        }
      }
    } else if (proxyMode === 'custom' && !customHost.trim()) {
      activeProxyId = null;
    }

    let currentFp: FingerprintConfig = {
      ...fingerprint,
      os: selectedOs,
      webrtc: webrtcMode,
      canvas: canvasNoise,
      audio: audioNoise,
    };

    // Ensure saved fingerprint is always 100% consistent across OS, UA, fonts, and WebGL
    if (validateFingerprint(currentFp).length > 0) {
      currentFp = repairFingerprintConsistency(currentFp, selectedOs);
    }

    setSubmitting(true);
    try {
      if (mode === 'create') {
        const createInput: CreateProfileInput = {
          name: name.trim(),
          groupId: groupId !== '' ? groupId : null,
          notes,
          proxyId: activeProxyId,
          tags,
          fingerprint: currentFp,
          extensions,
        };
        await createProfile(createInput);
      } else if (profile) {
        const updateInput: UpdateProfileInput = {
          id: profile.id,
          name: name.trim(),
          groupId: groupId !== '' ? groupId : null,
          notes,
          proxyId: activeProxyId,
          tags,
          fingerprint: currentFp,
          extensions,
        };
        await updateProfile(updateInput);

        // If cookies were provided in edit mode, import them automatically
        if (cookieInput.trim()) {
          try {
            await window.api.importCookies(profile.id, cookieInput.trim(), cookieFormat);
          } catch (cookieErr) {
            console.warn('Cookie auto-import warning:', cookieErr);
          }
        }
      }
      onClose();
    } catch (err) {
      setSubmitError(String(err));
    } finally {
      setSubmitting(false);
    }
  }

  const issues = fingerprint ? validateFingerprint(fingerprint) : [];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 select-none animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-[#06140e] border border-[#103425] rounded-2xl w-full max-w-5xl h-[90vh] flex flex-col shadow-2xl overflow-hidden text-[#e2f9ed]">
        {/* Top Header */}
        <div className="px-6 py-4 border-b border-[#103425] flex items-center justify-between bg-[#040e09]">
          <div className="flex items-center gap-3">
            <h2 className="text-base font-black text-white tracking-wide font-sans drop-shadow-[0_0_10px_rgba(255,255,255,0.15)]">
              {mode === 'create' ? 'Single Import' : 'Edit Profile'}
            </h2>
            {profile && (
              <span className="text-[11px] font-mono text-[#00ff88] bg-[#00ff88]/10 border border-[#00ff88]/30 px-2 py-0.5 rounded">
                ID: {profile.id.slice(0, 8)}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white rounded-lg p-1.5 hover:bg-[#081b13] transition-colors text-lg leading-none"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Navigation Tabs Header */}
        <div className="flex items-center gap-1 px-6 border-b border-[#103425] bg-[#05110c] text-xs font-mono">
          {[
            { id: 'basic', label: 'Basic' },
            { id: 'proxy', label: 'Proxy' },
            { id: 'fingerprint', label: 'Fingerprint' },
            { id: 'preferences', label: 'Preferences' },
            { id: 'cookies', label: 'Cookies' },
            { id: 'extensions', label: `Extensions (${extensions.length})` },
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`py-3 px-4 border-b-2 font-bold transition-all uppercase tracking-wider ${
                  isActive
                    ? 'border-[#00ff88] text-[#00ff88] bg-[#00ff88]/10 shadow-[0_0_10px_rgba(0,255,136,0.15)]'
                    : 'border-transparent text-emerald-800 hover:text-emerald-300 hover:bg-[#081b13]'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Main Body - 2 Columns */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Column (65%) */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* TAB: BASIC */}
            {activeTab === 'basic' && (
              <div className="space-y-5">
                {/* Profile Name & Group Row */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                      Profile Name <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="My Profile"
                      className={`w-full bg-[#272832] border rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 outline-none transition-all ${
                        nameError ? 'border-red-500 focus:border-red-400' : 'border-[#323440] focus:border-[#246cf9]'
                      }`}
                    />
                    {nameError && <p className="mt-1 text-xs text-red-400">{nameError}</p>}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-300 mb-1.5">Group</label>
                    <select
                      value={groupId}
                      onChange={(e) => setGroupId(e.target.value)}
                      className="w-full bg-[#272832] border border-[#323440] focus:border-[#246cf9] rounded-lg px-3 py-2 text-sm text-white outline-none"
                    >
                      <option value="">— No group —</option>
                      {groups.map((g: Group) => (
                        <option key={g.id} value={g.id}>
                          {g.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Operating System Selector (Windows Only) */}
                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-2">Operating system</label>
                  <div className="grid grid-cols-2 gap-3 max-w-md">
                    {[
                      { label: 'Windows 11', desc: 'Modern stealth x64 build', tpl: 'windows-11-desktop-intel' },
                      { label: 'Windows 10', desc: 'Enterprise desktop x64 build', tpl: 'windows-10-desktop-amd' },
                    ].map((item, idx) => {
                      const isSelected = selectedTemplate === item.tpl;
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => {
                            setSelectedOs('windows');
                            setSelectedTemplate(item.tpl);
                            const fp = generateFingerprint({ templateId: item.tpl });
                            setFingerprint(fp);
                          }}
                          className={`flex items-center gap-3 p-3 rounded-xl border transition-all text-left cursor-pointer ${
                            isSelected
                              ? 'bg-[#00ff88]/15 border-[#00ff88] text-white shadow-[0_0_12px_rgba(0,255,136,0.15)]'
                              : 'bg-[#081a13] border-[#143d2c] text-gray-400 hover:text-gray-200 hover:border-emerald-600'
                          }`}
                        >
                          <span className="text-xl leading-none">🪟</span>
                          <div className="flex flex-col">
                            <span className="text-xs font-bold text-white">{item.label}</span>
                            <span className="text-[10px] text-gray-400 font-mono mt-0.5">{item.desc}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* User-Agent Row */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-gray-300">User-Agent</label>
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-[#20222a] text-[#246cf9] border border-[#246cf9]/30">
                      Chrome 155
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={fingerprint.userAgent}
                      readOnly
                      className="flex-1 bg-[#272832] border border-[#323440] rounded-lg px-3 py-2 text-xs font-mono text-gray-300 outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleRegenerateFingerprint}
                      title="Shuffle User-Agent"
                      className="px-3 py-2 bg-[#20222a] hover:bg-[#272832] border border-[#323440] text-gray-300 hover:text-white rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap"
                    >
                      <span>🎲</span> Shuffle
                    </button>
                    <button
                      type="button"
                      onClick={handleCopyUa}
                      title="Copy User-Agent"
                      className="px-3 py-2 bg-[#20222a] hover:bg-[#272832] border border-[#323440] text-gray-300 hover:text-white rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap"
                    >
                      <span>📋</span> {copiedUa ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                </div>

                {/* Cookie Input Section */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-gray-300">Cookie</label>
                    <button
                      type="button"
                      onClick={() => {
                        setCookieInput((prev) => (prev ? prev + '\n' : '') + '[]');
                      }}
                      className="text-xs text-[#246cf9] hover:underline font-medium"
                    >
                      + Merge cookie
                    </button>
                  </div>
                  <textarea
                    value={cookieInput}
                    onChange={(e) => setCookieInput(e.target.value)}
                    rows={4}
                    placeholder='Enter cookie in JSON format. E.g., [{"name": "name", "value": "value", "domain": ".example.com"}] or Netscape format'
                    className="w-full bg-[#272832] border border-[#323440] focus:border-[#246cf9] rounded-lg p-3 text-xs font-mono text-gray-200 placeholder-gray-500 outline-none resize-none"
                  />
                </div>

                {/* Remark / Notes Section with Counter */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-gray-300">Remark</label>
                    <span className="text-[11px] text-gray-500 font-mono">
                      {notes.length} / 2000
                    </span>
                  </div>
                  <textarea
                    value={notes}
                    maxLength={2000}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                    placeholder="Enter remarks or tags for this profile..."
                    className="w-full bg-[#272832] border border-[#323440] focus:border-[#246cf9] rounded-lg p-3 text-xs text-gray-200 placeholder-gray-500 outline-none resize-none"
                  />
                </div>

                {/* Tags */}
                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                    Tags <span className="text-gray-500 font-normal">(comma-separated)</span>
                  </label>
                  <input
                    type="text"
                    value={tagsRaw}
                    onChange={(e) => setTagsRaw(e.target.value)}
                    placeholder="social, qa, e-commerce"
                    className="w-full bg-[#272832] border border-[#323440] focus:border-[#246cf9] rounded-lg px-3 py-2 text-xs text-white placeholder-gray-500 outline-none"
                  />
                </div>
              </div>
            )}

            {/* TAB: PROXY */}
            {activeTab === 'proxy' && (
              <div className="space-y-5">
                {/* Proxy Mode Pills */}
                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-2">Proxy Connection</label>
                  <div className="flex gap-2">
                    {[
                      { id: 'custom', label: 'Custom' },
                      { id: 'saved', label: 'Saved Proxies' },
                      { id: 'rotating', label: 'Rotating Proxy' },
                      { id: 'provider', label: 'Proxy Provider' },
                    ].map((modeItem) => {
                      const isSel = proxyMode === modeItem.id;
                      return (
                        <button
                          key={modeItem.id}
                          type="button"
                          onClick={() => setProxyMode(modeItem.id as typeof proxyMode)}
                          className={`px-3.5 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                            isSel
                              ? 'bg-[#246cf9] border-[#246cf9] text-white shadow-sm'
                              : 'bg-[#20222a] border-[#2d2f3b] text-gray-400 hover:text-gray-200 hover:bg-[#272832]'
                          }`}
                        >
                          {modeItem.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {proxyMode === 'saved' ? (
                  <div className="space-y-3">
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-xs font-semibold text-gray-300">Choose Saved Proxy</label>
                        <span className="text-[11px] text-[#246cf9] font-medium flex items-center gap-1">
                          <span>⚡</span> Auto-syncs Timezone & Language
                        </span>
                      </div>
                      <select
                        value={proxyId}
                        onChange={async (e) => {
                          const val = e.target.value;
                          setProxyId(val);
                          setProxyCheckResult(null);
                          if (!val) return;
                          const found = proxies.find((p) => p.id === val);
                          if (found) {
                            if (found.lastTestCountry) {
                              const updatedFp = adjustFingerprintToGeo(fingerprint, {
                                country: found.lastTestCountry,
                                timezone: found.lastTestTimezone ?? undefined,
                                loc: found.lastTestLoc ?? undefined,
                                ip: found.lastTestIp ?? undefined,
                              });
                              setFingerprint(updatedFp);
                              setProxyCheckResult({
                                ok: true,
                                message: `✓ Profile timezone (${updatedFp.timezone}) & language (${updatedFp.languages.slice(0, 2).join(', ')}) adjusted to ${found.lastTestCountry}!`,
                              });
                            } else {
                              // If proxy has not been tested yet, test it now in background to determine country
                              setProxyChecking(true);
                              try {
                                const res = await window.api.testProxy(found.id);
                                const updatedFp = adjustFingerprintToGeo(fingerprint, {
                                  country: res.country,
                                  timezone: res.timezone,
                                  loc: res.loc,
                                  ip: res.ip,
                                });
                                setFingerprint(updatedFp);
                                setProxyCheckResult({
                                  ok: true,
                                  message: `✓ Proxy tested (${res.ip}, ${res.country}) — Timezone (${updatedFp.timezone}) & language (${updatedFp.languages.slice(0, 2).join(', ')}) auto-adjusted!`,
                                });
                              } catch (tErr) {
                                console.warn('Saved proxy test error:', tErr);
                              } finally {
                                setProxyChecking(false);
                              }
                            }
                          }
                        }}
                        className="w-full bg-[#272832] border border-[#323440] focus:border-[#246cf9] rounded-lg px-3 py-2 text-xs text-white outline-none"
                      >
                        <option value="">— Direct (No Proxy) —</option>
                        {proxies.map((px) => (
                          <option key={px.id} value={px.id}>
                            {px.name} ({px.scheme}://{px.host}:{px.port}) {px.lastTestCountry ? `[${px.lastTestCountry}]` : ''}
                          </option>
                        ))}
                      </select>
                    </div>

                    {proxyChecking && (
                      <div className="p-2.5 rounded-lg border border-[#323440] bg-[#20222a] text-xs text-gray-300 flex items-center gap-2">
                        <span className="animate-spin">🔄</span>
                        <span>Detecting proxy location & synchronizing timezone/language...</span>
                      </div>
                    )}

                    {proxyCheckResult && (
                      <div
                        className={`p-3 rounded-lg border text-xs font-medium flex items-center gap-2 ${
                          proxyCheckResult.ok
                            ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-400'
                            : 'bg-red-950/40 border-red-500/30 text-red-400'
                        }`}
                      >
                        <span>{proxyCheckResult.ok ? '✓' : '⚠️'}</span>
                        <span>{proxyCheckResult.message}</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <>
                    {/* Proxy Type Buttons */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-xs font-semibold text-gray-300">Proxy Type</label>
                        <span className="text-[11px] text-gray-500">
                          IP checker: <span className="text-gray-300 font-medium">ip-api (Worldwide)</span>
                        </span>
                      </div>
                      <div className="flex gap-2">
                        {[
                          { id: 'no-proxy', label: 'No Proxy' },
                          { id: 'http', label: 'HTTP' },
                          { id: 'https', label: 'HTTPS' },
                          { id: 'socks5', label: 'SOCKS5' },
                        ].map((typeItem) => {
                          const isSel =
                            typeItem.id === 'no-proxy'
                              ? !customHost.trim()
                              : customScheme === typeItem.id && !!customHost.trim();
                          return (
                            <button
                              key={typeItem.id}
                              type="button"
                              onClick={() => {
                                if (typeItem.id === 'no-proxy') {
                                  setCustomHost('');
                                  setProxyId('');
                                } else {
                                  setCustomScheme(typeItem.id as 'http' | 'https' | 'socks5');
                                  if (!customHost.trim()) setCustomHost('127.0.0.1');
                                }
                              }}
                              className={`px-3.5 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                                isSel
                                  ? 'bg-[#246cf9]/20 border-[#246cf9] text-[#246cf9]'
                                  : 'bg-[#20222a] border-[#2d2f3b] text-gray-400 hover:text-gray-200 hover:bg-[#272832]'
                              }`}
                            >
                              {typeItem.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Host & Port Row with Check Proxy */}
                    <div className="grid grid-cols-12 gap-3 items-end">
                      <div className="col-span-7">
                        <label className="block text-xs font-semibold text-gray-300 mb-1.5">Proxy Host</label>
                        <input
                          type="text"
                          value={customHost}
                          onChange={(e) => setCustomHost(e.target.value)}
                          placeholder="e.g. 192.168.1.1 or proxy.network.com"
                          className="w-full bg-[#272832] border border-[#323440] focus:border-[#246cf9] rounded-lg px-3 py-2 text-xs text-white placeholder-gray-500 outline-none"
                        />
                      </div>
                      <div className="col-span-3">
                        <label className="block text-xs font-semibold text-gray-300 mb-1.5">Proxy Port</label>
                        <input
                          type="text"
                          value={customPort}
                          onChange={(e) => setCustomPort(e.target.value)}
                          placeholder="8080"
                          className="w-full bg-[#272832] border border-[#323440] focus:border-[#246cf9] rounded-lg px-3 py-2 text-xs text-white placeholder-gray-500 outline-none"
                        />
                      </div>
                      <div className="col-span-2">
                        <button
                          type="button"
                          onClick={() => void handleCheckProxy()}
                          disabled={proxyChecking || !customHost.trim()}
                          className="w-full py-2 px-2 bg-[#246cf9] hover:bg-[#1d5bd8] disabled:opacity-50 text-white rounded-lg text-xs font-medium transition-colors whitespace-nowrap shadow-sm text-center"
                        >
                          {proxyChecking ? 'Checking…' : 'Check proxy'}
                        </button>
                      </div>
                    </div>

                    {/* Proxy Check Result Banner */}
                    {proxyCheckResult && (
                      <div
                        className={`p-3 rounded-lg border text-xs font-medium flex items-center gap-2 ${
                          proxyCheckResult.ok
                            ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-400'
                            : 'bg-red-950/40 border-red-500/30 text-red-400'
                        }`}
                      >
                        <span>{proxyCheckResult.ok ? '✓' : '⚠️'}</span>
                        <span>{proxyCheckResult.message}</span>
                      </div>
                    )}

                    {/* Username & Password */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-gray-300 mb-1.5">Proxy user</label>
                        <input
                          type="text"
                          value={customUsername}
                          onChange={(e) => setCustomUsername(e.target.value)}
                          placeholder="Optional proxy username"
                          className="w-full bg-[#272832] border border-[#323440] focus:border-[#246cf9] rounded-lg px-3 py-2 text-xs text-white placeholder-gray-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-300 mb-1.5">Proxy password</label>
                        <input
                          type="password"
                          value={customPassword}
                          onChange={(e) => setCustomPassword(e.target.value)}
                          placeholder="••••••••"
                          className="w-full bg-[#272832] border border-[#323440] focus:border-[#246cf9] rounded-lg px-3 py-2 text-xs text-white placeholder-gray-500 outline-none"
                        />
                      </div>
                    </div>

                    {/* Change IP URL */}
                    <div>
                      <label className="block text-xs font-semibold text-gray-300 mb-1.5">Change IP URL</label>
                      <input
                        type="url"
                        value={changeIpUrl}
                        onChange={(e) => setChangeIpUrl(e.target.value)}
                        placeholder="https://api.proxyprovider.com/rotate?key=xyz"
                        className="w-full bg-[#272832] border border-[#323440] focus:border-[#246cf9] rounded-lg px-3 py-2 text-xs text-white placeholder-gray-500 outline-none"
                      />
                    </div>
                  </>
                )}
              </div>
            )}

            {/* TAB: FINGERPRINT */}
            {activeTab === 'fingerprint' && (
              <div className="space-y-5">
                {/* Hardware Template Selector */}
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <label className="block text-xs font-semibold text-gray-300 mb-1.5">Hardware Template</label>
                    <select
                      value={selectedTemplate}
                      onChange={(e) => {
                        setSelectedTemplate(e.target.value);
                        const tpl = FINGERPRINT_TEMPLATES[e.target.value];
                        if (tpl) {
                          setSelectedOs(tpl.os);
                          const newFp = generateFingerprint({ templateId: e.target.value });
                          setFingerprint(newFp);
                        }
                      }}
                      className="w-full bg-[#272832] border border-[#323440] focus:border-[#246cf9] rounded-lg px-3 py-2 text-xs text-white outline-none"
                    >
                      {Object.values(FINGERPRINT_TEMPLATES).map((tpl) => (
                        <option key={tpl.id} value={tpl.id}>
                          {tpl.name} ({tpl.os})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="self-end">
                    <button
                      type="button"
                      onClick={handleRegenerateFingerprint}
                      className="px-4 py-2 bg-[#20222a] hover:bg-[#272832] border border-[#323440] text-gray-200 hover:text-white rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors"
                    >
                      <span>🎲</span> Randomize
                    </button>
                  </div>
                </div>

                {/* Consistency Warning Notice */}
                {issues.length > 0 && (
                  <div className="p-3.5 bg-amber-950/40 border border-amber-500/40 rounded-xl text-xs text-amber-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="font-semibold flex items-center gap-1.5 text-amber-300">
                        <span>⚠️</span> Fingerprint Consistency Notice ({issues.length})
                      </div>
                      <button
                        type="button"
                        onClick={handleFixConsistency}
                        className="px-3 py-1 bg-amber-500 hover:bg-amber-400 text-black font-bold rounded-lg text-xs transition-colors flex items-center gap-1.5 shadow-sm cursor-pointer"
                      >
                        <span>⚡</span> Auto-Fix All Inconsistencies
                      </button>
                    </div>
                    <ul className="list-disc pl-4 space-y-0.5 text-gray-300">
                      {issues.map((iss, idx) => (
                        <li key={idx}>
                          <span className="font-bold text-amber-400 uppercase text-[10px]">[{iss.severity}]</span>{' '}
                          {iss.message}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* WebRTC Pills */}
                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-2">WebRTC</label>
                  <div className="flex gap-2">
                    {[
                      { id: 'proxy-only' as WebRtcPolicy, label: 'Proxy UDP' },
                      { id: 'disabled' as WebRtcPolicy, label: 'Disabled' },
                      { id: 'real' as WebRtcPolicy, label: 'Real' },
                      { id: 'forward' as WebRtcPolicy, label: 'Forward' },
                    ].map((item) => {
                      const isSel = webrtcMode === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setWebrtcMode(item.id)}
                          className={`px-3.5 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                            isSel
                              ? 'bg-[#246cf9] border-[#246cf9] text-white'
                              : 'bg-[#20222a] border-[#2d2f3b] text-gray-400 hover:text-gray-200'
                          }`}
                        >
                          {item.label}
                        </button>
                      );
                    })}
                  </div>
                  <p className="mt-1 text-[11px] text-gray-500">
                    Routing WebRTC via proxy UDP prevents local IP leaks while keeping WebRTC functional.
                  </p>
                </div>

                {/* Timezone Pills */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-semibold text-gray-300">Timezone</label>
                    {timezoneMode === 'ip' && (
                      <span className="text-[11px] text-[#246cf9] font-medium">
                        Proxy / IP location auto-adjusted
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setTimezoneMode('ip')}
                        className={`px-3.5 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                          timezoneMode === 'ip'
                            ? 'bg-[#246cf9] border-[#246cf9] text-white'
                            : 'bg-[#20222a] border-[#2d2f3b] text-gray-400 hover:text-gray-200'
                        }`}
                      >
                        Based on IP
                      </button>
                      <button
                        type="button"
                        onClick={() => setTimezoneMode('custom')}
                        className={`px-3.5 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                          timezoneMode === 'custom'
                            ? 'bg-[#246cf9] border-[#246cf9] text-white'
                            : 'bg-[#20222a] border-[#2d2f3b] text-gray-400 hover:text-gray-200'
                        }`}
                      >
                        Custom
                      </button>
                    </div>
                    {timezoneMode === 'ip' ? (
                      <span className="text-xs text-gray-300 font-mono px-2.5 py-1 rounded-md bg-[#20222a] border border-[#323440]">
                        ⚡ {fingerprint.timezone}
                      </span>
                    ) : (
                      <select
                        value={fingerprint.timezone}
                        onChange={(e) => setFingerprint({ ...fingerprint, timezone: e.target.value })}
                        className="flex-1 bg-[#272832] border border-[#323440] focus:border-[#246cf9] rounded-lg px-3 py-1.5 text-xs text-white outline-none"
                      >
                        <option value="America/Los_Angeles">America/Los_Angeles (US Pacific)</option>
                        <option value="America/New_York">America/New_York (US Eastern)</option>
                        <option value="America/Chicago">America/Chicago (US Central)</option>
                        <option value="Europe/London">Europe/London (GMT/BST)</option>
                        <option value="Europe/Berlin">Europe/Berlin (CET)</option>
                        <option value="Europe/Paris">Europe/Paris (CET)</option>
                        <option value="Asia/Tokyo">Asia/Tokyo (JST)</option>
                        <option value="Asia/Singapore">Asia/Singapore (SGT)</option>
                        <option value="Australia/Sydney">Australia/Sydney (AEST)</option>
                      </select>
                    )}
                  </div>
                </div>

                {/* Location Pills & Radio */}
                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-2">Location</label>
                  <div className="flex flex-wrap items-center gap-4">
                    <div className="flex gap-2">
                      {['ip', 'custom', 'block'].map((loc) => {
                        const isSel = locationMode === loc;
                        return (
                          <button
                            key={loc}
                            type="button"
                            onClick={() => setLocationMode(loc as typeof locationMode)}
                            className={`px-3.5 py-1.5 rounded-lg text-xs font-medium border capitalize transition-colors ${
                              isSel
                                ? 'bg-[#246cf9] border-[#246cf9] text-white'
                                : 'bg-[#20222a] border-[#2d2f3b] text-gray-400 hover:text-gray-200'
                            }`}
                          >
                            {loc === 'ip' ? 'Based on IP' : loc}
                          </button>
                        );
                      })}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-400">
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="radio"
                          name="locationPerm"
                          checked={locationPermission === 'ask'}
                          onChange={() => setLocationPermission('ask')}
                          className="accent-[#246cf9]"
                        />
                        <span>Ask</span>
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="radio"
                          name="locationPerm"
                          checked={locationPermission === 'allow'}
                          onChange={() => setLocationPermission('allow')}
                          className="accent-[#246cf9]"
                        />
                        <span>Always allow</span>
                      </label>
                    </div>
                  </div>
                </div>

                {/* Language Pills */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-semibold text-gray-300">Language</label>
                    {languageMode === 'ip' && (
                      <span className="text-[11px] text-[#246cf9] font-medium">
                        Proxy / IP location auto-adjusted
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setLanguageMode('ip')}
                        className={`px-3.5 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                          languageMode === 'ip'
                            ? 'bg-[#246cf9] border-[#246cf9] text-white'
                            : 'bg-[#20222a] border-[#2d2f3b] text-gray-400 hover:text-gray-200'
                        }`}
                      >
                        Based on IP
                      </button>
                      <button
                        type="button"
                        onClick={() => setLanguageMode('custom')}
                        className={`px-3.5 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                          languageMode === 'custom'
                            ? 'bg-[#246cf9] border-[#246cf9] text-white'
                            : 'bg-[#20222a] border-[#2d2f3b] text-gray-400 hover:text-gray-200'
                        }`}
                      >
                        Custom
                      </button>
                    </div>
                    {languageMode === 'ip' ? (
                      <span className="text-xs text-gray-300 font-mono px-2.5 py-1 rounded-md bg-[#20222a] border border-[#323440]">
                        ⚡ {fingerprint.languages.join(', ')}
                      </span>
                    ) : (
                      <input
                        type="text"
                        value={fingerprint.languages.join(', ')}
                        onChange={(e) =>
                          setFingerprint({
                            ...fingerprint,
                            languages: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
                          })
                        }
                        placeholder="en-US, en"
                        className="flex-1 bg-[#272832] border border-[#323440] focus:border-[#246cf9] rounded-lg px-3 py-1.5 text-xs text-white outline-none font-mono"
                      />
                    )}
                  </div>
                </div>

                {/* Screen Resolution Pills */}
                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-2">Screen Resolution</label>
                  <div className="flex items-center gap-3">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setResolutionMode('ua')}
                        className={`px-3.5 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                          resolutionMode === 'ua'
                            ? 'bg-[#246cf9] border-[#246cf9] text-white'
                            : 'bg-[#20222a] border-[#2d2f3b] text-gray-400 hover:text-gray-200'
                        }`}
                      >
                        Based on User-Agent
                      </button>
                      <button
                        type="button"
                        onClick={() => setResolutionMode('custom')}
                        className={`px-3.5 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                          resolutionMode === 'custom'
                            ? 'bg-[#246cf9] border-[#246cf9] text-white'
                            : 'bg-[#20222a] border-[#2d2f3b] text-gray-400 hover:text-gray-200'
                        }`}
                      >
                        Custom
                      </button>
                    </div>
                    {resolutionMode === 'custom' && (
                      <select
                        value={`${fingerprint.screen.width}x${fingerprint.screen.height}`}
                        onChange={(e) => {
                          const [w, h] = e.target.value.split('x').map((n) => parseInt(n, 10));
                          setFingerprint({
                            ...fingerprint,
                            screen: { ...fingerprint.screen, width: w, height: h },
                          });
                        }}
                        className="bg-[#272832] border border-[#323440] focus:border-[#246cf9] rounded-lg px-3 py-1.5 text-xs text-white outline-none"
                      >
                        <option value="1920x1080">1920 × 1080 (FHD)</option>
                        <option value="1280x720">1280 × 720 (HD)</option>
                        <option value="2560x1440">2560 × 1440 (2K QHD)</option>
                        <option value="1512x982">1512 × 982 (MacBook Pro)</option>
                        <option value="1728x1117">1728 × 1117 (MacBook Retina)</option>
                      </select>
                    )}
                  </div>
                </div>

                {/* Canvas / Audio Noise Pills */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-300 mb-2">Canvas Fingerprint</label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setCanvasNoise('noise')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                          canvasNoise === 'noise'
                            ? 'bg-[#246cf9] border-[#246cf9] text-white'
                            : 'bg-[#20222a] border-[#2d2f3b] text-gray-400 hover:text-gray-200'
                        }`}
                      >
                        Noise (Recommended)
                      </button>
                      <button
                        type="button"
                        onClick={() => setCanvasNoise('real')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                          canvasNoise === 'real'
                            ? 'bg-[#246cf9] border-[#246cf9] text-white'
                            : 'bg-[#20222a] border-[#2d2f3b] text-gray-400 hover:text-gray-200'
                        }`}
                      >
                        Real
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-300 mb-2">Audio Fingerprint</label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setAudioNoise('noise')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                          audioNoise === 'noise'
                            ? 'bg-[#246cf9] border-[#246cf9] text-white'
                            : 'bg-[#20222a] border-[#2d2f3b] text-gray-400 hover:text-gray-200'
                        }`}
                      >
                        Noise (Recommended)
                      </button>
                      <button
                        type="button"
                        onClick={() => setAudioNoise('real')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                          audioNoise === 'real'
                            ? 'bg-[#246cf9] border-[#246cf9] text-white'
                            : 'bg-[#20222a] border-[#2d2f3b] text-gray-400 hover:text-gray-200'
                        }`}
                      >
                        Real
                      </button>
                    </div>
                  </div>
                </div>

                {/* WebGL Hardware */}
                <div className="bg-[#20222a] border border-[#2d2f3b] rounded-xl p-3.5 space-y-2">
                  <div className="text-xs font-semibold text-gray-300">WebGL Hardware Emulation</div>
                  <div className="text-xs font-mono text-gray-400 truncate">
                    Vendor: <span className="text-gray-200">{fingerprint.webgl.vendor}</span>
                  </div>
                  <div className="text-xs font-mono text-gray-400 truncate">
                    Renderer: <span className="text-gray-200">{fingerprint.webgl.renderer}</span>
                  </div>
                </div>

                {/* CPU Cores & Device Memory */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-300 mb-2">CPU Cores</label>
                    <div className="flex gap-2">
                      {[2, 4, 8, 16].map((cores) => {
                        const isSel = fingerprint.hardwareConcurrency === cores;
                        return (
                          <button
                            key={cores}
                            type="button"
                            onClick={() => setFingerprint({ ...fingerprint, hardwareConcurrency: cores })}
                            className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                              isSel
                                ? 'bg-[#246cf9] border-[#246cf9] text-white'
                                : 'bg-[#20222a] border-[#2d2f3b] text-gray-400 hover:text-gray-200'
                            }`}
                          >
                            {cores}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-300 mb-2">Device Memory</label>
                    <div className="flex gap-2">
                      {[4, 8, 16, 32].map((mem) => {
                        const isSel = fingerprint.deviceMemory === mem;
                        return (
                          <button
                            key={mem}
                            type="button"
                            onClick={() => setFingerprint({ ...fingerprint, deviceMemory: mem })}
                            className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                              isSel
                                ? 'bg-[#246cf9] border-[#246cf9] text-white'
                                : 'bg-[#20222a] border-[#2d2f3b] text-gray-400 hover:text-gray-200'
                            }`}
                          >
                            {mem} GB
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB: PREFERENCES */}
            {activeTab === 'preferences' && (
              <div className="space-y-6">
                {/* Synchronization Card */}
                <div className="bg-[#20222a] border border-[#2d2f3b] rounded-2xl p-5 space-y-4">
                  <div className="text-xs font-bold text-white uppercase tracking-wider">Synchronization</div>
                  <div className="space-y-3">
                    {[
                      { label: 'Bookmarks sync', desc: 'Synchronize bookmarks to local profile directory', checked: prefSyncBookmarks, setChecked: setPrefSyncBookmarks },
                      { label: 'Saved passwords', desc: 'Remember and persist saved passwords across sessions', checked: prefSyncPasswords, setChecked: setPrefSyncPasswords },
                      { label: 'History & tabs', desc: 'Restore open tabs when browser relaunches', checked: prefSyncHistory, setChecked: setPrefSyncHistory },
                      { label: 'IndexedDB & local storage', desc: 'Preserve Web SQL and IndexedDB databases between sessions', checked: prefSyncStorage, setChecked: setPrefSyncStorage },
                      { label: 'Extension data', desc: 'Persist browser extension settings and background service workers', checked: prefSyncExtensions, setChecked: setPrefSyncExtensions },
                    ].map((row, idx) => (
                      <div key={idx} className="flex items-center justify-between py-1 border-b border-[#2d2f3b]/50 last:border-0">
                        <div>
                          <div className="text-xs font-semibold text-gray-200">{row.label}</div>
                          <div className="text-[11px] text-gray-500">{row.desc}</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => row.setChecked(!row.checked)}
                          className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                            row.checked ? 'bg-[#246cf9]' : 'bg-[#373a46]'
                          }`}
                        >
                          <span
                            className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                              row.checked ? 'translate-x-4' : 'translate-x-0'
                            }`}
                          />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Performance Card */}
                <div className="bg-[#20222a] border border-[#2d2f3b] rounded-2xl p-5 space-y-4">
                  <div className="text-xs font-bold text-white uppercase tracking-wider">Performance</div>
                  <div className="space-y-3">
                    {[
                      { label: 'Hardware acceleration', desc: 'Utilize host GPU acceleration for rendering pipelines', checked: prefHardwareAccel, setChecked: setPrefHardwareAccel },
                      { label: 'Disable image loading', desc: 'Save proxy bandwidth and accelerate page load times', checked: prefDisableImages, setChecked: setPrefDisableImages },
                      { label: 'Disable video autoplay', desc: 'Prevent media autoplaying in background tabs', checked: prefDisableVideo, setChecked: setPrefDisableVideo },
                      { label: "Don't close on last tab", desc: 'Keep browser window alive when closing the final tab', checked: prefDontCloseLastTab, setChecked: setPrefDontCloseLastTab },
                    ].map((row, idx) => (
                      <div key={idx} className="flex items-center justify-between py-1 border-b border-[#2d2f3b]/50 last:border-0">
                        <div>
                          <div className="text-xs font-semibold text-gray-200">{row.label}</div>
                          <div className="text-[11px] text-gray-500">{row.desc}</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => row.setChecked(!row.checked)}
                          className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                            row.checked ? 'bg-[#246cf9]' : 'bg-[#373a46]'
                          }`}
                        >
                          <span
                            className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                              row.checked ? 'translate-x-4' : 'translate-x-0'
                            }`}
                          />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Security & Privacy Card */}
                <div className="bg-[#20222a] border border-[#2d2f3b] rounded-2xl p-5 space-y-4">
                  <div className="text-xs font-bold text-white uppercase tracking-wider">Security & Privacy</div>
                  <div className="space-y-3">
                    {[
                      { label: 'GOST proxy SSL', desc: 'Enable GOST-compliant TLS encryption algorithms', checked: prefGostSsl, setChecked: setPrefGostSsl },
                      { label: 'Hide spoofing markers', desc: 'Mask native prototypes and receiver validation checks', checked: prefHideSpoofing, setChecked: setPrefHideSpoofing },
                      { label: 'Taskbar substitute', desc: 'Display custom profile name and custom icon in OS taskbar', checked: prefTaskbarName, setChecked: setPrefTaskbarName },
                      { label: 'Shared profile locks', desc: 'Prevent accidental concurrent launching of this profile instance', checked: prefProfileLock, setChecked: setPrefProfileLock },
                    ].map((row, idx) => (
                      <div key={idx} className="flex items-center justify-between py-1 border-b border-[#2d2f3b]/50 last:border-0">
                        <div>
                          <div className="text-xs font-semibold text-gray-200">{row.label}</div>
                          <div className="text-[11px] text-gray-500">{row.desc}</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => row.setChecked(!row.checked)}
                          className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                            row.checked ? 'bg-[#246cf9]' : 'bg-[#373a46]'
                          }`}
                        >
                          <span
                            className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                              row.checked ? 'translate-x-4' : 'translate-x-0'
                            }`}
                          />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* TAB: COOKIES */}
            {activeTab === 'cookies' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-bold text-white uppercase tracking-wider">Cookie Import / Export</h3>
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      Export and import session cookies in standard JSON or Netscape format for this profile.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      value={cookieFormat}
                      onChange={(e) => setCookieFormat(e.target.value as CookieFormat)}
                      className="bg-[#272832] border border-[#323440] rounded-lg px-2.5 py-1 text-xs text-white outline-none"
                    >
                      <option value="json">JSON Format</option>
                      <option value="netscape">Netscape Format</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => void handleExportCookies()}
                      disabled={cookieLoading}
                      className="px-3 py-1 bg-[#20222a] hover:bg-[#272832] border border-[#323440] text-gray-200 rounded-lg text-xs font-medium transition-colors"
                    >
                      📥 Export
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleImportCookies()}
                      disabled={cookieLoading}
                      className="px-3 py-1 bg-[#246cf9] hover:bg-[#1d5bd8] text-white rounded-lg text-xs font-medium transition-colors"
                    >
                      📤 Import
                    </button>
                  </div>
                </div>

                {cookieStatus && (
                  <div
                    className={`p-3 rounded-lg border text-xs font-medium ${
                      cookieStatus.startsWith('✓')
                        ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-400'
                        : 'bg-red-950/40 border-red-500/30 text-red-400'
                    }`}
                  >
                    {cookieStatus}
                  </div>
                )}

                <textarea
                  value={cookieInput}
                  onChange={(e) => setCookieInput(e.target.value)}
                  rows={10}
                  className="w-full bg-[#272832] border border-[#323440] focus:border-[#246cf9] rounded-lg p-3 text-xs font-mono text-gray-200 outline-none resize-none"
                  placeholder='[\n  {\n    "name": "session_id",\n    "value": "xyz123",\n    "domain": ".example.com",\n    "path": "/",\n    "secure": true,\n    "httpOnly": true\n  }\n]'
                />
              </div>
            )}

            {/* TAB: EXTENSIONS */}
            {activeTab === 'extensions' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-bold text-white uppercase tracking-wider">Unpacked Chrome Extensions</h3>
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      Load extensions from local directories containing manifest.json.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      void (async () => {
                        const path = await window.api.selectExtensionDir();
                        if (path && !extensions.includes(path)) {
                          setExtensions([...extensions, path]);
                        }
                      })();
                    }}
                    className="px-3 py-1.5 bg-[#246cf9] hover:bg-[#1d5bd8] text-white rounded-lg text-xs font-medium transition-colors"
                  >
                    ➕ Add Extension Folder
                  </button>
                </div>

                {extensions.length === 0 ? (
                  <div className="p-8 text-center border-2 border-dashed border-[#2d2f3b] rounded-xl text-xs text-gray-500">
                    No extensions loaded for this profile yet. Click &ldquo;Add Extension Folder&rdquo; above.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {extensions.map((extPath, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-3 bg-[#20222a] border border-[#2d2f3b] rounded-xl text-xs"
                      >
                        <div className="truncate font-mono text-gray-300 mr-2" title={extPath}>
                          {extPath}
                        </div>
                        <button
                          type="button"
                          onClick={() => setExtensions(extensions.filter((_, i) => i !== index))}
                          className="text-red-400 hover:text-red-300 hover:bg-red-500/10 px-2 py-1 rounded transition-colors"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {submitError && (
              <div className="p-3 bg-red-950/40 border border-red-500/30 text-red-400 rounded-xl text-xs">
                {submitError}
              </div>
            )}
          </div>

          {/* Right Column (35%) - Fixed Overview Panel */}
          <div className="w-80 flex-shrink-0 bg-[#141518] border-l border-[#2d2f3b] p-5 overflow-y-auto space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white tracking-wide">Overview</h3>
              <button
                type="button"
                onClick={handleRegenerateFingerprint}
                className="px-2.5 py-1 bg-[#246cf9] hover:bg-[#1d5bd8] text-white rounded-lg text-[11px] font-semibold transition-colors flex items-center gap-1 shadow-sm"
              >
                <span>+</span> New fingerprint
              </button>
            </div>

            {/* Dynamic Overview Details Card */}
            <div className="bg-[#1c1d22] border border-[#2d2f3b] rounded-xl p-4 space-y-3.5 text-xs">
              <div>
                <span className="text-gray-500 block text-[10px] uppercase font-bold tracking-wider">Browser</span>
                <span className="font-semibold text-white">SunBrowser [Chrome 155]</span>
              </div>

              <div>
                <span className="text-gray-500 block text-[10px] uppercase font-bold tracking-wider">Operating system</span>
                <span className="font-semibold text-gray-200 capitalize flex items-center gap-1.5 mt-0.5">
                  🪟 {selectedTemplate.includes('10') ? 'Windows 10 Desktop' : 'Windows 11 Desktop'}
                </span>
              </div>

              <div>
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-gray-500 text-[10px] uppercase font-bold tracking-wider">User-Agent</span>
                  <button
                    type="button"
                    onClick={handleCopyUa}
                    className="text-[10px] text-[#246cf9] hover:underline"
                  >
                    {copiedUa ? 'Copied' : 'Copy'}
                  </button>
                </div>
                <div className="font-mono text-[11px] text-gray-400 bg-[#16171b] border border-[#2d2f3b] p-2 rounded break-all leading-snug">
                  {fingerprint.userAgent}
                </div>
              </div>

              <div>
                <span className="text-gray-500 block text-[10px] uppercase font-bold tracking-wider">Cookie</span>
                <span className="text-gray-300 font-medium">
                  {cookieInput.trim().length > 0 ? 'Custom cookie loaded' : 'None'}
                </span>
              </div>

              <div>
                <span className="text-gray-500 block text-[10px] uppercase font-bold tracking-wider">Proxy</span>
                <span className="text-gray-300 font-medium">
                  {customHost.trim()
                    ? `${customScheme.toUpperCase()}://${customHost}:${customPort}`
                    : proxyId
                    ? 'Saved Proxy'
                    : 'Direct (No Proxy)'}
                </span>
              </div>

              <div>
                <span className="text-gray-500 block text-[10px] uppercase font-bold tracking-wider">WebRTC</span>
                <span className="text-gray-200 font-medium capitalize">
                  {webrtcMode === 'proxy-only' ? 'Proxy UDP' : webrtcMode}
                </span>
              </div>

              <div>
                <span className="text-gray-500 block text-[10px] uppercase font-bold tracking-wider">Timezone</span>
                <span className="text-gray-200 font-medium">
                  {timezoneMode === 'ip' ? 'Based on IP' : fingerprint.timezone}
                </span>
              </div>

              <div>
                <span className="text-gray-500 block text-[10px] uppercase font-bold tracking-wider">Location</span>
                <span className="text-gray-200 font-medium">
                  [{locationPermission === 'ask' ? 'Ask' : 'Allow'}] {locationMode === 'ip' ? 'Based on IP' : locationMode}
                </span>
              </div>

              <div>
                <span className="text-gray-500 block text-[10px] uppercase font-bold tracking-wider">Language</span>
                <span className="text-gray-200 font-medium">
                  {languageMode === 'ip' ? 'Based on IP' : 'en-US, en'}
                </span>
              </div>

              <div>
                <span className="text-gray-500 block text-[10px] uppercase font-bold tracking-wider">Screen resolution</span>
                <span className="text-gray-200 font-medium">
                  {resolutionMode === 'ua'
                    ? `Based on User-Agent (${fingerprint.screen.width}x${fingerprint.screen.height})`
                    : `${fingerprint.screen.width} × ${fingerprint.screen.height}`}
                </span>
              </div>

              <div>
                <span className="text-gray-500 block text-[10px] uppercase font-bold tracking-wider">Hardware Defenses</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                    ✓ Canvas Noise
                  </span>
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                    ✓ Audio Noise
                  </span>
                </div>
              </div>

              <div>
                <span className="text-gray-500 block text-[10px] uppercase font-bold tracking-wider">Profile Seed</span>
                <span className="font-mono text-gray-400 text-[11px] truncate block">
                  {fingerprint.seed}
                </span>
              </div>
            </div>

            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => setActiveTab('preferences')}
                className="text-[11px] text-[#246cf9] hover:underline cursor-pointer"
              >
                Set default values in Preferences.
              </button>
            </div>
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div className="px-6 py-4 border-t border-[#103425] bg-[#040e09] flex items-center justify-end gap-3 font-mono">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-5 py-2 text-xs font-semibold text-gray-400 bg-[#081a13] hover:bg-[#0e2c20] hover:text-white border border-[#143d2c] transition-colors uppercase tracking-wider"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={(e) => void handleSubmit(e)}
            disabled={submitting}
            className="rounded-xl px-7 py-2 text-xs font-black text-gray-950 bg-gradient-to-r from-[#00ff88] to-[#10b981] hover:brightness-110 disabled:opacity-50 transition-all shadow-[0_0_15px_rgba(0,255,136,0.35)] uppercase tracking-wider"
          >
            {submitting ? 'Saving…' : 'Save & Close'}
          </button>
        </div>
      </div>
    </div>
  );
}
