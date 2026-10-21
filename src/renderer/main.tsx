import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

import type { IpcApi } from '@shared/ipc';

// In browser preview (outside Electron), provide a fallback mock API so UI renders cleanly
if (typeof window !== 'undefined' && !window.api) {
  const browserFallbackApi: IpcApi = {
    seedDemoProfiles: () => Promise.resolve(),
    createProfile: (req) =>
      Promise.resolve({
        id: 'preview-1',
        name: req.name,
        groupId: req.groupId ?? null,
        status: 'idle',
        userDataDir: '/preview/dir',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        proxyId: req.proxyId ?? null,
        lastLaunchedAt: null,
        notes: req.notes ?? '',
        tags: req.tags ?? [],
      }),
    listProfiles: () => Promise.resolve([]),
    deleteProfile: () => Promise.resolve(),
    updateProfile: (req) =>
      Promise.resolve({
        id: req.id,
        name: req.name ?? 'Preview Profile',
        groupId: req.groupId ?? null,
        status: 'idle',
        userDataDir: '/preview/dir',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        proxyId: req.proxyId ?? null,
        lastLaunchedAt: null,
        notes: req.notes ?? '',
        tags: req.tags ?? [],
      }),
    duplicateProfile: (id) =>
      Promise.resolve({
        id: `${id}-copy`,
        name: 'Copy of Profile',
        groupId: null,
        status: 'idle',
        userDataDir: '/preview/dir',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        proxyId: null,
        lastLaunchedAt: null,
        notes: '',
        tags: [],
      }),
    bulkCreateProfiles: () => Promise.resolve([]),
    createProxy: (req) =>
      Promise.resolve({
        id: 'preview-p1',
        name: req.name,
        scheme: req.scheme,
        host: req.host,
        port: req.port,
        username: req.username ?? null,
        lastTestIp: null,
        lastTestCountry: null,
        lastTestLatencyMs: null,
        lastTestedAt: null,
      }),
    bulkCreateProxies: () => Promise.resolve([]),
    listProxies: () => Promise.resolve([]),
    deleteProxy: () => Promise.resolve(),
    updateProxy: (req) =>
      Promise.resolve({
        id: req.id,
        name: req.name ?? 'Proxy',
        scheme: req.scheme ?? 'http',
        host: req.host ?? '127.0.0.1',
        port: req.port ?? 8080,
        username: req.username ?? null,
        lastTestIp: null,
        lastTestCountry: null,
        lastTestLatencyMs: null,
        lastTestedAt: null,
      }),
    testProxy: () => Promise.resolve({ ip: '127.0.0.1', country: 'Local', latencyMs: 1 }),
    launchProfile: () => Promise.resolve(),
    stopProfile: () => Promise.resolve(),
    createGroup: (req) =>
      Promise.resolve({ id: 'preview-g1', name: req.name, createdAt: Date.now() }),
    listGroups: () => Promise.resolve([]),
    deleteGroup: () => Promise.resolve(),
    launchGroup: () => Promise.resolve([]),
    stopGroup: () => Promise.resolve([]),
    selectExtensionDir: () => Promise.resolve(null),
    getSettings: () =>
      Promise.resolve({
        customExecutablePath: null,
        userDataDir: 'Browser Preview Mode (Open Electron App Window)',
        apiPort: 3001,
        apiToken: 'preview-token-1234567890abcdef',
        apiEnabled: true,
      }),
    updateSettings: (req) =>
      Promise.resolve({
        customExecutablePath: req.customExecutablePath ?? null,
        userDataDir: 'Browser Preview Mode',
        apiPort: req.apiPort ?? 3001,
        apiToken: req.apiToken ?? 'preview-token-1234567890abcdef',
        apiEnabled: req.apiEnabled ?? true,
      }),
    regenerateApiToken: () => Promise.resolve('new-preview-token-abcdef123456'),
    exportCookies: () => Promise.resolve('[]'),
    importCookies: () => Promise.resolve({ count: 1 }),
    listActivities: () => Promise.resolve([]),
    getAuthSession: () =>
      Promise.resolve({
        user: {
          id: 'dev-preview-user',
          identifier: 'user@adsclin.com',
          deviceId: 'preview-device-id',
          planType: 'trial',
          trialEndsAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
          subscriptionEndsAt: null,
          createdAt: Date.now(),
          lastLoginAt: Date.now(),
        },
        deviceId: 'preview-device-id',
        isTrialActive: true,
        isSubscriptionActive: false,
        daysRemaining: 30,
        canLaunchBrowser: true,
        trialDeniedReason: null,
      }),
    login: (identifier: string) =>
      Promise.resolve({
        user: {
          id: 'dev-preview-user',
          identifier,
          deviceId: 'preview-device-id',
          planType: 'trial',
          trialEndsAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
          subscriptionEndsAt: null,
          createdAt: Date.now(),
          lastLoginAt: Date.now(),
        },
        deviceId: 'preview-device-id',
        isTrialActive: true,
        isSubscriptionActive: false,
        daysRemaining: 30,
        canLaunchBrowser: true,
        trialDeniedReason: null,
      }),
    logout: () =>
      Promise.resolve({
        user: null,
        deviceId: 'preview-device-id',
        isTrialActive: false,
        isSubscriptionActive: false,
        daysRemaining: 0,
        canLaunchBrowser: false,
        trialDeniedReason: null,
      }),
    getCryptoWallets: () =>
      Promise.resolve([
        {
          currency: 'USDT_TRC20',
          network: 'TRON (TRC20)',
          name: 'Tether USD',
          address: 'TX6WwKzZ1m9Y8sE4L7c5Q2p3R9v8D1j4kM',
          amountUsd: 9.0,
        },
        {
          currency: 'USDT_ERC20',
          network: 'Ethereum (ERC20)',
          name: 'Tether USD',
          address: '0x71C8A36eF090680A90F60c0E6F0b7B2e8D8E9A21',
          amountUsd: 9.0,
        },
        {
          currency: 'BTC',
          network: 'Bitcoin Native SegWit',
          name: 'Bitcoin',
          address: 'bc1q9v8d1j4km7c5q2p3r9v8d1j4km7c5q2p3r',
          amountUsd: 9.0,
        },
        {
          currency: 'ETH',
          network: 'Ethereum Mainnet',
          name: 'Ethereum',
          address: '0x71C8A36eF090680A90F60c0E6F0b7B2e8D8E9A21',
          amountUsd: 9.0,
        },
        {
          currency: 'SOL',
          network: 'Solana Network',
          name: 'Solana',
          address: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
          amountUsd: 9.0,
        },
      ]),
    activateSubscription: () =>
      Promise.resolve({
        user: {
          id: 'dev-preview-user',
          identifier: 'user@adsclin.com',
          deviceId: 'preview-device-id',
          planType: 'active',
          trialEndsAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
          subscriptionEndsAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
          createdAt: Date.now(),
          lastLoginAt: Date.now(),
        },
        deviceId: 'preview-device-id',
        isTrialActive: false,
        isSubscriptionActive: true,
        daysRemaining: 30,
        canLaunchBrowser: true,
        trialDeniedReason: null,
      }),
    minimizeWindow: () => Promise.resolve(),
    maximizeWindow: () => Promise.resolve(),
    closeWindow: () => Promise.resolve(),
    getSupabaseConfig: () => Promise.resolve({ url: '', anonKey: '', isConfigured: false }),
    saveSupabaseConfig: () => Promise.resolve({ success: true, message: 'Saved' }),
    testSupabaseConnection: () => Promise.resolve({ success: true, message: 'Connected' }),
    syncProfilesToCloud: () => Promise.resolve({ success: true, count: 0 }),
    pullProfilesFromCloud: () => Promise.resolve({ success: true, count: 0 }),
    syncProxiesToCloud: () => Promise.resolve({ success: true, count: 0 }),
    nowpaymentsCreateInvoice: () => Promise.resolve({ success: true, invoiceUrl: 'https://nowpayments.io', paymentId: 'demo' }),
    nowpaymentsVerifyPayment: () => Promise.resolve({ status: 'confirmed', isPaid: true, message: 'Verified' }),
    updaterCheck: () => Promise.resolve({ status: 'up-to-date' }),
    updaterQuitAndInstall: () => Promise.resolve(),
    onUpdaterStatus: () => () => {},
    onProfileStatusChanged: () => () => {},
  };
  window.api = browserFallbackApi;
}

// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
