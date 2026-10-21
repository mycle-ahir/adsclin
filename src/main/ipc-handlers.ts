import { registerProfileHandlers } from './services/profile-ipc';
import { registerProxyHandlers } from './services/proxy-ipc';
// launcher handlers are registered by launcher-service on init (imported below)
import { registerLauncherHandlers } from './services/launcher-ipc';
import { registerSettingsHandlers } from './services/settings-ipc';
import { registerCookieHandlers } from './services/cookie-ipc';
import { registerBulkHandlers } from './services/bulk-ipc';
import { registerActivityHandlers } from './services/activity-ipc';
import { registerAuthHandlers } from './services/auth-ipc';

/**
 * Aggregation point for all IPC handler registrations.
 * Each service module registers its own ipcMain.handle() calls here.
 * Must be called after initDatabase() on app startup.
 */
import { ipcMain } from 'electron';
import { getMainWindow } from './index';
import * as SupabaseService from './services/supabase-service';

export function registerIpcHandlers(): void {
  registerProfileHandlers();
  registerProxyHandlers();
  registerLauncherHandlers();
  registerSettingsHandlers();
  registerCookieHandlers();
  registerBulkHandlers();
  registerActivityHandlers();
  registerAuthHandlers();

  // Window controls (minimize, maximize, close)
  ipcMain.handle('window:minimize', () => {
    getMainWindow()?.minimize();
  });
  ipcMain.handle('window:maximize', () => {
    const win = getMainWindow();
    if (win?.isMaximized()) {
      win.unmaximize();
    } else {
      win?.maximize();
    }
  });
  // Supabase Cloud Sync handlers
  ipcMain.handle('supabase:getConfig', () => {
    return SupabaseService.getSupabaseConfig();
  });
  ipcMain.handle('supabase:saveConfig', (_e, payload: any, maybeAnonKey?: string) => {
    const url = (typeof payload === 'object' && payload !== null) ? payload.url : payload;
    const anonKey = (typeof payload === 'object' && payload !== null) ? payload.anonKey : maybeAnonKey;
    return SupabaseService.saveSupabaseConfig(String(url || ''), String(anonKey || ''));
  });
  ipcMain.handle('supabase:testConnection', () => {
    return SupabaseService.testSupabaseConnection();
  });
  ipcMain.handle('supabase:syncProfiles', () => {
    return SupabaseService.syncProfilesToCloud();
  });
  ipcMain.handle('supabase:pullProfiles', () => {
    return SupabaseService.pullProfilesFromCloud();
  });
  // NOWPayments automated payment handlers
  ipcMain.handle('nowpayments:createInvoice', async (_e, payload: { userId: string; payCurrency?: string }) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { createSubscriptionInvoice } = require('./services/nowpayments-service');
    return createSubscriptionInvoice(payload.userId, payload.payCurrency);
  });
  ipcMain.handle('nowpayments:verifyPayment', async (_e, payload: { paymentId: string; userId: string }) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { verifyPaymentStatus } = require('./services/nowpayments-service');
    return verifyPaymentStatus(payload.paymentId, payload.userId);
  });

  // Auto-Updater handlers
  ipcMain.handle('updater:check', async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { checkForUpdatesManually } = require('./services/updater-service');
    return checkForUpdatesManually();
  });
  ipcMain.handle('updater:quitAndInstall', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { quitAndInstallUpdate } = require('./services/updater-service');
    quitAndInstallUpdate();
  });
}

