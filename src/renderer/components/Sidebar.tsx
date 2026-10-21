import type { ReactNode } from 'react';
import { useAuthStore } from '../stores/auth-store';

export type Tab = 'dashboard' | 'profiles' | 'proxies' | 'fingerprint-test' | 'activity-log' | 'settings';

interface SidebarItem {
  id: Tab;
  label: string;
  icon: (active: boolean) => ReactNode;
}

const NAV_ITEMS: SidebarItem[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: (active) => (
      <svg
        className={`w-5 h-5 transition-all ${
          active ? 'text-[#00ff88] drop-shadow-[0_0_8px_rgba(0,255,136,0.8)]' : 'text-gray-400 group-hover:text-gray-200'
        }`}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        viewBox="0 0 24 24"
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
  },
  {
    id: 'profiles',
    label: 'Profiles',
    icon: (active) => (
      <svg
        className={`w-5 h-5 transition-all ${
          active ? 'text-[#00ff88] drop-shadow-[0_0_8px_rgba(0,255,136,0.8)]' : 'text-gray-400 group-hover:text-gray-200'
        }`}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        viewBox="0 0 24 24"
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
      </svg>
    ),
  },
  {
    id: 'proxies',
    label: 'Proxies',
    icon: (active) => (
      <svg
        className={`w-5 h-5 transition-all ${
          active ? 'text-[#00ff88] drop-shadow-[0_0_8px_rgba(0,255,136,0.8)]' : 'text-gray-400 group-hover:text-gray-200'
        }`}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        viewBox="0 0 24 24"
      >
        <circle cx="12" cy="12" r="9" strokeLinecap="round" strokeLinejoin="round" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.6 9h16.8M3.6 15h16.8M12 3a15 15 0 010 18M12 3a15 15 0 000 18" />
      </svg>
    ),
  },
  {
    id: 'fingerprint-test',
    label: 'Fingerprint Test',
    icon: (active) => (
      <svg
        className={`w-5 h-5 transition-all ${
          active ? 'text-[#00ff88] drop-shadow-[0_0_8px_rgba(0,255,136,0.8)]' : 'text-gray-400 group-hover:text-gray-200'
        }`}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        viewBox="0 0 24 24"
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
  },
  {
    id: 'activity-log',
    label: 'Activity Log',
    icon: (active) => (
      <svg
        className={`w-5 h-5 transition-all ${
          active ? 'text-[#00ff88] drop-shadow-[0_0_8px_rgba(0,255,136,0.8)]' : 'text-gray-400 group-hover:text-gray-200'
        }`}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        viewBox="0 0 24 24"
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: (active) => (
      <svg
        className={`w-5 h-5 transition-all ${
          active ? 'text-[#00ff88] drop-shadow-[0_0_8px_rgba(0,255,136,0.8)]' : 'text-gray-400 group-hover:text-gray-200'
        }`}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        viewBox="0 0 24 24"
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
];

interface SidebarProps {
  activeTab: Tab;
  onSelect: (tab: Tab) => void;
}

export function Sidebar({ activeTab, onSelect }: SidebarProps) {
  const { openPaywall } = useAuthStore();

  return (
    <aside className="w-64 flex-shrink-0 bg-[#040807] border-r border-[#103425]/70 flex flex-col pt-6 pb-4 px-3.5 select-none relative z-20">
      {/* Navigation Links */}
      <nav className="flex-1 flex flex-col gap-2">
        {NAV_ITEMS.map((item) => {
          // If user clicks dashboard, we can switch to profiles or dashboard view
          const isActive = activeTab === item.id || (item.id === 'profiles' && activeTab === 'dashboard');
          return (
            <button
              key={item.id}
              onClick={() => onSelect(item.id === 'dashboard' ? 'profiles' : item.id)}
              className={`group flex items-center justify-between px-4 py-3 rounded-2xl text-sm font-semibold transition-all w-full text-left cursor-pointer ${
                isActive
                  ? 'border border-[#00ff88] bg-gradient-to-r from-[#00ff88]/20 via-[#062c1e]/50 to-transparent text-[#00ff88] shadow-[0_0_20px_rgba(0,255,136,0.18)]'
                  : 'text-gray-400 hover:text-white hover:bg-[#071911] border border-transparent'
              }`}
            >
              <div className="flex items-center gap-3.5">
                {item.icon(isActive)}
                <span className={isActive ? 'font-bold text-[#00ff88]' : ''}>
                  {item.label}
                </span>
              </div>
              {isActive && (
                <svg className="w-4 h-4 text-[#00ff88]" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              )}
            </button>
          );
        })}
      </nav>

      {/* PRO PLAN Card (Exact match to screenshot) */}
      <div className="mb-3">
        <div className="rounded-2xl p-4 border border-[#103425] bg-[#06140e] shadow-xl relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-black uppercase tracking-wider text-white flex items-center gap-1.5">
              <span className="text-[#00ff88]">⚡</span>
              <span>PRO PLAN</span>
            </span>

            <span className="text-[10px] font-bold text-[#00ff88] bg-[#072618] border border-[#00ff88]/40 px-2.5 py-0.5 rounded-full shadow-sm">
              Active
            </span>
          </div>

          <p className="text-[11px] text-gray-400 leading-relaxed font-sans">
            More profiles. Higher limits.
            <br />
            Full access to all features.
          </p>

          <button
            onClick={openPaywall}
            className="w-full mt-3 rounded-xl py-2.5 px-3 text-xs font-black bg-[#00ff88] hover:bg-[#05eb8a] text-black transition-all shadow-[0_0_15px_rgba(0,255,136,0.35)] flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <span>Upgrade Plan</span>
            <span>➔</span>
          </button>
        </div>
      </div>

      {/* Network Connection Telemetry */}
      <div className="px-2 py-2 flex items-center justify-between rounded-xl bg-[#06140e]/60 border border-[#103425]/50 mb-2">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#00ff88] shadow-[0_0_6px_#00ff88]" />
          <div className="flex flex-col">
            <span className="text-xs font-semibold text-[#00ff88]">Connected</span>
            <span className="text-[10px] text-gray-400 font-mono">IP: 103.21.45.67</span>
          </div>
        </div>
        <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </div>

      {/* Footer Branding */}
      <div className="px-2 pt-2 text-center border-t border-[#103425]/60">
        <span className="text-[10px] text-gray-400">
          Made with <span className="text-rose-500 animate-pulse">❤️</span> by{' '}
          <span className="font-bold text-[#00ff88]">Growdemy</span>
        </span>
      </div>
    </aside>
  );
}
