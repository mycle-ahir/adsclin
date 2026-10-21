import { ipcMain } from 'electron';
import { IPC } from '../../shared/ipc';
import { exportCookiesSchema, importCookiesSchema } from '../../shared/schemas';
import * as CookieService from './cookie-service';
import { recordActivity } from './activity-service';

export function registerCookieHandlers(): void {
  ipcMain.handle(IPC.COOKIES_EXPORT, async (_e, raw: unknown) => {
    const input = exportCookiesSchema.parse(raw);
    const result = await CookieService.exportCookies(input.profileId, input.format);
    try {
      recordActivity('cookies:export', 'profile', input.profileId, { format: input.format });
    } catch {
      // Non-blocking
    }
    return result;
  });

  ipcMain.handle(IPC.COOKIES_IMPORT, async (_e, raw: unknown) => {
    const input = importCookiesSchema.parse(raw);
    const result = await CookieService.importCookies(input.profileId, input.content, input.format);
    try {
      recordActivity('cookies:import', 'profile', input.profileId, {
        format: input.format,
        count: result.count,
      });
    } catch {
      // Non-blocking
    }
    return result;
  });
}
