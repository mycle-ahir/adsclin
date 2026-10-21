import { ipcMain } from 'electron';
import { IPC } from '../../shared/ipc';
import { createProxySchema, updateProxySchema } from '../../shared/schemas';
import * as ProxyService from './proxy-service';

export function registerProxyHandlers(): void {
  ipcMain.handle(IPC.PROXY_CREATE, (_e, raw: unknown) => {
    const input = createProxySchema.parse(raw);
    return ProxyService.createProxy(input);
  });

  ipcMain.handle(IPC.PROXY_LIST, () => ProxyService.listProxies());

  ipcMain.handle(IPC.PROXY_DELETE, (_e, id: unknown) => {
    if (typeof id !== 'string') throw new Error('id must be a string');
    ProxyService.deleteProxy(id);
  });

  ipcMain.handle(IPC.PROXY_UPDATE, (_e, raw: unknown) => {
    const input = updateProxySchema.parse(raw);
    return ProxyService.updateProxy(input);
  });

  ipcMain.handle(IPC.PROXY_TEST, async (_e, id: unknown) => {
    if (typeof id !== 'string') throw new Error('id must be a string');
    return ProxyService.testProxy(id);
  });
}
