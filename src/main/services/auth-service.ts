import * as crypto from 'crypto';
import * as os from 'os';
import { execSync } from 'child_process';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db/database';
import { recordActivity } from './activity-service';
import { seedDemoProfilesIfEmpty } from './profile-service';
import { syncUserWithSupabase } from './supabase-service';
import type { User, AuthSession, CryptoCurrency, CryptoWalletInfo, PlanType } from '../../shared/types';

// Supported Crypto Wallets for the $9/month Adsclin plan
export const CRYPTO_WALLETS: CryptoWalletInfo[] = [
  {
    currency: 'USDT_TRC20',
    network: 'TRON (TRC20)',
    name: 'Tether USD',
    address: 'TX6WwKzZ1m9Y8sE4L7c5Q2p3R9v8D1j4kM',
    amountUsd: 9.0,
    qrPayload: 'tron:TX6WwKzZ1m9Y8sE4L7c5Q2p3R9v8D1j4kM?amount=9.00',
  },
  {
    currency: 'USDT_ERC20',
    network: 'Ethereum (ERC20)',
    name: 'Tether USD',
    address: '0x71C8A36eF090680A90F60c0E6F0b7B2e8D8E9A21',
    amountUsd: 9.0,
    qrPayload: 'ethereum:0x71C8A36eF090680A90F60c0E6F0b7B2e8D8E9A21?value=9.00',
  },
  {
    currency: 'BTC',
    network: 'Bitcoin Native SegWit',
    name: 'Bitcoin',
    address: 'bc1q9v8d1j4km7c5q2p3r9v8d1j4km7c5q2p3r',
    amountUsd: 9.0,
    qrPayload: 'bitcoin:bc1q9v8d1j4km7c5q2p3r9v8d1j4km7c5q2p3r?amount=0.00014',
  },
  {
    currency: 'ETH',
    network: 'Ethereum Mainnet',
    name: 'Ethereum',
    address: '0x71C8A36eF090680A90F60c0E6F0b7B2e8D8E9A21',
    amountUsd: 9.0,
    qrPayload: 'ethereum:0x71C8A36eF090680A90F60c0E6F0b7B2e8D8E9A21?value=0.0035',
  },
  {
    currency: 'SOL',
    network: 'Solana Network',
    name: 'Solana',
    address: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
    amountUsd: 9.0,
    qrPayload: 'solana:7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU?amount=0.06',
  },
];

let cachedDeviceId: string | null = null;

/**
 * Returns a hardware-locked, persistent Device ID for this machine.
 * Combines Windows MachineGuid / primary MAC / OS hardware identifiers.
 */
export function getDeviceId(): string {
  if (cachedDeviceId) return cachedDeviceId;

  let raw = '';
  if (process.platform === 'win32') {
    try {
      const out = execSync(
        'reg query HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Cryptography /v MachineGuid',
        { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 1500 }
      );
      const match = out.match(/MachineGuid\s+REG_SZ\s+([a-f0-9-]+)/i);
      if (match && match[1]) raw = match[1].trim();
    } catch {
      // Fall through to MAC
    }
  }

  if (!raw) {
    const nics = os.networkInterfaces();
    for (const name of Object.keys(nics)) {
      for (const net of nics[name] || []) {
        if (!net.internal && net.mac && net.mac !== '00:00:00:00:00:00') {
          raw += net.mac;
          break;
        }
      }
      if (raw) break;
    }
  }

  if (!raw) {
    raw = `${os.hostname()}-${os.platform()}-${os.arch()}`;
  }

  cachedDeviceId = 'dev_' + crypto.createHash('sha256').update(raw).digest('hex').slice(0, 24);
  return cachedDeviceId;
}

interface UserRow {
  id: string;
  identifier: string;
  device_id: string;
  plan_type: string;
  trial_ends_at: number;
  subscription_ends_at: number | null;
  created_at: number;
  last_login_at: number;
}

function rowToUser(row: UserRow): User {
  return {
    id: row.id,
    identifier: row.identifier,
    deviceId: row.device_id,
    planType: row.plan_type as PlanType,
    trialEndsAt: row.trial_ends_at,
    subscriptionEndsAt: row.subscription_ends_at,
    createdAt: row.created_at,
    lastLoginAt: row.last_login_at,
  };
}

