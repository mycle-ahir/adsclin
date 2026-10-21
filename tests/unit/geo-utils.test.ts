import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  normalizeCountryCode,
  getTimezoneForCountry,
  getLanguagesForCountry,
  adjustFingerprintToGeo,
} from '../../src/shared/geo-utils';
import { generateFingerprint } from '../../src/main/services/fingerprint-generator';
import { MockDatabase } from './mock-db';

const { mockGetDb, setDb } = vi.hoisted(() => {
  let currentDb: unknown = null;
  return {
    mockGetDb: vi.fn(() => currentDb),
    setDb: (db: unknown) => {
      currentDb = db;
    },
  };
});

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => '/mock/userData'),
  },
  safeStorage: {
    isEncryptionAvailable: vi.fn(() => true),
    encryptString: vi.fn((s: string) => Buffer.from(s)),
    decryptString: vi.fn((b: Buffer) => b.toString()),
  },
}));

vi.mock('../../src/main/db/database', () => ({
  getDb: mockGetDb,
}));

import * as profileService from '../../src/main/services/profile-service';
import * as proxyService from '../../src/main/services/proxy-service';

describe('geo-utils & proxy auto-adjustment', () => {
  describe('lookup helpers', () => {
    it('normalizes country codes and names', () => {
      expect(normalizeCountryCode('US')).toBe('US');
      expect(normalizeCountryCode('de')).toBe('DE');
      expect(normalizeCountryCode('Germany')).toBe('DE');
      expect(normalizeCountryCode('United States')).toBe('US');
      expect(normalizeCountryCode('japan')).toBe('JP');
      expect(normalizeCountryCode('France')).toBe('FR');
    });

    it('returns appropriate primary timezones for countries', () => {
      expect(getTimezoneForCountry('DE')).toBe('Europe/Berlin');
      expect(getTimezoneForCountry('FR')).toBe('Europe/Paris');
      expect(getTimezoneForCountry('JP')).toBe('Asia/Tokyo');
      expect(getTimezoneForCountry('GB')).toBe('Europe/London');
      expect(getTimezoneForCountry('US')).toBe('America/New_York');
      expect(getTimezoneForCountry('IN')).toBe('Asia/Kolkata');
    });

    it('returns appropriate primary languages for countries', () => {
      const deLangs = getLanguagesForCountry('DE');
      expect(deLangs).toContain('de-DE');
      expect(deLangs).toContain('de');

      const frLangs = getLanguagesForCountry('FR');
      expect(frLangs).toContain('fr-FR');
      expect(frLangs).toContain('fr');

      const jpLangs = getLanguagesForCountry('JP');
      expect(jpLangs).toContain('ja-JP');
      expect(jpLangs).toContain('ja');

      const usLangs = getLanguagesForCountry('US');
      expect(usLangs).toContain('en-US');
      expect(usLangs).toContain('en');
    });

    it('adjusts fingerprint timezone, languages, and coordinates according to geo', () => {
      const fp = generateFingerprint();
      const adjusted = adjustFingerprintToGeo(fp, {
        country: 'DE',
        timezone: 'Europe/Berlin',
        loc: '52.5200,13.4050',
      });

      expect(adjusted.timezone).toBe('Europe/Berlin');
      expect(adjusted.languages[0]).toBe('de-DE');
      expect(adjusted.geolocation).toEqual({
        lat: 52.52,
        lon: 13.405,
        accuracy: 50,
      });
    });
  });

  describe('profile-service integration with proxy geo', () => {
    beforeEach(() => {
      const db = new MockDatabase();
      setDb(db);
    });

    it('automatically adjusts profile timezone and languages when created with a proxy', () => {
      // 1. Create a proxy tested in Germany
      const proxy = proxyService.createProxy({
        name: 'German Proxy',
        scheme: 'http',
        host: '185.10.10.1',
        port: 8080,
      });

      // Simulate proxy test having set last_test_country to DE
      const db = mockGetDb() as MockDatabase;
      const px = db.proxies.get(proxy.id);
      if (px) {
        px['last_test_country'] = 'DE';
        px['last_test_timezone'] = 'Europe/Berlin';
        px['last_test_loc'] = '52.52,13.40';
      }

      // 2. Create profile with this proxyId
      const profile = profileService.createProfile({
        name: 'Auto German Profile',
        proxyId: proxy.id,
      });

      expect(profile.fingerprint).toBeDefined();
      expect(profile.fingerprint?.timezone).toBe('Europe/Berlin');
      expect(profile.fingerprint?.languages[0]).toBe('de-DE');
      expect(profile.fingerprint?.geolocation?.lat).toBe(52.52);
    });

    it('automatically adjusts profile timezone and languages when updated with a proxy', () => {
      // 1. Create a profile without proxy (default US/en)
      const profile = profileService.createProfile({
        name: 'Initial Profile',
      });

      // 2. Create a proxy tested in Japan
      const proxy = proxyService.createProxy({
        name: 'Tokyo Proxy',
        scheme: 'socks5',
        host: '133.1.2.3',
        port: 1080,
      });
      const db = mockGetDb() as MockDatabase;
      const px = db.proxies.get(proxy.id);
      if (px) {
        px['last_test_country'] = 'JP';
        px['last_test_timezone'] = 'Asia/Tokyo';
      }

      // 3. Update profile to assign this proxy
      const updated = profileService.updateProfile({
        id: profile.id,
        proxyId: proxy.id,
      });

      expect(updated.fingerprint).toBeDefined();
      expect(updated.fingerprint?.timezone).toBe('Asia/Tokyo');
      expect(updated.fingerprint?.languages[0]).toBe('ja-JP');
    });
  });
});
