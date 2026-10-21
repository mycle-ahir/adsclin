import { useState, useEffect } from 'react';
import { TopHeader } from './components/TopHeader';
import { Sidebar, type Tab } from './components/Sidebar';
import { ProfileList } from './components/ProfileList';
import { ProxyList } from './components/ProxyList';
import { SettingsPanel } from './components/SettingsPanel';
import { FingerprintTestScreen } from './components/FingerprintTestScreen';
import { ActivityLogScreen } from './components/ActivityLogScreen';
import { LoginScreen } from './components/LoginScreen';
import { PaywallModal } from './components/PaywallModal';
import { CyberLoadingScreen } from './components/CyberLoadingScreen';
import { useProfilesStore } from './stores/profiles-store';
import { useProxiesStore } from './stores/proxies-store';
import { useAuthStore } from './stores/auth-store';

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('profiles');
  const [isBooting, setIsBooting] = useState(true);
  const fetchProfiles = useProfilesStore((s) => s.fetchProfiles);
  const fetchGroups = useProfilesStore((s) => s.fetchGroups);
  const fetchProxies = useProxiesStore((s) => s.fetchProxies);

  const { session, loading, fetchSession, isPaywallOpen, openPaywall } = useAuthStore();

  useEffect(() => {
    void fetchSession();
  }, [fetchSession]);

  useEffect(() => {
    if (session?.user) {
      void fetchProfiles();
      void fetchGroups();
      void fetchProxies();
    }
  }, [session?.user, fetchProfiles, fetchGroups, fetchProxies]);

  if (isBooting || (loading && !session)) {
    return (
      <CyberLoadingScreen
        onComplete={() => setIsBooting(false)}
        minDurationMs={2600}
      />
    );
  }

  if (!session?.user) {
    return <LoginScreen />;
  }

  const isExpired = session && !session.canLaunchBrowser;

  return (
    <div className="flex h-screen bg-[#040807] text-[#e2f9ed] font-sans antialiased overflow-hidden flex-col relative select-none">
      {/* Background cyber radial glow & grid */}
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_80%_80%_at_50%_0%,rgba(0,255,136,0.05),transparent)] z-0" />
      <div className="absolute inset-0 pointer-events-none cyber-grid opacity-70 z-0" />

      {/* Modern Cyber Top Header (from screenshot) */}
      <TopHeader />

      {/* Top Paywall Warning Banner if trial expired or hardware lock denied */}
      {isExpired && (
        <div className="bg-gradient-to-r from-rose-950/90 via-amber-950/70 to-rose-950/90 border-b border-rose-500/40 px-6 py-2.5 flex items-center justify-between text-xs font-semibold text-rose-200 z-40 relative">
          <div className="flex items-center gap-2">
            <span className="text-base">⚠️</span>
            <span>
              {session.trialDeniedReason
                ? 'Notice: This device has already claimed the 1-month free trial. Subscribe to the $9/mo plan to launch browsers.'
                : 'Free trial expired. Subscribe to the $9/mo plan with crypto to launch browser sessions.'}
            </span>
          </div>
          <button
            onClick={openPaywall}
            className="bg-gradient-to-r from-[#00ff88] to-[#10b981] hover:brightness-110 text-gray-950 font-black px-4 py-1.5 rounded-xl text-xs transition-all shadow-md shadow-emerald-500/30 flex items-center gap-1.5 flex-shrink-0 cursor-pointer"
          >
            <span>⚡ Unlock Pro ($9/mo)</span>
          </button>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden relative z-10">
        <Sidebar activeTab={activeTab} onSelect={(tab) => setActiveTab(tab)} />
        <main className="flex-1 overflow-auto p-6 bg-transparent relative">
          {(activeTab === 'profiles' || activeTab === 'dashboard') && <ProfileList />}
          {activeTab === 'proxies' && <ProxyList />}
          {activeTab === 'fingerprint-test' && <FingerprintTestScreen />}
          {activeTab === 'activity-log' && <ActivityLogScreen />}
          {activeTab === 'settings' && <SettingsPanel />}
        </main>
      </div>

      {isPaywallOpen && <PaywallModal />}
    </div>
  );
}
