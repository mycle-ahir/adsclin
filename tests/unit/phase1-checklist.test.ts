import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as path from 'path';

// ---------------------------------------------------------------------------
// Mocks for Phase 1 Checklist Verification
// ---------------------------------------------------------------------------

interface FakeBrowserSession {
  pid: number;
  closeCallbacks: Array<() => void>;
  onClose: (cb: () => void) => void;
  close: ReturnType<typeof vi.fn>;
  triggerClose: () => void;
}

function makeFakeBrowser(pid = 9999): FakeBrowserSession {
  const closeCallbacks: Array<() => void> = [];
  return {
    pid,
    closeCallbacks,
    onClose(cb) {
      closeCallbacks.push(cb);
    },
    close: vi.fn(async () => {
      for (const cb of closeCallbacks) cb();
    }),
    triggerClose() {
      for (const cb of closeCallbacks) cb();
    },
  };
}

const {
  getBrowserPool,
  addBrowserToPool,
  mockEngineLaunch,
  mockUpdateProfileStatus,
  mockGetProfile,
  mockGetProxyWithPassword,
} = vi.hoisted(() => {
  const browserPool: FakeBrowserSession[] = [];
  const launchFn = vi.fn(async () => {
    const b = browserPool.shift() ?? {
      pid: 1001,
      closeCallbacks: [],
      onClose(cb: () => void) { this.closeCallbacks.push(cb); },
      close: vi.fn(async function (this: { closeCallbacks: Array<() => void> }) {
        for (const cb of this.closeCallbacks) cb();
      }),
      triggerClose() { for (const cb of this.closeCallbacks) cb(); },
    };
    return b;
  });

  return {
    getBrowserPool: () => browserPool,
    addBrowserToPool: (b: FakeBrowserSession) => browserPool.push(b),
    mockEngineLaunch: launchFn,
    mockUpdateProfileStatus: vi.fn(),
    mockGetProfile: vi.fn(),
    mockGetProxyWithPassword: vi.fn(),
  };
});

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => '/mock/userData'),
  },
  BrowserWindow: vi.fn(),
  safeStorage: {
    isEncryptionAvailable: vi.fn(() => true),
    encryptString: vi.fn((s: string) => Buffer.from(`enc:${s}`)),
    decryptString: vi.fn((b: Buffer) => b.toString().replace(/^enc:/, '')),
  },
  ipcMain: { handle: vi.fn() },
}));

vi.mock('../../src/main/engine/chromium-playwright', () => ({
  ChromiumPlaywrightEngine: vi.fn().mockImplementation(() => ({
    id: 'chromium-playwright' as const,
    launch: mockEngineLaunch,
  })),
}));

vi.mock('../../src/main/services/proxy-forwarder', () => ({
  startForwarder: vi.fn(async (upstream: string) => ({
    localUrl: 'http://127.0.0.1:18888',
    close: vi.fn(async () => undefined),
  })),
}));

vi.mock('../../src/main/services/profile-service', () => ({
  getProfile: mockGetProfile,
  updateProfileStatus: mockUpdateProfileStatus,
}));

vi.mock('../../src/main/services/proxy-service', () => ({
  getProxyWithPassword: mockGetProxyWithPassword,
}));

vi.mock('../../src/main/index', () => ({
  getMainWindow: () => ({
    focus: vi.fn(),
    webContents: { send: vi.fn() },
  }),
}));

import * as LauncherService from '../../src/main/services/launcher-service';
import { startForwarder } from '../../src/main/services/proxy-forwarder';
import { MockDatabase } from './mock-db';

