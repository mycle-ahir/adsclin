import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Controllable fake RunningBrowser interface
// ---------------------------------------------------------------------------
interface FakeBrowser {
  pid: number | undefined;
  cdpEndpoint: string;
  closeCallbacks: Array<() => void>;
  onClose: (cb: () => void) => void;
  close: ReturnType<typeof vi.fn>;
  /** Simulate the browser being closed externally */
  triggerClose: () => void;
}

function makeFakeBrowser(pid = 1234): FakeBrowser {
  const closeCallbacks: Array<() => void> = [];
  const browser: FakeBrowser = {
    pid,
    cdpEndpoint: '',
    closeCallbacks,
    onClose(cb: () => void) {
      closeCallbacks.push(cb);
    },
    close: vi.fn(async () => {
      for (const cb of closeCallbacks) cb();
    }),
    triggerClose() {
      for (const cb of closeCallbacks) cb();
    },
  };
  return browser;
}

// ---------------------------------------------------------------------------
// Mocks — hoisted before imports
// ---------------------------------------------------------------------------

const {
  getFakeBrowser,
  setFakeBrowser,
  fakeForwarderClose,
  fakeForwarderLocalUrl,
  mockUpdateProfileStatus,
  mockGetProfile,
  mockGetProxyWithPassword,
  mockFocus,
  mockSend,
  mockEngineLaunch,
} = vi.hoisted(() => {
  let fakeBrowser: FakeBrowser | null = null;
  const fwdClose = vi.fn(async () => undefined);
  const fwdLocal = 'http://127.0.0.1:19999';
  const updateStatus = vi.fn();
  const getProf = vi.fn();
  const getProxy = vi.fn();
  const focus = vi.fn();
  const send = vi.fn();
  const mockEngineLaunch = vi.fn(async () => fakeBrowser);

  return {
    getFakeBrowser: () => fakeBrowser,
    setFakeBrowser: (b: FakeBrowser) => {
      fakeBrowser = b;
    },
    mockEngineLaunch,
    fakeForwarderClose: fwdClose,
    fakeForwarderLocalUrl: fwdLocal,
    mockUpdateProfileStatus: updateStatus,
    mockGetProfile: getProf,
    mockGetProxyWithPassword: getProxy,
    mockFocus: focus,
    mockSend: send,
  };
});

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn((_key: string) => '/mock/userData'),
  },
  BrowserWindow: vi.fn(),
  safeStorage: {
    isEncryptionAvailable: vi.fn(() => true),
    encryptString: vi.fn((s: string) => Buffer.from(`enc:${s}`)),
    decryptString: vi.fn((b: Buffer) => b.toString().replace(/^enc:/, '')),
  },
  ipcMain: {
    handle: vi.fn(),
  },
}));

vi.mock('../../src/main/engine/chromium-playwright', () => ({
  ChromiumPlaywrightEngine: vi.fn().mockImplementation(() => ({
    id: 'chromium-playwright' as const,
    launch: mockEngineLaunch,
  })),
}));

