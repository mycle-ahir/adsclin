import { ipcMain } from 'electron';
import {
  getCurrentSession,
  loginUser,
  logoutUser,
  CRYPTO_WALLETS,
  activateSubscription,
} from './auth-service';
import type { CryptoCurrency } from '../../shared/types';

export function registerAuthHandlers(): void {
  ipcMain.handle('auth:getSession', () => {
    return getCurrentSession();
  });

  ipcMain.handle('auth:login', (_event, identifier: unknown) => {
    if (typeof identifier !== 'string') {
      throw new Error('Identifier must be a string');
    }
    return loginUser(identifier);
  });

  ipcMain.handle('auth:logout', () => {
    logoutUser();
    return getCurrentSession();
  });

  ipcMain.handle('auth:getWallets', () => {
    return CRYPTO_WALLETS;
  });

  ipcMain.handle(
    'auth:activateSubscription',
    (_event, payload: { userId: string; currency: CryptoCurrency; txHash: string }) => {
      if (!payload || !payload.userId || !payload.currency || !payload.txHash) {
        throw new Error('Invalid subscription activation payload');
      }
      return activateSubscription(payload.userId, payload.currency, payload.txHash);
    }
  );
}
