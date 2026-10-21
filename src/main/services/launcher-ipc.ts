/**
 * Registers IPC handlers for the launcher channels.
 * Must be called once after the database is initialized (inside registerIpcHandlers).
 */

import { ipcMain } from 'electron';
import { IPC } from '../../shared/ipc';
import { launchGroupSchema, stopGroupSchema } from '../../shared/schemas';
import * as LauncherService from './launcher-service';

export function registerLauncherHandlers(): void {
  ipcMain.handle(IPC.LAUNCHER_LAUNCH, async (_e, id: unknown) => {
    if (typeof id !== 'string') throw new Error('profileId must be a string');
    await LauncherService.launch(id);
  });

  ipcMain.handle(IPC.LAUNCHER_STOP, async (_e, id: unknown) => {
    if (typeof id !== 'string') throw new Error('profileId must be a string');
    await LauncherService.stop(id);
  });

  ipcMain.handle(IPC.GROUP_LAUNCH, async (_e, raw: unknown) => {
    const input = launchGroupSchema.parse(raw);
    return LauncherService.launchGroup(input.groupId, { tile: input.tile });
  });

  ipcMain.handle(IPC.GROUP_STOP, async (_e, raw: unknown) => {
    const input = stopGroupSchema.parse(raw);
    return LauncherService.stopGroup(input.groupId);
  });
}
