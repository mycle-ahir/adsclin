import type { Proxy } from '../../shared/types';
import type { ProxyTestResult } from '../../shared/types';

interface ProxyRowProps {
  proxy: Proxy;
  testResult: ProxyTestResult | null;
  isTesting: boolean;
  onTest: (id: string) => void;
  onEdit: (proxy: Proxy) => void;
  onDelete: (id: string) => void;
}

const SCHEME_COLORS: Record<string, string> = {
  http: 'bg-[#00ff88]/10 text-[#00ff88] border border-[#00ff88]/30',
  https: 'bg-teal-950/40 text-teal-300 border border-teal-500/30',
  socks5: 'bg-emerald-950/40 text-emerald-300 border border-emerald-500/30',
};

export function ProxyRow({
  proxy,
  testResult,
  isTesting,
  onTest,
  onEdit,
  onDelete,
}: ProxyRowProps) {
  const schemeClass =
    SCHEME_COLORS[proxy.scheme] ?? 'bg-[#081812] text-gray-400 border border-[#14382a]';

  function handleDelete() {
    if (window.confirm(`Delete proxy "${proxy.name}"? This cannot be undone.`)) {
      onDelete(proxy.id);
    }
  }

  // Resolve the best available result: fresh result > persisted last test
  const displayResult: { ip: string; country: string; latencyMs: number } | null =
    testResult ??
    (proxy.lastTestIp !== null && proxy.lastTestLatencyMs !== null
      ? {
          ip: proxy.lastTestIp,
          country: proxy.lastTestCountry ?? '—',
          latencyMs: proxy.lastTestLatencyMs,
        }
      : null);

  return (
    <tr className="border-b border-[#0f281e] hover:bg-[#071911] transition-colors">
      {/* Name */}
      <td className="px-4 py-3 font-bold text-white max-w-[180px] truncate text-xs">
        <div className="flex items-center gap-2">
          <span className="text-[#00ff88] font-mono">⬡</span>
          <span className="truncate" title={proxy.name}>
            {proxy.name}
          </span>
        </div>
      </td>

      {/* Scheme */}
      <td className="px-4 py-3">
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-mono font-bold uppercase tracking-wider ${schemeClass}`}
        >
          {proxy.scheme}
        </span>
      </td>

      {/* Host:port */}
      <td className="px-4 py-3 text-xs text-emerald-300 font-mono whitespace-nowrap">
        {proxy.host}:{proxy.port}
      </td>

      {/* Username */}
      <td className="px-4 py-3 text-xs text-gray-300 font-mono">
        {proxy.username ?? <span className="text-emerald-950">—</span>}
      </td>

      {/* Last test result */}
      <td className="px-4 py-3 text-xs">
        {displayResult !== null ? (
          <div className="flex flex-col gap-0.5 font-mono">
            <span className="font-bold text-[#00ff88] text-xs flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#00ff88] shadow-[0_0_6px_#00ff88]" />
              {displayResult.ip}
            </span>
            <span className="text-[11px] text-gray-400">
              {displayResult.country} · {displayResult.latencyMs}ms
            </span>
          </div>
        ) : (
          <span className="text-emerald-950 text-xs font-mono">Not tested</span>
        )}
      </td>

      {/* Actions */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => onTest(proxy.id)}
            disabled={isTesting}
            className="rounded-lg px-2.5 py-1.5 text-xs font-bold bg-[#00ff88]/15 text-[#00ff88] border border-[#00ff88]/40 hover:bg-[#00ff88]/25 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-mono shadow-[0_0_8px_rgba(0,255,136,0.15)] flex items-center gap-1"
          >
            <svg className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <span>{isTesting ? 'Testing…' : 'Test'}</span>
          </button>
          <button
            onClick={() => onEdit(proxy)}
            className="rounded-lg px-2.5 py-1.5 text-xs font-medium bg-[#091f16] border border-[#143d2c] text-emerald-300 hover:text-white hover:bg-[#0e2c20] transition-colors flex items-center gap-1"
            title="Edit proxy"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            <span>Edit</span>
          </button>
          <button
            onClick={handleDelete}
            className="rounded-lg p-1.5 text-gray-500 hover:text-rose-400 bg-[#091f16] hover:bg-rose-950/40 border border-[#143d2c] hover:border-rose-500/40 transition-colors"
            title="Delete proxy"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </td>
    </tr>
  );
}
