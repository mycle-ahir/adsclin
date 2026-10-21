import { ipcMain, dialog } from 'electron';
import { IPC } from '../../shared/ipc';
import { createProfileSchema, updateProfileSchema, createGroupSchema } from '../../shared/schemas';
import * as ProfileService from './profile-service';
import { getMainWindow } from '../index';

export function registerProfileHandlers(): void {
  ipcMain.handle(IPC.PROFILE_SEED_DEMO, (_e, force?: boolean) => {
    ProfileService.seedDemoProfilesIfEmpty(Boolean(force));
  });

  ipcMain.handle(IPC.PROFILE_CREATE, (_e, raw: unknown) => {
    const input = createProfileSchema.parse(raw);
    return ProfileService.createProfile(input);
  });

  ipcMain.handle(IPC.PROFILE_LIST, () => ProfileService.listProfiles());

  ipcMain.handle(IPC.PROFILE_DELETE, (_e, id: unknown) => {
    if (typeof id !== 'string') throw new Error('id must be a string');
    ProfileService.deleteProfile(id);
  });

  ipcMain.handle(IPC.PROFILE_UPDATE, (_e, raw: unknown) => {
    const input = updateProfileSchema.parse(raw);
    return ProfileService.updateProfile(input);
  });

  ipcMain.handle(IPC.PROFILE_DUPLICATE, (_e, id: unknown) => {
    if (typeof id !== 'string') throw new Error('id must be a string');
    return ProfileService.duplicateProfile(id);
  });

  ipcMain.handle(IPC.PROFILE_SELECT_EXTENSION_DIR, async () => {
    const win = getMainWindow();
    const result = win
      ? await dialog.showOpenDialog(win, {
          title: 'Select Unpacked Extension Directory',
          properties: ['openDirectory'],
        })
      : await dialog.showOpenDialog({
          title: 'Select Unpacked Extension Directory',
          properties: ['openDirectory'],
        });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }
    return result.filePaths[0];
  });

  // groups
  ipcMain.handle(IPC.GROUP_CREATE, (_e, raw: unknown) => {
    const input = createGroupSchema.parse(raw);
    return ProfileService.createGroup(input);
  });

  ipcMain.handle(IPC.GROUP_LIST, () => ProfileService.listGroups());

  ipcMain.handle(IPC.GROUP_DELETE, (_e, id: unknown) => {
    if (typeof id !== 'string') throw new Error('id must be a string');
    ProfileService.deleteGroup(id);
  });
}
