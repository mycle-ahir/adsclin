import type { FingerprintConfig, ValidationIssue } from '../../shared/types';

export interface ProxyGeoInfo {
  country?: string | null;
  timezone?: string | null;
}

// Common timezone prefixes / values for country codes
const COUNTRY_TIMEZONES: Record<string, string[]> = {
  US: ['America/', 'Pacific/Honolulu', 'US/'],
  CA: ['America/'],
  GB: ['Europe/London', 'GMT', 'UTC'],
  DE: ['Europe/Berlin'],
  FR: ['Europe/Paris'],
  JP: ['Asia/Tokyo'],
  IN: ['Asia/Kolkata', 'Asia/Calcutta'],
  AU: ['Australia/'],
  BR: ['America/'],
  RU: ['Europe/Moscow', 'Asia/'],
};

// Primary languages for country codes
const COUNTRY_LANGUAGES: Record<string, string[]> = {
  US: ['en', 'es'],
  CA: ['en', 'fr'],
  GB: ['en'],
  DE: ['de', 'en'],
  FR: ['fr', 'en'],
  JP: ['ja', 'en'],
  IN: ['en', 'hi'],
  BR: ['pt', 'en'],
  RU: ['ru', 'en'],
};

/**
 * Validates a FingerprintConfig for consistency across OS, fonts, GPU, browser versions, and proxy geolocation.
 * Returns a list of error (blocking) and warn (advisory) issues.
 */
