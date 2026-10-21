/**
 * LauncherService — lifecycle management for browser profile sessions.
 *
 * Responsibilities:
 *  - Launch a Chromium profile via BrowserEngine
 *  - Start a local proxy-chain forwarder when a proxy is configured
 *    (keeps credentials off Chromium's command line regardless of auth)
 *  - Refuse to launch the same profile twice (focus existing window instead)
 *  - Update profile status in DB and push events to the renderer
 *  - Clean up on browser close (internal or user-triggered)
 */

import { screen } from 'electron';
import * as http from 'http';
import * as https from 'https';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { getProfile, updateProfileStatus, listProfiles } from './profile-service';
import { getProxyWithPassword } from './proxy-service';
import { startForwarder, type ForwarderHandle } from './proxy-forwarder';
import { recordActivity } from './activity-service';
import { ChromiumPlaywrightEngine } from '../engine/chromium-playwright';
import type { RunningBrowser } from '../engine/browser-engine';
import type { ProfileStatus, WindowBounds } from '../../shared/types';
import { getMainWindow } from '../index';
import { detectSystemBrowserVersion } from './fingerprint-generator';
import { verifyLaunchAllowed } from './auth-service';
import { getTimezoneForCountry, getLanguagesForCountry } from '../../shared/geo-utils';

// ---------------------------------------------------------------------------
// Module-level state
// ---------------------------------------------------------------------------

// Singleton engine — can be swapped in tests via module mocking
const engine = new ChromiumPlaywrightEngine();

interface ActiveSession {
  browser: RunningBrowser;
  forwarder: ForwarderHandle | null;
}

/** Maps profileId → active session */
const sessions = new Map<string, ActiveSession>();

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

/**
 * Pushes a status-changed event to the renderer and persists the status in DB.
 * Errors are caught and logged so they never propagate to the caller.
 */
function setProfileStatus(profileId: string, status: ProfileStatus): void {
  try {
    updateProfileStatus(profileId, status);
  } catch (err) {
    console.error(`[launcher] Failed to persist status for profile ${profileId}:`, err);
  }

  try {
    // Push to renderer — fire-and-forget is acceptable here (event notification)
    getMainWindow()?.webContents.send('profile:statusChanged', profileId, status);
  } catch (err) {
    console.error(`[launcher] Failed to send statusChanged event for profile ${profileId}:`, err);
  }
}

/**
 * Called when a browser closes — either via stop() or externally (user closed window).
 */
function handleClose(profileId: string): void {
  const session = sessions.get(profileId);
  sessions.delete(profileId);

  if (session?.forwarder) {
    // Fire-and-forget: forwarder cleanup is best-effort
    session.forwarder.close().catch(() => undefined);
  }

  setProfileStatus(profileId, 'idle');
  console.log(`[launcher] Profile ${profileId} closed — status set to idle`);
  try {
    recordActivity('profile:stop', 'profile', profileId);
  } catch {
    // Activity recording is non-blocking
  }
}

interface ProxyGeoInfo {
  ip?: string | undefined;
  country?: string | undefined;
  timezone?: string | undefined;
  loc?: string | undefined;
}

function fetchProxyGeoFallback(port: string, resolve: (val: ProxyGeoInfo | null) => void): void {
  try {
    const req = http.get(
      {
        host: '127.0.0.1',
        port: Number(port),
        path: 'http://ip-api.com/json',
        headers: { Host: 'ip-api.com', Accept: 'application/json' },
        timeout: 4000,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () => {
          try {
            const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8')) as {
              status?: string;
              timezone?: string;
              lat?: number;
              lon?: number;
              query?: string;
              country?: string;
            };
            if (parsed.status === 'success' && parsed.timezone) {
              resolve({
                ip: parsed.query,
                country: parsed.country,
                timezone: parsed.timezone,
                loc: parsed.lat !== undefined && parsed.lon !== undefined ? `${parsed.lat},${parsed.lon}` : undefined,
              });
              return;
            }
            resolve(null);
          } catch {
            resolve(null);
          }
        });
        res.on('error', () => resolve(null));
      }
    );
    req.on('error', () => resolve(null));
    req.on('timeout', () => {
      req.destroy();
      resolve(null);
    });
  } catch {
    resolve(null);
  }
}

