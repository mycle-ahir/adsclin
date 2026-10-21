import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { initDatabase, getDb } from '../src/main/db/database';
import {
  createSubscriptionInvoice,
  verifyPaymentStatus,
  PRODUCTION_NOWPAYMENTS_API_KEY
} from '../src/main/services/nowpayments-service';
import {
  PRODUCTION_SUPABASE_URL,
  PRODUCTION_SUPABASE_ANON_KEY,
  testSupabaseConnection,
  syncProfilesToCloud,
  pullProfilesFromCloud,
  syncProxiesToCloud,
  syncUserWithSupabase
} from '../src/main/services/supabase-service';
import { getDeviceId, getCurrentSession, loginUser, activateSubscription } from '../src/main/services/auth-service';
import { listProfiles, seedDemoProfilesIfEmpty, createProfile } from '../src/main/services/profile-service';
import { generateFingerprint } from '../src/main/services/fingerprint-generator';
import { validateFingerprint } from '../src/main/services/fingerprint-validator';
import { buildInitScript } from '../src/main/services/fingerprint-injector';
import { chromium } from 'playwright';

interface TestResult {
  category: string;
  name: string;
  passed: boolean;
  details?: string;
  durationMs: number;
}

const results: TestResult[] = [];

async function runTest(category: string, name: string, fn: () => Promise<string | void>) {
  const start = Date.now();
  process.stdout.write(`  [TEST] ${category} > ${name} ... `);
  try {
    const details = await fn();
    const duration = Date.now() - start;
    console.log(`PASS (${duration}ms)${details ? ` - ${details}` : ''}`);
    results.push({ category, name, passed: true, details: details || undefined, durationMs: duration });
  } catch (err: any) {
    const duration = Date.now() - start;
    console.log(`FAIL (${duration}ms)`);
    console.error(`         Error: ${err?.message || String(err)}`);
    results.push({ category, name, passed: false, details: err?.message || String(err), durationMs: duration });
  }
}

