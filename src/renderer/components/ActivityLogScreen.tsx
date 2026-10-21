import { useState, useEffect, useCallback, Fragment } from 'react';
import type { ActivityLog, ActivityEntityType } from '../../shared/types';

export function ActivityLogScreen() {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<string>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const entityType = filterType === 'all' ? undefined : (filterType as ActivityEntityType);
      const data = await window.api.listActivities(entityType ? { entityType } : undefined);
      setLogs(data);
    } catch (err) {
      console.error('Failed to load activity logs', err);
    } finally {
      setLoading(false);
    }
  }, [filterType]);

  useEffect(() => {
    void fetchLogs();
  }, [fetchLogs]);

  function getBadgeColor(action: string) {
    if (action.includes('launch') || action.includes('create')) {
      return 'bg-[#00ff88]/15 text-[#00ff88] border border-[#00ff88]/30 shadow-[0_0_8px_rgba(0,255,136,0.15)]';
    }
    if (action.includes('stop') || action.includes('update')) {
      return 'bg-amber-500/20 text-amber-300 border border-amber-500/30';
    }
    if (action.includes('delete')) {
      return 'bg-rose-500/20 text-rose-300 border border-rose-500/30';
    }
    return 'bg-[#081b13] text-emerald-300 border border-[#143d2c]';
  }

  return (
    <div className="flex flex-col gap-5 max-w-6xl mx-auto text-[#e2f9ed]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-black text-white tracking-tight drop-shadow-[0_0_10px_rgba(255,255,255,0.15)]">
              Activity Log & Audit Trail
            </h1>
            <span className="text-xs bg-[#00ff88]/10 text-[#00ff88] border border-[#00ff88]/30 px-3 py-0.5 rounded-full font-mono font-bold uppercase tracking-wider">
              {logs.length} Events
            </span>
          </div>
          <p className="text-xs text-emerald-500/80 font-mono mt-1 tracking-wide">
            IMMUTABLE AUDIT TRAIL • REDACTED CREDENTIALS • HARDWARE FINGERPRINT LOGS
          </p>
        </div>
        <div className="flex items-center gap-3 font-mono">
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="rounded-xl bg-[#081b13] border border-[#143d2c] focus:border-[#00ff88] px-3.5 py-2 text-xs text-emerald-300 outline-none font-mono cursor-pointer"
          >
            <option value="all">All Entity Types</option>
            <option value="profile">Profiles</option>
            <option value="proxy">Proxies</option>
            <option value="group">Groups</option>
          </select>
          <button
            type="button"
            onClick={() => void fetchLogs()}
            disabled={loading}
            className="px-4 py-2 text-xs font-bold text-emerald-300 bg-[#081a13] hover:bg-[#0e2c20] hover:text-white border border-[#143d2c] rounded-xl transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-50 uppercase tracking-wider"
          >
            <svg className={`w-3.5 h-3.5 text-[#00ff88] ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Log Feed */}
      <div className="bg-[#06140e] rounded-2xl border border-[#103425] shadow-2xl overflow-hidden">
        {loading && logs.length === 0 ? (
          <div className="p-8 text-center text-xs font-mono text-emerald-600/70">Loading activity trail…</div>
        ) : logs.length === 0 ? (
          <div className="p-16 text-center text-xs font-mono text-emerald-800/80">
            No activity records found. Activities will appear as you launch, edit, and manage profiles.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#040e09] border-b border-[#103425] text-emerald-400 font-mono uppercase text-[11px] tracking-wider">
                  <th className="py-3 px-4 w-44">Timestamp</th>
                  <th className="py-3 px-4 w-36">Action</th>
                  <th className="py-3 px-4 w-28">Entity</th>
                  <th className="py-3 px-4">Entity ID</th>
                  <th className="py-3 px-4 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#0e271d] font-mono text-[11px]">
                {logs.map((log) => {
                  const isExpanded = expandedId === log.id;
                  const formattedTime = new Date(log.createdAt).toLocaleString();
                  return (
                    <Fragment key={log.id}>
                      <tr className="hover:bg-[#071911] transition-colors">
                        <td className="py-2.5 px-4 text-gray-400 whitespace-nowrap">
                          {formattedTime}
                        </td>
                        <td className="py-2.5 px-4">
                          <span
                            className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${getBadgeColor(
                              log.action
                            )}`}
                          >
                            {log.action}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 text-emerald-300 font-medium capitalize">
                          {log.entityType}
                        </td>
                        <td className="py-2.5 px-4 text-gray-400 max-w-[200px] truncate" title={log.entityId || undefined}>
                          {log.entityId ?? '—'}
                        </td>
                        <td className="py-2.5 px-4 text-right">
                          {log.details ? (
                            <button
                              type="button"
                              onClick={() => setExpandedId(isExpanded ? null : log.id)}
                              className="text-xs text-[#00ff88] hover:underline font-mono"
                            >
                              {isExpanded ? 'Hide Payload ▲' : 'View Payload ▼'}
                            </button>
                          ) : (
                            <span className="text-emerald-950">—</span>
                          )}
                        </td>
                      </tr>
                      {isExpanded && log.details && (
                        <tr className="bg-[#040e09]">
                          <td colSpan={5} className="p-4 border-b border-[#103425]">
                            <pre className="text-[11px] font-mono text-[#00ff88] bg-black/60 p-3 rounded-lg border border-[#143d2c] overflow-x-auto whitespace-pre-wrap">
                              {log.details}
                            </pre>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