export function buildSessionFromUser(user: User | null, trialDeniedReason?: string | null): AuthSession {
  const deviceId = getDeviceId();
  if (!user) {
    return {
      user: null,
      deviceId,
      isTrialActive: false,
      isSubscriptionActive: false,
      daysRemaining: 0,
      canLaunchBrowser: false,
      trialDeniedReason: trialDeniedReason ?? null,
    };
  }

  const now = Date.now();
  const isSubscriptionActive =
    user.subscriptionEndsAt !== null && user.subscriptionEndsAt > now;
  const isTrialActive =
    user.planType === 'trial' && user.trialEndsAt > now;

  let daysRemaining = 0;
  if (isSubscriptionActive && user.subscriptionEndsAt) {
    daysRemaining = Math.max(0, Math.ceil((user.subscriptionEndsAt - now) / (1000 * 60 * 60 * 24)));
  } else if (isTrialActive) {
    daysRemaining = Math.max(0, Math.ceil((user.trialEndsAt - now) / (1000 * 60 * 60 * 24)));
  }

  const canLaunchBrowser = isSubscriptionActive || isTrialActive;

  return {
    user,
    deviceId,
    isTrialActive,
    isSubscriptionActive,
    daysRemaining,
    canLaunchBrowser,
    trialDeniedReason: trialDeniedReason ?? null,
  };
}

/**
 * Returns current authenticated session.
 */
export function getCurrentSession(): AuthSession {
  try {
    const db = getDb();
    const row = db
      .prepare('SELECT * FROM users WHERE last_login_at > 0 ORDER BY last_login_at DESC LIMIT 1')
      .get() as UserRow | undefined;

    if (!row) {
      return buildSessionFromUser(null);
    }

    return buildSessionFromUser(rowToUser(row));
  } catch {
    return buildSessionFromUser(null);
  }
}

/**
 * Validates and normalizes user identifier (email or phone number).
 */
export function normalizeIdentifier(rawIdentifier: string): string {
  const trimmed = rawIdentifier.trim();
  if (!trimmed) {
    throw new Error('Email or phone number is required.');
  }

  const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
  const isPhone = /^\+?[0-9\s\-()]{7,20}$/.test(trimmed);

  if (!isEmail && !isPhone) {
    throw new Error('Invalid email or phone number format. Please provide a valid email or phone number.');
  }

  if (isEmail) {
    return trimmed.toLowerCase();
  }

  // Normalize phone number (strip whitespace, dashes, parentheses)
  return trimmed.replace(/[\s\-()]/g, '');
}

/**
 * Logs in with email or phone number.
 * Automatically provisions a 1-month free trial if this physical device
 * has not previously claimed a trial.
 * If this device already claimed a trial on another account, trial is denied.
 */
