import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { CreateProxyInput, BulkCreateProfilesInput } from '../../src/shared/schemas';
import type { Proxy, Profile } from '../../src/shared/types';
import {
  parseProxyList,
  bulkCreateProxies,
  bulkCreateProfiles,
} from '../../src/main/services/bulk-service';

// Mock dependencies
const mockCreateProfile = vi.fn();
const mockListProxies = vi.fn();
const mockCreateProxy = vi.fn();

vi.mock('../../src/main/services/profile-service', () => ({
  createProfile: (input: unknown) => mockCreateProfile(input),
}));

vi.mock('../../src/main/services/proxy-service', () => ({
  listProxies: () => mockListProxies(),
  createProxy: (input: unknown) => mockCreateProxy(input),
}));

describe('Bulk Operations Service (§8)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('parseProxyList', () => {
    it('parses host:port lines with default protocol', () => {
      const raw = '192.168.1.1:8080\n10.0.0.1:3128';
      const parsed = parseProxyList(raw, 'http');

      expect(parsed).toHaveLength(2);
      expect(parsed[0]).toEqual({
        name: 'Proxy 1 (192.168.1.1:8080)',
        scheme: 'http',
        host: '192.168.1.1',
        port: 8080,
        username: null,
        password: null,
      });
      expect(parsed[1].host).toBe('10.0.0.1');
      expect(parsed[1].port).toBe(3128);
    });

    it('parses host:port:username:password format', () => {
      const raw = 'proxy.provider.com:9000:alice:secret123';
      const parsed = parseProxyList(raw, 'socks5');

      expect(parsed).toHaveLength(1);
      expect(parsed[0].scheme).toBe('socks5');
      expect(parsed[0].host).toBe('proxy.provider.com');
      expect(parsed[0].port).toBe(9000);
      expect(parsed[0].username).toBe('alice');
      expect(parsed[0].password).toBe('secret123');
    });

    it('parses username:password@host:port format', () => {
      const raw = 'bob:pass456@172.16.0.1:1080';
      const parsed = parseProxyList(raw, 'http');

      expect(parsed).toHaveLength(1);
      expect(parsed[0].host).toBe('172.16.0.1');
      expect(parsed[0].port).toBe(1080);
      expect(parsed[0].username).toBe('bob');
      expect(parsed[0].password).toBe('pass456');
    });

    it('parses full URL format scheme://user:pass@host:port', () => {
      const raw = 'socks5://carol:mypass@vpn.node.com:1080';
      const parsed = parseProxyList(raw, 'http');

      expect(parsed).toHaveLength(1);
      expect(parsed[0].scheme).toBe('socks5');
      expect(parsed[0].host).toBe('vpn.node.com');
      expect(parsed[0].port).toBe(1080);
      expect(parsed[0].username).toBe('carol');
      expect(parsed[0].password).toBe('mypass');
    });

    it('skips comments and invalid lines', () => {
      const raw = `
# Comment line
invalid_line_without_port
127.0.0.1:99999999
valid.host.com:8080
`;
      const parsed = parseProxyList(raw);
      expect(parsed).toHaveLength(1);
      expect(parsed[0].host).toBe('valid.host.com');
      expect(parsed[0].port).toBe(8080);
    });
  });

  describe('bulkCreateProxies', () => {
    it('creates all parsed proxies via proxyService', async () => {
      const inputs: CreateProxyInput[] = [
        {
          name: 'P1',
          scheme: 'http',
          host: '1.1.1.1',
          port: 8080,
          username: null,
          password: null,
        },
        {
          name: 'P2',
          scheme: 'socks5',
          host: '2.2.2.2',
          port: 1080,
          username: 'user',
          password: 'pw',
        },
      ];

      mockCreateProxy.mockImplementation((input: CreateProxyInput) => ({
        id: `id-${input.name}`,
        ...input,
        lastTestIp: null,
        lastTestCountry: null,
        lastTestLatencyMs: null,
        lastTestedAt: null,
      }));

      const created = bulkCreateProxies(inputs);
      expect(created).toHaveLength(2);
      expect(mockCreateProxy).toHaveBeenCalledTimes(2);
    });
  });

  describe('bulkCreateProfiles', () => {
    const availableProxies: Proxy[] = [
      {
        id: 'proxy-1',
        name: 'Proxy 1',
        scheme: 'http',
        host: '1.1.1.1',
        port: 8080,
        username: null,
        lastTestIp: null,
        lastTestCountry: null,
        lastTestLatencyMs: null,
        lastTestedAt: null,
      },
      {
        id: 'proxy-2',
        name: 'Proxy 2',
        scheme: 'http',
        host: '2.2.2.2',
        port: 8080,
        username: null,
        lastTestIp: null,
        lastTestCountry: null,
        lastTestLatencyMs: null,
        lastTestedAt: null,
      },
    ];

    it('creates N profiles with unique seeded fingerprints', () => {
      mockListProxies.mockReturnValue(availableProxies);
      mockCreateProfile.mockImplementation((arg: { name: string; fingerprint: { seed: string } }) => ({
        id: `id-${arg.name}`,
        name: arg.name,
        fingerprint: arg.fingerprint,
        status: 'idle',
      }));

      const input: BulkCreateProfilesInput = {
        count: 5,
        namePrefix: 'Worker',
        templateId: 'windows-11-desktop-intel',
        proxyMode: 'none',
        tags: ['batch'],
      };

      const profiles = bulkCreateProfiles(input);
      expect(profiles).toHaveLength(5);
      expect(mockCreateProfile).toHaveBeenCalledTimes(5);

      // Verify names and seeds are unique
      const seeds = new Set(profiles.map((p: Profile) => p.fingerprint?.seed));
      expect(seeds.size).toBe(5);
      expect(profiles[0].name).toBe('Worker 1');
      expect(profiles[4].name).toBe('Worker 5');
    });

    it('assigns proxies sequentially when proxyMode is sequential', () => {
      mockListProxies.mockReturnValue(availableProxies);
      const assignedProxyIds: string[] = [];

      mockCreateProfile.mockImplementation((arg: { proxyId: string | null; name: string }) => {
        if (arg.proxyId) assignedProxyIds.push(arg.proxyId);
        return { id: `id-${arg.name}`, name: arg.name, status: 'idle' };
      });

      const input: BulkCreateProfilesInput = {
        count: 4,
        namePrefix: 'Seq',
        proxyMode: 'sequential',
        tags: [],
      };

      bulkCreateProfiles(input);

      // Should cycle between proxy-1 and proxy-2
      expect(assignedProxyIds).toEqual(['proxy-1', 'proxy-2', 'proxy-1', 'proxy-2']);
    });

    it('assigns a specific proxy when proxyMode is specific', () => {
      mockListProxies.mockReturnValue(availableProxies);
      const assignedProxyIds: string[] = [];

      mockCreateProfile.mockImplementation((arg: { proxyId: string | null; name: string }) => {
        if (arg.proxyId) assignedProxyIds.push(arg.proxyId);
        return { id: `id-${arg.name}`, name: arg.name, status: 'idle' };
      });

      const input: BulkCreateProfilesInput = {
        count: 3,
        namePrefix: 'Spec',
        proxyMode: 'specific',
        specificProxyId: 'proxy-2',
        tags: [],
      };

      bulkCreateProfiles(input);
      expect(assignedProxyIds).toEqual(['proxy-2', 'proxy-2', 'proxy-2']);
    });
  });
});
