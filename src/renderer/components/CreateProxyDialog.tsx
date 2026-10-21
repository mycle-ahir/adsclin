import { useState, useEffect } from 'react';
import type { CreateProxyInput } from '../../shared/schemas';
import type { ProxyScheme } from '../../shared/types';
import { useProxiesStore } from '../stores/proxies-store';

const SCHEMES: ProxyScheme[] = ['http', 'https', 'socks5'];

interface CreateProxyDialogProps {
  onClose: () => void;
}

export function CreateProxyDialog({ onClose }: CreateProxyDialogProps) {
  const createProxy = useProxiesStore((s) => s.createProxy);

  const [name, setName] = useState('');
  const [scheme, setScheme] = useState<ProxyScheme>('http');
  const [host, setHost] = useState('');
  const [port, setPort] = useState<string>('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  // Lock body scroll
  useEffect(() => {
    document.body.classList.add('overflow-hidden');
    return () => document.body.classList.remove('overflow-hidden');
  }, []);

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (name.trim().length === 0) e['name'] = 'Name is required.';
    if (host.trim().length === 0) e['host'] = 'Host is required.';
    const portNum = parseInt(port, 10);
    if (isNaN(portNum) || portNum < 1 || portNum > 65535)
      e['port'] = 'Port must be 1–65535.';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError('');
    if (!validate()) return;

    const input: CreateProxyInput = {
      name: name.trim(),
      scheme,
      host: host.trim(),
      port: parseInt(port, 10),
      username: username.trim() !== '' ? username.trim() : null,
      password: password !== '' ? password : null,
    };

    setSubmitting(true);
    try {
      await createProxy(input);
      onClose();
    } catch (err) {
      setSubmitError(String(err));
    } finally {
      setSubmitting(false);
    }
  }

  const field = (key: string) => ({
    className: `w-full bg-[#081b13] border rounded-xl px-3 py-2 text-xs text-white outline-none font-mono focus:border-[#00ff88] focus:shadow-[0_0_10px_rgba(0,255,136,0.2)] ${
      errors[key] ? 'border-rose-500' : 'border-[#143d2c]'
    }`,
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs select-none animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-[#06140e] border border-[#103425] rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6 text-[#e2f9ed] font-mono">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#103425] mb-5">
          <div>
            <h2 className="text-base font-black text-white tracking-wide font-sans drop-shadow-[0_0_10px_rgba(255,255,255,0.15)]">
              Add Proxy Endpoint
            </h2>
            <p className="text-[11px] text-emerald-500/80 mt-0.5">
              Securely register and encrypt proxy credentials
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white rounded-lg p-1.5 hover:bg-[#081b13] transition-colors text-lg leading-none"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} noValidate className="space-y-4">
          {/* Name */}
          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-1">
              Proxy Name <span className="text-[#00ff88]">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              {...field('name')}
              placeholder="e.g. US Residential 01"
              autoFocus
            />
            {errors['name'] && (
              <p className="mt-1 text-xs text-rose-400">{errors['name']}</p>
            )}
          </div>

          {/* Scheme */}
          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-1">
              Protocol / Scheme
            </label>
            <select
              value={scheme}
              onChange={(e) => setScheme(e.target.value as ProxyScheme)}
              className="w-full bg-[#081b13] border border-[#143d2c] focus:border-[#00ff88] rounded-xl px-3 py-2 text-xs text-emerald-300 outline-none font-mono cursor-pointer"
            >
              {SCHEMES.map((s) => (
                <option key={s} value={s}>
                  {s.toUpperCase()}
                </option>
              ))}
            </select>
          </div>

          {/* Host + Port (row) */}
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-xs font-semibold text-gray-300 mb-1">
                Host / IP <span className="text-[#00ff88]">*</span>
              </label>
              <input
                type="text"
                value={host}
                onChange={(e) => setHost(e.target.value)}
                {...field('host')}
                placeholder="192.168.1.1"
              />
              {errors['host'] && (
                <p className="mt-1 text-xs text-rose-400">{errors['host']}</p>
              )}
            </div>
            <div className="w-28">
              <label className="block text-xs font-semibold text-gray-300 mb-1">
                Port <span className="text-[#00ff88]">*</span>
              </label>
              <input
                type="number"
                value={port}
                onChange={(e) => setPort(e.target.value)}
                {...field('port')}
                placeholder="8080"
                min={1}
                max={65535}
              />
              {errors['port'] && (
                <p className="mt-1 text-xs text-rose-400">{errors['port']}</p>
              )}
            </div>
          </div>

          {/* Username */}
          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-1">
              Username <span className="text-gray-500 font-normal">(optional)</span>
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-[#081b13] border border-[#143d2c] focus:border-[#00ff88] rounded-xl px-3 py-2 text-xs text-white outline-none font-mono"
              placeholder="user"
              autoComplete="off"
            />
          </div>

          {/* Password */}
          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-1">
              Password <span className="text-gray-500 font-normal">(optional)</span>
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-[#081b13] border border-[#143d2c] focus:border-[#00ff88] rounded-xl px-3 py-2 text-xs text-white outline-none font-mono"
              placeholder="••••••••"
              autoComplete="new-password"
            />
          </div>

          {submitError && (
            <p className="text-xs text-rose-300 bg-rose-950/40 border border-rose-500/30 rounded-xl p-2.5 font-mono">
              {submitError}
            </p>
          )}

          {/* Buttons */}
          <div className="flex justify-end gap-2.5 pt-4 border-t border-[#103425] font-mono">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-4 py-2 text-xs font-semibold text-gray-400 bg-[#081a13] hover:bg-[#0e2c20] hover:text-white border border-[#143d2c] transition-colors uppercase tracking-wider"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-xl px-6 py-2 text-xs font-black text-gray-950 bg-gradient-to-r from-[#00ff88] to-[#10b981] hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-[0_0_15px_rgba(0,255,136,0.35)] uppercase tracking-wider"
            >
              {submitting ? 'Adding…' : 'Add Proxy'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
