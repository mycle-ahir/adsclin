/**
 * BrowserEngine abstraction layer.
 * All browser launching MUST go through this interface — never import Playwright
 * directly in service files.
 */

import type { FingerprintConfig, BrowserCookie } from '../../shared/types';

export interface LaunchOptions {
  profileId: string;
  userDataDir: string;
  proxy?: {
    /** Local forwarder address, e.g. "http://127.0.0.1:8877" */
    server: string;
    /** Unused for local anonymous forwarders, kept for interface completeness */
    username?: string | undefined;
    /** Unused for local anonymous forwarders, kept for interface completeness */
    password?: string | undefined;
  } | undefined;
  /** Phase 2 — Fingerprint configuration */
  fingerprint?: FingerprintConfig | undefined;
  /** Phase 3 — browser extension paths */
  extensions?: string[] | undefined;
  windowBounds?: { x: number; y: number; width: number; height: number } | undefined;
}

export interface RunningBrowser {
  /** OS process ID of the browser, undefined if not available */
  pid: number | undefined;
  /** CDP WebSocket endpoint; set to '' if not yet available (Phase 3) */
  cdpEndpoint: string;
  /** Register a callback to be called when the browser context closes */
  onClose(cb: () => void): void;
  /** Gracefully close the browser context */
  close(): Promise<void>;
  /** Retrieve live session cookies */
  getCookies?: () => Promise<BrowserCookie[]>;
  /** Add cookies into active browser context */
  addCookies?: (cookies: BrowserCookie[]) => Promise<void>;
  /** Optional underlying BrowserContext for testing and diagnostics */
  context?: unknown;
}

export interface BrowserEngine {
  readonly id: 'chromium-playwright';
  launch(opts: LaunchOptions): Promise<RunningBrowser>;
  getCookies(userDataDir: string): Promise<BrowserCookie[]>;
  addCookies(userDataDir: string, cookies: BrowserCookie[]): Promise<void>;
}

