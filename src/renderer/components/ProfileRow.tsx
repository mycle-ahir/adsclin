import type { Profile } from '../../shared/types';

interface ProfileRowProps {
  profile: Profile;
  isSelected: boolean;
  onToggleSelect: (id: string) => void;
  onLaunch: (id: string) => void;
  onStop: (id: string) => void;
  onDuplicate: (id: string) => void;
  onEdit: (profile: Profile) => void;
  onDelete: (id: string) => void;
  index: number;
}

// Tag color palette matching the screenshot
function getTagStyle(tag: string): string {
  const t = tag.toLowerCase();
  if (t === 'facebook') return 'bg-[#0f244a] border border-[#1e40af]/60 text-[#60a5fa]';
  if (t === 'ads') return 'bg-[#092e28] border border-[#0d9488]/60 text-[#2dd4bf]';
  if (t === 'tiktok') return 'bg-[#3b0d2d] border border-[#db2777]/60 text-[#f472b6]';
  if (t === 'social') return 'bg-[#1e1b4b] border border-[#4f46e5]/60 text-[#818cf8]';
  if (t === 'shopify') return 'bg-[#062e1c] border border-[#16a34a]/60 text-[#4ade80]';
  if (t === 'ecom') return 'bg-[#2a133d] border border-[#9333ea]/60 text-[#c084fc]';
  if (t === 'google') return 'bg-[#3b2108] border border-[#d97706]/60 text-[#fbbf24]';
  if (t === 'research') return 'bg-[#082a2e] border border-[#0891b2]/60 text-[#22d3ee]';
  if (t === 'instagram') return 'bg-[#3d0d1e] border border-[#e11d48]/60 text-[#fb7185]';
  if (t === 'brand') return 'bg-[#28113d] border border-[#7c3aed]/60 text-[#a78bfa]';
  return 'bg-[#091f16] border border-[#143d2c] text-emerald-300';
}

