import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  calculateTileBounds,
  launchGroup,
  stopGroup,
  launch,
} from '../../src/main/services/launcher-service';
import type { Profile } from '../../src/shared/types';
import type { LaunchOptions } from '../../src/main/engine/browser-engine';

// Hoisted mocks
const {
  mockListProfiles,
  mockGetProfile,
  mockUpdateProfileStatus,
  mockEngineLaunch,
} = vi.hoisted(() => {
  const mockListProfiles = vi.fn();
  const mockGetProfile = vi.fn();
  const mockUpdateProfileStatus = vi.fn();
  const mockEngineLaunch = vi.fn();
  return {
    mockListProfiles,
    mockGetProfile,
    mockUpdateProfileStatus,
    mockEngineLaunch,
  };
});

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => '/mock/userData'),
  },
  screen: {
    getPrimaryDisplay: vi.fn(() => ({
      workArea: { x: 0, y: 0, width: 1920, height: 1080 },
    })),
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
  startForwarder: vi.fn(async () => ({
    localUrl: 'http://127.0.0.1:19999',
    close: vi.fn(),
  })),
}));

vi.mock('../../src/main/services/profile-service', () => ({
  listProfiles: mockListProfiles,
  getProfile: mockGetProfile,
  updateProfileStatus: mockUpdateProfileStatus,
}));

vi.mock('../../src/main/services/proxy-service', () => ({
  getProxyWithPassword: vi.fn(),
}));

vi.mock('../../src/main/index', () => ({
  getMainWindow: () => null,
}));

function makeFakeBrowser(pid = 1234) {
  const closeCallbacks: Array<() => void> = [];
  return {
    pid,
    cdpEndpoint: 'ws://127.0.0.1:1234/devtools/browser/abc',
    onClose: (cb: () => void) => closeCallbacks.push(cb),
    close: vi.fn(async () => {
      for (const cb of closeCallbacks) cb();
    }),
  };
}