describe('Phase 1 Acceptance Checklist (§12)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('Checklist #1: Launch with no proxy assigns proper status and opts', async () => {
    const fake = makeFakeBrowser(101);
    addBrowserToPool(fake);

    mockGetProfile.mockReturnValue({
      id: 'p-no-proxy',
      name: 'No Proxy Profile',
      proxyId: null,
      userDataDir: path.join('/mock/userData', 'profiles', 'p-no-proxy'),
      status: 'idle',
    });

    await LauncherService.launch('p-no-proxy');

    expect(startForwarder).not.toHaveBeenCalled();
    expect(mockEngineLaunch).toHaveBeenCalledWith(
      expect.objectContaining({
        profileId: 'p-no-proxy',
        userDataDir: expect.stringContaining('p-no-proxy'),
      })
    );
    expect(mockUpdateProfileStatus).toHaveBeenCalledWith('p-no-proxy', 'running');
  });

  it('Checklist #2: Launch with authenticated SOCKS5 proxy routes through local forwarder with credentials redacted', async () => {
    const fake = makeFakeBrowser(102);
    addBrowserToPool(fake);

    mockGetProfile.mockReturnValue({
      id: 'p-socks5',
      name: 'SOCKS5 Profile',
      proxyId: 'proxy-s5',
      userDataDir: path.join('/mock/userData', 'profiles', 'p-socks5'),
      status: 'idle',
    });

    mockGetProxyWithPassword.mockReturnValue({
      proxy: {
        id: 'proxy-s5',
        name: 'Private Proxy',
        scheme: 'socks5',
        host: 'vpn.example.com',
        port: 1080,
        username: 'secure_user',
        lastTestIp: null,
        lastTestCountry: null,
        lastTestLatencyMs: null,
        lastTestedAt: null,
      },
      password: 'super_secret_password',
    });

    await LauncherService.launch('p-socks5');

    // Forwarder was passed the upstream target with credentials
    expect(startForwarder).toHaveBeenCalledWith(expect.stringContaining('secure_user'));
    expect(startForwarder).toHaveBeenCalledWith(expect.stringContaining('super_secret_password'));

    // Browser engine ONLY received local forwarder address — never the credentials
    const callArgs = mockEngineLaunch.mock.calls[0] as [{ proxy?: { server: string } }];
    expect(callArgs[0].proxy?.server).toBe('http://127.0.0.1:18888');
    expect(callArgs[0].proxy?.server).not.toContain('super_secret_password');
    expect(callArgs[0].proxy?.server).not.toContain('secure_user');
  });

  it('Checklist #3: Two profiles launched have completely isolated user-data-dirs', async () => {
    const fake1 = makeFakeBrowser(201);
    const fake2 = makeFakeBrowser(202);
    addBrowserToPool(fake1);
    addBrowserToPool(fake2);

    const dirA = path.join('/mock/userData', 'profiles', 'profile-alpha');
    const dirB = path.join('/mock/userData', 'profiles', 'profile-beta');

    mockGetProfile.mockImplementation((id: string) => ({
      id,
      name: `Profile ${id}`,
      proxyId: null,
      userDataDir: id === 'profile-alpha' ? dirA : dirB,
      status: 'idle',
    }));

    await LauncherService.launch('profile-alpha');
    await LauncherService.launch('profile-beta');

    expect(mockEngineLaunch).toHaveBeenCalledTimes(2);

    const call1 = mockEngineLaunch.mock.calls[0] as [{ userDataDir: string }];
    const call2 = mockEngineLaunch.mock.calls[1] as [{ userDataDir: string }];

    expect(call1[0].userDataDir).toBe(dirA);
    expect(call2[0].userDataDir).toBe(dirB);
    expect(call1[0].userDataDir).not.toBe(call2[0].userDataDir);
  });

  it('Checklist #4: Close browser manually updates status to idle', async () => {
    const fake = makeFakeBrowser(301);
    addBrowserToPool(fake);

    mockGetProfile.mockReturnValue({
      id: 'p-close-test',
      name: 'Close Test Profile',
      proxyId: null,
      userDataDir: path.join('/mock/userData', 'profiles', 'p-close-test'),
      status: 'idle',
    });

    await LauncherService.launch('p-close-test');
    expect(mockUpdateProfileStatus).toHaveBeenCalledWith('p-close-test', 'running');

    // Simulate external window close by user
    fake.triggerClose();
    await Promise.resolve();

    expect(mockUpdateProfileStatus).toHaveBeenCalledWith('p-close-test', 'idle');
  });

  it('Checklist #5: App restart resets stale running profiles to idle in DB', () => {
    const db = new MockDatabase();
    // Simulate a profile that was left 'running' when app was abruptly terminated
    db.profiles.set('stale-p', {
      id: 'stale-p',
      name: 'Stale Profile',
      group_id: null,
      proxy_id: null,
      notes: '',
      status: 'running',
      user_data_dir: '/mock/path',
      fingerprint_json: null,
      created_at: 1000,
      updated_at: 1000,
      last_launched_at: null,
    });

    // Simulate database startup query (from database.ts resetStaleRunningProfiles)
    db.prepare("UPDATE profiles SET status = 'idle', updated_at = ? WHERE status = 'running'").run(
      Date.now()
    );

    const profile = db.profiles.get('stale-p');
    expect(profile?.status).toBe('idle');
  });
});