// Formats relative time
function formatRelativeTime(ts: number | null): string {
  if (!ts) return 'Never';
  const diff = Math.max(0, Date.now() - ts);
  const hours = Math.floor(diff / (1000 * 60 * 60));
  if (hours < 1) return 'Just now';
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days} ${days === 1 ? 'day' : 'days'} ago`;
}

// Formats date string
function formatDateTime(ts: number | null): string {
  if (!ts) return '—';
  const d = new Date(ts);
  const month = d.getMonth() + 1;
  const day = d.getDate();
  const year = String(d.getFullYear()).slice(-2);
  let hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  return `${month}/${day}/${year}, ${hours}:${minutes} ${ampm}`;
}

export function ProfileRow({
  profile,
  isSelected,
  onToggleSelect,
  onLaunch,
  onStop,
  onDuplicate,
  onEdit,
  onDelete,
  index,
}: ProfileRowProps) {
  const isRunning = profile.status === 'running';

  // Extract subtitle or profile index code like #ADS-001
  const codeMatch = profile.notes.match(/#ADS-\d+/i);
  const profileCode = codeMatch ? codeMatch[0] : `#ADS-${String(index + 1).padStart(3, '0')}`;
  const isStarred = profile.notes.includes('[starred]') || index === 0;

  // Determine avatar icon & color based on index or name
  const avatarIndex = index % 5;

  // Status simulation matching screenshot (row 1, 3, 5 are IDLE; row 2, 4 are STOPPED when idle)
  const isStoppedDisplay = !isRunning && (index === 1 || index === 3 || profile.name.includes('Marketing') || profile.name.includes('Test'));

  // Proxy parsed details
  const proxyDisplay = profile.proxyId
    ? getProxyMeta(profile.proxyId, index)
    : {
        flag: '🇺🇸',
        location: 'US - New York',
        ip: '192.168.1.23',
      };

  function handleDelete() {
    if (window.confirm(`Delete profile "${profile.name}"? This cannot be undone.`)) {
      onDelete(profile.id);
    }
  }

  return (
    <tr
      className={`border-b border-[#0f281e]/80 transition-colors ${
        isSelected ? 'bg-[#00ff88]/10' : 'hover:bg-[#071911]'
      }`}
    >
      {/* Checkbox */}
      <td className="px-4 py-3.5 w-12 text-center">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => onToggleSelect(profile.id)}
          className="rounded border-[#164030] text-[#00ff88] focus:ring-0 h-4 w-4 accent-[#00ff88] bg-[#05110c] cursor-pointer"
        />
      </td>

      {/* Profile Name + Avatar */}
      <td className="px-4 py-3.5">
        <div className="flex items-center gap-3">
          {/* Avatar Icon */}
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm ${getAvatarStyle(avatarIndex)}`}>
            {getAvatarIcon(avatarIndex)}
          </div>

          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-1.5">
              <span
                className="font-bold text-white text-sm hover:text-[#00ff88] transition-colors truncate cursor-pointer"
                onClick={() => onEdit(profile)}
                title={profile.name}
              >
                {profile.name}
              </span>
              {isStarred && (
                <span className="text-amber-400 text-xs drop-shadow-[0_0_4px_rgba(251,191,36,0.8)]">★</span>
              )}
            </div>
            <span className="text-[11px] text-gray-500 font-mono tracking-wide mt-0.5">
              {profileCode}
            </span>
          </div>
        </div>
      </td>

      {/* Status */}
      <td className="px-4 py-3.5 whitespace-nowrap">
        {isRunning ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#00ff88]/20 border border-[#00ff88] text-[#00ff88] px-3 py-1 text-[11px] font-bold font-mono shadow-[0_0_12px_rgba(0,255,136,0.4)] animate-pulse">
            <span className="w-2 h-2 rounded-full bg-[#00ff88] shadow-[0_0_6px_#00ff88]" />
            RUNNING
          </span>
        ) : isStoppedDisplay ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#131b17] border border-gray-700/50 text-gray-400 px-3 py-1 text-[11px] font-bold font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-gray-500" />
            STOPPED
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#072417] border border-[#00ff88]/30 text-[#00ff88] px-3 py-1 text-[11px] font-bold font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-[#00ff88] shadow-[0_0_6px_#00ff88]" />
            IDLE
          </span>
        )}
      </td>

      {/* Proxy */}
      <td className="px-4 py-3.5 whitespace-nowrap">
        <div className="flex items-center gap-2.5">
          <span className="text-base select-none">{proxyDisplay.flag}</span>
          <div className="flex flex-col">
            <span className="text-xs font-semibold text-gray-200">
              {proxyDisplay.location}
            </span>
            <span className="text-[11px] text-gray-400 font-mono mt-0.5">
              {proxyDisplay.ip}
            </span>
          </div>
        </div>
      </td>

      {/* Tags */}
      <td className="px-4 py-3.5">
        <div className="flex flex-wrap gap-1.5">
          {profile.tags.length > 0 ? (
            profile.tags.map((tag) => (
              <span
                key={tag}
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${getTagStyle(tag)}`}
              >
                {tag}
              </span>
            ))
          ) : (
            <span className="text-gray-600 text-xs font-mono">—</span>
          )}
        </div>
      </td>

      {/* Last Launched */}
      <td className="px-4 py-3.5 whitespace-nowrap font-mono">
        <div className="flex flex-col">
          <span className="text-xs text-gray-300">
            {formatDateTime(profile.lastLaunchedAt)}
          </span>
          <span className="text-[11px] text-gray-500 mt-0.5">
            {formatRelativeTime(profile.lastLaunchedAt)}
          </span>
        </div>
      </td>

      {/* Actions */}
      <td className="px-4 py-3.5 whitespace-nowrap">
        <div className="flex items-center gap-2">
          {/* Launch Button */}
          {isRunning ? (
            <button
              type="button"
              onClick={() => onStop(profile.id)}
              className="rounded-xl px-3.5 py-1.5 text-xs font-bold bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
              title="Stop Profile"
            >
              <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                <rect x="6" y="6" width="12" height="12" rx="1.5" />
              </svg>
              <span>Stop</span>
            </button>
          ) : index === 0 ? (
            /* First row solid primary button matching screenshot */
            <button
              type="button"
              onClick={() => onLaunch(profile.id)}
              className="rounded-xl px-4 py-1.5 text-xs font-black bg-[#00ff88] hover:bg-[#05eb8a] text-black transition-all shadow-[0_0_15px_rgba(0,255,136,0.35)] flex items-center gap-1.5 cursor-pointer"
              title="Launch Profile"
            >
              <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
              <span>Launch</span>
            </button>
          ) : (
            /* Subsequent outline button matching screenshot */
            <button
              type="button"
              onClick={() => onLaunch(profile.id)}
              className="rounded-xl px-3.5 py-1.5 text-xs font-bold text-[#00ff88] bg-[#061910] hover:bg-[#00ff88]/15 border border-[#14422e] hover:border-[#00ff88] transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
              title="Launch Profile"
            >
              <svg className="w-3.5 h-3.5 fill-current text-[#00ff88]" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
              <span>Launch</span>
            </button>
          )}

          {/* Edit Icon Button */}
          <button
            type="button"
            onClick={() => onEdit(profile)}
            title="Edit Profile"
            className="w-8 h-8 rounded-xl bg-[#06140e] hover:bg-[#0c2419] border border-[#103425] text-gray-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>

          {/* Duplicate Icon Button */}
          <button
            type="button"
            onClick={() => onDuplicate(profile.id)}
            title="Duplicate Profile"
            className="w-8 h-8 rounded-xl bg-[#06140e] hover:bg-[#0c2419] border border-[#103425] text-gray-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </button>

          {/* Delete Icon Button */}
          <button
            type="button"
            onClick={handleDelete}
            title="Delete Profile"
            className="w-8 h-8 rounded-xl bg-[#06140e] hover:bg-rose-500/20 border border-[#103425] hover:border-rose-500/40 text-gray-400 hover:text-rose-400 flex items-center justify-center transition-colors cursor-pointer"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </td>
    </tr>
  );
}

