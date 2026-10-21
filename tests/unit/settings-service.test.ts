import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => '/mock/userData'),
  },
}));

import * as SettingsService from '../../src/main/services/settings-service';

describe('settings-service', () => {
  beforeEach(() => {
    delete process.env['PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH'];
  });

  it('getSettings returns userDataDir and current custom path', () => {
    const s = SettingsService.getSettings();
    expect(s.userDataDir).toBe('/mock/userData');
    expect(s.customExecutablePath).toBeNull();
  });

  it('updateSettings updates customExecutablePath and process.env', () => {
    const updated = SettingsService.updateSettings({
      customExecutablePath: '/custom/chrome.exe',
    });
    expect(updated.customExecutablePath).toBe('/custom/chrome.exe');
    expect(process.env['PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH']).toBe('/custom/chrome.exe');

    const reset = SettingsService.updateSettings({
      customExecutablePath: null,
    });
    expect(reset.customExecutablePath).toBeNull();
    expect(process.env['PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH']).toBeUndefined();
  });
});