async function main() {
  console.log('================================================================');
  console.log('       ADSCLIN PRODUCTION SYSTEM INTEGRATION & VERIFICATION     ');
  console.log('================================================================\n');

  // Initialize SQLite database
  initDatabase();

  // -------------------------------------------------------------
  // 1. SUPABASE DATABASE TESTS
  // -------------------------------------------------------------
  console.log('--- 1. SUPABASE CLOUD DATABASE ---');

  await runTest('Supabase', 'Connection & Health Check', async () => {
    const conn = await testSupabaseConnection();
    if (!conn.success) throw new Error(conn.message);
    return conn.message;
  });

  const supabase = createClient(PRODUCTION_SUPABASE_URL, PRODUCTION_SUPABASE_ANON_KEY);

  await runTest('Supabase', 'Table Access Check: users', async () => {
    const { data, error } = await supabase.from('users').select('id, identifier, plan_type').limit(5);
    if (error) throw new Error(error.message);
    return `Found ${data?.length ?? 0} existing users in Supabase`;
  });

  await runTest('Supabase', 'Table Access Check: profiles', async () => {
    const { data, error } = await supabase.from('profiles').select('id, name, status').limit(5);
    if (error) throw new Error(error.message);
    return `Found ${data?.length ?? 0} cloud profiles in Supabase`;
  });

  await runTest('Supabase', 'Table Access Check: proxies', async () => {
    const { data, error } = await supabase.from('proxies').select('id, name, scheme, host, port').limit(5);
    if (error) throw new Error(error.message);
    return `Found ${data?.length ?? 0} cloud proxies in Supabase`;
  });

  await runTest('Supabase', 'User Sync Integration', async () => {
    const testUser = {
      id: 'test_user_' + Date.now(),
      identifier: `test-${Date.now()}@adsclin.local`,
      deviceId: 'dev_test_' + Date.now(),
      planType: 'trial' as const,
      trialEndsAt: Date.now() + 30 * 86400000,
      subscriptionEndsAt: null,
      createdAt: Date.now(),
      lastLoginAt: Date.now(),
    };
    const synced = await syncUserWithSupabase(testUser);
    if (!synced) throw new Error('syncUserWithSupabase returned false');
    return `User ${testUser.identifier} synced successfully`;
  });

  await runTest('Supabase', 'Cloud Sync Service: Profiles', async () => {
    const res = await syncProfilesToCloud();
    if (!res.success) throw new Error(res.error || 'syncProfilesToCloud failed');
    return `Synced ${res.count} profiles to Supabase`;
  });

  await runTest('Supabase', 'Cloud Sync Service: Pull Profiles', async () => {
    const res = await pullProfilesFromCloud();
    if (!res.success) throw new Error(res.error || 'pullProfilesFromCloud failed');
    return `Pulled ${res.count} profiles from Supabase`;
  });

  // -------------------------------------------------------------
  // 2. NOWPAYMENTS PAYMENT TESTS
  // -------------------------------------------------------------
  console.log('\n--- 2. NOWPAYMENTS CRYPTO PAYMENT SYSTEM ---');

  let testInvoiceId = '';

  await runTest('NOWPayments', 'Invoice & Payment Generation ($9.00 USD)', async () => {
    const res = await createSubscriptionInvoice('test-user-prod-check', 'usdttrc20');
    if (!res.success || !res.invoiceUrl) {
      throw new Error(res.error || 'Failed to create payment/invoice');
    }
    testInvoiceId = res.invoiceId || res.paymentId || '';
    return `Invoice ID: ${testInvoiceId} | URL: ${res.invoiceUrl} (Pay Address: ${res.payAddress || 'Hosted Checkout'})`;
  });

  await runTest('NOWPayments', 'Payment Status Verification', async () => {
    if (!testInvoiceId) throw new Error('No invoice ID from previous step');
    const statusRes = await verifyPaymentStatus(testInvoiceId, 'test-user-prod-check');
    return `Status: "${statusRes.status}" | Message: "${statusRes.message}"`;
  });

  // -------------------------------------------------------------
  // 3. LOCAL SQLITE DATABASE & AUTH
  // -------------------------------------------------------------
  console.log('\n--- 3. LOCAL SQLITE DATABASE & AUTH ---');

  await runTest('Local DB', 'Database Initialization & Schema Verification', async () => {
    const db = getDb();
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as { name: string }[];
    const names = tables.map(t => t.name);
    const required = ['profiles', 'proxies', 'tags', 'profile_tags', 'app_settings', 'activity_logs', 'users'];
    for (const req of required) {
      if (!names.includes(req)) throw new Error(`Missing local table: ${req}`);
    }
    return `Verified ${tables.length} tables (${required.join(', ')})`;
  });

  await runTest('Local DB', 'Device ID Generation', async () => {
    const devId = getDeviceId();
    if (!devId || !devId.startsWith('dev_')) throw new Error(`Invalid device ID: ${devId}`);
    return `Hardware-locked Device ID: ${devId}`;
  });

  let currentUserId = '';

  await runTest('Local DB', 'User Login & Demo Profiles Seeding', async () => {
    const session = loginUser('admin@adsclin.com');
    if (!session || !session.user) throw new Error('Failed to login local user');
    currentUserId = session.user.id;
    seedDemoProfilesIfEmpty(currentUserId);
    const profiles = listProfiles();
    return `Active user: ${session.user.identifier} (${session.user.planType}) | Profiles seeded: ${profiles.length}`;
  });

  await runTest('Local DB', 'Subscription Activation Engine', async () => {
    if (!currentUserId) throw new Error('No active user found');
    const activated = activateSubscription(currentUserId, 'USDT_TRC20', 'TX_TEST_VERIFY_1001');
    if (!activated || !activated.isSubscriptionActive) throw new Error('Subscription activation failed');
    return `Plan: ${activated.user.planType} | Active: ${activated.isSubscriptionActive} | Expires: ${new Date(activated.user.subscriptionEndsAt!).toLocaleDateString()}`;
  });

  // -------------------------------------------------------------
  // 4. BROWSER ENGINE, FINGERPRINTING & ANTI-DETECT SPOOFING
  // -------------------------------------------------------------
  console.log('\n--- 4. ANTI-DETECT BROWSER ENGINE & SPOOFING ---');

  let testFp: any = null;

  await runTest('Fingerprint', 'Generation & Entropy Validation', async () => {
    testFp = generateFingerprint({
      os: 'windows',
    });
    const issues = validateFingerprint(testFp);
    const errors = issues.filter(i => i.severity === 'error');
    if (errors.length > 0) throw new Error(errors.map(e => e.message).join(', '));
    return `OS: ${testFp.os} | Platform: ${testFp.uaMetadata?.platform || 'Windows'} | WebGL Renderer: ${testFp.webgl?.unmaskedRenderer || 'Spoofed GPU'}`;
  });

  await runTest('Fingerprint', 'Injection Script Builder', async () => {
    const script = buildInitScript(testFp);
    if (!script || script.length < 500) throw new Error('Injection script generated is empty or too short');
    if (!script.includes('WebGLRenderingContext')) throw new Error('WebGL spoofing missing from script');
    if (!script.includes('HTMLCanvasElement')) throw new Error('Canvas spoofing missing from script');
    return `Script size: ${Math.round(script.length / 1024)} KB compiled`;
  });

  await runTest('Browser Engine', 'Playwright Runtime Launch & Anti-Detect Inspection', async () => {
    const script = buildInitScript(testFp);

    const browser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled',
      ],
    });

    try {
      const context = await browser.newContext({
        userAgent: testFp.userAgent,
        viewport: { width: testFp.screen.width, height: testFp.screen.height },
        locale: testFp.languages?.[0] || 'en-US',
        timezoneId: testFp.timezone || 'America/New_York',
      });

      await context.addInitScript(script);

      const page = await context.newPage();
      await page.goto('data:text/html,<html><head><title>Adsclin Test</title></head><body><h1>Anti-Detect Test</h1></body></html>');

      // Probe browser properties
      const evalResult = await page.evaluate(() => {
        const nav = window.navigator as any;
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl') as WebGLRenderingContext | null;
        let unmaskedVendor = '';
        let unmaskedRenderer = '';
        if (gl) {
          const dbg = gl.getExtension('WEBGL_debug_renderer_info');
          if (dbg) {
            unmaskedVendor = gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL);
            unmaskedRenderer = gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL);
          }
        }

        return {
          userAgent: nav.userAgent,
          webdriver: nav.webdriver,
          hardwareConcurrency: nav.hardwareConcurrency,
          deviceMemory: (nav as any).deviceMemory,
          platform: nav.platform,
          languages: nav.languages,
          unmaskedVendor,
          unmaskedRenderer,
        };
      });

      if (evalResult.webdriver !== false && evalResult.webdriver !== undefined) {
        throw new Error(`navigator.webdriver was not spoofed (value: ${evalResult.webdriver})`);
      }

      if (evalResult.userAgent !== testFp.userAgent) {
        throw new Error(`User Agent mismatch: expected ${testFp.userAgent}, got ${evalResult.userAgent}`);
      }

      await browser.close();
      return `Spoofed UA verified | WebGL Vendor: "${evalResult.unmaskedVendor}" | WebGL Renderer: "${evalResult.unmaskedRenderer}" | navigator.webdriver: ${evalResult.webdriver}`;
    } catch (err) {
      await browser.close();
      throw err;
    }
  });

  // -------------------------------------------------------------
  // SUMMARY REPORT
  // -------------------------------------------------------------
  console.log('\n================================================================');
  console.log('                      TEST EXECUTION SUMMARY                    ');
  console.log('================================================================');

  const total = results.length;
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  console.log(`Total Tests : ${total}`);
  console.log(`Passed      : ${passed} \x1b[32m✓\x1b[0m`);
  console.log(`Failed      : ${failed} ${failed > 0 ? '\x1b[31m✗\x1b[0m' : ''}`);

  if (failed > 0) {
    console.log('\nFailed Tests:');
    results.filter(r => !r.passed).forEach(r => {
      console.log(` - [${r.category}] ${r.name}: ${r.details}`);
    });
    process.exit(1);
  } else {
    console.log('\n\x1b[32mALL 16 PRODUCTION INTEGRATION & SYSTEM CHECKS PASSED PERFECTLY!\x1b[0m\n');
  }
}

main().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
