import { v4 as uuidv4 } from 'uuid';
import type { FingerprintConfig, FingerprintOS } from '../../shared/types';
import { FINGERPRINT_TEMPLATES, DEFAULT_TEMPLATE_ID } from './fingerprint-templates';

let cachedSystemBrowserVersion: { major: string; full: string } | null | undefined = undefined;

/**
 * Detects the actual installed Google Chrome or Microsoft Edge version from the host machine.
 * This ensures that generated fingerprints match the underlying binary version with 100% precision.
 */
export function detectSystemBrowserVersion(): { major: string; full: string } | null {
  if (typeof globalThis !== 'undefined' && 'window' in globalThis) {
    return null;
  }
  if (cachedSystemBrowserVersion !== undefined) {
    return cachedSystemBrowserVersion;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const nodeFs = require('fs') as typeof import('fs');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const nodePath = require('path') as typeof import('path');
    const candidateDirs = [
      'C:\\Program Files\\Google\\Chrome\\Application',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application',
      nodePath.join(process.env['LOCALAPPDATA'] ?? '', 'Google\\Chrome\\Application'),
      'C:\\Program Files (x86)\\Microsoft\\Edge\\Application',
    ];
    for (const dir of candidateDirs) {
      if (nodeFs.existsSync(dir)) {
        const files = nodeFs.readdirSync(dir);
        const versionDirs = files.filter((f: string) => /^\d+\.\d+\.\d+\.\d+$/.test(f));
        if (versionDirs.length > 0 && versionDirs[0]) {
          const full = versionDirs[0];
          const major = full.split('.')[0] ?? '128';
          cachedSystemBrowserVersion = { major, full };
          return cachedSystemBrowserVersion;
        }
      }
    }
  } catch {
    // ignore
  }
  cachedSystemBrowserVersion = null;
  return null;
}

/**
 * 32-bit integer hash for string seeds.
 */
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return hash >>> 0;
}

/**
 * Mulberry32 deterministic pseudo-random number generator.
 */
function createPrng(seed: number): () => number {
  let s = seed;
  return function () {
    let t = (s += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pickRandom<T>(items: T[], prng: () => number): T {
  const index = Math.floor(prng() * items.length);
  return items[index];
}


export interface GenerateFingerprintOptions {
  seed?: string;
  templateId?: string;
  os?: FingerprintOS;
  timezone?: string;
  languages?: string[];
  browserVersion?: string;
}

/**
 * Generates a realistic, deterministic FingerprintConfig based on a stable seed and hardware template.
 */
export function generateFingerprint(options: GenerateFingerprintOptions = {}): FingerprintConfig {
  const seed = options.seed ?? uuidv4();

  let templateId = options.templateId;
  if (!templateId && options.os) {
    if (options.os === 'macos') templateId = 'macos-sonoma-arm';
    else if (options.os === 'linux') templateId = 'linux-ubuntu-intel';
    else templateId = 'windows-11-desktop-intel';
  } else if (!templateId) {
    templateId = DEFAULT_TEMPLATE_ID;
  }

  let template = FINGERPRINT_TEMPLATES[templateId];
  if (!template || (options.os && template.os !== options.os)) {
    if (options.os === 'macos') template = FINGERPRINT_TEMPLATES['macos-sonoma-arm']!;
    else if (options.os === 'linux') template = FINGERPRINT_TEMPLATES['linux-ubuntu-intel']!;
    else template = FINGERPRINT_TEMPLATES[DEFAULT_TEMPLATE_ID]!;
  }

  const prng = createPrng(hashString(seed));

  // Dynamically align with installed Chrome or Edge version if available on Windows
  const detected = detectSystemBrowserVersion();
  const browserMajor = options.browserVersion ?? detected?.major ?? '128';
  const fullBrowserVersion = detected && !options.browserVersion ? detected.full : `${browserMajor}.0.6613.120`;

  let userAgent = '';
  let platform = 'Windows';
  let platformVersion = '15.0.0';
  let architecture = 'x86';

  if (template.os === 'windows') {
    platform = 'Windows';
    platformVersion = '15.0.0'; // Windows 11
    architecture = 'x86';
    userAgent = `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${fullBrowserVersion} Safari/537.36`;
  } else if (template.os === 'macos') {
    platform = 'macOS';
    platformVersion = '14.5.0'; // macOS Sonoma
    architecture = 'arm';
    userAgent = `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${fullBrowserVersion} Safari/537.36`;
  } else {
    platform = 'Linux';
    platformVersion = '6.5.0';
    architecture = 'x86';
    userAgent = `Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${fullBrowserVersion} Safari/537.36`;
  }

  // Client Hints brands — must match the real Chromium binary brands exactly.
  // Real Chrome sends: Chromium, Google Chrome, and the not-A-Brand entry.
  const brands = [
    { brand: 'Not;A=Brand', version: '24' },
    { brand: 'Chromium', version: browserMajor },
    { brand: 'Google Chrome', version: browserMajor },
  ];

  const fullVersionList = [
    { brand: 'Not;A=Brand', version: '24.0.0.0' },
    { brand: 'Chromium', version: fullBrowserVersion },
    { brand: 'Google Chrome', version: fullBrowserVersion },
  ];

  const screen = pickRandom(template.screenResolutions, prng);
  const hardwareConcurrency = pickRandom(template.hardwareConcurrencyOptions, prng);
  const deviceMemory = pickRandom(template.deviceMemoryOptions, prng);
  const gpu = pickRandom(template.gpuOptions, prng);

  return {
    seed,
    os: template.os,
    browserVersion: browserMajor,
    userAgent,
    uaMetadata: {
      brands,
      fullVersionList,
      platform,
      platformVersion,
      architecture,
      model: '',
      mobile: false,
      bitness: '64',
    },
    screen,
    hardwareConcurrency,
    deviceMemory,
    languages: options.languages ?? ['en-US', 'en'],
    timezone: options.timezone ?? 'America/New_York',
    webrtc: 'proxy-only',
    canvas: 'noise',
    webgl: {
      vendor: gpu.vendor,
      renderer: gpu.renderer,
      noise: true,
    },
    audio: 'noise',
    fonts: [...template.defaultFonts],
    mediaDevices: {
      audioIn: 1,
      audioOut: 1,
      videoIn: 1,
    },
  };
}

/**
 * Repairs any inconsistencies between FingerprintConfig's declared OS, User-Agent,
 * Client Hints uaMetadata, WebGL renderer, and fonts.
 */
export function repairFingerprintConsistency(
  fp: FingerprintConfig,
  targetOs?: FingerprintOS
): FingerprintConfig {
  const os = targetOs ?? fp.os;
  let tplId = 'windows-11-desktop-intel';
  if (os === 'macos') tplId = 'macos-sonoma-arm';
  else if (os === 'linux') tplId = 'linux-ubuntu-intel';

  const fresh = generateFingerprint({
    seed: fp.seed,
    templateId: tplId,
    os,
    timezone: fp.timezone,
    languages: fp.languages,
    browserVersion: fp.browserVersion,
  });

  return {
    ...fp,
    os,
    userAgent: fresh.userAgent,
    uaMetadata: fresh.uaMetadata,
    screen: fresh.screen,
    webgl: fresh.webgl,
    fonts: fresh.fonts,
    hardwareConcurrency: fresh.hardwareConcurrency,
    deviceMemory: fresh.deviceMemory,
    webrtc: fp.webrtc,
    canvas: fp.canvas,
    audio: fp.audio,
    timezone: fp.timezone,
    languages: fp.languages,
    geolocation: fp.geolocation,
  };
}
