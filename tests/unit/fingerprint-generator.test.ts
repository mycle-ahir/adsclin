import { describe, it, expect } from 'vitest';
import { generateFingerprint } from '../../src/main/services/fingerprint-generator';
import { fingerprintConfigSchema } from '../../src/shared/schemas';

describe('fingerprint-generator', () => {
  it('1. Determinism: identical seed produces identical FingerprintConfig', () => {
    const seed = 'stable-profile-seed-42';
    const fp1 = generateFingerprint({ seed, templateId: 'windows-11-desktop-intel' });
    const fp2 = generateFingerprint({ seed, templateId: 'windows-11-desktop-intel' });

    expect(fp1).toEqual(fp2);
    expect(fp1.seed).toBe(seed);
    expect(fp1.screen).toEqual(fp2.screen);
    expect(fp1.hardwareConcurrency).toBe(fp2.hardwareConcurrency);
    expect(fp1.deviceMemory).toBe(fp2.deviceMemory);
    expect(fp1.webgl).toEqual(fp2.webgl);
  });

  it('2. Diversity: different seeds produce different hardware combinations', () => {
    const configs = Array.from({ length: 10 }, (_, i) =>
      generateFingerprint({ seed: `seed-variant-${i}`, templateId: 'windows-11-desktop-intel' })
    );

    // Across 10 random seeds, we should see at least some variation in GPUs or resolutions
    const uniqueGpus = new Set(configs.map((c) => c.webgl.renderer));
    expect(uniqueGpus.size).toBeGreaterThan(1);
  });

  it('3. OS alignment: macOS template produces valid macOS properties', () => {
    const fp = generateFingerprint({
      seed: 'mac-test-seed',
      templateId: 'macos-sonoma-arm',
    });

    expect(fp.os).toBe('macos');
    expect(fp.userAgent).toContain('Macintosh; Intel Mac OS X 10_15_7');
    expect(fp.uaMetadata.platform).toBe('macOS');
    expect(fp.uaMetadata.architecture).toBe('arm');
    expect(fp.webgl.vendor).toContain('Apple');
    expect(fp.fonts).toContain('-apple-system');
  });

  it('4. OS alignment: Linux template produces valid Linux properties', () => {
    const fp = generateFingerprint({
      seed: 'linux-test-seed',
      templateId: 'linux-ubuntu-intel',
    });

    expect(fp.os).toBe('linux');
    expect(fp.userAgent).toContain('X11; Linux x86_64');
    expect(fp.uaMetadata.platform).toBe('Linux');
    expect(fp.fonts).toContain('Ubuntu');
  });

  it('5. Schema validation: generated config satisfies zod fingerprintConfigSchema', () => {
    const fp = generateFingerprint({
      seed: 'schema-test-seed',
      templateId: 'windows-11-desktop-intel',
    });

    const parsed = fingerprintConfigSchema.safeParse(fp);
    expect(parsed.success).toBe(true);
  });
});