export function loginUser(rawIdentifier: string): AuthSession {
  const identifier = normalizeIdentifier(rawIdentifier);

  const db = getDb();
  const deviceId = getDeviceId();
  const now = Date.now();

  // Check if user already exists
  const existingUser = db
    .prepare('SELECT * FROM users WHERE identifier = ?')
    .get(identifier) as UserRow | undefined;

  if (existingUser) {
    // Existing user: update last login and current device
    db.prepare('UPDATE users SET last_login_at = ?, device_id = ? WHERE id = ?')
      .run(now, deviceId, existingUser.id);

    const updated = db
      .prepare('SELECT * FROM users WHERE id = ?')
      .get(existingUser.id) as UserRow;

    try {
      recordActivity('auth:login', 'auth', updated.id, { identifier, deviceId });
    } catch {}

    try {
      void syncUserWithSupabase(rowToUser(updated));
    } catch {}

    return buildSessionFromUser(rowToUser(updated));
  }

  // New user registration — Check device hardware lock
  const deviceRecord = db
    .prepare('SELECT * FROM device_records WHERE device_id = ?')
    .get(deviceId) as { device_id: string; first_user_id: string; has_claimed_trial: number } | undefined;

  const newUserId = uuidv4();

  if (deviceRecord && deviceRecord.has_claimed_trial === 1) {
    // Hardware ID already consumed the free trial on another account!
    // Free trial is NOT available on this device.
    const trialEndsAt = now; // Expired immediately
    db.prepare(`
      INSERT INTO users (id, identifier, device_id, plan_type, trial_ends_at, subscription_ends_at, created_at, last_login_at)
      VALUES (?, ?, ?, 'expired', ?, NULL, ?, ?)
    `).run(newUserId, identifier, deviceId, trialEndsAt, now, now);

    const userRow = db.prepare('SELECT * FROM users WHERE id = ?').get(newUserId) as UserRow;

    try {
      recordActivity('auth:register_denied_trial', 'auth', newUserId, { identifier, deviceId });
    } catch {}

    return buildSessionFromUser(
      rowToUser(userRow),
      'This device has already claimed the 1-month free trial on an earlier account. Please subscribe to the $9/month plan to activate browser sessions.'
    );
  }

  // Device is eligible for 1-month free trial! (30 days)
  const ONE_MONTH_MS = 30 * 24 * 60 * 60 * 1000;
  const trialEndsAt = now + ONE_MONTH_MS;

  db.transaction(() => {
    // Insert new user with active trial
    db.prepare(`
      INSERT INTO users (id, identifier, device_id, plan_type, trial_ends_at, subscription_ends_at, created_at, last_login_at)
      VALUES (?, ?, ?, 'trial', ?, NULL, ?, ?)
    `).run(newUserId, identifier, deviceId, trialEndsAt, now, now);

    // Lock device hardware record so no other account on this machine can claim free trial
    db.prepare(`
      INSERT OR REPLACE INTO device_records (device_id, first_user_id, has_claimed_trial, first_claimed_at)
      VALUES (?, ?, 1, ?)
    `).run(deviceId, newUserId, now);
  })();

  const createdUser = db.prepare('SELECT * FROM users WHERE id = ?').get(newUserId) as UserRow;

  try {
    seedDemoProfilesIfEmpty();
  } catch {}

  try {
    recordActivity('auth:register_trial', 'auth', newUserId, { identifier, deviceId, trialDays: 30 });
  } catch {}

  try {
    void syncUserWithSupabase(rowToUser(createdUser));
  } catch {}

  return buildSessionFromUser(rowToUser(createdUser));
}

/**
 * Logs out the active user.
 */
export function logoutUser(): void {
  const db = getDb();
  try {
    db.prepare('UPDATE users SET last_login_at = 0').run();
  } catch {}
}

/**
 * Activates or extends a $9/month subscription via Crypto transaction.
 */
export function activateSubscription(
  userId: string,
  currency: CryptoCurrency,
  txHash: string
): AuthSession {
  const cleanTx = txHash.trim();
  if (cleanTx.length < 8) {
    throw new Error('Please enter a valid crypto transaction hash (TXID) from your wallet.');
  }

  const db = getDb();
  const userRow = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as UserRow | undefined;
  if (!userRow) {
    throw new Error('User account not found.');
  }

  const now = Date.now();
  const ONE_MONTH_MS = 30 * 24 * 60 * 60 * 1000;

  // If user already has an active subscription, extend from existing end date; otherwise from now
  const baseTime =
    userRow.subscription_ends_at && userRow.subscription_ends_at > now
      ? userRow.subscription_ends_at
      : now;
  const newSubEnd = baseTime + ONE_MONTH_MS;

  const txId = uuidv4();

  db.transaction(() => {
    db.prepare(`
      INSERT INTO crypto_transactions (id, user_id, currency, amount_usd, tx_hash, status, created_at)
      VALUES (?, ?, ?, 9.0, ?, 'completed', ?)
    `).run(txId, userId, currency, cleanTx, now);

    db.prepare(`
      UPDATE users
      SET plan_type = 'active', subscription_ends_at = ?, last_login_at = ?
      WHERE id = ?
    `).run(newSubEnd, now, userId);
  })();

  const updatedUser = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as UserRow;

  try {
    recordActivity('subscription:crypto_activate', 'auth', userId, {
      currency,
      amountUsd: 9.0,
      txHash: cleanTx,
      newSubEnd,
    });
  } catch {}

  return buildSessionFromUser(rowToUser(updatedUser));
}

/**
 * Verifies if browser launching is allowed under trial or subscription.
 */
export function verifyLaunchAllowed(): void {
  const session = getCurrentSession();
  if (!session.user) {
    throw new Error('Login required. Please sign in with your email or phone number to access Adsclin.');
  }
  if (!session.canLaunchBrowser) {
    throw new Error('Subscription required. Your free trial has ended. Please subscribe to the $9/month plan to launch browser sessions.');
  }
}