describe('Launch Groups & Window Tiling (§8)', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await stopGroup('grp-test-1');
    await stopGroup('grp-stop');
  });

  describe('calculateTileBounds', () => {
    it('returns empty array when count <= 0', () => {
      expect(calculateTileBounds(0)).toEqual([]);
      expect(calculateTileBounds(-1)).toEqual([]);
    });

    it('tiles 1 window to full screen', () => {
      const bounds = calculateTileBounds(1, { x: 0, y: 0, width: 1920, height: 1080 });
      expect(bounds).toHaveLength(1);
      expect(bounds[0]).toEqual({ x: 0, y: 0, width: 1920, height: 1080 });
    });

    it('tiles 2 windows side-by-side (2x1 grid)', () => {
      const bounds = calculateTileBounds(2, { x: 0, y: 0, width: 1920, height: 1080 });
      expect(bounds).toHaveLength(2);
      expect(bounds[0]).toEqual({ x: 0, y: 0, width: 960, height: 1080 });
      expect(bounds[1]).toEqual({ x: 960, y: 0, width: 960, height: 1080 });
    });

    it('tiles 4 windows in a 2x2 grid', () => {
      const bounds = calculateTileBounds(4, { x: 0, y: 0, width: 1920, height: 1080 });
      expect(bounds).toHaveLength(4);
      // Top left
      expect(bounds[0]).toEqual({ x: 0, y: 0, width: 960, height: 540 });
      // Top right
      expect(bounds[1]).toEqual({ x: 960, y: 0, width: 960, height: 540 });
      // Bottom left
      expect(bounds[2]).toEqual({ x: 0, y: 540, width: 960, height: 540 });
      // Bottom right
      expect(bounds[3]).toEqual({ x: 960, y: 540, width: 960, height: 540 });
    });

    it('tiles 6 windows in a 3x2 grid', () => {
      const bounds = calculateTileBounds(6, { x: 0, y: 0, width: 1920, height: 1080 });
      expect(bounds).toHaveLength(6);
      expect(bounds[0]).toEqual({ x: 0, y: 0, width: 640, height: 540 });
      expect(bounds[1]).toEqual({ x: 640, y: 0, width: 640, height: 540 });
      expect(bounds[2]).toEqual({ x: 1280, y: 0, width: 640, height: 540 });
      expect(bounds[3]).toEqual({ x: 0, y: 540, width: 640, height: 540 });
      expect(bounds[4]).toEqual({ x: 640, y: 540, width: 640, height: 540 });
      expect(bounds[5]).toEqual({ x: 1280, y: 540, width: 640, height: 540 });
    });

    it('respects non-zero screen offsets', () => {
      const bounds = calculateTileBounds(2, { x: 100, y: 50, width: 1600, height: 900 });
      expect(bounds).toHaveLength(2);
      expect(bounds[0]).toEqual({ x: 100, y: 50, width: 800, height: 900 });
      expect(bounds[1]).toEqual({ x: 900, y: 50, width: 800, height: 900 });
    });
  });

  describe('launchGroup', () => {
    const mockProfiles: Profile[] = [
      {
        id: 'p-group-1',
        name: 'Profile G1',
        groupId: 'grp-test-1',
        proxyId: null,
        notes: '',
        status: 'idle',
        userDataDir: '/tmp/profiles/p-group-1',
        createdAt: 1000,
        updatedAt: 1000,
        lastLaunchedAt: null,
        tags: [],
        extensions: ['/extensions/adblock'],
      },
      {
        id: 'p-group-2',
        name: 'Profile G2',
        groupId: 'grp-test-1',
        proxyId: null,
        notes: '',
        status: 'idle',
        userDataDir: '/tmp/profiles/p-group-2',
        createdAt: 2000,
        updatedAt: 2000,
        lastLaunchedAt: null,
        tags: [],
        extensions: [],
      },
      {
        id: 'p-other',
        name: 'Profile Other',
        groupId: 'grp-other',
        proxyId: null,
        notes: '',
        status: 'idle',
        userDataDir: '/tmp/profiles/p-other',
        createdAt: 3000,
        updatedAt: 3000,
        lastLaunchedAt: null,
        tags: [],
      },
    ];

    it('launches all profiles in group with window bounds when tile=true', async () => {
      mockListProfiles.mockReturnValue(mockProfiles);
      mockGetProfile.mockImplementation((id: string) => mockProfiles.find((p) => p.id === id) ?? null);
      mockEngineLaunch.mockImplementation(async () => makeFakeBrowser());

      const launchedIds = await launchGroup('grp-test-1', { tile: true });

      expect(launchedIds).toEqual(['p-group-1', 'p-group-2']);
      expect(mockEngineLaunch).toHaveBeenCalledTimes(2);

      // Profile 1 call check (left tile + extension path)
      const call1Opts = mockEngineLaunch.mock.calls[0][0] as LaunchOptions;
      expect(call1Opts.profileId).toBe('p-group-1');
      expect(call1Opts.extensions).toEqual(['/extensions/adblock']);
      expect(call1Opts.windowBounds).toEqual({ x: 0, y: 0, width: 960, height: 1080 });

      // Profile 2 call check (right tile)
      const call2Opts = mockEngineLaunch.mock.calls[1][0] as LaunchOptions;
      expect(call2Opts.profileId).toBe('p-group-2');
      expect(call2Opts.windowBounds).toEqual({ x: 960, y: 0, width: 960, height: 1080 });

      await stopGroup('grp-test-1');
    });

    it('launches without tiling bounds when tile=false', async () => {
      mockListProfiles.mockReturnValue(mockProfiles);
      mockGetProfile.mockImplementation((id: string) => mockProfiles.find((p) => p.id === id) ?? null);
      mockEngineLaunch.mockImplementation(async () => makeFakeBrowser());

      const launchedIds = await launchGroup('grp-test-1', { tile: false });

      expect(launchedIds).toEqual(['p-group-1', 'p-group-2']);
      expect(mockEngineLaunch).toHaveBeenCalledTimes(2);

      const call1Opts = mockEngineLaunch.mock.calls[0][0] as LaunchOptions;
      expect(call1Opts.windowBounds).toBeUndefined();
    });

    it('returns empty array when group has no matching profiles', async () => {
      mockListProfiles.mockReturnValue(mockProfiles);
      const launchedIds = await launchGroup('nonexistent-group', { tile: true });
      expect(launchedIds).toEqual([]);
      expect(mockEngineLaunch).not.toHaveBeenCalled();
    });
  });

  describe('stopGroup', () => {
    it('stops only running profiles in the specified group', async () => {
      const mockProfiles: Profile[] = [
        {
          id: 'p-stop-1',
          name: 'P1',
          groupId: 'grp-stop',
          proxyId: null,
          notes: '',
          status: 'idle',
          userDataDir: '/tmp/p1',
          createdAt: 1000,
          updatedAt: 1000,
          lastLaunchedAt: null,
          tags: [],
        },
      ];

      mockListProfiles.mockReturnValue(mockProfiles);
      mockGetProfile.mockImplementation((id: string) => mockProfiles.find((p) => p.id === id) ?? null);

      const fakeBrowser = makeFakeBrowser();
      mockEngineLaunch.mockResolvedValue(fakeBrowser);

      // Launch p-stop-1 so it becomes running
      await launch('p-stop-1');

      // Now stop the group
      const stoppedIds = await stopGroup('grp-stop');
      expect(stoppedIds).toEqual(['p-stop-1']);
      expect(fakeBrowser.close).toHaveBeenCalledTimes(1);
    });
  });
});