let cachedHostGeo: ProxyGeoInfo | null = null;
async function fetchHostGeo(): Promise<ProxyGeoInfo | null> {
  if (cachedHostGeo) return cachedHostGeo;
  if (process.env['NODE_ENV'] === 'test') return null;
  return new Promise((resolve) => {
    try {
      const req = http.get(
        {
          host: 'ip-api.com',
          path: '/json',
          headers: { Host: 'ip-api.com', Accept: 'application/json' },
          timeout: 3000,
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on('data', (c: Buffer) => chunks.push(c));
          res.on('end', () => {
            try {
              const data = JSON.parse(Buffer.concat(chunks).toString('utf8')) as {
                status?: string;
                timezone?: string;
                lat?: number;
                lon?: number;
                query?: string;
                country?: string;
              };
              if (data?.status === 'success' && data.lat !== undefined && data.lon !== undefined) {
                cachedHostGeo = {
                  ip: data.query,
                  country: data.country,
                  timezone: data.timezone,
                  loc: `${data.lat},${data.lon}`,
                };
                resolve(cachedHostGeo);
                return;
              }
              resolve(null);
            } catch {
              resolve(null);
            }
          });
          res.on('error', () => resolve(null));
        }
      );
      req.on('error', () => resolve(null));
      req.on('timeout', () => {
        req.destroy();
        resolve(null);
      });
    } catch {
      resolve(null);
    }
  });
}


