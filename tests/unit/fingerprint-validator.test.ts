import { describe, it, expect } from 'vitest';
import { validateFingerprint } from '../../src/main/services/fingerprint-validator';
import { generateFingerprint, repairFingerprintConsistency } from '../../src/main/services/fingerprint-generator';

describe('fingerprint-validator (§7.4 & §7.6)', () => {
  it('1. Valid Windows 11 configuration passes with 0 error issues', () => {
    const config = generateFingerprint({ seed: 'win-seed', templateId: 'windows-11-desktop-intel' });
    const issues = validateFingerprint(config);

    const errors = issues.filter((i) => i.severity === 'error');
    expect(errors).toHaveLength(0);
  });

  it('2. Valid macOS Sonoma configuration passes with 0 error issues', () => {
    const config = generateFingerprint({ seed: 'mac-seed', templateId: 'macos-sonoma-arm' });
    const issues = validateFingerprint(config);

    const errors = issues.filter((i) => i.severity === 'error');
    expect(errors).toHaveLength(0);
  });

  it('3. Catches seeded mismatch: Windows OS with Mac User-Agent', () => {
    const config = generateFingerprint({ seed: 'seed-1', templateId: 'windows-11-desktop-intel' });
    config.userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36';

    const issues = validateFingerprint(config);
    expect(issues.some((i) => i.field === 'userAgent' && i.severity === 'error')).toBe(true);
  });

  it('4. Catches seeded mismatch: macOS with Direct3D GPU renderer', () => {
    const config = generateFingerprint({ seed: 'seed-2', templateId: 'macos-sonoma-arm' });
    config.webgl.renderer = 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3070 Direct3D11 vs_5_0 ps_5_0, D3D11)';

    const issues = validateFingerprint(config);
    expect(issues.some((i) => i.field === 'webgl.renderer' && i.severity === 'error')).toBe(true);
  });

  it('5. Catches seeded mismatch: Windows with Apple Silicon GPU renderer', () => {
    const config = generateFingerprint({ seed: 'seed-3', templateId: 'windows-11-desktop-intel' });
    config.webgl.renderer = 'ANGLE (Apple, Apple M2, OpenGL 4.1 Metal - 88.1)';

    const issues = validateFingerprint(config);
    expect(issues.some((i) => i.field === 'webgl.renderer' && i.severity === 'error')).toBe(true);
  });

  it('6. Catches seeded mismatch: macOS with Windows-only fonts', () => {
    const config = generateFingerprint({ seed: 'seed-4', templateId: 'macos-sonoma-arm' });
    config.fonts = ['Segoe UI', 'Calibri', 'Consolas'];

    const issues = validateFingerprint(config);
    expect(issues.some((i) => i.field === 'fonts' && i.severity === 'error')).toBe(true);
  });

  it('7. Catches seeded mismatch: browserVersion does not match User-Agent', () => {
    const config = generateFingerprint({ seed: 'seed-5', templateId: 'windows-11-desktop-intel' });
    config.browserVersion = '130';
    // User-agent still has Chrome/128...
    const issues = validateFingerprint(config);
    expect(issues.some((i) => i.field === 'userAgent' && i.severity === 'error')).toBe(true);
  });

  it('8. Catches seeded invalid DPR bounds', () => {
    const config = generateFingerprint({ seed: 'seed-6', templateId: 'windows-11-desktop-intel' });
    config.screen.dpr = -1;

    const issues = validateFingerprint(config);
    expect(issues.some((i) => i.field === 'screen.dpr' && i.severity === 'error')).toBe(true);
  });

  it('9. Catches proxy country and timezone mismatch warning', () => {
    const config = generateFingerprint({
      seed: 'seed-7',
      templateId: 'windows-11-desktop-intel',
      timezone: 'America/New_York',
    });

    const issues = validateFingerprint(config, { country: 'JP', timezone: 'Asia/Tokyo' });
    expect(issues.some((i) => i.field === 'timezone' && i.severity === 'warn')).toBe(true);
  });

  it('10. Catches implausible hardware concurrency', () => {
    const config = generateFingerprint({ seed: 'seed-8', templateId: 'windows-11-desktop-intel' });
    config.hardwareConcurrency = 0;

    const issues = validateFingerprint(config);
    expect(issues.some((i) => i.field === 'hardwareConcurrency' && i.severity === 'error')).toBe(true);
  });

  it('11. repairFingerprintConsistency automatically resolves all consistency errors', () => {
    // Replicate the exact inconsistent state reported in user issue
    const brokenConfig = generateFingerprint({ seed: 'broken', templateId: 'windows-11-desktop-intel' });
    brokenConfig.os = 'macos'; // Forcing macos onto a Windows config

    const beforeIssues = validateFingerprint(brokenConfig);
    expect(beforeIssues.length).toBeGreaterThanOrEqual(4);

    const repaired = repairFingerprintConsistency(brokenConfig, 'macos');
    const afterIssues = validateFingerprint(repaired);
    const errors = afterIssues.filter((i) => i.severity === 'error');
    expect(errors).toHaveLength(0);
    expect(repaired.os).toBe('macos');
    expect(repaired.userAgent).toContain('Macintosh');
    expect(repaired.uaMetadata.platform).toBe('macOS');
    expect(repaired.webgl.renderer).toContain('Apple');
  });
});
