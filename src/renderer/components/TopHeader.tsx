import { useState, useRef, useEffect } from 'react';
import { useAuthStore } from '../stores/auth-store';
import adsclinLogo from '../assets/adsclin-logo.png';

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  time: string;
  type: 'success' | 'info' | 'warning';
  read: boolean;
}

const INITIAL_NOTIFICATIONS: NotificationItem[] = [
  {
    id: 'notif-1',
    title: 'Stealth Shield Active',
    message: 'Genuine canvas, WebGL & audio noise protection running on all profiles.',
    time: 'Just now',
    type: 'success',
    read: false,
  },
  {
    id: 'notif-2',
    title: 'Free Trial Activated',
    message: '30-day enterprise trial active on this physical machine. 1 account/hardware.',
    time: '10m ago',
    type: 'info',
    read: false,
  },
  {
    id: 'notif-3',
    title: 'Proxy Forwarder Ready',
    message: 'Encrypted proxy tunnels and DNS leak guards verified online.',
    time: '1h ago',
    type: 'info',
    read: true,
  },
  {
    id: 'notif-4',
    title: 'Cloud Database Ready',
    message: 'Supabase cloud synchronization available for enterprise publishing.',
    time: '2h ago',
    type: 'success',
    read: true,
  },
];

export function TopHeader() {
  const { session, logout } = useAuthStore();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>(INITIAL_NOTIFICATIONS);

  const userMenuRef = useRef<HTMLDivElement>(null);
  const notifMenuRef = useRef<HTMLDivElement>(null);

  const userEmail = session?.user?.identifier ?? 'aheer210@gmail.com';
  const initial = (userEmail[0] || 'A').toUpperCase();
  const unreadCount = notifications.filter((n) => !n.read).length;

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
      if (notifMenuRef.current && !notifMenuRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleMinimize = () => {
    void window.api?.minimizeWindow?.();
  };

  const handleMaximize = () => {
    void window.api?.maximizeWindow?.();
  };

  const handleClose = () => {
    void window.api?.closeWindow?.();
  };

  const markAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const dismissNotif = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  return (
    <header
      className="h-16 flex-shrink-0 bg-[#040807] border-b border-[#103425]/70 px-4 flex items-center justify-between select-none relative z-30"
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      {/* Left side: Brand + Engine Pill + Security Pill */}
      <div className="flex items-center gap-4" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        {/* Logo & Brand */}
        <div className="flex items-center gap-3">
          <img
            src={adsclinLogo}
            alt="Adsclin Logo"
            className="h-8 w-auto object-contain drop-shadow-[0_0_10px_rgba(0,255,136,0.6)]"
          />
          <div className="flex flex-col">
            <span className="text-xl font-black text-white tracking-tight leading-none font-sans drop-shadow-[0_0_10px_rgba(255,255,255,0.15)]">
              Adsclin
            </span>
            <span className="text-[9px] text-gray-400 font-semibold tracking-widest uppercase mt-0.5">
              ANTI-DETECT BROWSER
            </span>
          </div>
        </div>

        {/* Status Pills */}
        <div className="flex items-center gap-2.5 ml-2">
          {/* Browser Engine Pill */}
          <div className="rounded-full bg-[#061910] border border-[#143d2c] px-3.5 py-1 text-xs text-gray-300 font-sans flex items-center gap-2 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-[#00ff88] shadow-[0_0_8px_#00ff88]" />
            <span className="text-xs font-medium">Browser Engine v1.0.2</span>
          </div>

          {/* Secure • Private • Undetectable Pill */}
          <div className="rounded-full bg-[#061910] border border-[#143d2c] px-3.5 py-1 text-xs text-[#00ff88] font-sans flex items-center gap-2 shadow-sm">
            <svg className="w-3.5 h-3.5 text-[#00ff88]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            <span className="text-xs font-semibold tracking-wide">
              Secure <span className="text-emerald-600">•</span> Private <span className="text-emerald-600">•</span> Undetectable
            </span>
          </div>
        </div>
      </div>

      {/* Right side: Notifications + User Pill + Window Controls */}
      <div className="flex items-center gap-4" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        {/* Notification Bell Dropdown */}
        <div className="relative" ref={notifMenuRef}>
          <button
            type="button"
            onClick={() => {
              setShowNotifications(!showNotifications);
              setShowUserMenu(false);
            }}
            title="System notifications"
            className={`relative p-2 rounded-xl transition-all cursor-pointer ${
              showNotifications
                ? 'bg-[#00ff88]/20 text-[#00ff88] border border-[#00ff88]/50 shadow-[0_0_10px_rgba(0,255,136,0.3)]'
                : 'text-gray-400 hover:text-white hover:bg-[#081a13]'
            }`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full bg-[#00ff88] shadow-[0_0_8px_#00ff88] border-2 border-[#040807]" />
            )}
          </button>

          {/* Notifications Menu Popover */}
          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 rounded-2xl bg-[#06140e] border border-[#103425] shadow-2xl p-3 z-50 animate-fadeIn font-sans">
              <div className="flex items-center justify-between pb-2.5 mb-2 border-b border-[#103425]/70">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-white uppercase tracking-wider font-mono">Notifications</span>
                  {unreadCount > 0 && (
                    <span className="text-[10px] font-mono font-bold bg-[#00ff88]/20 text-[#00ff88] px-2 py-0.5 rounded-full">
                      {unreadCount} new
                    </span>
                  )}
                </div>
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={markAllRead}
                    className="text-[11px] text-[#00ff88] hover:underline cursor-pointer font-medium"
                  >
                    Mark all read
                  </button>
                )}
              </div>

              <div className="flex flex-col gap-2 max-h-72 overflow-y-auto pr-1">
                {notifications.length === 0 ? (
                  <div className="text-center py-6 text-xs text-gray-500 font-mono">
                    No new notifications
                  </div>
                ) : (
                  notifications.map((item) => (
                    <div
                      key={item.id}
                      className={`p-2.5 rounded-xl border transition-all text-xs relative group ${
                        item.read
                          ? 'bg-[#081a13]/50 border-[#103425]/50 text-gray-400'
                          : 'bg-[#081f16] border-[#00ff88]/30 text-gray-200 shadow-sm'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-1.5 font-bold text-white">
                          {!item.read && <span className="w-1.5 h-1.5 rounded-full bg-[#00ff88] flex-shrink-0" />}
                          <span>{item.title}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-gray-500 font-mono">{item.time}</span>
                          <button
                            type="button"
                            onClick={() => dismissNotif(item.id)}
                            className="text-gray-500 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Dismiss"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                      <p className="text-[11px] text-gray-400 mt-1 leading-relaxed">
                        {item.message}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* User Profile Pill */}
        <div className="relative" ref={userMenuRef}>
          <button
            type="button"
            onClick={() => {
              setShowUserMenu(!showUserMenu);
              setShowNotifications(false);
            }}
            className="flex items-center gap-2.5 rounded-full bg-[#061910] hover:bg-[#0a2318] border border-[#143d2c] hover:border-[#00ff88]/40 pl-1.5 pr-3 py-1 transition-all cursor-pointer shadow-sm"
          >
            <div className="w-7 h-7 rounded-full bg-[#052b1b] border border-[#00ff88]/50 text-[#00ff88] font-bold flex items-center justify-center text-xs shadow-sm">
              {initial}
            </div>
            <span className="text-xs font-semibold text-gray-200 truncate max-w-[160px]">
              {userEmail}
            </span>
            <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {/* User Menu Dropdown */}
          {showUserMenu && (
            <div className="absolute right-0 mt-2 w-56 rounded-2xl bg-[#06140e] border border-[#103425] shadow-2xl p-2 z-50 animate-fadeIn">
              <div className="px-3 py-2 border-b border-[#143d2c]/60">
                <p className="text-[11px] text-gray-400 font-mono">Signed in as</p>
                <p className="text-xs font-bold text-white truncate font-mono">{userEmail}</p>
                <div className="mt-1.5 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#00ff88]" />
                  <span className="text-[10px] text-[#00ff88] font-mono uppercase font-bold">
                    {session?.isSubscriptionActive ? 'Pro Plan' : session?.isTrialActive ? 'Free Trial' : 'Expired'}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={async () => {
                  setShowUserMenu(false);
                  await logout();
                }}
                className="w-full text-left px-3 py-2.5 text-xs font-semibold text-rose-400 hover:bg-rose-500/15 rounded-xl mt-1.5 transition-colors flex items-center gap-2 cursor-pointer"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                <span>Sign Out</span>
              </button>
            </div>
          )}
        </div>

        {/* Frameless Window Controls */}
        <div className="flex items-center gap-1 ml-2 border-l border-[#103425] pl-3">
          <button
            type="button"
            onClick={handleMinimize}
            title="Minimize"
            className="w-8 h-8 rounded-lg hover:bg-[#0c2419] text-gray-400 hover:text-white flex items-center justify-center transition-colors text-xs font-bold cursor-pointer"
          >
            —
          </button>
          <button
            type="button"
            onClick={handleMaximize}
            title="Maximize"
            className="w-8 h-8 rounded-lg hover:bg-[#0c2419] text-gray-400 hover:text-white flex items-center justify-center transition-colors text-xs font-bold cursor-pointer"
          >
            □
          </button>
          <button
            type="button"
            onClick={handleClose}
            title="Close"
            className="w-8 h-8 rounded-lg hover:bg-rose-500/20 text-gray-400 hover:text-rose-400 flex items-center justify-center transition-colors text-xs font-bold cursor-pointer"
          >
            ✕
          </button>
        </div>
      </div>
    </header>
  );
}
