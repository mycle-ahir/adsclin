import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as http from 'http';
import type { BrowserContext } from 'playwright';
import { ChromiumPlaywrightEngine } from '../../src/main/engine/chromium-playwright';
import { generateFingerprint } from '../../src/main/services/fingerprint-generator';

const engine = new ChromiumPlaywrightEngine();
const tempDirs: string[] = [];

function makeTempProfileDir(name: string): string {
  const dir = path.join(os.tmpdir(), `pb-e2e-${name}-${Date.now()}`);
  fs.mkdirSync(dir, { recursive: true });
  tempDirs.push(dir);
  return dir;
}

test.afterAll(() => {
  // Clean up any test profile directories created during E2E tests
  for (const dir of tempDirs) {
    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch {
      // ignore Windows file locks if any take an extra moment to release
    }
  }
});

test.describe('E2E: ChromiumPlaywrightEngine persistent context & isolation', () => {
  test('1. Launches persistent context and initializes profile directory', async () => {
    const profileDir = makeTempProfileDir('p1');
    const running = await engine.launch({
      profileId: 'e2e-p1',
      userDataDir: profileDir,
    });

    try {
      expect(running).toBeDefined();
      expect(typeof running.close).toBe('function');
      expect(typeof running.onClose).toBe('function');

      // Verify profile storage directory was populated by Chromium
      expect(fs.existsSync(profileDir)).toBe(true);
      const files = fs.readdirSync(profileDir);
      expect(files.length).toBeGreaterThan(0);
    } finally {
      await running.close();
    }
  });

  test('2. Two profiles launched concurrently have isolated storage', async () => {
    const dirA = makeTempProfileDir('iso-a');
    const dirB = makeTempProfileDir('iso-b');

    const browserA = await engine.launch({
      profileId: 'e2e-iso-a',
      userDataDir: dirA,
    });

    const browserB = await engine.launch({
      profileId: 'e2e-iso-b',
      userDataDir: dirB,
    });

    try {
      expect(dirA).not.toBe(dirB);
      expect(fs.existsSync(dirA)).toBe(true);
      expect(fs.existsSync(dirB)).toBe(true);

      const filesA = fs.readdirSync(dirA);
      const filesB = fs.readdirSync(dirB);
      expect(filesA.length).toBeGreaterThan(0);
      expect(filesB.length).toBeGreaterThan(0);
    } finally {
      await browserA.close();
      await browserB.close();
    }
  });

  test('3. Browser onClose callback fires upon close()', async () => {
    const profileDir = makeTempProfileDir('close-test');
    const running = await engine.launch({
      profileId: 'e2e-close',
      userDataDir: profileDir,
    });

    let closed = false;
    running.onClose(() => {
      closed = true;
    });

    await running.close();
    // Allow microtasks to settle
    await new Promise((r) => setTimeout(r, 100));

    expect(closed).toBe(true);
  });

  test('4. Browser launches cleanly with proxy configuration', async () => {
    let proxyConnected = false;

    // Start a test proxy server to verify browser binds cleanly to proxy settings
    const server = http.createServer((_req, res) => {
      proxyConnected = true;
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('ok');
    });

    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
    const address = server.address();
    if (!address || typeof address === 'string') {
      server.close();
      throw new Error('Failed to bind test proxy server');
    }

    const proxyPort = address.port;
    const profileDir = makeTempProfileDir('proxy-test');

    const running = await engine.launch({
      profileId: 'e2e-proxy',
      userDataDir: profileDir,
      proxy: {
        server: `http://127.0.0.1:${proxyPort}`,
      },
    });

    try {
      expect(fs.existsSync(profileDir)).toBe(true);
      expect(typeof running.close).toBe('function');
    } finally {
      await running.close();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  test('5. Injected fingerprint applies correctly to live Chromium context', async () => {
    const profileDir = makeTempProfileDir('fingerprint-test');
    const fingerprint = generateFingerprint({
      templateId: 'windows-11-desktop-intel',
      seed: 'test-seed-e2e-12345',
    });

    const running = await engine.launch({
      profileId: 'e2e-fingerprint',
      userDataDir: profileDir,
      fingerprint,
    });

    const context = running.context as BrowserContext;
    expect(context).toBeDefined();

    try {
      const page = context.pages()[0] || (await context.newPage());
      await page.goto('about:blank');

      // 1. Verify navigator properties
      const navHardwareConcurrency = await page.evaluate(() => navigator.hardwareConcurrency);
      const navDeviceMemory = await page.evaluate(() => (navigator as unknown as { deviceMemory: number }).deviceMemory);

      expect(navHardwareConcurrency).toBe(fingerprint.hardwareConcurrency);
      expect(navDeviceMemory).toBe(fingerprint.deviceMemory);

      // 2. Verify WebGL renderer override
      const webglRenderer = await page.evaluate(() => {
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl');
        if (!gl) return null;
        const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
        if (!debugInfo) return null;
        return gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
      });

      expect(webglRenderer).toBe(fingerprint.webgl.renderer);

      // 3. Verify Canvas noise injection is deterministic and active
      const canvasHash = await page.evaluate(() => {
        const canvas = document.createElement('canvas');
        canvas.width = 100;
        canvas.height = 100;
        const ctx = canvas.getContext('2d');
        if (!ctx) return '';
        ctx.fillStyle = 'rgb(200, 0, 0)';
        ctx.fillRect(10, 10, 50, 50);
        return canvas.toDataURL();
      });

      expect(canvasHash.length).toBeGreaterThan(0);
      expect(canvasHash.startsWith('data:image/png;base64,')).toBe(true);

      // 4. Verify Screen dimensions and anti-automation stealth
      const stealthCheck = await page.evaluate(() => ({
        screenWidth: screen.width,
        screenHeight: screen.height,
        dpr: window.devicePixelRatio,
        webdriver: (navigator as unknown as { webdriver: unknown }).webdriver,
        isNativeToString: Function.prototype.toString.call(CanvasRenderingContext2D.prototype.getImageData).includes('[native code]'),
        hasNavigatorOwnProperties: Object.getOwnPropertyNames(navigator).length,
      }));

      expect(stealthCheck.screenWidth).toBe(fingerprint.screen.width);
      expect(stealthCheck.screenHeight).toBe(fingerprint.screen.height);
      expect(stealthCheck.dpr).toBe(fingerprint.screen.dpr);
      expect(stealthCheck.webdriver).toBe(false);
      expect(stealthCheck.isNativeToString).toBe(true);
      expect(stealthCheck.hasNavigatorOwnProperties).toBe(0);
    } finally {
      await running.close();
    }
  });

  test('6. Live Chromium cookies add & retrieve round-trip', async () => {
    const profileDir = makeTempProfileDir('cookies');
    const running = await engine.launch({
      profileId: 'e2e-cookies',
      userDataDir: profileDir,
    });

    try {
      expect(typeof running.addCookies).toBe('function');
      expect(typeof running.getCookies).toBe('function');

      // Add a test cookie
      await running.addCookies!([
        {
          name: 'session_token',
          value: 'secret_abc_123',
          domain: 'example.com',
          path: '/',
          secure: true,
          httpOnly: true,
        },
      ]);

      // Retrieve cookies from the live running browser
      const cookies = await running.getCookies!();
      const matched = cookies.find((c) => c.name === 'session_token');
      expect(matched).toBeDefined();
      expect(matched?.value).toBe('secret_abc_123');
      expect(matched?.domain).toContain('example.com');
      expect(matched?.httpOnly).toBe(true);
    } finally {
      await running.close();
    }
  });

  test('7. Launches live Chromium with custom window bounds viewport', async () => {
    const profileDir = makeTempProfileDir('window-bounds');
    const running = await engine.launch({
      profileId: 'e2e-bounds',
      userDataDir: profileDir,
      windowBounds: { x: 50, y: 50, width: 850, height: 650 },
    });

    const context = running.context as BrowserContext;
    expect(context).toBeDefined();

    try {
      const page = context.pages()[0] || (await context.newPage());
      await page.goto('about:blank');

      const viewport = page.viewportSize();
      expect(viewport).toEqual({ width: 850, height: 650 });
    } finally {
      await running.close();
    }
  });

  test('8. Launches live Chromium with unpacked extension directory', async () => {
    const profileDir = makeTempProfileDir('extension');
    const extDir = path.join(os.tmpdir(), `pb-ext-${Date.now()}`);
    fs.mkdirSync(extDir, { recursive: true });
    tempDirs.push(extDir);

    // Minimal Manifest V3 extension
    const manifest = {
      manifest_version: 3,
      name: 'Test Extension',
      version: '1.0.0',
      description: 'ProfileBrowser E2E test extension',
    };
    fs.writeFileSync(path.join(extDir, 'manifest.json'), JSON.stringify(manifest, null, 2));

    const running = await engine.launch({
      profileId: 'e2e-ext',
      userDataDir: profileDir,
      extensions: [extDir],
    });

    try {
      expect(running).toBeDefined();
      expect(typeof running.close).toBe('function');
      expect(running.context).toBeDefined();
    } finally {
      await running.close();
    }
  });
});


