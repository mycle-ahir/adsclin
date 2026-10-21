import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { BrowserCookie } from '../../src/shared/types';
import {
  parseJsonCookies,
  serializeJsonCookies,
  parseNetscapeCookies,
  serializeNetscapeCookies,
  exportCookies,
  importCookies,
} from '../../src/main/services/cookie-service';

// Mock dependencies
const mockGetProfile = vi.fn();
const mockGetRunningBrowser = vi.fn();
const mockEngineGetCookies = vi.fn();
const mockEngineAddCookies = vi.fn();

vi.mock('../../src/main/services/profile-service', () => ({
  getProfile: (id: string) => mockGetProfile(id),
}));

vi.mock('../../src/main/services/launcher-service', () => ({
  getRunningBrowser: (id: string) => mockGetRunningBrowser(id),
}));

vi.mock('../../src/main/engine/chromium-playwright', () => ({
  ChromiumPlaywrightEngine: vi.fn().mockImplementation(() => ({
    getCookies: (dir: string) => mockEngineGetCookies(dir),
    addCookies: (dir: string, cookies: BrowserCookie[]) => mockEngineAddCookies(dir, cookies),
  })),
}));

describe('Cookie Service (§8)', () => {
  const sampleCookies: BrowserCookie[] = [
    {
      name: 'session_token',
      value: 'abc123xyz',
      domain: '.example.com',
      path: '/',
      expires: 1800000000,
      httpOnly: true,
      secure: true,
      sameSite: 'Lax',
    },
    {
      name: 'theme',
      value: 'dark',
      domain: 'app.example.com',
      path: '/dashboard',
      expires: undefined,
      httpOnly: false,
      secure: false,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('JSON Format Parsing and Serialization', () => {
    it('serializes and parses cookies with roundtrip fidelity', () => {
      const json = serializeJsonCookies(sampleCookies);
      const parsed = parseJsonCookies(json);

      expect(parsed).toHaveLength(2);
      expect(parsed[0]).toEqual({
        name: 'session_token',
        value: 'abc123xyz',
        domain: '.example.com',
        path: '/',
        expires: 1800000000,
        httpOnly: true,
        secure: true,
        sameSite: 'Lax',
      });
      expect(parsed[1].name).toBe('theme');
      expect(parsed[1].value).toBe('dark');
      expect(parsed[1].httpOnly).toBe(false);
    });

    it('handles EditThisCookie expirationDate format', () => {
      const editThisCookieRaw = JSON.stringify([
        {
          name: 'login_uid',
          value: 'uid_42',
          domain: '.test.com',
          path: '/',
          expirationDate: 1750000000,
          httpOnly: true,
          secure: true,
          sameSite: 'strict',
        },
      ]);

      const parsed = parseJsonCookies(editThisCookieRaw);
      expect(parsed).toHaveLength(1);
      expect(parsed[0].expires).toBe(1750000000);
      expect(parsed[0].sameSite).toBe('Strict');
    });

    it('rejects invalid JSON syntax', () => {
      expect(() => parseJsonCookies('this is not json { [')).toThrow('Invalid JSON cookie format');
    });

    it('filters out objects missing name or domain', () => {
      const mixed = JSON.stringify([
        { name: 'valid', value: 'yes', domain: 'example.com', path: '/' },
        { name: '', value: 'missing-name', domain: 'example.com' },
        { name: 'no-domain', value: 'missing-domain' },
      ]);
      const parsed = parseJsonCookies(mixed);
      expect(parsed).toHaveLength(1);
      expect(parsed[0].name).toBe('valid');
    });
  });

  describe('Netscape Format Parsing and Serialization', () => {
    it('serializes cookies to valid Netscape format including #HttpOnly_ tags', () => {
      const netscape = serializeNetscapeCookies(sampleCookies);

      expect(netscape).toContain('# Netscape HTTP Cookie File');
      expect(netscape).toContain('#HttpOnly_.example.com\tTRUE\t/\tTRUE\t1800000000\tsession_token\tabc123xyz');
      expect(netscape).toContain('app.example.com\tFALSE\t/dashboard\tFALSE\t0\ttheme\tdark');
    });

    it('parses standard Netscape cookies and handles comments and #HttpOnly_ prefixes', () => {
      const rawNetscape = `
# Netscape HTTP Cookie File
# Comment line to ignore

#HttpOnly_.example.com\tTRUE\t/\tTRUE\t1800000000\tsession_token\tabc123xyz
app.example.com\tFALSE\t/dashboard\tFALSE\t1750000000\ttheme\tdark
`;

      const parsed = parseNetscapeCookies(rawNetscape);
      expect(parsed).toHaveLength(2);

      expect(parsed[0].name).toBe('session_token');
      expect(parsed[0].httpOnly).toBe(true);
      expect(parsed[0].secure).toBe(true);
      expect(parsed[0].domain).toBe('.example.com');
      expect(parsed[0].expires).toBe(1800000000);

      expect(parsed[1].name).toBe('theme');
      expect(parsed[1].httpOnly).toBe(false);
      expect(parsed[1].secure).toBe(false);
      expect(parsed[1].path).toBe('/dashboard');
    });

    it('handles space-delimited Netscape files if tabs were converted', () => {
      const spaceDelimited = '.site.org TRUE / FALSE 1900000000 cookie_a val_a';
      const parsed = parseNetscapeCookies(spaceDelimited);
      expect(parsed).toHaveLength(1);
      expect(parsed[0].name).toBe('cookie_a');
      expect(parsed[0].value).toBe('val_a');
      expect(parsed[0].domain).toBe('.site.org');
    });
  });

  describe('exportCookies and importCookies workflows', () => {
    const mockProfile = {
      id: 'profile-uuid',
      name: 'Test Profile',
      userDataDir: '/tmp/test-profile-dir',
      status: 'idle',
    };

    it('exports live cookies from running browser session', async () => {
      mockGetProfile.mockReturnValue(mockProfile);
      const mockRunning = {
        getCookies: vi.fn().mockResolvedValue(sampleCookies),
      };
      mockGetRunningBrowser.mockReturnValue(mockRunning);

      const exportedJson = await exportCookies('profile-uuid', 'json');
      expect(mockRunning.getCookies).toHaveBeenCalled();
      expect(mockEngineGetCookies).not.toHaveBeenCalled();
      expect(JSON.parse(exportedJson)).toHaveLength(2);
    });

    it('exports cookies via engine when profile browser is idle', async () => {
      mockGetProfile.mockReturnValue(mockProfile);
      mockGetRunningBrowser.mockReturnValue(undefined);
      mockEngineGetCookies.mockResolvedValue(sampleCookies);

      const exportedNetscape = await exportCookies('profile-uuid', 'netscape');
      expect(mockEngineGetCookies).toHaveBeenCalledWith('/tmp/test-profile-dir');
      expect(exportedNetscape).toContain('# Netscape HTTP Cookie File');
    });

    it('imports cookies into running browser context', async () => {
      mockGetProfile.mockReturnValue(mockProfile);
      const mockRunning = {
        addCookies: vi.fn().mockResolvedValue(undefined),
      };
      mockGetRunningBrowser.mockReturnValue(mockRunning);

      const json = serializeJsonCookies(sampleCookies);
      const res = await importCookies('profile-uuid', json, 'json');

      expect(res.count).toBe(2);
      expect(mockRunning.addCookies).toHaveBeenCalled();
      expect(mockEngineAddCookies).not.toHaveBeenCalled();
    });

    it('imports cookies via engine when profile browser is idle', async () => {
      mockGetProfile.mockReturnValue(mockProfile);
      mockGetRunningBrowser.mockReturnValue(undefined);
      mockEngineAddCookies.mockResolvedValue(undefined);

      const netscape = serializeNetscapeCookies(sampleCookies);
      const res = await importCookies('profile-uuid', netscape, 'netscape');

      expect(res.count).toBe(2);
      expect(mockEngineAddCookies).toHaveBeenCalledWith('/tmp/test-profile-dir', expect.any(Array));
    });

    it('throws when profile is not found', async () => {
      mockGetProfile.mockReturnValue(null);
      await expect(exportCookies('missing-id', 'json')).rejects.toThrow('Profile not found: missing-id');
    });

    it('throws when importing empty or invalid cookie content', async () => {
      mockGetProfile.mockReturnValue(mockProfile);
      await expect(importCookies('profile-uuid', '# just a comment\n', 'netscape')).rejects.toThrow(
        'No valid cookies found'
      );
    });
  });
});
