import { ipcMain } from 'electron';
import { IPC } from '../../shared/ipc';
import type { ActivityEntityType } from '../../shared/types';
import * as activityService from './activity-service';

export function registerActivityHandlers(): void {
  ipcMain.handle(
    IPC.ACTIVITY_LIST,
    (_e, raw?: { limit?: number; offset?: number; entityType?: ActivityEntityType }) => {
      return activityService.listActivities(raw);
    }
  );
}
