import { app } from 'electron';
import * as crypto from 'crypto';
import type { AppSettings } from '../../shared/types';
import type { UpdateSettingsInput } from '../../shared/schemas';
import { getDb } from '../db/database';

let customExecutablePath: string | null = process.env['PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH'] ?? null;

// In-memory fallback if DB is not available in unit tests
let memApiPort = 3001;
let memApiToken = '';
let memApiEnabled = true;

function getDbSetting(key: string): string | null {
  try {
    const db = getDb();
    const row = db.prepare('SELECT value FROM app_settings WHERE key = ?').get(key) as { value: string } | undefined;
    return row ? row.value : null;
  } catch {
    return null;
  }
}

function setDbSetting(key: string, value: string): void {
  try {
    const db = getDb();
    db.prepare('INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)').run(key, value);
  } catch {
    // DB not initialized (e.g. unit test runner)
  }
}

function getOrGenerateApiToken(): string {
  const existing = getDbSetting('api_token');
  if (existing) return existing;
  if (memApiToken) return memApiToken;

  const newToken = crypto.randomBytes(16).toString('hex');
  setDbSetting('api_token', newToken);
  memApiToken = newToken;
  return newToken;
}

export function getSettings(): AppSettings {
  const storedPort = getDbSetting('api_port');
  const storedEnabled = getDbSetting('api_enabled');

  const apiPort = storedPort ? parseInt(storedPort, 10) : memApiPort;
  const apiToken = getOrGenerateApiToken();
  const apiEnabled = storedEnabled !== null ? storedEnabled === '1' : memApiEnabled;

  let userDataDir = '';
  try {
    userDataDir = app.getPath('userData');
  } catch {
    userDataDir = process.cwd();
  }

  return {
    userDataDir,
    customExecutablePath,
    apiPort,
    apiToken,
    apiEnabled,
  };
}

export function regenerateApiToken(): string {
  const newToken = crypto.randomBytes(16).toString('hex');
  setDbSetting('api_token', newToken);
  memApiToken = newToken;
  return newToken;
}

export function updateSettings(input: UpdateSettingsInput): AppSettings {
  if ('customExecutablePath' in input) {
    customExecutablePath = input.customExecutablePath ?? null;
    if (customExecutablePath) {
      process.env['PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH'] = customExecutablePath;
    } else {
      delete process.env['PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH'];
    }
  }

  if (input.apiPort !== undefined) {
    setDbSetting('api_port', String(input.apiPort));
    memApiPort = input.apiPort;
  }

  if (input.apiToken !== undefined) {
    setDbSetting('api_token', input.apiToken);
    memApiToken = input.apiToken;
  }

  if (input.apiEnabled !== undefined) {
    setDbSetting('api_enabled', input.apiEnabled ? '1' : '0');
    memApiEnabled = input.apiEnabled;
  }

  return getSettings();
}
