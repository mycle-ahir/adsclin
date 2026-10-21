import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as https from 'https';
import { MockDatabase } from './mock-db';

// ---------------------------------------------------------------------------
// Mocks — hoisted
// ---------------------------------------------------------------------------

const { mockEncrypt, mockDecrypt, mockIsAvailable, mockGetDb, setDb } = vi.hoisted(() => {
  let currentDb: unknown = null;
  const enc = vi.fn((s: string) => Buffer.from(`enc:${s}`));
  const dec = vi.fn((b: Buffer) => b.toString().replace(/^enc:/, ''));
  const isAvail = vi.fn(() => true);
  return {
    mockEncrypt: enc,
    mockDecrypt: dec,
    mockIsAvailable: isAvail,
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
    isEncryptionAvailable: mockIsAvailable,
    encryptString: mockEncrypt,
    decryptString: mockDecrypt,
  },
}));

let uuidCounter = 0;
vi.mock('uuid', () => ({
  v4: vi.fn(() => `proxy-uuid-${++uuidCounter}`),
}));

// Mock proxy-chain (dynamic require in proxy-service)
vi.mock('proxy-chain', () => ({
  anonymizeProxy: vi.fn(async () => 'http://127.0.0.1:18080'),
  closeAnonymizedProxy: vi.fn(async () => undefined),
}));

// Mock https-proxy-agent
vi.mock('https-proxy-agent', () => ({
  HttpsProxyAgent: vi.fn().mockImplementation(() => ({})),
}));

// Mock https.get
vi.mock('https', async (importOriginal) => {
  const actual = await importOriginal<typeof import('https')>();
  return {
    ...actual,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    get: vi.fn((_opts: any, cb: any) => {
      const fakeRes = {
        on: (event: string, handler: (data?: Buffer) => void) => {
          if (event === 'data') handler(Buffer.from('{"ip":"1.2.3.4","country":"US"}'));
          if (event === 'end') handler();
          return fakeRes;
        },
      };
      if (cb) cb(fakeRes);
      return { on: vi.fn(), destroy: vi.fn() } as unknown as ReturnType<typeof actual.get>;
    }),
  };
});

vi.mock('../../src/main/db/database', () => ({
  getDb: mockGetDb,
}));

// ---------------------------------------------------------------------------
// System under test
// ---------------------------------------------------------------------------
import * as ProxyService from '../../src/main/services/proxy-service';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('proxy-service', () => {
  beforeEach(() => {
    uuidCounter = 0;
    vi.clearAllMocks();
    mockIsAvailable.mockReturnValue(true);
    const db = new MockDatabase();
    setDb(db);
  });

  it('create → list shows no password field', () => {
    ProxyService.createProxy({
      name: 'My Proxy',
      scheme: 'http',
      host: '1.2.3.4',
      port: 8080,
      username: 'user',
      password: 'secret',
    });
    const proxies = ProxyService.listProxies();
    expect(proxies).toHaveLength(1);
    const proxy = proxies[0];
    expect(proxy).not.toHaveProperty('password');
    expect(proxy).not.toHaveProperty('password_enc');
    expect(proxy.username).toBe('user');
  });

  it('encryptString is called when password is provided', () => {
    ProxyService.createProxy({
      name: 'Enc Test',
      scheme: 'socks5',
      host: '5.6.7.8',
      port: 1080,
      username: null,
      password: 'mysecret',
    });
    expect(mockEncrypt).toHaveBeenCalledWith('mysecret');
  });

  it('encryptString is NOT called when password is null', () => {
    ProxyService.createProxy({
      name: 'No Pass',
      scheme: 'http',
      host: '9.9.9.9',
      port: 3128,
      username: null,
      password: null,
    });
    expect(mockEncrypt).not.toHaveBeenCalled();
  });

  it('getProxy returns null for unknown id', () => {
    expect(ProxyService.getProxy('nonexistent')).toBeNull();
  });

  it('deleteProxy removes from list', () => {
    const p = ProxyService.createProxy({
      name: 'Del Me',
      scheme: 'http',
      host: '1.1.1.1',
      port: 80,
    });
    ProxyService.deleteProxy(p.id);
    expect(ProxyService.listProxies()).toHaveLength(0);
  });

  it('getProxyWithPassword decrypts password', () => {
    const p = ProxyService.createProxy({
      name: 'PwdTest',
      scheme: 'http',
      host: '2.2.2.2',
      port: 80,
      username: 'u',
      password: 'hunter2',
    });
    const { password } = ProxyService.getProxyWithPassword(p.id);
    expect(mockDecrypt).toHaveBeenCalled();
    expect(password).toBe('hunter2');
  });

  it('testProxy calls ipinfo.io (via https mock)', async () => {
    const p = ProxyService.createProxy({
      name: 'TestMe',
      scheme: 'http',
      host: '3.3.3.3',
      port: 3128,
      username: null,
      password: null,
    });

    const result = await ProxyService.testProxy(p.id);
    expect(result.ip).toBe('1.2.3.4');
    expect(result.country).toBe('US');
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it('warns and stores unencrypted when safeStorage unavailable', () => {
    mockIsAvailable.mockReturnValue(false);
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    ProxyService.createProxy({
      name: 'NoEnc',
      scheme: 'http',
      host: '4.4.4.4',
      port: 8080,
      password: 'rawpass',
    });

    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('safeStorage unavailable'));
    expect(mockEncrypt).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});
