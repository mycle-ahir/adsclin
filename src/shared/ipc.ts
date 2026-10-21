import type {
  Profile,
  Proxy,
  Group,
  ProxyTestResult,
  AppSettings,
  CookieFormat,
  ActivityLog,
  ActivityEntityType,
  AuthSession,
  CryptoWalletInfo,
  CryptoCurrency,
} from './types';
import type {
  CreateProfileInput,
  UpdateProfileInput,
  CreateProxyInput,
  UpdateProxyInput,
  CreateGroupInput,
  UpdateSettingsInput,
  BulkCreateProfilesInput,
} from './schemas';

// IPC channel names — keep in sync with ipc-handlers.ts
export const IPC = {
  AUTH_GET_SESSION: 'auth:getSession',
  AUTH_LOGIN: 'auth:login',
  AUTH_LOGOUT: 'auth:logout',
  AUTH_GET_WALLETS: 'auth:getWallets',
  AUTH_ACTIVATE_SUBSCRIPTION: 'auth:activateSubscription',
  PROFILE_SEED_DEMO: 'profile:seedDemo',
  PROFILE_CREATE: 'profile:create',
  PROFILE_LIST: 'profile:list',
  PROFILE_DELETE: 'profile:delete',
  PROFILE_UPDATE: 'profile:update',
  PROFILE_DUPLICATE: 'profile:duplicate',
  PROFILE_BULK_CREATE: 'profile:bulkCreate',
  PROXY_CREATE: 'proxy:create',
  PROXY_LIST: 'proxy:list',
  PROXY_DELETE: 'proxy:delete',
  PROXY_UPDATE: 'proxy:update',
  PROXY_TEST: 'proxy:test',
  PROXY_BULK_CREATE: 'proxy:bulkCreate',
  LAUNCHER_LAUNCH: 'launcher:launch',
  LAUNCHER_STOP: 'launcher:stop',
  GROUP_CREATE: 'group:create',
  GROUP_LIST: 'group:list',
  GROUP_DELETE: 'group:delete',
  GROUP_LAUNCH: 'group:launch',
  GROUP_STOP: 'group:stop',
  PROFILE_SELECT_EXTENSION_DIR: 'profile:selectExtensionDir',
  SETTINGS_GET: 'settings:get',
  SETTINGS_SET: 'settings:set',
  SETTINGS_REGENERATE_API_TOKEN: 'settings:regenerateApiToken',
  COOKIES_EXPORT: 'cookies:export',
  COOKIES_IMPORT: 'cookies:import',
  ACTIVITY_LIST: 'activity:list',
  // supabase cloud sync
  SUPABASE_GET_CONFIG: 'supabase:getConfig',
  SUPABASE_SAVE_CONFIG: 'supabase:saveConfig',
  SUPABASE_TEST_CONNECTION: 'supabase:testConnection',
  SUPABASE_SYNC_PROFILES: 'supabase:syncProfiles',
  SUPABASE_PULL_PROFILES: 'supabase:pullProfiles',
  SUPABASE_SYNC_PROXIES: 'supabase:syncProxies',
  PROFILE_STATUS_CHANGED: 'profile:statusChanged', // main→renderer push
} as const;

// The typed API exposed via contextBridge
export interface IpcApi {
  // profiles
  seedDemoProfiles: (force?: boolean) => Promise<void>;
  createProfile: (req: CreateProfileInput) => Promise<Profile>;
  listProfiles: () => Promise<Profile[]>;
  deleteProfile: (id: string) => Promise<void>;
  updateProfile: (req: UpdateProfileInput) => Promise<Profile>;
  duplicateProfile: (id: string) => Promise<Profile>;
  bulkCreateProfiles: (req: BulkCreateProfilesInput) => Promise<Profile[]>;
  // proxies
  createProxy: (req: CreateProxyInput) => Promise<Proxy>;
  listProxies: () => Promise<Proxy[]>;
  deleteProxy: (id: string) => Promise<void>;
  updateProxy: (req: UpdateProxyInput) => Promise<Proxy>;
  testProxy: (id: string) => Promise<ProxyTestResult>;
  bulkCreateProxies: (proxies: CreateProxyInput[]) => Promise<Proxy[]>;
  // launcher
  launchProfile: (id: string) => Promise<void>;
  stopProfile: (id: string) => Promise<void>;
  // groups
  createGroup: (req: CreateGroupInput) => Promise<Group>;
  listGroups: () => Promise<Group[]>;
  deleteGroup: (id: string) => Promise<void>;
  launchGroup: (groupId: string, tile?: boolean) => Promise<string[]>;
  stopGroup: (groupId: string) => Promise<string[]>;
  // extensions
  selectExtensionDir: () => Promise<string | null>;
  // settings
  getSettings: () => Promise<AppSettings>;
  updateSettings: (req: UpdateSettingsInput) => Promise<AppSettings>;
  regenerateApiToken: () => Promise<string>;
  // cookies
  exportCookies: (profileId: string, format?: CookieFormat) => Promise<string>;
  importCookies: (profileId: string, content: string, format?: CookieFormat) => Promise<{ count: number }>;
  // activity
  listActivities: (options?: { limit?: number; offset?: number; entityType?: ActivityEntityType }) => Promise<ActivityLog[]>;
  // auth & subscription
  getAuthSession: () => Promise<AuthSession>;
  login: (identifier: string) => Promise<AuthSession>;
  logout: () => Promise<AuthSession>;
  getCryptoWallets: () => Promise<CryptoWalletInfo[]>;
  activateSubscription: (payload: { userId: string; currency: CryptoCurrency; txHash: string }) => Promise<AuthSession>;
  // window controls
  minimizeWindow: () => Promise<void>;
  maximizeWindow: () => Promise<void>;
  closeWindow: () => Promise<void>;
  // supabase cloud sync
  getSupabaseConfig: () => Promise<{ url: string; anonKey: string; isConfigured: boolean }>;
  saveSupabaseConfig: (url: string, anonKey: string) => Promise<{ success: boolean; message: string }>;
  testSupabaseConnection: () => Promise<{ success: boolean; message: string }>;
  syncProfilesToCloud: () => Promise<{ success: boolean; count: number; error?: string }>;
  pullProfilesFromCloud: () => Promise<{ success: boolean; count: number; error?: string }>;
  syncProxiesToCloud: () => Promise<{ success: boolean; count: number; error?: string }>;
  // NOWPayments automated crypto payments
  nowpaymentsCreateInvoice: (userId: string, payCurrency?: string) => Promise<{
    success: boolean;
    invoiceId?: string;
    invoiceUrl?: string;
    payAddress?: string;
    payAmount?: number;
    payCurrency?: string;
    paymentId?: string;
    error?: string;
  }>;
  nowpaymentsVerifyPayment: (paymentId: string, userId: string) => Promise<{
    status: string;
    isPaid: boolean;
    message: string;
  }>;
  // auto-updater
  updaterCheck: () => Promise<any>;
  updaterQuitAndInstall: () => Promise<void>;
  onUpdaterStatus: (cb: (data: any) => void) => () => void;
  // renderer event subscriptions
  onProfileStatusChanged: (cb: (profileId: string, status: string) => void) => () => void;
}

// Augment the Window interface for renderer use
declare global {
  interface Window {
    api: IpcApi;
  }
}
