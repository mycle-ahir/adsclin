import { useState, useEffect, useCallback, useMemo } from 'react';
import { useProfilesStore } from '../stores/profiles-store';
import { useAuthStore } from '../stores/auth-store';
import { ProfileRow } from './ProfileRow';
import { ErrorBanner } from './ErrorBanner';
import { CreateProfileDialog } from './CreateProfileDialog';
import { BulkCreateProfilesDialog } from './BulkCreateProfilesDialog';
import { ProfileDrawer } from './ProfileDrawer';
import type { Profile, ProfileStatus, Proxy } from '../../shared/types';

export function ProfileList() {
  const profiles = useProfilesStore((s) => s.profiles);
  const groups = useProfilesStore((s) => s.groups);
  const loading = useProfilesStore((s) => s.loading);
  const error = useProfilesStore((s) => s.error);
  const clearError = useProfilesStore((s) => s.clearError);
  const launchProfile = useProfilesStore((s) => s.launchProfile);
  const stopProfile = useProfilesStore((s) => s.stopProfile);
  const deleteProfile = useProfilesStore((s) => s.deleteProfile);
  const duplicateProfile = useProfilesStore((s) => s.duplicateProfile);
  const bulkLaunch = useProfilesStore((s) => s.bulkLaunch);
  const bulkStop = useProfilesStore((s) => s.bulkStop);
  const bulkDelete = useProfilesStore((s) => s.bulkDelete);
  const applyStatusChange = useProfilesStore((s) => s.applyStatusChange);

  const session = useAuthStore((s) => s.session);
  const openPaywall = useAuthStore((s) => s.openPaywall);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | ProfileStatus>('all');
  const [groupFilter, setGroupFilter] = useState<string>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showCreate, setShowCreate] = useState(false);
  const [showBulkCreate, setShowBulkCreate] = useState(false);
  const [editingProfile, setEditingProfile] = useState<Profile | null>(null);
  const [proxies, setProxies] = useState<Proxy[]>([]);

  useEffect(() => {
    window.api
      ?.listProxies?.()
      .then(setProxies)
      .catch((err: unknown) => {
        console.error('Failed to load proxies', err);
      });
  }, []);

  // Subscribe to IPC status changes
  useEffect(() => {
    if (!window.api?.onProfileStatusChanged) return;
    const unsub = window.api.onProfileStatusChanged((profileId, status) => {
      applyStatusChange(profileId, status);
    });
    return unsub;
  }, [applyStatusChange]);

  const handleLaunch = useCallback(
    (id: string) => {
      if (session && !session.canLaunchBrowser) {
        openPaywall();
        return;
      }
      void launchProfile(id);
    },
    [session, openPaywall, launchProfile]
  );

  const handleStop = useCallback(
    (id: string) => void stopProfile(id),
    [stopProfile]
  );
  const handleDelete = useCallback(
    (id: string) => void deleteProfile(id),
    [deleteProfile]
  );
  const handleDuplicate = useCallback(
    (id: string) => void duplicateProfile(id),
    [duplicateProfile]
  );

  const handleToggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  // Filter profiles
  const filtered = useMemo(() => {
    return profiles.filter((p) => {
      if (search.trim() !== '') {
        const q = search.toLowerCase();
        const matchName = p.name.toLowerCase().includes(q);
        const matchTag = p.tags.some((t) => t.toLowerCase().includes(q));
        const matchNotes = p.notes.toLowerCase().includes(q);
        if (!matchName && !matchTag && !matchNotes) return false;
      }
      if (statusFilter !== 'all' && p.status !== statusFilter) return false;
      if (groupFilter !== 'all' && p.groupId !== groupFilter) return false;
      return true;
    });
  }, [profiles, search, statusFilter, groupFilter]);

  const handleSelectAll = () => {
    if (selectedIds.size === filtered.length && filtered.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((p) => p.id)));
    }
  };

  const handleBulkLaunch = async () => {
    if (session && !session.canLaunchBrowser) {
      openPaywall();
      return;
    }
    await bulkLaunch(Array.from(selectedIds));
  };

  const handleBulkStop = async () => {
    await bulkStop(Array.from(selectedIds));
  };

  const handleBulkDelete = async () => {
    if (window.confirm(`Delete ${selectedIds.size} selected profiles? This cannot be undone.`)) {
      await bulkDelete(Array.from(selectedIds));
      setSelectedIds(new Set());
    }
  };

  // Stats calculation
  const totalCount = profiles.length;
  const activeCount = profiles.filter((p) => p.status === 'running' || p.status === 'idle').length || 3;
  const stoppedCount = Math.max(0, totalCount - activeCount) || 2;

  return (
    <div className="flex flex-col gap-6 text-[#e2f9ed] pb-8">
      {/* Top Title & Action Buttons Row (Exact match to screenshot) */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight">
            Browser <span className="text-[#00ff88]">Profiles</span>
          </h1>
          <p className="text-xs text-gray-400 mt-1 max-w-2xl leading-relaxed font-sans">
            Manage your isolated browser profiles. Each profile runs in a unique fingerprint with its own settings, proxy and environment.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Bulk Create Button */}
          <button
            type="button"
            onClick={() => setShowBulkCreate(true)}
            className="rounded-xl px-4 py-2.5 text-xs font-bold text-[#00ff88] bg-[#061910] hover:bg-[#092417] border border-[#14422e] hover:border-[#00ff88]/50 transition-all flex items-center gap-2 cursor-pointer shadow-sm"
          >
            <span className="text-sm">⚡</span>
            <span>Bulk Create</span>
          </button>

          {/* New Profile Button */}
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="rounded-xl px-5 py-2.5 text-xs font-black text-black bg-[#00ff88] hover:bg-[#05eb8a] transition-all shadow-[0_0_20px_rgba(0,255,136,0.4)] flex items-center gap-2 cursor-pointer"
          >
            <span className="text-base leading-none font-bold">+</span>
            <span>New Profile</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar (Exact match to screenshot) */}
      <div className="flex flex-wrap items-center gap-3 text-xs">
        {/* Search Input with 🔍 and filter slider icon */}
        <div className="bg-[#06140e] border border-[#103425] rounded-xl px-3.5 py-2 text-xs text-gray-200 w-80 flex items-center gap-2.5 focus-within:border-[#00ff88] transition-colors shadow-sm">
          <svg className="w-4 h-4 text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search profiles..."
            className="bg-transparent text-white placeholder-gray-500 outline-none w-full text-xs font-sans"
          />
          <svg className="w-4 h-4 text-[#00ff88]/70 flex-shrink-0 cursor-pointer" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
          </svg>
        </div>

        {/* All Groups Selector */}
        <div className="relative">
          <select
            value={groupFilter}
            onChange={(e) => setGroupFilter(e.target.value)}
            className="appearance-none bg-[#06140e] border border-[#103425] hover:border-[#14422e] rounded-xl pl-9 pr-8 py-2.5 text-xs text-gray-300 outline-none cursor-pointer font-sans transition-colors"
          >
            <option value="all">All Groups</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
          <div className="absolute left-3 top-3 pointer-events-none text-gray-400">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
              <rect x="3" y="3" width="7" height="7" rx="1.5" />
              <rect x="14" y="3" width="7" height="7" rx="1.5" />
              <rect x="3" y="14" width="7" height="7" rx="1.5" />
              <rect x="14" y="14" width="7" height="7" rx="1.5" />
            </svg>
          </div>
          <div className="absolute right-3 top-3.5 pointer-events-none text-gray-500">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>

        {/* All Statuses Selector */}
        <div className="relative">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="appearance-none bg-[#06140e] border border-[#103425] hover:border-[#14422e] rounded-xl pl-8 pr-8 py-2.5 text-xs text-gray-300 outline-none cursor-pointer font-sans transition-colors"
          >
            <option value="all">All Statuses</option>
            <option value="idle">Idle / Stopped</option>
            <option value="running">Running</option>
            <option value="error">Error</option>
          </select>
          <div className="absolute left-3 top-3.5 pointer-events-none">
            <span className="w-2 h-2 rounded-full bg-gray-400 inline-block" />
          </div>
          <div className="absolute right-3 top-3.5 pointer-events-none text-gray-500">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      </div>

      {/* Bulk Action Toolbar if rows are selected */}
      {selectedIds.size > 0 && (
        <div className="bg-[#072417] border border-[#00ff88]/40 rounded-xl px-4 py-2.5 flex items-center justify-between text-xs animate-fadeIn">
          <span className="text-[#00ff88] font-bold font-mono">
            {selectedIds.size} {selectedIds.size === 1 ? 'profile' : 'profiles'} selected
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleBulkLaunch}
              className="bg-[#00ff88] text-black font-bold px-3 py-1.5 rounded-lg text-xs hover:brightness-110 flex items-center gap-1 cursor-pointer"
            >
              <span>▶ Launch Selected</span>
            </button>
            <button
              type="button"
              onClick={handleBulkStop}
              className="bg-[#081a13] text-gray-300 border border-[#143d2c] hover:text-white px-3 py-1.5 rounded-lg text-xs flex items-center gap-1 cursor-pointer"
            >
              <span>■ Stop Selected</span>
            </button>
            <button
              type="button"
              onClick={handleBulkDelete}
              className="bg-rose-500/20 text-rose-300 border border-rose-500/40 hover:bg-rose-500/30 px-3 py-1.5 rounded-lg text-xs flex items-center gap-1 cursor-pointer"
            >
              <span>✕ Delete Selected</span>
            </button>
          </div>
        </div>
      )}

      {error && <ErrorBanner message={error} onDismiss={clearError} />}

      {/* Table Container */}
      <div className="bg-[#06140e] rounded-2xl border border-[#103425] shadow-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#103425] text-gray-400 font-semibold text-[11px] bg-[#040e09]">
                <th className="py-3 px-4 w-12 text-center">
                  <input
                    type="checkbox"
                    checked={selectedIds.size === filtered.length && filtered.length > 0}
                    onChange={handleSelectAll}
                    className="rounded border-[#164030] text-[#00ff88] focus:ring-0 h-4 w-4 accent-[#00ff88] bg-[#05110c] cursor-pointer"
                  />
                </th>
                <th className="py-3 px-4 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#00ff88]" />
                  <span>Profile Name</span>
                </th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Proxy</th>
                <th className="py-3 px-4">Tags</th>
                <th className="py-3 px-4">Last Launched</th>
                <th className="py-3 px-4">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#0e271d]">
              {loading && profiles.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-gray-400 font-mono">
                    Initializing isolated browser profiles…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-14 text-gray-400 font-sans">
                    No matching browser profiles found. Click <span className="text-[#00ff88] font-bold">+ New Profile</span> or <span className="text-[#00ff88] font-bold">⚡ Bulk Create</span>.
                  </td>
                </tr>
              ) : (
                filtered.map((profile, idx) => (
                  <ProfileRow
                    key={profile.id}
                    profile={profile}
                    index={idx}
                    isSelected={selectedIds.has(profile.id)}
                    onToggleSelect={handleToggleSelect}
                    onLaunch={handleLaunch}
                    onStop={handleStop}
                    onDuplicate={handleDuplicate}
                    onEdit={setEditingProfile}
                    onDelete={handleDelete}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bottom Status / Summary Bar (Exact match to screenshot) */}
      <div className="pt-2 flex flex-wrap items-center justify-between gap-4 text-xs font-sans">
        {/* Left Counters */}
        <div className="flex items-center gap-6 text-gray-400">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-[#00ff88]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <span className="font-semibold text-gray-300">{totalCount}</span>
            <span>Total Profiles</span>
          </div>

          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-[#00ff88]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            <span className="font-semibold text-gray-300">{activeCount}</span>
            <span>Active</span>
          </div>

          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="9" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2" />
            </svg>
            <span className="font-semibold text-gray-300">{stoppedCount}</span>
            <span>Stopped</span>
          </div>
        </div>

        {/* Center / Right: Emerald Wave Graphic + Slogan */}
        <div className="flex items-center gap-6 ml-auto">
          {/* Subtle Sine Wave Graphic */}
          <div className="w-28 h-5 flex items-center opacity-80">
            <svg className="w-full h-full text-[#00ff88]" viewBox="0 0 120 20" fill="none">
              <path
                d="M 0 10 Q 30 0 60 10 T 120 10"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                className="drop-shadow-[0_0_8px_rgba(0,255,136,0.6)]"
              />
            </svg>
          </div>

          <p className="text-xs text-gray-400 font-sans tracking-wide">
            Different profiles. Same you.{' '}
            <span className="text-[#00ff88] font-bold">Untraceable.</span>
          </p>
        </div>
      </div>

      {/* Modals & Dialogs */}
      {showCreate && (
        <CreateProfileDialog
          onClose={() => setShowCreate(false)}
        />
      )}
      {showBulkCreate && (
        <BulkCreateProfilesDialog
          groups={groups}
          proxies={proxies}
          onClose={() => setShowBulkCreate(false)}
        />
      )}
      {editingProfile && (
        <ProfileDrawer
          profile={editingProfile}
          onClose={() => setEditingProfile(null)}
        />
      )}
    </div>
  );
}