export function validateFingerprint(
  config: FingerprintConfig,
  proxyGeo?: ProxyGeoInfo | null
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  // 1. OS ↔ User-Agent ↔ uaMetadata.platform
  const ua = config.userAgent.toLowerCase();
  const platform = config.uaMetadata.platform.toLowerCase();

  if (config.os === 'windows') {
    if (!ua.includes('windows')) {
      issues.push({
        field: 'userAgent',
        message: 'OS is windows but userAgent does not contain "Windows"',
        severity: 'error',
      });
    }
    if (!platform.includes('windows')) {
      issues.push({
        field: 'uaMetadata.platform',
        message: `OS is windows but uaMetadata.platform is "${config.uaMetadata.platform}"`,
        severity: 'error',
      });
    }
  } else if (config.os === 'macos') {
    if (!ua.includes('macintosh') && !ua.includes('mac os x')) {
      issues.push({
        field: 'userAgent',
        message: 'OS is macos but userAgent does not contain "Macintosh" or "Mac OS X"',
        severity: 'error',
      });
    }
    if (!platform.includes('mac')) {
      issues.push({
        field: 'uaMetadata.platform',
        message: `OS is macos but uaMetadata.platform is "${config.uaMetadata.platform}"`,
        severity: 'error',
      });
    }
  } else if (config.os === 'linux') {
    if (!ua.includes('linux')) {
      issues.push({
        field: 'userAgent',
        message: 'OS is linux but userAgent does not contain "Linux"',
        severity: 'error',
      });
    }
    if (!platform.includes('linux')) {
      issues.push({
        field: 'uaMetadata.platform',
        message: `OS is linux but uaMetadata.platform is "${config.uaMetadata.platform}"`,
        severity: 'error',
      });
    }
  }

  // 2. OS ↔ Fonts
  const fonts = config.fonts;
  const hasWindowsFont = fonts.some((f) => ['segoe ui', 'calibri', 'consolas'].includes(f.toLowerCase()));
  const hasAppleFont = fonts.some((f) => ['-apple-system', 'sf pro', 'helvetica neue'].includes(f.toLowerCase()));

  if (config.os === 'macos' && hasWindowsFont && !hasAppleFont) {
    issues.push({
      field: 'fonts',
      message: 'macOS profile includes Windows-exclusive fonts without Apple system fonts',
      severity: 'error',
    });
  }

  if (config.os === 'windows' && hasAppleFont && !hasWindowsFont) {
    issues.push({
      field: 'fonts',
      message: 'Windows profile includes Apple system fonts without Windows fonts',
      severity: 'error',
    });
  }

  // 3. OS ↔ WebGL Renderer family
  const renderer = config.webgl.renderer;
  const isDirect3D = renderer.includes('Direct3D') || renderer.includes('D3D');
  const isAppleGpu = renderer.includes('Apple M') || renderer.includes('Metal');

  if (config.os !== 'windows' && isDirect3D) {
    issues.push({
      field: 'webgl.renderer',
      message: `Direct3D WebGL renderer "${renderer}" is only valid on Windows, but OS is ${config.os}`,
      severity: 'error',
    });
  }

  if (config.os !== 'macos' && isAppleGpu) {
    issues.push({
      field: 'webgl.renderer',
      message: `Apple Metal / Silicon WebGL renderer "${renderer}" is only valid on macOS, but OS is ${config.os}`,
      severity: 'error',
    });
  }

  // 4. UA Version ↔ uaMetadata ↔ browserVersion
  const brandEntry = config.uaMetadata.brands.find(
    (b) => b.brand === 'Chromium' || b.brand === 'Google Chrome'
  );
  if (brandEntry && brandEntry.version !== config.browserVersion) {
    issues.push({
      field: 'browserVersion',
      message: `Config browserVersion (${config.browserVersion}) does not match uaMetadata brand version (${brandEntry.version})`,
      severity: 'error',
    });
  }

  if (!ua.includes(`chrome/${config.browserVersion}`) && !ua.includes(`chromium/${config.browserVersion}`)) {
    issues.push({
      field: 'userAgent',
      message: `User-Agent does not contain browserVersion "${config.browserVersion}"`,
      severity: 'error',
    });
  }

  // 5. Screen & DPR
  if (config.screen.width < 640 || config.screen.height < 480) {
    issues.push({
      field: 'screen',
      message: `Unusually small screen dimensions (${config.screen.width}x${config.screen.height})`,
      severity: 'warn',
    });
  }

  if (config.screen.dpr <= 0 || config.screen.dpr > 4) {
    issues.push({
      field: 'screen.dpr',
      message: `Invalid device pixel ratio: ${config.screen.dpr}`,
      severity: 'error',
    });
  }

  // 6. Hardware bounds
  if (config.hardwareConcurrency < 1 || config.hardwareConcurrency > 128) {
    issues.push({
      field: 'hardwareConcurrency',
      message: `Implausible hardwareConcurrency: ${config.hardwareConcurrency}`,
      severity: 'error',
    });
  }

  if (config.deviceMemory < 0.25 || config.deviceMemory > 64) {
    issues.push({
      field: 'deviceMemory',
      message: `Implausible deviceMemory: ${config.deviceMemory}`,
      severity: 'error',
    });
  }

  // 7. Timezone & Languages ↔ Proxy Country
  if (proxyGeo?.country) {
    const countryUpper = proxyGeo.country.toUpperCase();
    const allowedTzPrefixes = COUNTRY_TIMEZONES[countryUpper];
    if (allowedTzPrefixes && allowedTzPrefixes.length > 0) {
      const match = allowedTzPrefixes.some((prefix) => config.timezone.startsWith(prefix));
      if (!match) {
        issues.push({
          field: 'timezone',
          message: `Timezone "${config.timezone}" does not match proxy country "${countryUpper}"`,
          severity: 'warn',
        });
      }
    }

    const allowedLangPrefixes = COUNTRY_LANGUAGES[countryUpper];
    if (allowedLangPrefixes && allowedLangPrefixes.length > 0 && config.languages.length > 0) {
      const primaryLang = config.languages[0].split('-')[0].toLowerCase();
      if (!allowedLangPrefixes.includes(primaryLang)) {
        issues.push({
          field: 'languages',
          message: `Primary language "${config.languages[0]}" is unusual for proxy country "${countryUpper}"`,
          severity: 'warn',
        });
      }
    }
  }

  return issues;
}
