import { contextBridge, ipcRenderer } from 'electron';
import type { IpcApi } from '../shared/ipc';

const api: IpcApi = {
  // profile
  seedDemoProfiles: (force?: boolean) => ipcRenderer.invoke('profile:seedDemo', force),
  createProfile: (req: unknown) => ipcRenderer.invoke('profile:create', req),
  listProfiles: () => ipcRenderer.invoke('profile:list'),
  deleteProfile: (id: unknown) => ipcRenderer.invoke('profile:delete', id),
  updateProfile: (req: unknown) => ipcRenderer.invoke('profile:update', req),
  duplicateProfile: (id: unknown) => ipcRenderer.invoke('profile:duplicate', id),
  bulkCreateProfiles: (req: unknown) => ipcRenderer.invoke('profile:bulkCreate', req),
  // proxy
  createProxy: (req: unknown) => ipcRenderer.invoke('proxy:create', req),
  listProxies: () => ipcRenderer.invoke('proxy:list'),
  deleteProxy: (id: unknown) => ipcRenderer.invoke('proxy:delete', id),
  updateProxy: (req: unknown) => ipcRenderer.invoke('proxy:update', req),
  testProxy: (id: unknown) => ipcRenderer.invoke('proxy:test', id),
  bulkCreateProxies: (proxies: unknown) => ipcRenderer.invoke('proxy:bulkCreate', proxies),
  // launcher
  launchProfile: (id: unknown) => ipcRenderer.invoke('launcher:launch', id),
  stopProfile: (id: unknown) => ipcRenderer.invoke('launcher:stop', id),
  // groups
  createGroup: (req: unknown) => ipcRenderer.invoke('group:create', req),
  listGroups: () => ipcRenderer.invoke('group:list'),
  deleteGroup: (id: unknown) => ipcRenderer.invoke('group:delete', id),
  launchGroup: (groupId: unknown, tile = false) =>
    ipcRenderer.invoke('group:launch', { groupId, tile }),
  stopGroup: (groupId: unknown) =>
    ipcRenderer.invoke('group:stop', { groupId }),
  // extensions
  selectExtensionDir: () => ipcRenderer.invoke('profile:selectExtensionDir'),
  // settings
  getSettings: () => ipcRenderer.invoke('settings:get'),
  updateSettings: (req: unknown) => ipcRenderer.invoke('settings:set', req),
  regenerateApiToken: () => ipcRenderer.invoke('settings:regenerateApiToken'),
  // cookies
  exportCookies: (profileId: string, format = 'json') =>
    ipcRenderer.invoke('cookies:export', { profileId, format }),
  importCookies: (profileId: string, content: string, format = 'json') =>
    ipcRenderer.invoke('cookies:import', { profileId, content, format }),
  // activity
  listActivities: (options?: unknown) => ipcRenderer.invoke('activity:list', options),
  // auth & subscription
  getAuthSession: () => ipcRenderer.invoke('auth:getSession'),
  login: (identifier: string) => ipcRenderer.invoke('auth:login', identifier),
  logout: () => ipcRenderer.invoke('auth:logout'),
  getCryptoWallets: () => ipcRenderer.invoke('auth:getWallets'),
  activateSubscription: (payload: { userId: string; currency: any; txHash: string }) =>
    ipcRenderer.invoke('auth:activateSubscription', payload),
  // window controls
  minimizeWindow: () => ipcRenderer.invoke('window:minimize'),
  maximizeWindow: () => ipcRenderer.invoke('window:maximize'),
  closeWindow: () => ipcRenderer.invoke('window:close'),
  // supabase cloud sync
  getSupabaseConfig: () => ipcRenderer.invoke('supabase:getConfig'),
  saveSupabaseConfig: (url: string, anonKey: string) => ipcRenderer.invoke('supabase:saveConfig', { url, anonKey }),
  testSupabaseConnection: () => ipcRenderer.invoke('supabase:testConnection'),
  syncProfilesToCloud: () => ipcRenderer.invoke('supabase:syncProfiles'),
  pullProfilesFromCloud: () => ipcRenderer.invoke('supabase:pullProfiles'),
  syncProxiesToCloud: () => ipcRenderer.invoke('supabase:syncProxies'),
  // NOWPayments automated crypto payments
  nowpaymentsCreateInvoice: (userId: string, payCurrency?: string) =>
    ipcRenderer.invoke('nowpayments:createInvoice', { userId, payCurrency }),
  nowpaymentsVerifyPayment: (paymentId: string, userId: string) =>
    ipcRenderer.invoke('nowpayments:verifyPayment', { paymentId, userId }),
  // auto-updater
  updaterCheck: () => ipcRenderer.invoke('updater:check'),
  updaterQuitAndInstall: () => ipcRenderer.invoke('updater:quitAndInstall'),
  onUpdaterStatus: (cb: (data: any) => void) => {
    const listener = (_: Electron.IpcRendererEvent, data: any) => cb(data);
    ipcRenderer.on('updater:status', listener);
    return () => ipcRenderer.removeListener('updater:status', listener);
  },
  // events (renderer subscribes)
  onProfileStatusChanged: (cb: (profileId: string, status: string) => void) => {
    const listener = (_: Electron.IpcRendererEvent, profileId: string, status: string) =>
      cb(profileId, status);
    ipcRenderer.on('profile:statusChanged', listener);
    return () => ipcRenderer.removeListener('profile:statusChanged', listener);
  },
};

contextBridge.exposeInMainWorld('api', api);
