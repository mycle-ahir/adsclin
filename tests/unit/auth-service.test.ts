import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MockDatabase } from './mock-db';

let testDb: MockDatabase;

vi.mock('../../src/main/db/database', () => ({
  getDb: () => testDb,
}));

vi.mock('../../src/main/services/activity-service', () => ({
  recordActivity: vi.fn(),
}));

import {
  normalizeIdentifier,
  getDeviceId,
  loginUser,
  activateSubscription,
  CRYPTO_WALLETS,
} from '../../src/main/services/auth-service';

describe('auth-service and subscription logic', () => {
  beforeEach(() => {
    testDb = new MockDatabase();
  });

  it('normalizes valid email and phone number inputs properly', () => {
    expect(normalizeIdentifier('  User@Example.COM  ')).toBe('user@example.com');
    expect(normalizeIdentifier('+1 (555) 019-2834')).toBe('+15550192834');
    expect(() => normalizeIdentifier('abc')).toThrow(/Invalid email or phone number/);
    expect(() => normalizeIdentifier('')).toThrow(/Email or phone number is required/);
  });

  it('generates a persistent, deterministic deviceId', () => {
    const id1 = getDeviceId();
    const id2 = getDeviceId();
    expect(id1).toBeDefined();
    expect(typeof id1).toBe('string');
    expect(id1.length).toBeGreaterThan(10);
    expect(id1).toBe(id2);
  });

  it('grants a 30-day free trial to the first user on a new device', () => {
    const session = loginUser('alice@adsclin.com');
    expect(session.user).not.toBeNull();
    expect(session.user?.identifier).toBe('alice@adsclin.com');
    expect(session.user?.planType).toBe('trial');
    expect(session.isTrialActive).toBe(true);
    expect(session.canLaunchBrowser).toBe(true);
    expect(session.daysRemaining).toBe(30);
    expect(session.trialDeniedReason).toBeNull();

    // Verify database state
    const deviceRecord = testDb
      .prepare('SELECT * FROM device_records WHERE device_id = ?')
      .get(session.deviceId) as any;
    expect(deviceRecord).toBeDefined();
    expect(deviceRecord.first_user_id).toBe(session.user?.id);
    expect(deviceRecord.has_claimed_trial).toBe(1);
  });

  it('denies 30-day free trial to subsequent accounts created on the same hardware device', () => {
    // 1st user registers and claims trial
    const session1 = loginUser('first_account@adsclin.com');
    expect(session1.canLaunchBrowser).toBe(true);
    expect(session1.isTrialActive).toBe(true);

    // 2nd user tries to register on the same device
    const session2 = loginUser('second_account@adsclin.com');
    expect(session2.user).not.toBeNull();
    expect(session2.user?.planType).toBe('expired');
    expect(session2.isTrialActive).toBe(false);
    expect(session2.canLaunchBrowser).toBe(false);
    expect(session2.trialDeniedReason).toContain('already claimed the 1-month free trial');
  });

  it('allows subscription activation for $9/month plan via crypto', () => {
    // Register user who is expired
    const initialSession = loginUser('bob@adsclin.com');
    const userId = initialSession.user!.id;

    // Simulate crypto transaction activation
    const txHash = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
    const subSession = activateSubscription(userId, 'USDT_TRC20', txHash);

    expect(subSession.user?.planType).toBe('active');
    expect(subSession.isSubscriptionActive).toBe(true);
    expect(subSession.canLaunchBrowser).toBe(true);
    expect(subSession.daysRemaining).toBe(30);

    // Check transaction recorded in DB
    const tx = testDb
      .prepare('SELECT * FROM crypto_transactions WHERE user_id = ?')
      .get(userId) as any;
    expect(tx).toBeDefined();
    expect(tx.currency).toBe('USDT_TRC20');
    expect(tx.amount_usd).toBe(9.0);
    expect(tx.tx_hash).toBe(txHash);
    expect(tx.status).toBe('confirmed');
  });

  it('provides all required crypto wallets for the $9 plan (USDT TRC20, ERC20, BTC, ETH, SOL)', () => {
    const currencies = CRYPTO_WALLETS.map((w) => w.currency);
    expect(currencies).toContain('USDT_TRC20');
    expect(currencies).toContain('USDT_ERC20');
    expect(currencies).toContain('BTC');
    expect(currencies).toContain('ETH');
    expect(currencies).toContain('SOL');

    for (const w of CRYPTO_WALLETS) {
      expect(w.amountUsd).toBe(9.0);
      expect(w.address.length).toBeGreaterThan(15);
      expect(w.network).toBeDefined();
    }
  });
});