async function fetchProxyGeo(localProxyUrl: string): Promise<ProxyGeoInfo | null> {
  if (process.env['NODE_ENV'] === 'test') {
    return null;
  }
  return new Promise((resolve) => {
    try {
      const port = new URL(localProxyUrl).port;
      const req = https.get(
        {
          hostname: 'ipinfo.io',
          path: '/json',
          headers: { Accept: 'application/json' },
          agent: new HttpsProxyAgent(`http://127.0.0.1:${port}`),
          timeout: 4000,
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on('data', (chunk: Buffer) => chunks.push(chunk));
          res.on('end', () => {
            try {
              const data = JSON.parse(Buffer.concat(chunks).toString('utf8')) as ProxyGeoInfo;
              if (data?.timezone) {
                resolve(data);
                return;
              }
              fetchProxyGeoFallback(port, resolve);
            } catch {
              fetchProxyGeoFallback(port, resolve);
            }
          });
          res.on('error', () => fetchProxyGeoFallback(port, resolve));
        }
      );
      req.on('error', () => fetchProxyGeoFallback(port, resolve));
      req.on('timeout', () => {
        req.destroy();
        fetchProxyGeoFallback(port, resolve);
      });
    } catch {
      resolve(null);
    }
  });
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Launches a Chromium browser for the given profile.
 *
 * If the profile is already running, the main window is focused and the call
 * returns immediately without launching a second browser.
 *
 * Proxy credentials are NEVER exposed to Chromium's command line; they are
 * tunnelled through a local proxy-chain forwarder.
 */
export async function launch(
  profileId: string,
  options?: { windowBounds?: WindowBounds }
): Promise<RunningBrowser> {
  // 0. Enforce authentication and active subscription/trial
  if (process.env['NODE_ENV'] !== 'test') {
    verifyLaunchAllowed();
  }

  // 1. Load profile
  const profile = getProfile(profileId);
  if (!profile) {
    throw new Error(`Profile not found: ${profileId}`);
  }

  // 2. Refuse duplicate launch — focus existing window instead
  if (sessions.has(profileId)) {
    console.log(`[launcher] Profile ${profileId} already running — focusing main window`);
    getMainWindow()?.focus();
    return sessions.get(profileId)!.browser;
  }

  // 3. Resolve proxy credentials if a proxy is assigned
  let forwarder: ForwarderHandle | null = null;
  let proxyServer: string | undefined;
  let assignedProxy: import('../../shared/types').Proxy | null = null;

  if (profile.proxyId) {
    const { proxy, password } = getProxyWithPassword(profile.proxyId);
    assignedProxy = proxy;

    // Build the upstream proxy URL with credentials (NEVER log this full URL)
    let upstreamUrl: string;
    if (proxy.username) {
      const encodedUser = encodeURIComponent(proxy.username);
      const encodedPass = password ? encodeURIComponent(password) : '';
      upstreamUrl = `${proxy.scheme}://${encodedUser}:${encodedPass}@${proxy.host}:${proxy.port}`;
    } else {
      upstreamUrl = `${proxy.scheme}://${proxy.host}:${proxy.port}`;
    }

    // Redacted log — only scheme+host+port
    console.log(
      `[launcher] Starting forwarder for proxy ${proxy.scheme}://${proxy.host}:${proxy.port}`
    );

    // Always use a forwarder — keeps credentials off Chromium's command line
    forwarder = await startForwarder(upstreamUrl);
    proxyServer = forwarder.localUrl;

    console.log(`[launcher] Forwarder listening at ${forwarder.localUrl}`);
  }

  // 4. Launch the browser
  const launchOpts: import('../engine/browser-engine').LaunchOptions = {
    profileId,
    userDataDir: profile.userDataDir,
  };
  if (proxyServer) {
    launchOpts.proxy = { server: proxyServer };
  }
  if (profile.fingerprint) {
    const effectiveFp = { ...profile.fingerprint };

    // If proxy was tested and has known country, align initial timezone & languages
    if (assignedProxy?.lastTestCountry) {
      effectiveFp.languages = getLanguagesForCountry(assignedProxy.lastTestCountry);
      if (assignedProxy.lastTestTimezone) {
        effectiveFp.timezone = assignedProxy.lastTestTimezone;
      } else {
        effectiveFp.timezone = getTimezoneForCountry(assignedProxy.lastTestCountry);
      }
    }

    if (forwarder) {
      try {
        const geo = await fetchProxyGeo(forwarder.localUrl);
        if (geo?.timezone) {
          effectiveFp.timezone = geo.timezone;
        } else if (geo?.country) {
          effectiveFp.timezone = getTimezoneForCountry(geo.country);
        }
        if (geo?.country) {
          effectiveFp.languages = getLanguagesForCountry(geo.country);
        }
        if (geo?.loc) {
          const parts = geo.loc.split(',');
          const lat = parseFloat(parts[0] ?? '0');
          const lon = parseFloat(parts[1] ?? '0');
          if (!isNaN(lat) && !isNaN(lon)) {
            effectiveFp.geolocation = { lat, lon, accuracy: 50 };
          }
        }
      } catch {
        // Fall back to profile's configured fingerprint
      }
    } else {
      // Without a proxy, align timezone and geolocation with host's real network location to prevent 'light' signal
      try {
        const localTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        if (localTz) {
          effectiveFp.timezone = localTz;
        }
        const hostGeo = await fetchHostGeo();
        if (hostGeo?.timezone) {
          effectiveFp.timezone = hostGeo.timezone;
        }
        if (hostGeo?.country) {
          effectiveFp.languages = getLanguagesForCountry(hostGeo.country);
        }
        if (hostGeo?.loc) {
          const parts = hostGeo.loc.split(',');
          const lat = parseFloat(parts[0] ?? '0');
          const lon = parseFloat(parts[1] ?? '0');
          if (!isNaN(lat) && !isNaN(lon)) {
            effectiveFp.geolocation = { lat, lon, accuracy: 25 };
          }
        }
      } catch {
        // ignore
      }
    }

    // Always align declared browser version with host Chrome binary to prevent 'eagle' signal
    const hostBrowser = detectSystemBrowserVersion();
    if (hostBrowser) {
      effectiveFp.browserVersion = hostBrowser.major;
      effectiveFp.userAgent = effectiveFp.userAgent.replace(/Chrome\/[\d.]+/g, `Chrome/${hostBrowser.full}`);
      if (effectiveFp.uaMetadata) {
        effectiveFp.uaMetadata.brands = [
          { brand: 'Not(A:Brand', version: '24' },
          { brand: 'Chromium', version: hostBrowser.major },
          { brand: 'Google Chrome', version: hostBrowser.major },
        ];
        effectiveFp.uaMetadata.fullVersionList = [
          { brand: 'Not(A:Brand', version: '24.0.0.0' },
          { brand: 'Chromium', version: hostBrowser.full },
          { brand: 'Google Chrome', version: hostBrowser.full },
        ];
      }
    }

    launchOpts.fingerprint = effectiveFp;
  }
  if (profile.extensions && profile.extensions.length > 0) {
    launchOpts.extensions = profile.extensions;
  }
  if (options?.windowBounds) {
    launchOpts.windowBounds = options.windowBounds;
  }
  const browser = await engine.launch(launchOpts);

  console.log(
    `[launcher] Profile ${profileId} launched — pid=${browser.pid ?? 'unknown'}`
  );

  // 5. Register close handler
  browser.onClose(() => {
    handleClose(profileId);
  });

  // 6. Track session
  sessions.set(profileId, { browser, forwarder });

  // 7. Persist running status
  setProfileStatus(profileId, 'running');

  try {
    recordActivity('profile:launch', 'profile', profileId, {
      pid: browser.pid,
      proxyAssigned: Boolean(profile.proxyId),
    });
  } catch {
    // Non-blocking
  }

  return browser;
}

/**
 * Calculates (x, y, width, height) grid coordinates for tiling N windows across a display.
 */
export function calculateTileBounds(count: number, displayBounds?: WindowBounds): WindowBounds[] {
  if (count <= 0) return [];

  const screenBounds = displayBounds ?? { x: 0, y: 0, width: 1920, height: 1080 };
  const cols = Math.ceil(Math.sqrt(count));
  const rows = Math.ceil(count / cols);
  const tileWidth = Math.floor(screenBounds.width / cols);
  const tileHeight = Math.floor(screenBounds.height / rows);

  const bounds: WindowBounds[] = [];
  for (let i = 0; i < count; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    bounds.push({
      x: screenBounds.x + col * tileWidth,
      y: screenBounds.y + row * tileHeight,
      width: tileWidth,
      height: tileHeight,
    });
  }
  return bounds;
}

/**
 * Launches all profiles in a given group, optionally tiling their browser windows.
 */
export async function launchGroup(
  groupId: string,
  options?: { tile?: boolean }
): Promise<string[]> {
  const allProfiles = listProfiles() ?? [];
  const groupProfiles = allProfiles.filter((p) => p.groupId === groupId);
  if (groupProfiles.length === 0) return [];

  let tileBounds: WindowBounds[] = [];
  if (options?.tile) {
    let displayBounds: WindowBounds | undefined;
    try {
      const primary = screen.getPrimaryDisplay();
      if (primary?.workArea) {
        displayBounds = {
          x: primary.workArea.x,
          y: primary.workArea.y,
          width: primary.workArea.width,
          height: primary.workArea.height,
        };
      }
    } catch {
      // Screen API may not be ready in headless or unit tests
    }
    tileBounds = calculateTileBounds(groupProfiles.length, displayBounds);
  }

  const launchedIds: string[] = [];
  for (let i = 0; i < groupProfiles.length; i++) {
    const p = groupProfiles[i];
    const bounds = tileBounds[i];
    await launch(p.id, bounds ? { windowBounds: bounds } : undefined);
    launchedIds.push(p.id);
  }

  try {
    recordActivity('group:launch', 'group', groupId, {
      count: launchedIds.length,
      tile: Boolean(options?.tile),
    });
  } catch {
    // Non-blocking
  }

  return launchedIds;
}

/**
 * Stops all running profiles in a given group.
 */
export async function stopGroup(groupId: string): Promise<string[]> {
  const allProfiles = listProfiles() ?? [];
  const groupProfiles = allProfiles.filter((p) => p.groupId === groupId && isRunning(p.id));
  const stoppedIds: string[] = [];
  for (const p of groupProfiles) {
    await stop(p.id);
    stoppedIds.push(p.id);
  }

  try {
    recordActivity('group:stop', 'group', groupId, {
      count: stoppedIds.length,
    });
  } catch {
    // Non-blocking
  }

  return stoppedIds;
}

/**
 * Stops the browser for the given profile.
 * If the profile is not running, the call is a no-op.
 */
export async function stop(profileId: string): Promise<void> {
  const session = sessions.get(profileId);
  if (!session) {
    console.log(`[launcher] stop() called but profile ${profileId} is not running — no-op`);
    return;
  }

  // Closing the browser will trigger the onClose callback → handleClose()
  await session.browser.close();
}

/**
 * Returns whether a profile currently has an active browser session.
 * Useful for status queries without touching the DB.
 */
export function isRunning(profileId: string): boolean {
  return sessions.has(profileId);
}

/**
 * Returns the running browser instance for a profile if active.
 */
export function getRunningBrowser(profileId: string): RunningBrowser | undefined {
  return sessions.get(profileId)?.browser;
}
