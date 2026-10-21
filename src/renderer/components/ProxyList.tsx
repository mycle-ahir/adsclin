import { useState, useCallback } from 'react';
import { useProxiesStore } from '../stores/proxies-store';
import { ProxyRow } from './ProxyRow';
import { ErrorBanner } from './ErrorBanner';
import { CreateProxyDialog } from './CreateProxyDialog';
import { EditProxyDialog } from './EditProxyDialog';
import { BulkImportProxiesDialog } from './BulkImportProxiesDialog';
import type { Proxy } from '../../shared/types';

export function ProxyList() {
  const proxies = useProxiesStore((s) => s.proxies);
  const loading = useProxiesStore((s) => s.loading);
  const error = useProxiesStore((s) => s.error);
  const clearError = useProxiesStore((s) => s.clearError);
  const deleteProxy = useProxiesStore((s) => s.deleteProxy);
  const testProxy = useProxiesStore((s) => s.testProxy);
  const testResults = useProxiesStore((s) => s.testResults);
  const testingIds = useProxiesStore((s) => s.testingIds);
  const fetchProxies = useProxiesStore((s) => s.fetchProxies);

  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [editingProxy, setEditingProxy] = useState<Proxy | null>(null);

  const handleTest = useCallback(
    (id: string) => void testProxy(id),
    [testProxy]
  );
  const handleDelete = useCallback(
    (id: string) => void deleteProxy(id),
    [deleteProxy]
  );

  const filtered = proxies.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.host.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex flex-col gap-5 text-[#e2f9ed]">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-black text-white tracking-tight drop-shadow-[0_0_10px_rgba(255,255,255,0.15)]">
              Proxy Management
            </h1>
            <span className="text-xs bg-[#00ff88]/10 text-[#00ff88] border border-[#00ff88]/30 px-3 py-0.5 rounded-full font-mono font-bold uppercase tracking-wider shadow-[0_0_10px_rgba(0,255,136,0.15)]">
              {proxies.length} Endpoints
            </span>
          </div>
          <p className="text-xs text-emerald-500/80 font-mono mt-1 tracking-wide">
            GLOBAL ROUTING • PROXY CHAINS • GEO-IP LATENCY TELEMETRY
          </p>
        </div>
        <div className="flex items-center gap-3 flex-1 max-w-lg ml-auto justify-end">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search proxies by name or host…"
            className="flex-1 rounded-xl bg-[#081b13] border border-[#143d2c] focus:border-[#00ff88] focus:shadow-[0_0_10px_rgba(0,255,136,0.2)] px-3.5 py-2 text-xs text-white placeholder-emerald-900/60 outline-none transition-all font-mono"
          />
          <button
            onClick={() => setShowBulkImport(true)}
            className="rounded-xl bg-[#081a13] border border-[#143d2c] px-4 py-2.5 text-xs font-bold text-emerald-300 hover:text-white hover:bg-[#0e2c20] transition-colors whitespace-nowrap shadow-sm font-mono uppercase tracking-wider flex items-center gap-1.5"
          >
            <svg className="w-3.5 h-3.5 text-[#00ff88]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            <span>Import</span>
          </button>
          <button
            onClick={() => setShowCreate(true)}
            className="rounded-xl bg-gradient-to-r from-[#00ff88] to-[#10b981] text-gray-950 font-black px-5 py-2.5 text-xs hover:brightness-110 transition-all whitespace-nowrap shadow-[0_0_16px_rgba(0,255,136,0.35)] uppercase tracking-wider flex items-center gap-1.5"
          >
            <svg className="w-4 h-4 fill-current stroke-current stroke-1" viewBox="0 0 24 24">
              <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
            </svg>
            <span>Add Proxy</span>
          </button>
        </div>
      </div>

      {/* Error banner */}
      {error && <ErrorBanner message={error} onDismiss={clearError} />}

      {/* Table */}
      <div className="rounded-2xl border border-[#103425] bg-[#06140e] shadow-2xl overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-xs font-mono text-emerald-600/70">
            Loading proxies…
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-16 text-center text-xs font-mono text-emerald-800/80">
            {search
              ? 'No proxies match your search.'
              : 'No proxies yet. Click "+ Add Proxy" to get started.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[#103425] bg-[#040e09] text-[11px] font-mono text-emerald-400 uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3.5">Proxy Name</th>
                  <th className="px-4 py-3.5">Protocol</th>
                  <th className="px-4 py-3.5">Endpoint (Host:Port)</th>
                  <th className="px-4 py-3.5">Credentials</th>
                  <th className="px-4 py-3.5">Latency & Status</th>
                  <th className="px-4 py-3.5">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((proxy) => (
                  <ProxyRow
                    key={proxy.id}
                    proxy={proxy}
                    testResult={testResults[proxy.id] ?? null}
                    isTesting={testingIds.has(proxy.id)}
                    onTest={handleTest}
                    onEdit={setEditingProxy}
                    onDelete={handleDelete}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Dialog */}
      {showCreate && (
        <CreateProxyDialog onClose={() => setShowCreate(false)} />
      )}

      {/* Bulk Import Dialog */}
      {showBulkImport && (
        <BulkImportProxiesDialog
          onClose={() => setShowBulkImport(false)}
          onImported={() => void fetchProxies()}
        />
      )}

      {/* Edit Dialog */}
      {editingProxy && (
        <EditProxyDialog
          proxy={editingProxy}
          onClose={() => setEditingProxy(null)}
        />
      )}
    </div>
  );
}
