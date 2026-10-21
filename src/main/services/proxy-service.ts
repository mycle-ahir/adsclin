import * as https from 'https';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { safeStorage } from 'electron';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db/database';
import { recordActivity } from './activity-service';
import type { Proxy, ProxyTestResult } from '../../shared/types';
import type { CreateProxyInput, UpdateProxyInput } from '../../shared/schemas';
import {
  getTimezoneForCountry,
  getLanguagesForCountry,
  getCoordinatesForCountry,
} from '../../shared/geo-utils';

// ---------------------------------------------------------------------------
// Internal row shape
// ---------------------------------------------------------------------------
interface ProxyRow {
  id: string;
  name: string;
  scheme: string;
  host: string;
  port: number;
  username: string | null;
  password_enc: Buffer | null;
  last_test_ip: string | null;
  last_test_country: string | null;
  last_test_latency_ms: number | null;
  last_tested_at: number | null;
  last_test_timezone?: string | null;
  last_test_loc?: string | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function rowToProxy(row: ProxyRow): Proxy {
  // password_enc is intentionally dropped — never returned to renderer
  return {
    id: row.id,
    name: row.name,
    scheme: row.scheme as Proxy['scheme'],
    host: row.host,
    port: row.port,
    username: row.username,
    lastTestIp: row.last_test_ip,
    lastTestCountry: row.last_test_country,
    lastTestLatencyMs: row.last_test_latency_ms,
    lastTestedAt: row.last_tested_at,
    lastTestTimezone: row.last_test_timezone ?? null,
    lastTestLoc: row.last_test_loc ?? null,
  };
}

function encryptPassword(password: string): Buffer {
  if (safeStorage.isEncryptionAvailable()) {
    return safeStorage.encryptString(password);
  }
  // WARNING: safeStorage unavailable (e.g., CI/headless environment).
  // Storing password as raw UTF-8 bytes. This is a known limitation —
  // the password is NOT encrypted at rest in this mode.
  console.warn('[proxy-service] safeStorage unavailable — password stored unencrypted');
  return Buffer.from(password, 'utf8');
}

function decryptPassword(enc: Buffer): string {
  if (safeStorage.isEncryptionAvailable()) {
    return safeStorage.decryptString(enc);
  }
  // WARNING: safeStorage unavailable — reading raw UTF-8 bytes (see encryptPassword comment)
  return enc.toString('utf8');
}

/** Build a full proxy URL for outbound connections. REDACT before logging. */
function buildProxyUrl(proxy: Proxy, password: string | null): string {
  const auth =
    proxy.username
      ? `${encodeURIComponent(proxy.username)}${password ? `:${encodeURIComponent(password)}` : ''}@`
      : '';
  return `${proxy.scheme}://${auth}${proxy.host}:${proxy.port}`;
}

// ---------------------------------------------------------------------------
// Proxy CRUD
// ---------------------------------------------------------------------------
export function createProxy(input: CreateProxyInput): Proxy {
  const db = getDb();
  const id = uuidv4();

  const passwordEnc =
    input.password != null ? encryptPassword(input.password) : null;

  db.prepare(
    `INSERT INTO proxies (id, name, scheme, host, port, username, password_enc)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    input.name,
    input.scheme,
    input.host,
    input.port,
    input.username ?? null,
    passwordEnc
  );

  const row = db
    .prepare<string>('SELECT * FROM proxies WHERE id = ?')
    .get(id) as ProxyRow;
  return rowToProxy(row);
}

export function listProxies(): Proxy[] {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM proxies ORDER BY name').all() as ProxyRow[];
  return rows.map(rowToProxy);
}

export function getProxy(id: string): Proxy | null {
  const db = getDb();
  const row = db
    .prepare<string>('SELECT * FROM proxies WHERE id = ?')
    .get(id) as ProxyRow | undefined;
  return row ? rowToProxy(row) : null;
}

export function updateProxy(input: UpdateProxyInput): Proxy {
  const db = getDb();

  const sets: string[] = [];
  const values: unknown[] = [];

  if (input.name !== undefined) { sets.push('name = ?'); values.push(input.name); }
  if (input.scheme !== undefined) { sets.push('scheme = ?'); values.push(input.scheme); }
  if (input.host !== undefined) { sets.push('host = ?'); values.push(input.host); }
  if (input.port !== undefined) { sets.push('port = ?'); values.push(input.port); }
  if ('username' in input) { sets.push('username = ?'); values.push(input.username ?? null); }
  if ('password' in input) {
    const passwordEnc =
      input.password != null ? encryptPassword(input.password) : null;
    sets.push('password_enc = ?');
    values.push(passwordEnc);
  }

  if (sets.length > 0) {
    values.push(input.id);
    db.prepare(`UPDATE proxies SET ${sets.join(', ')} WHERE id = ?`).run(...values);
  }

  const row = db
    .prepare<string>('SELECT * FROM proxies WHERE id = ?')
    .get(input.id) as ProxyRow | undefined;
  if (!row) throw new Error(`Proxy not found: ${input.id}`);
  return rowToProxy(row);
}

export function deleteProxy(id: string): void {
  const db = getDb();
  db.prepare<string>('DELETE FROM proxies WHERE id = ?').run(id);
}

/**
 * Internal use ONLY — called by the launcher service to get the decrypted password.
 * NEVER expose this via IPC.
 */
export function getProxyWithPassword(id: string): { proxy: Proxy; password: string | null } {
  const db = getDb();
  const row = db
    .prepare<string>('SELECT * FROM proxies WHERE id = ?')
    .get(id) as ProxyRow | undefined;
  if (!row) throw new Error(`Proxy not found: ${id}`);

  const password =
    row.password_enc != null ? decryptPassword(row.password_enc) : null;

  return { proxy: rowToProxy(row), password };
}

// ---------------------------------------------------------------------------
// Proxy test
// ---------------------------------------------------------------------------
export async function testProxy(id: string): Promise<ProxyTestResult> {
  const { proxy, password } = getProxyWithPassword(id);

  // Build proxy URL — redact when logging
  const proxyUrl = buildProxyUrl(proxy, password);
  // REDACTED log: only log scheme+host+port, never credentials
  console.log(
    `[proxy-service] Testing proxy ${proxy.scheme}://${proxy.host}:${proxy.port} (id=${id})`
  );

  // Use proxy-chain to create a local anonymous forwarder, then hit ipinfo.io through it
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const proxyChain = require('proxy-chain') as typeof import('proxy-chain');

  const localProxyUrl = await proxyChain.anonymizeProxy(proxyUrl);

  const localPort = new URL(localProxyUrl).port;
  const start = Date.now();

  let body = '';
  try {
    body = await new Promise<string>((resolve, reject) => {
      const req = https.get(
        {
          hostname: 'ipinfo.io',
          path: '/json',
          headers: { Accept: 'application/json' },
          agent: new HttpsProxyAgent(`http://127.0.0.1:${localPort}`),
          timeout: 10_000,
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on('data', (chunk: Buffer) => chunks.push(chunk));
          res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
          res.on('error', reject);
        }
      );
      req.on('error', reject);
      req.on('timeout', () => { req.destroy(); reject(new Error('Proxy test timed out')); });
    });
  } finally {
    await proxyChain.closeAnonymizedProxy(localProxyUrl, true).catch(() => undefined);
  }

  const latencyMs = Date.now() - start;
  const parsed = JSON.parse(body) as {
    ip?: string;
    country?: string;
    timezone?: string;
    loc?: string;
    city?: string;
  };
  const ip = parsed.ip ?? '';
  const country = parsed.country ?? '';
  const timezone = parsed.timezone || (country ? getTimezoneForCountry(country) : undefined);
  const loc = parsed.loc || (country ? (() => {
    const coords = getCoordinatesForCountry(country);
    return coords ? `${coords.lat},${coords.lon}` : undefined;
  })() : undefined);
  const city = parsed.city;
  const languages = country ? getLanguagesForCountry(country) : undefined;

  // Store results on the proxy row
  getDb()
    .prepare(
      `UPDATE proxies
       SET last_test_ip = ?, last_test_country = ?, last_test_latency_ms = ?, last_tested_at = ?,
           last_test_timezone = ?, last_test_loc = ?
       WHERE id = ?`
    )
    .run(ip, country, latencyMs, Date.now(), timezone ?? null, loc ?? null, id);

  try {
    recordActivity('proxy:test', 'proxy', id, { ip, country, latencyMs });
  } catch {
    // Non-blocking
  }

  return { ip, country, latencyMs, timezone, loc, city, languages };
}
