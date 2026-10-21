import { create } from 'zustand';
import type { AuthSession, CryptoCurrency, CryptoWalletInfo } from '../../shared/types';

interface AuthState {
  session: AuthSession | null;
  wallets: CryptoWalletInfo[];
  loading: boolean;
  submitting: boolean;
  error: string | null;
  isPaywallOpen: boolean;

  openPaywall: () => void;
  closePaywall: () => void;
  fetchSession: () => Promise<void>;
  fetchWallets: () => Promise<void>;
  login: (identifier: string) => Promise<AuthSession>;
  logout: () => Promise<void>;
  activateSubscription: (currency: CryptoCurrency, txHash: string) => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  wallets: [],
  loading: true,
  submitting: false,
  error: null,
  isPaywallOpen: false,

  openPaywall: () => set({ isPaywallOpen: true, error: null }),
  closePaywall: () => set({ isPaywallOpen: false, error: null }),
  clearError: () => set({ error: null }),

  fetchSession: async () => {
    try {
      set({ loading: true, error: null });
      const session = await window.api.getAuthSession();
      set({ session, loading: false });
    } catch (err: any) {
      set({ error: err?.message || String(err), loading: false });
    }
  },

  fetchWallets: async () => {
    try {
      const wallets = await window.api.getCryptoWallets();
      set({ wallets });
    } catch (err: any) {
      console.error('[auth] Failed to load wallets:', err);
    }
  },

  login: async (identifier: string) => {
    try {
      set({ submitting: true, error: null });
      const session = await window.api.login(identifier);
      set({ session, submitting: false });
      // If user plan is expired / not allowed to launch, automatically open the paywall
      if (!session.canLaunchBrowser) {
        set({ isPaywallOpen: true });
      }
      return session;
    } catch (err: any) {
      const msg = err?.message || String(err);
      set({ error: msg, submitting: false });
      throw err;
    }
  },

  logout: async () => {
    try {
      set({ loading: true, error: null });
      const session = await window.api.logout();
      set({ session, loading: false, isPaywallOpen: false });
    } catch (err: any) {
      set({ error: err?.message || String(err), loading: false });
    }
  },

  activateSubscription: async (currency: CryptoCurrency, txHash: string) => {
    const { session } = get();
    if (!session?.user?.id) {
      throw new Error('User not logged in');
    }
    try {
      set({ submitting: true, error: null });
      const updatedSession = await window.api.activateSubscription({
        userId: session.user.id,
        currency,
        txHash,
      });
      set({ session: updatedSession, submitting: false, isPaywallOpen: false });
    } catch (err: any) {
      const msg = err?.message || String(err);
      set({ error: msg, submitting: false });
      throw err;
    }
  },
}));
