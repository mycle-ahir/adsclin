import { ipcMain } from 'electron';
import { IPC } from '../../shared/ipc';
import { bulkCreateProfilesSchema, bulkCreateProxiesSchema } from '../../shared/schemas';
import * as bulkService from './bulk-service';

export function registerBulkHandlers(): void {
  ipcMain.handle(IPC.PROFILE_BULK_CREATE, (_e, raw: unknown) => {
    const input = bulkCreateProfilesSchema.parse(raw);
    return bulkService.bulkCreateProfiles(input);
  });

  ipcMain.handle(IPC.PROXY_BULK_CREATE, (_e, raw: unknown) => {
    const input = bulkCreateProxiesSchema.parse({ proxies: raw });
    return bulkService.bulkCreateProxies(input.proxies);
  });
}
