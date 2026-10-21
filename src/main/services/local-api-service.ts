/**
 * Local REST Automation API service.
 *
 * Requirements (SPEC.md §8 & §10):
 *  - Bound strictly to 127.0.0.1 only
 *  - Bearer token authentication stored in settings
 *  - Host and Origin header validation against DNS rebinding & cross-site scripting
 *  - Endpoints:
 *      GET  /profiles
 *      POST /profiles/:id/start -> { ok: true, wsEndpoint, pid, status }
 *      POST /profiles/:id/stop  -> { ok: true, status }
 */

import * as http from 'http';
import { getSettings } from './settings-service';
import { listProfiles } from './profile-service';
import * as launcherService from './launcher-service';

let server: http.Server | null = null;
let currentPort = 0;

/**
 * Validates whether the incoming request Host header is localhost or 127.0.0.1.
 */
export function isAllowedHost(hostHeader?: string): boolean {
  if (!hostHeader) return false;
  // Normalize host:port -> host
  const host = hostHeader.split(':')[0].toLowerCase();
  return host === 'localhost' || host === '127.0.0.1';
}

/**
 * Validates whether the incoming Origin header is from localhost or 127.0.0.1.
 * If Origin is not present (standard non-browser curl/script), it is allowed.
 */
export function isAllowedOrigin(originHeader?: string): boolean {
  if (!originHeader || originHeader === 'null') return true;
  try {
    const url = new URL(originHeader);
    const hostname = url.hostname.toLowerCase();
    return hostname === 'localhost' || hostname === '127.0.0.1';
  } catch {
    return false;
  }
}

/**
 * Validates Bearer token in Authorization header.
 */
export function isAuthorized(authHeader?: string, expectedToken?: string): boolean {
  if (!authHeader || !expectedToken) return false;
  const parts = authHeader.trim().split(' ');
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
    return false;
  }
  return parts[1] === expectedToken;
}

function sendJson(res: http.ServerResponse, statusCode: number, data: unknown): void {
  const json = JSON.stringify(data);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(json),
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  });
  res.end(json);
}

export function handleRequest(req: http.IncomingMessage, res: http.ServerResponse): void {
  const settings = getSettings();

  // 1. Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Authorization, Content-Type',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    });
    res.end();
    return;
  }

  // 2. Security validation: Host header (protect against DNS rebinding)
  if (!isAllowedHost(req.headers.host)) {
    sendJson(res, 403, { error: 'Forbidden: invalid host header' });
    return;
  }

  // 3. Security validation: Origin header (protect against rogue web pages)
  const origin = req.headers.origin;
  if (origin && !isAllowedOrigin(origin)) {
    sendJson(res, 403, { error: 'Forbidden: cross-origin requests from external domains not allowed' });
    return;
  }

  // 4. Security validation: Bearer token authentication
  if (!isAuthorized(req.headers.authorization, settings.apiToken)) {
    sendJson(res, 401, { error: 'Unauthorized: valid Bearer token required' });
    return;
  }

  // 5. Parse route and method
  const rawUrl = req.url ?? '/';
  const pathname = rawUrl.split('?')[0];
  const method = req.method ?? 'GET';

  // GET / or GET /health
  if (method === 'GET' && (pathname === '/' || pathname === '/health')) {
    sendJson(res, 200, {
      status: 'ok',
      service: 'ProfileBrowser REST API',
      version: '1.0.0',
    });
    return;
  }

  // GET /profiles
  if (method === 'GET' && pathname === '/profiles') {
    try {
      const profiles = listProfiles().map((p) => ({
        id: p.id,
        name: p.name,
        status: launcherService.isRunning(p.id) ? 'running' : p.status,
        groupId: p.groupId,
        proxyId: p.proxyId,
        tags: p.tags,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
        lastLaunchedAt: p.lastLaunchedAt,
      }));
      sendJson(res, 200, { profiles });
    } catch (err) {
      sendJson(res, 500, { error: `Failed to list profiles: ${String(err)}` });
    }
    return;
  }

  // POST /profiles/:id/start
  const startMatch = pathname.match(/^\/profiles\/([a-zA-Z0-9_-]+)\/start\/?$/);
  if (method === 'POST' && startMatch) {
    const profileId = startMatch[1];
    void (async () => {
      try {
        const browser = await launcherService.launch(profileId);
        sendJson(res, 200, {
          ok: true,
          profileId,
          status: 'running',
          wsEndpoint: browser.cdpEndpoint,
          pid: browser.pid,
        });
      } catch (err) {
        sendJson(res, 400, {
          ok: false,
          profileId,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    })();
    return;
  }

  // POST /profiles/:id/stop
  const stopMatch = pathname.match(/^\/profiles\/([a-zA-Z0-9_-]+)\/stop\/?$/);
  if (method === 'POST' && stopMatch) {
    const profileId = stopMatch[1];
    void (async () => {
      try {
        await launcherService.stop(profileId);
        sendJson(res, 200, {
          ok: true,
          profileId,
          status: 'idle',
        });
      } catch (err) {
        sendJson(res, 400, {
          ok: false,
          profileId,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    })();
    return;
  }

  // 404 for unknown endpoints
  sendJson(res, 404, { error: `Route not found: ${method} ${pathname}` });
}

/**
 * Starts the local REST API server bound strictly to 127.0.0.1.
 */
export async function startLocalApi(port?: number): Promise<number> {
  if (server) {
    await stopLocalApi();
  }

  const settings = getSettings();
  if (!settings.apiEnabled) {
    console.log('[local-api] Local REST API is disabled in settings');
    return 0;
  }

  const targetPort = port ?? settings.apiPort ?? 3001;

  return new Promise<number>((resolve, reject) => {
    const srv = http.createServer(handleRequest);

    srv.on('error', (err) => {
      console.error('[local-api] Server error:', err);
      reject(err);
    });

    // Bound strictly to 127.0.0.1
    srv.listen(targetPort, '127.0.0.1', () => {
      const addr = srv.address();
      const boundPort = typeof addr === 'object' && addr !== null ? addr.port : targetPort;
      currentPort = boundPort;
      server = srv;
      console.log(`[local-api] REST Automation API running at http://127.0.0.1:${boundPort}`);
      resolve(boundPort);
    });
  });
}

/**
 * Stops the local REST API server.
 */
export async function stopLocalApi(): Promise<void> {
  if (!server) return;
  return new Promise<void>((resolve) => {
    server?.close(() => {
      server = null;
      currentPort = 0;
      console.log('[local-api] REST API stopped');
      resolve();
    });
  });
}

export function getLocalApiPort(): number {
  return currentPort;
}