vi.mock('../../src/main/services/proxy-forwarder', () => ({
  startForwarder: vi.fn(async (_upstream: string) => ({
    localUrl: fakeForwarderLocalUrl,
    close: fakeForwarderClose,
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
    focus: mockFocus,
    webContents: { send: mockSend },
  }),
}));

// ---------------------------------------------------------------------------
// System under test
// ---------------------------------------------------------------------------
import * as LauncherService from '../../src/main/services/launcher-service';
import { startForwarder } from '../../src/main/services/proxy-forwarder';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeProfile(
  overrides: Partial<{
    id: string;
    proxyId: string | null;
    userDataDir: string;
    status: string;
  }> = {}
) {
  return {
    id: 'profile-1',
    name: 'Test Profile',
    groupId: null,
    proxyId: null,
    notes: '',
    status: 'idle' as const,
    userDataDir: '/mock/userData/profiles/profile-1',
    createdAt: 1000,
    updatedAt: 1000,
    lastLaunchedAt: null,
    tags: [],
    ...overrides,
  };
}

function makeProxy(scheme: 'http' | 'socks5', username: string | null = null) {
  return {
    id: 'proxy-1',
    name: 'Test Proxy',
    scheme,
    host: '10.0.0.1',
    port: scheme === 'http' ? 8080 : 1080,
    username,
    lastTestIp: null,
    lastTestCountry: null,
    lastTestLatencyMs: null,
    lastTestedAt: null,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('launcher-service', () => {
  let fakeBrowser: FakeBrowser;

  beforeEach(async () => {
    vi.clearAllMocks();
    fakeBrowser = makeFakeBrowser();
    setFakeBrowser(fakeBrowser);
  });

  // -------------------------------------------------------------------------
  // 1. Launch with no proxy
  // -------------------------------------------------------------------------
  it('1. launch() with no proxy — engine called with no proxy option, status set to running', async () => {
    mockGetProfile.mockReturnValue(makeProfile({ id: 'profile-a', proxyId: null }));

    await LauncherService.launch('profile-a');

    expect(startForwarder).not.toHaveBeenCalled();
    expect(mockUpdateProfileStatus).toHaveBeenCalledWith('profile-a', 'running');
    expect(mockSend).toHaveBeenCalledWith('profile:statusChanged', 'profile-a', 'running');
  });

  // -------------------------------------------------------------------------
  // 2. Launch with unauthenticated HTTP proxy
  // -------------------------------------------------------------------------
  it('2. launch() with unauthenticated HTTP proxy — forwarder started, engine gets local URL', async () => {
    mockGetProfile.mockReturnValue(makeProfile({ id: 'profile-b', proxyId: 'proxy-1' }));
    mockGetProxyWithPassword.mockReturnValue({
      proxy: makeProxy('http', null),
      password: null,
    });

    await LauncherService.launch('profile-b');

    expect(startForwarder).toHaveBeenCalledWith('http://10.0.0.1:8080');
    expect(mockUpdateProfileStatus).toHaveBeenCalledWith('profile-b', 'running');
  });

  // -------------------------------------------------------------------------
  // 3. Launch with authenticated SOCKS5 proxy — credentials NOT in engine opts
  // -------------------------------------------------------------------------
  it('3. launch() with authenticated SOCKS5 proxy — forwarder started, credentials NOT in engine opts', async () => {
    mockGetProfile.mockReturnValue(makeProfile({ id: 'profile-c', proxyId: 'proxy-1' }));
    mockGetProxyWithPassword.mockReturnValue({
      proxy: makeProxy('socks5', 'alice'),
      password: 'secret',
    });

    await LauncherService.launch('profile-c');

    expect(startForwarder).toHaveBeenCalledWith(expect.stringContaining('alice'));
    expect(startForwarder).toHaveBeenCalledWith(expect.stringContaining('secret'));

    const launchCall = mockEngineLaunch.mock.calls[0] as [{ proxy?: { server: string } }];
    const launchOpts = launchCall[0];
    expect(launchOpts.proxy?.server).toBe(fakeForwarderLocalUrl);
    expect(launchOpts.proxy?.server).not.toContain('alice');
    expect(launchOpts.proxy?.server).not.toContain('secret');

    expect(mockUpdateProfileStatus).toHaveBeenCalledWith('profile-c', 'running');
  });

  // -------------------------------------------------------------------------
  // 4. Launch same profile twice — second call focuses window, no duplicate launch
  // -------------------------------------------------------------------------
  it('4. launch() same profile twice — second call focuses window, no duplicate launch', async () => {
    mockGetProfile.mockReturnValue(makeProfile({ id: 'profile-d', proxyId: null }));

    await LauncherService.launch('profile-d');
    await LauncherService.launch('profile-d');

    expect(mockEngineLaunch).toHaveBeenCalledTimes(1);
    expect(mockFocus).toHaveBeenCalledTimes(1);
  });

  // -------------------------------------------------------------------------
  // 5. stop() — browser.close() called, status set to idle
  // -------------------------------------------------------------------------
  it('5. stop() — browser.close() called, status set to idle', async () => {
    mockGetProfile.mockReturnValue(makeProfile({ id: 'profile-e', proxyId: null }));

    await LauncherService.launch('profile-e');
    vi.clearAllMocks();

    await LauncherService.stop('profile-e');

    expect(fakeBrowser.close).toHaveBeenCalledTimes(1);
    expect(mockUpdateProfileStatus).toHaveBeenCalledWith('profile-e', 'idle');
    expect(mockSend).toHaveBeenCalledWith('profile:statusChanged', 'profile-e', 'idle');
  });

  // -------------------------------------------------------------------------
  // 6. Browser closes externally → status set to idle, forwarder closed
  // -------------------------------------------------------------------------
  it('6. external browser close — status set to idle, forwarder closed', async () => {
    mockGetProfile.mockReturnValue(makeProfile({ id: 'profile-f', proxyId: 'proxy-1' }));
    mockGetProxyWithPassword.mockReturnValue({
      proxy: makeProxy('http', null),
      password: null,
    });

    await LauncherService.launch('profile-f');
    vi.clearAllMocks();

    fakeBrowser.triggerClose();

    await Promise.resolve();

    expect(mockUpdateProfileStatus).toHaveBeenCalledWith('profile-f', 'idle');
    expect(mockSend).toHaveBeenCalledWith('profile:statusChanged', 'profile-f', 'idle');
    expect(fakeForwarderClose).toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Edge: stop() on non-running profile is a no-op
  // -------------------------------------------------------------------------
  it('stop() on non-running profile is a no-op — does not throw', async () => {
    await expect(LauncherService.stop('nonexistent-profile')).resolves.toBeUndefined();
  });

  // -------------------------------------------------------------------------
  // Edge: launch() throws when profile not found
  // -------------------------------------------------------------------------
  it('launch() throws when profile not found', async () => {
    mockGetProfile.mockReturnValue(null);
    await expect(LauncherService.launch('ghost')).rejects.toThrow('Profile not found: ghost');
  });
});