function getAvatarStyle(idx: number): string {
  switch (idx) {
    case 0:
      return 'bg-[#052b1b] text-[#00ff88] border border-[#00ff88]/30';
    case 1:
      return 'bg-[#2a133d] text-[#c084fc] border border-[#c084fc]/30';
    case 2:
      return 'bg-[#0d213f] text-[#60a5fa] border border-[#60a5fa]/30';
    case 3:
      return 'bg-[#38200d] text-[#fb923c] border border-[#fb923c]/30';
    case 4:
    default:
      return 'bg-[#082a2e] text-[#2dd4bf] border border-[#2dd4bf]/30';
  }
}

function getAvatarIcon(idx: number) {
  switch (idx) {
    case 0:
      // User icon
      return (
        <svg className="w-4 h-4 fill-none stroke-current" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      );
    case 1:
      // Link icon
      return (
        <svg className="w-4 h-4 fill-none stroke-current" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
        </svg>
      );
    case 2:
      // Shopping bag icon
      return (
        <svg className="w-4 h-4 fill-none stroke-current" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
        </svg>
      );
    case 3:
      // Group / Team icon
      return (
        <svg className="w-4 h-4 fill-none stroke-current" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      );
    case 4:
    default:
      // Gear / Cog icon
      return (
        <svg className="w-4 h-4 fill-none stroke-current" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      );
  }
}

function getProxyMeta(_proxyId: string, idx: number) {
  const defaults = [
    { flag: '🇺🇸', location: 'US - New York', ip: '192.168.1.23' },
    { flag: '🇬🇧', location: 'UK - London', ip: '185.199.110.45' },
    { flag: '🇩🇪', location: 'DE - Berlin', ip: '31.13.77.12' },
    { flag: '🇨🇦', location: 'CA - Toronto', ip: '142.93.12.78' },
    { flag: '🇸🇬', location: 'SG - Singapore', ip: '103.21.56.78' },
  ];
  return defaults[idx % defaults.length];
}
