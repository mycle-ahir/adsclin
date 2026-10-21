import * as fs from 'fs';
import * as path from 'path';
import type { FingerprintConfig } from '../../shared/types';
import { buildInitScript } from './fingerprint-injector';

/**
 * Generates a dynamic Manifest V3 unpacked extension that injects
 * our stealth & fingerprint overrides directly into the MAIN execution world
 * of every page and iframe at document_start.
 *
 * This allows native, un-automated Chrome launches to have full fingerprint
 * spoofing and Web Worker synchronization without connecting CDP or Playwright.
 */
export function generateProfileExtension(
  userDataDir: string,
  config: FingerprintConfig
): string {
  const extDir = path.join(userDataDir, 'ProfileCoreExtension');
  fs.mkdirSync(extDir, { recursive: true });

  const manifest = {
    manifest_version: 3,
    name: 'Profile Core',
    version: '1.0.0',
    description: 'Profile Browser Core Extension',
    content_scripts: [
      {
        matches: ['<all_urls>'],
        js: ['inject.js'],
        run_at: 'document_start',
        world: 'MAIN',
        all_frames: true,
        match_about_blank: true,
      },
    ],
  };

  fs.writeFileSync(
    path.join(extDir, 'manifest.json'),
    JSON.stringify(manifest, null, 2),
    'utf8'
  );

  const initScript = buildInitScript(config);
  fs.writeFileSync(path.join(extDir, 'inject.js'), initScript, 'utf8');

  return extDir;
}
