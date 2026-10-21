import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as http from 'http';
import {
  isAllowedHost,
  isAllowedOrigin,
  isAuthorized,
  handleRequest,
  startLocalApi,
  stopLocalApi,
} from '../../src/main/services/local-api-service';

// Mock dependencies
const mockGetSettings = vi.fn();
const mockListProfiles = vi.fn();
const mockLaunch = vi.fn();
const mockStop = vi.fn();
const mockIsRunning = vi.fn();

vi.mock('../../src/main/services/settings-service', () => ({
  getSettings: () => mockGetSettings(),
}));

vi.mock('../../src/main/services/profile-service', () => ({
  listProfiles: () => mockListProfiles(),
}));

vi.mock('../../src/main/services/launcher-service', () => ({
  launch: (id: string) => mockLaunch(id),
  stop: (id: string) => mockStop(id),
  isRunning: (id: string) => mockIsRunning(id),
}));

describe('Local REST Automation API (§8 & §10)', () => {
  const TEST_TOKEN = 'test-token-abcdef123456';

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSettings.mockReturnValue({
      userDataDir: '/fake/path',
      customExecutablePath: null,
      apiPort: 3001,
      apiToken: TEST_TOKEN,
      apiEnabled: true,
    });
    mockListProfiles.mockReturnValue([
      {
        id: 'prof-1',
        name: 'Profile 1',
        status: 'idle',
        groupId: null,
        proxyId: null,
        tags: [],
        createdAt: 1000,
        updatedAt: 2000,
        lastLaunchedAt: null,
      },
    ]);
    mockIsRunning.mockReturnValue(false);
  });

  afterEach(async () => {
    await stopLocalApi();
  });

  describe('Host header validation (DNS rebinding defense)', () => {
    it('accepts localhost and 127.0.0.1 with and without ports', () => {
      expect(isAllowedHost('localhost')).toBe(true);
      expect(isAllowedHost('localhost:3001')).toBe(true);
      expect(isAllowedHost('127.0.0.1')).toBe(true);
      expect(isAllowedHost('127.0.0.1:8080')).toBe(true);
    });

    it('rejects external or malicious host headers', () => {
      expect(isAllowedHost(undefined)).toBe(false);
      expect(isAllowedHost('')).toBe(false);
      expect(isAllowedHost('attacker.com')).toBe(false);
      expect(isAllowedHost('attacker.com:3001')).toBe(false);
      expect(isAllowedHost('192.168.1.50')).toBe(false);
    });
  });

  describe('Origin header validation (Cross-site request defense)', () => {
    it('accepts missing, null, or local origins', () => {
      expect(isAllowedOrigin(undefined)).toBe(true);
      expect(isAllowedOrigin('null')).toBe(true);
      expect(isAllowedOrigin('http://localhost:5173')).toBe(true);
      expect(isAllowedOrigin('http://127.0.0.1:3001')).toBe(true);
      expect(isAllowedOrigin('https://localhost:8443')).toBe(true);
    });

    it('rejects cross-origin requests from external web pages', () => {
      expect(isAllowedOrigin('https://evil.com')).toBe(false);
      expect(isAllowedOrigin('http://malicious-site.org:8080')).toBe(false);
      expect(isAllowedOrigin('invalid-url-string')).toBe(false);
    });
  });

  describe('Bearer Token validation', () => {
    it('accepts correct Bearer token format', () => {
      expect(isAuthorized(`Bearer ${TEST_TOKEN}`, TEST_TOKEN)).toBe(true);
      expect(isAuthorized(`bearer ${TEST_TOKEN}`, TEST_TOKEN)).toBe(true);
    });

    it('rejects invalid or missing tokens', () => {
      expect(isAuthorized(undefined, TEST_TOKEN)).toBe(false);
      expect(isAuthorized('', TEST_TOKEN)).toBe(false);
      expect(isAuthorized('Bearer wrong-token', TEST_TOKEN)).toBe(false);
      expect(isAuthorized('Basic dXNlcjpwYXNz', TEST_TOKEN)).toBe(false);
    });
  });

  describe('HTTP Endpoints via ephemeral test server', () => {
    let testServer: http.Server;
    let serverPort = 0;

    beforeEach(async () => {
      testServer = http.createServer(handleRequest);
      await new Promise<void>((resolve) => {
        testServer.listen(0, '127.0.0.1', () => {
          const addr = testServer.address();
          if (typeof addr === 'object' && addr !== null) {
            serverPort = addr.port;
          }
          resolve();
        });
      });
    });

    afterEach(async () => {
      await new Promise<void>((resolve) => testServer.close(() => resolve()));
    });

    function makeRequest(
      method: string,
      path: string,
      headers: Record<string, string> = {}
    ): Promise<{ statusCode: number; body: Record<string, unknown> }> {
      return new Promise((resolve, reject) => {
        const req = http.request(
          {
            hostname: '127.0.0.1',
            port: serverPort,
            path,
            method,
            headers: {
              Host: `127.0.0.1:${serverPort}`,
              ...headers,
            },
          },
          (res) => {
            let data = '';
            res.on('data', (chunk) => {
              data += chunk;
            });
            res.on('end', () => {
              try {
                const body = JSON.parse(data) as Record<string, unknown>;
                resolve({ statusCode: res.statusCode ?? 0, body });
              } catch {
                resolve({ statusCode: res.statusCode ?? 0, body: { raw: data } });
              }
            });
          }
        );

        req.on('error', reject);
        req.end();
      });
    }

    it('returns 401 when Authorization header is missing', async () => {
      const res = await makeRequest('GET', '/profiles');
      expect(res.statusCode).toBe(401);
      expect(res.body.error).toContain('valid Bearer token required');
    });

    it('returns 403 when Host header points to an external domain', async () => {
      const res = await makeRequest('GET', '/profiles', {
        Host: 'evil-attacker.com',
        Authorization: `Bearer ${TEST_TOKEN}`,
      });
      expect(res.statusCode).toBe(403);
      expect(res.body.error).toContain('invalid host header');
    });

    it('returns 403 when Origin header is from an external site', async () => {
      const res = await makeRequest('GET', '/profiles', {
        Origin: 'https://evil.com',
        Authorization: `Bearer ${TEST_TOKEN}`,
      });
      expect(res.statusCode).toBe(403);
      expect(res.body.error).toContain('external domains not allowed');
    });

    it('GET /health returns 200 with service information', async () => {
      const res = await makeRequest('GET', '/health', {
        Authorization: `Bearer ${TEST_TOKEN}`,
      });
      expect(res.statusCode).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(res.body.service).toBe('ProfileBrowser REST API');
    });

    it('GET /profiles returns profile list with live status', async () => {
      mockIsRunning.mockReturnValue(true);
      const res = await makeRequest('GET', '/profiles', {
        Authorization: `Bearer ${TEST_TOKEN}`,
      });
      expect(res.statusCode).toBe(200);
      const profiles = res.body.profiles as Array<{ id: string; status: string }>;
      expect(profiles).toHaveLength(1);
      expect(profiles[0].id).toBe('prof-1');
      expect(profiles[0].status).toBe('running');
    });

    it('POST /profiles/:id/start invokes launcher and returns wsEndpoint', async () => {
      mockLaunch.mockResolvedValue({
        pid: 9999,
        cdpEndpoint: 'ws://127.0.0.1:4567/devtools/browser/abc-123',
      });

      const res = await makeRequest('POST', '/profiles/prof-1/start', {
        Authorization: `Bearer ${TEST_TOKEN}`,
      });

      expect(mockLaunch).toHaveBeenCalledWith('prof-1');
      expect(res.statusCode).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.profileId).toBe('prof-1');
      expect(res.body.wsEndpoint).toBe('ws://127.0.0.1:4567/devtools/browser/abc-123');
      expect(res.body.pid).toBe(9999);
    });

    it('POST /profiles/:id/stop invokes stop and returns idle status', async () => {
      mockStop.mockResolvedValue(undefined);

      const res = await makeRequest('POST', '/profiles/prof-1/stop', {
        Authorization: `Bearer ${TEST_TOKEN}`,
      });

      expect(mockStop).toHaveBeenCalledWith('prof-1');
      expect(res.statusCode).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.profileId).toBe('prof-1');
      expect(res.body.status).toBe('idle');
    });

    it('returns 404 for unknown endpoints', async () => {
      const res = await makeRequest('GET', '/nonexistent', {
        Authorization: `Bearer ${TEST_TOKEN}`,
      });
      expect(res.statusCode).toBe(404);
      expect(res.body.error).toContain('Route not found');
    });
  });

  describe('startLocalApi lifecycle', () => {
    it('starts on ephemeral port and stops cleanly', async () => {
      const port = await startLocalApi(0);
      expect(port).toBeGreaterThan(0);

      await stopLocalApi();
    });
  });
});
