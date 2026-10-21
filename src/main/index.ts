import 'dotenv/config';
import { app, BrowserWindow } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { initDatabase } from './db/database';
import { registerIpcHandlers } from './ipc-handlers';
import { startLocalApi, stopLocalApi } from './services/local-api-service';

const isDev = !app.isPackaged;

let mainWindow: BrowserWindow | null = null;

function getPreloadPath(): string {
  const candidate1 = path.join(__dirname, '../preload/index.js');
  if (fs.existsSync(candidate1)) return candidate1;
  const candidate2 = path.join(app.getAppPath(), 'dist/main/preload/index.js');
  if (fs.existsSync(candidate2)) return candidate2;
  return candidate1;
}

function getRendererHtmlPath(): string {
  const candidate1 = path.resolve(__dirname, '../../renderer/index.html');
  if (fs.existsSync(candidate1)) return candidate1;
  const candidate2 = path.join(app.getAppPath(), 'dist/renderer/index.html');
  if (fs.existsSync(candidate2)) return candidate2;
  return candidate1;
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    title: 'Adsclin - Anti-Detect Browser',
    width: 1360,
    height: 850,
    minWidth: 1080,
    minHeight: 700,
    frame: false,
    backgroundColor: '#040807',
    webPreferences: {
      // Security: contextIsolation on, nodeIntegration off
      contextIsolation: true,
      nodeIntegration: false,
      preload: getPreloadPath(),
    },
  });

  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    console.error(`[main] did-fail-load: code ${errorCode}, desc: ${errorDescription}, url: ${validatedURL}`);
  });

  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'F12' && input.type === 'keyDown') {
      mainWindow?.webContents.toggleDevTools();
      event.preventDefault();
    }
  });

  if (isDev && process.env.VITE_DEV_SERVER_URL) {
    void mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else if (isDev && !fs.existsSync(getRendererHtmlPath())) {
    void mainWindow.loadURL('http://localhost:5173');
  } else {
    void mainWindow.loadFile(getRendererHtmlPath());
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

/** Returns the current main BrowserWindow, or null if it has been destroyed. */
export function getMainWindow(): BrowserWindow | null {
  return mainWindow;
}

import { initAutoUpdater } from './services/updater-service';

app.on('ready', () => {
  initDatabase();
  registerIpcHandlers();
  createWindow();
  initAutoUpdater(mainWindow);
  startLocalApi().catch((err) => {
    console.error('[main] Failed to start local REST API:', err);
  });
});

app.on('will-quit', () => {
  void stopLocalApi();
});

app.on('window-all-closed', () => {
  // On macOS it is conventional to keep the app open until explicitly quit.
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // On macOS re-create a window when dock icon is clicked and no windows are open.
  if (mainWindow === null) {
    createWindow();
  }
});
