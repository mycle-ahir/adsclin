import { useState } from 'react';
import type { Group, Proxy, ProxyAssignmentMode } from '../../shared/types';
import type { BulkCreateProfilesInput } from '../../shared/schemas';
import { FINGERPRINT_TEMPLATES } from '../../main/services/fingerprint-templates';

interface BulkCreateProfilesDialogProps {
  groups?: Group[];
  proxies: Proxy[];
  onClose: () => void;
  onCreated?: () => void;
}

export function BulkCreateProfilesDialog({
  groups = [],
  proxies,
  onClose,
  onCreated,
}: BulkCreateProfilesDialogProps) {
  const [count, setCount] = useState(5);
  const [namePrefix, setNamePrefix] = useState('Profile');
  const [templateId, setTemplateId] = useState('windows-11-desktop-intel');
  const [groupId, setGroupId] = useState('');
  const [proxyMode, setProxyMode] = useState<ProxyAssignmentMode>('none');
  const [specificProxyId, setSpecificProxyId] = useState('');
  const [tagsRaw, setTagsRaw] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (namePrefix.trim().length === 0) {
      setError('Profile name prefix is required.');
      return;
    }
    if (count < 1 || count > 100) {
      setError('Count must be between 1 and 100.');
      return;
    }

    const tags = tagsRaw
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    const input: BulkCreateProfilesInput = {
      count,
      namePrefix: namePrefix.trim(),
      templateId,
      groupId: groupId !== '' ? groupId : null,
      proxyMode,
      specificProxyId: proxyMode === 'specific' && specificProxyId !== '' ? specificProxyId : null,
      tags,
    };

    setSubmitting(true);
    try {
      await window.api.bulkCreateProfiles(input);
      if (onCreated) onCreated();
      onClose();
    } catch (err) {
      setError(String(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs select-none animate-in fade-in duration-200">
      <div className="bg-[#06140e] rounded-2xl shadow-2xl border border-[#103425] max-w-lg w-full p-6 text-[#e2f9ed] font-mono">
        <div className="flex items-center justify-between pb-4 border-b border-[#103425]">
          <div>
            <h2 className="text-base font-black text-white tracking-wide font-sans drop-shadow-[0_0_10px_rgba(255,255,255,0.15)]">
              Bulk Create Profiles
            </h2>
            <p className="text-xs text-emerald-500/80 mt-0.5">
              Generate multiple browser profiles from a hardware template with unique seeds.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white rounded-lg p-1.5 hover:bg-[#081b13] transition-colors text-lg"
          >
            ✕
          </button>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="mt-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">
                Number of Profiles (1–100)
              </label>
              <input
                type="number"
                min={1}
                max={100}
                value={count}
                onChange={(e) => setCount(parseInt(e.target.value, 10) || 1)}
                className="w-full bg-[#081b13] border border-[#143d2c] focus:border-[#00ff88] focus:shadow-[0_0_10px_rgba(0,255,136,0.2)] rounded-xl px-3 py-2 text-xs text-white outline-none font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">
                Name Prefix
              </label>
              <input
                type="text"
                value={namePrefix}
                onChange={(e) => setNamePrefix(e.target.value)}
                placeholder="e.g. Account"
                className="w-full bg-[#081b13] border border-[#143d2c] focus:border-[#00ff88] focus:shadow-[0_0_10px_rgba(0,255,136,0.2)] rounded-xl px-3 py-2 text-xs text-white placeholder-emerald-900/60 outline-none font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-1">
              Hardware Template
            </label>
            <select
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
              className="w-full bg-[#081b13] border border-[#143d2c] focus:border-[#00ff88] rounded-xl px-3 py-2 text-xs text-emerald-300 outline-none font-mono cursor-pointer"
            >
              {Object.values(FINGERPRINT_TEMPLATES)
                .filter((tpl) => tpl.os === 'windows')
                .map((tpl) => (
                  <option key={tpl.id} value={tpl.id}>
                    {tpl.name}
                  </option>
                ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">Group (optional)</label>
              <select
                value={groupId}
                onChange={(e) => setGroupId(e.target.value)}
                className="w-full bg-[#081b13] border border-[#143d2c] focus:border-[#00ff88] rounded-xl px-3 py-2 text-xs text-emerald-300 outline-none font-mono cursor-pointer"
              >
                <option value="">— None —</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">Proxy Assignment</label>
              <select
                value={proxyMode}
                onChange={(e) => setProxyMode(e.target.value as ProxyAssignmentMode)}
                className="w-full bg-[#081b13] border border-[#143d2c] focus:border-[#00ff88] rounded-xl px-3 py-2 text-xs text-emerald-300 outline-none font-mono cursor-pointer"
              >
                <option value="none">Direct (No Proxy)</option>
                <option value="sequential" disabled={proxies.length === 0}>
                  Sequential ({proxies.length} available)
                </option>
                <option value="random" disabled={proxies.length === 0}>
                  Random ({proxies.length} available)
                </option>
                <option value="specific" disabled={proxies.length === 0}>
                  Assign Specific Proxy
                </option>
              </select>
            </div>
          </div>

          {proxyMode === 'specific' && proxies.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">Choose Proxy</label>
              <select
                value={specificProxyId}
                onChange={(e) => setSpecificProxyId(e.target.value)}
                className="w-full bg-[#081b13] border border-[#143d2c] focus:border-[#00ff88] rounded-xl px-3 py-2 text-xs text-emerald-300 outline-none font-mono cursor-pointer"
              >
                <option value="">— Select Proxy —</option>
                {proxies.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.host}:{p.port})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-1">
              Tags <span className="text-gray-500 font-normal">(comma-separated)</span>
            </label>
            <input
              type="text"
              value={tagsRaw}
              onChange={(e) => setTagsRaw(e.target.value)}
              placeholder="e.g. batch-1, automation"
              className="w-full bg-[#081b13] border border-[#143d2c] focus:border-[#00ff88] rounded-xl px-3 py-2 text-xs text-white placeholder-emerald-900/60 outline-none font-mono"
            />
          </div>

          {error && (
            <p className="text-xs text-rose-300 bg-rose-950/40 border border-rose-500/30 rounded-xl p-2.5 font-mono">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2.5 pt-4 border-t border-[#103425] font-mono">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-gray-400 bg-[#081a13] hover:bg-[#0e2c20] hover:text-white border border-[#143d2c] rounded-xl transition-colors uppercase tracking-wider"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2 text-xs font-black text-gray-950 bg-gradient-to-r from-[#00ff88] to-[#10b981] hover:brightness-110 disabled:opacity-50 rounded-xl transition-all shadow-[0_0_15px_rgba(0,255,136,0.35)] uppercase tracking-wider"
            >
              {submitting ? 'Generating Profiles…' : `Create ${count} Profiles`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
