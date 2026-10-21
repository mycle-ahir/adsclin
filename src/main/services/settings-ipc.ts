import { ipcMain } from 'electron';
import { IPC } from '../../shared/ipc';
import { updateSettingsSchema } from '../../shared/schemas';
import * as SettingsService from './settings-service';

export function registerSettingsHandlers(): void {
  ipcMain.handle(IPC.SETTINGS_GET, () => {
    return SettingsService.getSettings();
  });

  ipcMain.handle(IPC.SETTINGS_SET, (_e, raw: unknown) => {
    const input = updateSettingsSchema.parse(raw);
    return SettingsService.updateSettings(input);
  });

  ipcMain.handle(IPC.SETTINGS_REGENERATE_API_TOKEN, () => {
    return SettingsService.regenerateApiToken();
  });
}

