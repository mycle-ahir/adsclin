/**
 * Playwright persistent-context implementation of BrowserEngine.
 * This is the ONLY file that imports playwright-core.
 */

import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';
import { chromium, type BrowserContext } from 'playwright-core';
import type { BrowserEngine, LaunchOptions, RunningBrowser } from './browser-engine';
import type { BrowserCookie } from '../../shared/types';
import { generateProfileExtension } from '../services/extension-generator';
import {
  getBrowserLaunchArgs,
  buildInitScript,
} from '../services/fingerprint-injector';

function resolveExecutablePath(): string {
  const envPath = process.env['PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH'];
  if (envPath && fs.existsSync(envPath)) {
    return envPath;
  }
  const preferred = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    path.join(process.env['LOCALAPPDATA'] ?? '', 'Google\\Chrome\\Application\\chrome.exe'),
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  ];
  for (const p of preferred) {
    if (fs.existsSync(p)) return p;
  }
  try {
    const pwPath = chromium.executablePath();
    if (fs.existsSync(pwPath)) return pwPath;
  } catch {
    // ignore
  }
  return 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
}

async function launchNativeChrome(
  executablePath: string,
  opts: LaunchOptions
): Promise<RunningBrowser> {
  const exts = [...(opts.extensions ?? [])];
  if (opts.fingerprint) {
    const coreExtDir = generateProfileExtension(opts.userDataDir, opts.fingerprint);
    exts.push(coreExtDir);
  }

  const nativeArgs = [
    `--user-data-dir=${opts.userDataDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--password-store=basic',
    '--disable-features=ChromeWhatsNewUI,Translate',
    ...getBrowserLaunchArgs(opts.fingerprint),
  ];

  if (opts.proxy) {
    nativeArgs.push(`--proxy-server=${opts.proxy.server}`);
  }

  const validExts = exts.filter((p) => typeof p === 'string' && p.trim().length > 0);
  if (validExts.length > 0) {
    const extPaths = validExts.join(',');
    nativeArgs.push(
      `--disable-extensions-except=${extPaths}`,
      `--load-extension=${extPaths}`
    );
  }

  if (opts.windowBounds) {
    nativeArgs.push(
      `--window-position=${opts.windowBounds.x},${opts.windowBounds.y}`,
      `--window-size=${opts.windowBounds.width},${opts.windowBounds.height}`
    );
  } else if (opts.fingerprint) {
    nativeArgs.push(
      `--window-size=${opts.fingerprint.screen.width},${opts.fingerprint.screen.height}`
    );
  }

  if (opts.fingerprint) {
    nativeArgs.push(`--lang=${opts.fingerprint.languages[0] ?? 'en-US'}`);
  }

  console.log(
    `[engine:native] Spawning native un-automated Chrome for profile ${opts.profileId}`,
    `bin=${executablePath}`,
    `proxy=${opts.proxy ? opts.proxy.server : 'none'}`
  );

  const child = spawn(executablePath, nativeArgs, {
    detached: false,
    stdio: 'ignore',
    env: {
      ...process.env,
      TZ: opts.fingerprint?.timezone ?? process.env['TZ'] ?? 'UTC',
    },
  });

  const closeCallbacks: Array<() => void> = [];
  child.on('exit', () => {
    for (const cb of closeCallbacks) cb();
  });

  return {
    pid: child.pid,
    cdpEndpoint: '',
    onClose(cb: () => void): void {
      closeCallbacks.push(cb);
    },
    async close(): Promise<void> {
      try {
        child.kill();
      } catch {
        // ignore
      }
    },
  };
}

export class ChromiumPlaywrightEngine implements BrowserEngine {
  readonly id = 'chromium-playwright' as const;

  async launch(opts: LaunchOptions): Promise<RunningBrowser> {
    // Ensure user-data directory exists before Playwright tries to use it
    fs.mkdirSync(opts.userDataDir, { recursive: true });

    const executablePath = resolveExecutablePath();

    // Redacted log — no credentials here; proxy.server is a local forwarder address
    console.log(
      `[engine] Launching Chromium for profile ${opts.profileId}`,
      `executable=${executablePath}`,
      `proxy=${opts.proxy ? opts.proxy.server : 'none'}`,
      `fingerprint=${opts.fingerprint ? opts.fingerprint.seed : 'none'}`
    );

    const extraArgs = [
      '--no-sandbox',
      '--disable-dev-shm-usage',
      // Do NOT add --remote-debugging-port=0 — it creates a DevTools endpoint
      // that anti-bot scripts detect via console.context and DevToolsActivePort.
      '--disable-features=ChromeWhatsNewUI',
      '--disable-infobars',
      '--hide-scrollbars',
      '--mute-audio',
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-background-networking',
      '--disable-sync',
      '--disable-translate',
      '--disable-default-apps',
      '--no-pings',
      '--password-store=basic',
      '--use-mock-keychain',
      ...getBrowserLaunchArgs(opts.fingerprint),
    ];

    if (opts.extensions && opts.extensions.length > 0) {
      const validExts = opts.extensions.filter((p) => typeof p === 'string' && p.trim().length > 0);
      if (validExts.length > 0) {
        const extPaths = validExts.join(',');
        extraArgs.push(
          `--disable-extensions-except=${extPaths}`,
          `--load-extension=${extPaths}`
        );
      }
    }

    if (opts.windowBounds) {
      extraArgs.push(
        `--window-position=${opts.windowBounds.x},${opts.windowBounds.y}`,
        `--window-size=${opts.windowBounds.width},${opts.windowBounds.height}`
      );
    } else if (opts.fingerprint) {
      extraArgs.push(
        `--window-size=${opts.fingerprint.screen.width},${opts.fingerprint.screen.height}`
      );
    }

    const contextOptions: NonNullable<Parameters<typeof chromium.launchPersistentContext>[1]> = {
      executablePath,
      headless: process.env['HEADLESS'] === 'true' || process.env['CI'] === 'true',
      args: extraArgs,
      ignoreDefaultArgs: ['--enable-automation', '--enable-blink-features=IdleDetection'],
    };

    if (opts.fingerprint) {
      const fp = opts.fingerprint;
      contextOptions.userAgent = fp.userAgent;
      contextOptions.locale = fp.languages[0] ?? 'en-US';
      contextOptions.timezoneId = fp.timezone;
      if (fp.geolocation) {
        contextOptions.geolocation = {
          latitude: fp.geolocation.lat,
          longitude: fp.geolocation.lon,
          accuracy: fp.geolocation.accuracy,
        };
        contextOptions.permissions = ['geolocation'];
      }

      // Inject matching Sec-CH-UA headers so HTTP-level Client Hints
      // match the JS-level navigator.userAgentData (neutralizes eagle).
      const brandsFull = fp.uaMetadata.fullVersionList ?? fp.uaMetadata.brands;
      const secChUa = brandsFull
        .map((b) => `"${b.brand}";v="${b.version.split('.')[0]}"`)
        .join(', ');
      const secChUaFull = brandsFull
        .map((b) => `"${b.brand}";v="${b.version}"`)
        .join(', ');
      const langList = (fp.languages ?? ['en-US', 'en']).join(',');
      contextOptions.extraHTTPHeaders = {
        'Accept-Language': `${langList};q=0.9`,
        'Sec-CH-UA': secChUa,
        'Sec-CH-UA-Full-Version-List': secChUaFull,
        'Sec-CH-UA-Mobile': fp.uaMetadata.mobile ? '?1' : '?0',
        'Sec-CH-UA-Platform': `"${fp.uaMetadata.platform}"`,
        'Sec-CH-UA-Platform-Version': `"${fp.uaMetadata.platformVersion ?? '15.0.0'}"`,
        'Sec-CH-UA-Arch': `"${fp.uaMetadata.architecture}"`,
        'Sec-CH-UA-Bitness': `"${fp.uaMetadata.bitness ?? '64'}"`,
        'Sec-CH-UA-Model': `"${fp.uaMetadata.model ?? ''}"`,
        'Sec-CH-UA-WoW64': '?0',
      };
    }

    if (opts.proxy) {
      contextOptions.proxy = {
        server: opts.proxy.server,
        ...(opts.proxy.username ? { username: opts.proxy.username } : {}),
        ...(opts.proxy.password ? { password: opts.proxy.password } : {}),
      };
    }

    if (opts.windowBounds) {
      contextOptions.viewport = {
        width: opts.windowBounds.width,
        height: opts.windowBounds.height,
      };
    } else {
      contextOptions.viewport = null;
    }

    const isTest =
      process.env['NODE_ENV'] === 'test' ||
      process.env['CI'] === 'true' ||
      process.env['TEST_WORKER_INDEX'] !== undefined ||
      process.env['npm_lifecycle_event'] === 'test:e2e' ||
      opts.profileId.startsWith('e2e-');
    if (!isTest && !contextOptions.headless) {
      return launchNativeChrome(executablePath, opts);
    }

    let context: BrowserContext;
    try {
      context = await chromium.launchPersistentContext(opts.userDataDir, contextOptions);
    } catch (err) {
      throw new Error(
        `Failed to launch Chromium for profile ${opts.profileId}: ${err instanceof Error ? err.message : String(err)}`
      );
    }

    if (opts.fingerprint) {
      // Inject Navigator, WebGL, Canvas, Audio noise init-scripts
      await context.addInitScript(buildInitScript(opts.fingerprint));
    }

    // Browser handle may provide pid or wsEndpoint in some runtimes
    const browserObj = context.browser() as unknown as {
      process?: () => { pid?: number };
      wsEndpoint?: () => string;
    } | null;

    const pid = browserObj?.process?.()?.pid;
    let cdpEndpoint = browserObj?.wsEndpoint?.() ?? '';

    // If Playwright does not expose wsEndpoint directly, read the ephemeral port allocated by Chromium
    if (!cdpEndpoint) {
      try {
        const activePortFile = path.join(opts.userDataDir, 'DevToolsActivePort');
        if (fs.existsSync(activePortFile)) {
          const lines = fs.readFileSync(activePortFile, 'utf8').trim().split('\n');
          const port = lines[0]?.trim();
          const wsPath = lines[1]?.trim() ?? '';
          if (port) {
            cdpEndpoint = `ws://127.0.0.1:${port}${wsPath.startsWith('/') ? '' : '/'}${wsPath}`;
          }
        }
      } catch {
        // DevToolsActivePort resolution is best-effort
      }
    }

    const closeCallbacks: Array<() => void> = [];

    context.on('close', () => {
      for (const cb of closeCallbacks) cb();
    });

    return {
      pid,
      cdpEndpoint,
      context,
      onClose(cb: () => void): void {
        closeCallbacks.push(cb);
      },
      async close(): Promise<void> {
        await context.close();
      },
      async getCookies(): Promise<BrowserCookie[]> {
        const rawCookies = await context.cookies();
        return rawCookies.map((c) => ({
          name: c.name,
          value: c.value,
          domain: c.domain,
          path: c.path,
          expires: c.expires > 0 ? c.expires : undefined,
          httpOnly: c.httpOnly,
          secure: c.secure,
          sameSite: c.sameSite,
        }));
      },
      async addCookies(cookies: BrowserCookie[]): Promise<void> {
        const pwCookies = cookies.map((c) => {
          const item: {
            name: string;
            value: string;
            domain: string;
            path: string;
            expires?: number;
            httpOnly?: boolean;
            secure?: boolean;
            sameSite?: 'Strict' | 'Lax' | 'None';
          } = {
            name: c.name,
            value: c.value,
            domain: c.domain,
            path: c.path,
          };
          if (c.expires !== undefined) item.expires = c.expires;
          if (c.httpOnly !== undefined) item.httpOnly = c.httpOnly;
          if (c.secure !== undefined) item.secure = c.secure;
          if (c.sameSite !== undefined) item.sameSite = c.sameSite;
          return item;
        });
        await context.addCookies(pwCookies);
      },
    };
  }

  async getCookies(userDataDir: string): Promise<BrowserCookie[]> {
    fs.mkdirSync(userDataDir, { recursive: true });
    const executablePath = resolveExecutablePath();
    const ctx = await chromium.launchPersistentContext(userDataDir, {
      executablePath,
      headless: true,
      args: ['--no-sandbox', '--disable-dev-shm-usage'],
    });
    try {
      const rawCookies = await ctx.cookies();
      return rawCookies.map((c) => ({
        name: c.name,
        value: c.value,
        domain: c.domain,
        path: c.path,
        expires: c.expires > 0 ? c.expires : undefined,
        httpOnly: c.httpOnly,
        secure: c.secure,
        sameSite: c.sameSite,
      }));
    } finally {
      await ctx.close();
    }
  }

  async addCookies(userDataDir: string, cookies: BrowserCookie[]): Promise<void> {
    fs.mkdirSync(userDataDir, { recursive: true });
    const executablePath = resolveExecutablePath();
    const ctx = await chromium.launchPersistentContext(userDataDir, {
      executablePath,
      headless: true,
      args: ['--no-sandbox', '--disable-dev-shm-usage'],
    });
    try {
      const pwCookies = cookies.map((c) => {
        const item: {
          name: string;
          value: string;
          domain: string;
          path: string;
          expires?: number;
          httpOnly?: boolean;
          secure?: boolean;
          sameSite?: 'Strict' | 'Lax' | 'None';
        } = {
          name: c.name,
          value: c.value,
          domain: c.domain,
          path: c.path,
        };
        if (c.expires !== undefined) item.expires = c.expires;
        if (c.httpOnly !== undefined) item.httpOnly = c.httpOnly;
        if (c.secure !== undefined) item.secure = c.secure;
        if (c.sameSite !== undefined) item.sameSite = c.sameSite;
        return item;
      });
      await ctx.addCookies(pwCookies);
    } finally {
      await ctx.close();
    }
  }
}

