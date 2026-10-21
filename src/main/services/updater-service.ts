import { autoUpdater } from 'electron-updater';
import { app, BrowserWindow } from 'electron';

export interface UpdateInfo {
  version: string;
  releaseDate?: string;
  releaseNotes?: string;
}

let updaterInitialized = false;

export function initAutoUpdater(mainWindow: BrowserWindow | null): void {
  if (updaterInitialized) return;
  updaterInitialized = true;

  // Don't auto-download immediately; let user see notification or download in background
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('checking-for-update', () => {
    mainWindow?.webContents.send('updater:status', { status: 'checking' });
  });

  autoUpdater.on('update-available', (info) => {
    mainWindow?.webContents.send('updater:status', {
      status: 'available',
      version: info.version,
      releaseNotes: info.releaseNotes,
    });
  });

  autoUpdater.on('update-not-available', () => {
    mainWindow?.webContents.send('updater:status', { status: 'not-available' });
  });

  autoUpdater.on('download-progress', (progressObj) => {
    mainWindow?.webContents.send('updater:progress', {
      percent: Math.round(progressObj.percent),
      bytesPerSecond: progressObj.bytesPerSecond,
      transferred: progressObj.transferred,
      total: progressObj.total,
    });
  });

  autoUpdater.on('update-downloaded', (info) => {
    mainWindow?.webContents.send('updater:status', {
      status: 'downloaded',
      version: info.version,
    });
  });

  autoUpdater.on('error', (err) => {
    // Non-blocking error handling for dev / offline runs
    mainWindow?.webContents.send('updater:status', {
      status: 'error',
      message: err?.message || 'Update check failed',
    });
  });

  // Only check for updates in packaged production builds
  if (app.isPackaged) {
    setTimeout(() => {
      try {
        autoUpdater.checkForUpdates().catch((_err) => {
          // Expected when GitHub repository / release is pending creation
        });
      } catch {
        // Safe ignore
      }
    }, 5000);
  }
}

export function checkForUpdatesManually(): Promise<any> {
  if (!app.isPackaged) {
    return Promise.resolve({ status: 'dev-mode', message: 'Auto-updater is active in production builds only.' });
  }
  return autoUpdater.checkForUpdates().catch((err) => {
    return { status: 'error', message: err?.message || 'Update check failed.' };
  });
}

export function quitAndInstallUpdate(): void {
  autoUpdater.quitAndInstall();
}
