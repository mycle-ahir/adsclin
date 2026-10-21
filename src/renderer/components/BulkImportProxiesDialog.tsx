import { useState, useMemo } from 'react';
import type { ProxyScheme } from '../../shared/types';
import { parseProxyList } from '../../shared/proxy-parser';

interface BulkImportProxiesDialogProps {
  onClose: () => void;
  onImported: () => void;
}

export function BulkImportProxiesDialog({ onClose, onImported }: BulkImportProxiesDialogProps) {
  const [rawText, setRawText] = useState('');
  const [defaultScheme, setDefaultScheme] = useState<ProxyScheme>('http');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const parsedProxies = useMemo(() => {
    return parseProxyList(rawText, defaultScheme);
  }, [rawText, defaultScheme]);

  async function handleImport(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (parsedProxies.length === 0) {
      setError('Please paste at least one valid proxy.');
      return;
    }

    setSubmitting(true);
    try {
      await window.api.bulkCreateProxies(parsedProxies);
      onImported();
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
              Bulk Import Proxies
            </h2>
            <p className="text-[11px] text-emerald-500/80 mt-0.5">
              Paste a multi-line list of proxies to import and encrypt automatically.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white rounded-lg p-1.5 hover:bg-[#081b13] transition-colors text-lg"
          >
            ✕
          </button>
        </div>

        <form onSubmit={(e) => void handleImport(e)} className="mt-4 space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-gray-300 mb-1">Default Protocol</label>
            <div className="flex items-center gap-2">
              <select
                value={defaultScheme}
                onChange={(e) => setDefaultScheme(e.target.value as ProxyScheme)}
                className="rounded-xl border border-[#143d2c] px-3 py-1.5 text-xs bg-[#081b13] font-mono text-emerald-300 outline-none focus:border-[#00ff88] cursor-pointer"
              >
                <option value="http">HTTP</option>
                <option value="https">HTTPS</option>
                <option value="socks5">SOCKS5</option>
              </select>
              <span className="text-emerald-700 text-[11px]">
                (Used if no protocol prefix is specified)
              </span>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="font-semibold text-gray-300">Paste Proxy List (one per line):</label>
              <span className="font-bold text-[#00ff88]">
                {parsedProxies.length} valid {parsedProxies.length === 1 ? 'proxy' : 'proxies'} recognized
              </span>
            </div>
            <textarea
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              rows={8}
              className="w-full rounded-xl border border-[#143d2c] p-2.5 font-mono text-[11px] outline-none focus:border-[#00ff88] focus:shadow-[0_0_10px_rgba(0,255,136,0.2)] bg-[#081b13] text-emerald-300 placeholder-emerald-900/60 resize-y"
              placeholder={
                '192.168.1.100:8080\n10.0.0.1:1080:username:password\nsocks5://user:pass@proxy.example.com:1080'
              }
            />
          </div>

          <div className="bg-[#040e09] rounded-xl p-3 border border-[#103425] text-emerald-500/80 text-[11px] space-y-1">
            <span className="font-bold text-gray-300 block">Supported Formats:</span>
            <div>• <code className="text-[#00ff88] font-mono">host:port</code></div>
            <div>• <code className="text-[#00ff88] font-mono">host:port:user:pass</code></div>
            <div>• <code className="text-[#00ff88] font-mono">user:pass@host:port</code></div>
            <div>• <code className="text-[#00ff88] font-mono">scheme://host:port</code></div>
          </div>

          {error && (
            <p className="text-xs text-rose-300 bg-rose-950/40 border border-rose-500/30 rounded-xl p-2.5">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2.5 pt-4 border-t border-[#103425]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-gray-400 bg-[#081a13] hover:bg-[#0e2c20] hover:text-white border border-[#143d2c] rounded-xl transition-colors uppercase tracking-wider"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || parsedProxies.length === 0}
              className="px-6 py-2 text-xs font-black text-gray-950 bg-gradient-to-r from-[#00ff88] to-[#10b981] hover:brightness-110 disabled:opacity-50 rounded-xl transition-all shadow-[0_0_15px_rgba(0,255,136,0.35)] uppercase tracking-wider"
            >
              {submitting ? 'Importing…' : `Import ${parsedProxies.length} Proxies`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
