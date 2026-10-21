import { describe, it, expect, vi } from 'vitest';
import {
  getBrowserLaunchArgs,
  buildInitScript,
  applyCdpOverrides,
} from '../../src/main/services/fingerprint-injector';
import { generateFingerprint } from '../../src/main/services/fingerprint-generator';

describe('fingerprint-injector', () => {
  it('1. WebRTC launch arguments match configured policy', () => {
    const fpProxyOnly = generateFingerprint({ seed: 's1' });
    fpProxyOnly.webrtc = 'proxy-only';
    expect(getBrowserLaunchArgs(fpProxyOnly)).toContain(
      '--force-webrtc-ip-handling-policy=disable_non_proxied_udp'
    );

    const fpDisabled = generateFingerprint({ seed: 's2' });
    fpDisabled.webrtc = 'disabled';
    expect(getBrowserLaunchArgs(fpDisabled)).toContain('--disable-webrtc');

    const fpReal = generateFingerprint({ seed: 's3' });
    fpReal.webrtc = 'real';
    expect(getBrowserLaunchArgs(fpReal)).toEqual([]);
  });

  it('2. buildInitScript generates valid JS containing navigator, webgl, canvas and audio spoofing', () => {
    const fp = generateFingerprint({
      seed: 'test-seed-injection',
      templateId: 'windows-11-desktop-intel',
    });

    const script = buildInitScript(fp);

    expect(script).toContain('hardwareConcurrency');
    expect(script).toContain(String(fp.hardwareConcurrency));
    expect(script).toContain('deviceMemory');
    expect(script).toContain(String(fp.deviceMemory));
    expect(script).toContain('37445'); // UNMASKED_VENDOR_WEBGL
    expect(script).toContain('37446'); // UNMASKED_RENDERER_WEBGL
    expect(script).toContain(JSON.stringify(fp.webgl.vendor));
    expect(script).toContain(JSON.stringify(fp.webgl.renderer));
    expect(script).toContain('CanvasRenderingContext2D.prototype.getImageData');
    expect(script).toContain('AudioBuffer.prototype.getChannelData');
  });

  it('3. applyCdpOverrides calls correct CDP emulation commands', async () => {
    const fp = generateFingerprint({
      seed: 'cdp-test-seed',
      templateId: 'windows-11-desktop-intel',
      timezone: 'Europe/Berlin',
    });

    const mockSend = vi.fn().mockResolvedValue({});
    const mockCdp = { send: mockSend };

    await applyCdpOverrides(mockCdp, fp);

    expect(mockSend).toHaveBeenCalledWith(
      'Emulation.setUserAgentOverride',
      expect.objectContaining({
        userAgent: fp.userAgent,
        acceptLanguage: expect.stringContaining('en'),
        userAgentMetadata: fp.uaMetadata,
      })
    );

    expect(mockSend).toHaveBeenCalledWith('Emulation.setTimezoneOverride', {
      timezoneId: 'Europe/Berlin',
    });

    expect(mockSend).toHaveBeenCalledWith(
      'Emulation.setDeviceMetricsOverride',
      expect.objectContaining({
        width: fp.screen.width,
        height: fp.screen.height,
        deviceScaleFactor: fp.screen.dpr,
      })
    );
  });
});
