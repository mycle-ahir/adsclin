import type { FingerprintTemplate } from '../../shared/types';

export const FINGERPRINT_TEMPLATES: Record<string, FingerprintTemplate> = {
  'windows-11-desktop-intel': {
    id: 'windows-11-desktop-intel',
    name: 'Windows 11 Desktop (Intel/NVIDIA)',
    os: 'windows',
    screenResolutions: [
      { width: 1280, height: 720, dpr: 1 },
      { width: 1920, height: 1080, dpr: 1 },
      { width: 2560, height: 1440, dpr: 1 },
      { width: 1920, height: 1080, dpr: 1.25 },
    ],
    hardwareConcurrencyOptions: [8, 12, 16],
    deviceMemoryOptions: [8, 16, 32],
    gpuOptions: [
      {
        vendor: 'Google Inc. (NVIDIA)',
        renderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3070 Direct3D11 vs_5_0 ps_5_0, D3D11)',
      },
      {
        vendor: 'Google Inc. (NVIDIA)',
        renderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 4070 Direct3D11 vs_5_0 ps_5_0, D3D11)',
      },
      {
        vendor: 'Google Inc. (Intel)',
        renderer: 'ANGLE (Intel, Intel(R) UHD Graphics 770 Direct3D11 vs_5_0 ps_5_0, D3D11)',
      },
    ],
    defaultFonts: [
      'Arial',
      'Calibri',
      'Consolas',
      'Segoe UI',
      'Tahoma',
      'Times New Roman',
      'Trebuchet MS',
      'Verdana',
    ],
  },
  'windows-11-laptop-amd': {
    id: 'windows-11-laptop-amd',
    name: 'Windows 11 Laptop (AMD)',
    os: 'windows',
    screenResolutions: [
      { width: 1280, height: 720, dpr: 1 },
      { width: 1920, height: 1080, dpr: 1.25 },
      { width: 1920, height: 1080, dpr: 1.5 },
      { width: 1920, height: 1200, dpr: 1.25 },
    ],
    hardwareConcurrencyOptions: [8, 12, 16],
    deviceMemoryOptions: [8, 16],
    gpuOptions: [
      {
        vendor: 'Google Inc. (AMD)',
        renderer: 'ANGLE (AMD, AMD Radeon(TM) Graphics Direct3D11 vs_5_0 ps_5_0, D3D11)',
      },
      {
        vendor: 'Google Inc. (AMD)',
        renderer: 'ANGLE (AMD, AMD Radeon RX 6600M Direct3D11 vs_5_0 ps_5_0, D3D11)',
      },
    ],
    defaultFonts: [
      'Arial',
      'Calibri',
      'Segoe UI',
      'Tahoma',
      'Verdana',
      'Georgia',
    ],
  },
  'macos-sonoma-arm': {
    id: 'macos-sonoma-arm',
    name: 'macOS Sonoma (Apple Silicon)',
    os: 'macos',
    screenResolutions: [
      { width: 1280, height: 720, dpr: 2 },
      { width: 1728, height: 1117, dpr: 2 },
      { width: 1512, height: 982, dpr: 2 },
      { width: 2560, height: 1440, dpr: 2 },
    ],
    hardwareConcurrencyOptions: [8, 10, 12],
    deviceMemoryOptions: [8, 16, 24],
    gpuOptions: [
      {
        vendor: 'Google Inc. (Apple)',
        renderer: 'ANGLE (Apple, Apple M2, OpenGL 4.1 Metal - 88.1)',
      },
      {
        vendor: 'Google Inc. (Apple)',
        renderer: 'ANGLE (Apple, Apple M3, OpenGL 4.1 Metal - 88.1)',
      },
      {
        vendor: 'Google Inc. (Apple)',
        renderer: 'ANGLE (Apple, Apple M1, OpenGL 4.1 Metal - 88.1)',
      },
    ],
    defaultFonts: [
      '-apple-system',
      'BlinkMacSystemFont',
      'Helvetica Neue',
      'SF Pro',
      'Monaco',
      'Menlo',
      'Geneva',
      'Lucida Grande',
    ],
  },
  'linux-ubuntu-intel': {
    id: 'linux-ubuntu-intel',
    name: 'Linux Ubuntu (Intel/Mesa)',
    os: 'linux',
    screenResolutions: [
      { width: 1280, height: 720, dpr: 1 },
      { width: 1920, height: 1080, dpr: 1 },
      { width: 2560, height: 1440, dpr: 1 },
    ],
    hardwareConcurrencyOptions: [4, 8, 12],
    deviceMemoryOptions: [8, 16],
    gpuOptions: [
      {
        vendor: 'Google Inc. (Intel)',
        renderer: 'ANGLE (Intel, Mesa Intel(R) UHD Graphics (CML GT2), OpenGL 4.6)',
      },
      {
        vendor: 'Google Inc. (NVIDIA)',
        renderer: 'ANGLE (NVIDIA, NVIDIA GeForce GTX 1660 SUPER/PCIe/SSE2, OpenGL 4.5.0)',
      },
    ],
    defaultFonts: [
      'DejaVu Sans',
      'Liberation Sans',
      'Ubuntu',
      'FreeSans',
      'Droid Sans',
    ],
  },
};

// Aliases for template lookup
FINGERPRINT_TEMPLATES['macos-14-m2'] = FINGERPRINT_TEMPLATES['macos-sonoma-arm']!;
FINGERPRINT_TEMPLATES['linux-ubuntu-desktop'] = FINGERPRINT_TEMPLATES['linux-ubuntu-intel']!;

export const DEFAULT_TEMPLATE_ID = 'windows-11-desktop-intel';
