/**
 * scripts/patch-playwright.js
 * 
 * Applies the rebrowser-style "enableDisable" patch to playwright-core's
 * coreBundle.js to suppress persistent Runtime.enable CDP events.
 * 
 * This eliminates the hasCDP: true detection on anti-bot checkers.
 * Run automatically via postinstall or manually: node scripts/patch-playwright.js
 */

const fs = require('fs');
const path = require('path');

const bundlePath = path.join(__dirname, '..', 'node_modules', 'playwright-core', 'lib', 'coreBundle.js');

if (!fs.existsSync(bundlePath)) {
  console.warn('[patch-playwright] coreBundle.js not found, skipping patch.');
  process.exit(0);
}

let code = fs.readFileSync(bundlePath, 'utf8');

// Check if already patched
const PATCH_MARKER = 'this._client.send("Runtime.disable", {}),\n          this._client.send("Page.addScriptToEvaluateOnNewDocument"';
if (code.includes(PATCH_MARKER)) {
  console.log('[patch-playwright] Already patched. Skipping.');
  process.exit(0);
}

// Apply enableDisable patch:
// After Runtime.enable in main frame initialization, immediately issue Runtime.disable.
// This gives Playwright the executionContextId it needs, but closes the Runtime domain
// so anti-bot scripts cannot probe for CDP-specific console.context behaviors.
const SEARCH = 'this._client.send("Runtime.enable", {}),\n          this._client.send("Page.addScriptToEvaluateOnNewDocument"';
const REPLACE = 'this._client.send("Runtime.enable", {}),\n          this._client.send("Runtime.disable", {}),\n          this._client.send("Page.addScriptToEvaluateOnNewDocument"';

if (!code.includes(SEARCH)) {
  console.warn('[patch-playwright] Target pattern not found - playwright-core may have been updated.');
  console.warn('[patch-playwright] Skipping patch. Review the patch script for version compatibility.');
  process.exit(0);
}

// Backup original if not already done
const backupPath = bundlePath + '.backup';
if (!fs.existsSync(backupPath)) {
  fs.copyFileSync(bundlePath, backupPath);
  console.log('[patch-playwright] Backup created at:', backupPath);
}

code = code.replace(SEARCH, REPLACE);
fs.writeFileSync(bundlePath, code, 'utf8');
console.log('[patch-playwright] ✅ Runtime.enable/disable patch applied to playwright-core.');
