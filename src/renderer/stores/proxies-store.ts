import { create } from 'zustand';
import type { Proxy, ProxyTestResult } from '../../shared/types';
import type { CreateProxyInput, UpdateProxyInput } from '../../shared/schemas';

interface ProxiesState {
  proxies: Proxy[];
  loading: boolean;
  error: string | null;
  testResults: Record<string, ProxyTestResult>;
  testingIds: Set<string>;
  fetchProxies: () => Promise<void>;
  createProxy: (input: CreateProxyInput) => Promise<void>;
  updateProxy: (input: UpdateProxyInput) => Promise<void>;
  deleteProxy: (id: string) => Promise<void>;
  testProxy: (id: string) => Promise<void>;
  clearError: () => void;
}

export const useProxiesStore = create<ProxiesState>((set) => ({
  proxies: [],
  loading: false,
  error: null,
  testResults: {},
  testingIds: new Set(),

  fetchProxies: async () => {
    set({ loading: true, error: null });
    try {
      const proxies = await window.api.listProxies();
      set({ proxies, loading: false });
    } catch (err) {
      set({ loading: false, error: String(err) });
    }
  },

  createProxy: async (input) => {
    const proxy = await window.api.createProxy(input);
    set((s) => ({ proxies: [...s.proxies, proxy] }));
  },

  updateProxy: async (input) => {
    const updated = await window.api.updateProxy(input);
    set((s) => ({
      proxies: s.proxies.map((p) => (p.id === updated.id ? updated : p)),
    }));
  },

  deleteProxy: async (id) => {
    await window.api.deleteProxy(id);
    set((s) => ({ proxies: s.proxies.filter((p) => p.id !== id) }));
  },

  testProxy: async (id) => {
    set((s) => ({ testingIds: new Set([...s.testingIds, id]) }));
    try {
      const result = await window.api.testProxy(id);
      set((s) => {
        const newTesting = new Set(s.testingIds);
        newTesting.delete(id);
        return {
          testResults: { ...s.testResults, [id]: result },
          testingIds: newTesting,
        };
      });
    } catch (err) {
      set((s) => {
        const newTesting = new Set(s.testingIds);
        newTesting.delete(id);
        return {
          error: `Proxy test failed: ${String(err)}`,
          testingIds: newTesting,
        };
      });
    }
  },

  clearError: () => set({ error: null }),
}));
