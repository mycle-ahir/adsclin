import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { getDb } from '../db/database';
import type { User } from '../../shared/types';

// Electron main process environment does not include native WebSocket (in Node 20.x).
// Supabase realtime-js attempts to access WebSocket on client instantiation.
// Provide a lightweight dummy class so database/PostgREST operations work seamlessly.
if (typeof (globalThis as any).WebSocket === 'undefined') {
  (globalThis as any).WebSocket = class DummyWebSocket {
    constructor() {}
    addEventListener() {}
    removeEventListener() {}
    send() {}
    close() {}
  };
}

let supabaseClient: SupabaseClient | null = null;

function getDbSetting(key: string): string | null {
  try {
    const db = getDb();
    const row = db.prepare('SELECT value FROM app_settings WHERE key = ?').get(key) as { value: string } | undefined;
    return row ? row.value : null;
  } catch {
    return null;
  }
}

function setDbSetting(key: string, value: string): void {
  try {
    const db = getDb();
    db.prepare('INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)').run(key, value);
  } catch {
    // Non-blocking
  }
}

export const PRODUCTION_SUPABASE_URL = 'https://ulfylnwaxcbzarwugofc.supabase.co';
export const PRODUCTION_SUPABASE_ANON_KEY = 'sb_publishable_MM26kKGXNiQWPNA4NKZJQQ_MgCpPrQ-';

/**
 * Returns current configured Supabase credentials.
 */
export function getSupabaseConfig(): { url: string; anonKey: string; isConfigured: boolean } {
  const url = getDbSetting('supabase_url') || process.env.SUPABASE_URL || PRODUCTION_SUPABASE_URL;
  const anonKey = getDbSetting('supabase_anon_key') || process.env.SUPABASE_ANON_KEY || PRODUCTION_SUPABASE_ANON_KEY;
  const isConfigured = Boolean(url.trim() && anonKey.trim());
  return { url, anonKey, isConfigured };
}
/**
 * Creates a standalone Supabase client instance with WebSockets configured.
 */
export function createSupabaseClientInstance(url: string, anonKey: string): SupabaseClient | null {
  if (!url?.trim() || !anonKey?.trim()) return null;
  try {
    return createClient(url.trim(), anonKey.trim(), {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
      realtime: {
        transport: (globalThis as any).WebSocket,
      },
    });
  } catch (err) {
    console.warn('[supabase] Failed to initialize client:', err);
    return null;
  }
}

/**
 * Initializes or updates Supabase client instance.
 */
export function getSupabaseClient(): SupabaseClient | null {
  if (supabaseClient) return supabaseClient;

  const { url, anonKey, isConfigured } = getSupabaseConfig();
  if (!isConfigured) return null;

  supabaseClient = createSupabaseClientInstance(url, anonKey);
  return supabaseClient;
}

/**
 * Saves Supabase credentials and reinitializes client.
 */
export async function saveSupabaseConfig(url: string, anonKey: string): Promise<{ success: boolean; message: string }> {
  const trimmedUrl = (url || '').trim();
  const trimmedKey = (anonKey || '').trim();

  setDbSetting('supabase_url', trimmedUrl);
  setDbSetting('supabase_anon_key', trimmedKey);

  if (!trimmedUrl || !trimmedKey) {
    supabaseClient = null;
    return { success: true, message: 'Supabase credentials cleared. Using local SQLite mode.' };
  }

  const client = createSupabaseClientInstance(trimmedUrl, trimmedKey);
  if (!client) {
    supabaseClient = null;
    return { success: false, message: 'Invalid Supabase URL or Key format.' };
  }

  supabaseClient = client;
  return testSupabaseConnection(client);
}

/**
 * Tests connection to Supabase instance.
 */
export async function testSupabaseConnection(overrideClient?: SupabaseClient | null): Promise<{ success: boolean; message: string }> {
  const client = overrideClient || getSupabaseClient();
  if (!client) {
    return { success: false, message: 'Supabase URL and Anon Key are required.' };
  }

  try {
    // Attempt a light query to verify connectivity and auth
    const { error } = await client.from('profiles').select('id').limit(1);
    if (error && error.code !== 'PGRST116') {
      // If table doesn't exist yet, we still know endpoint responded
      if (error.message.includes('relation') || error.message.includes('does not exist')) {
        return {
          success: true,
          message: 'Connected to Supabase! (Tables pending: please execute supabase-schema.sql in your Supabase SQL Editor).',
        };
      }
      return { success: false, message: `Supabase error: ${error.message}` };
    }
    return { success: true, message: 'Successfully connected to Supabase Cloud Database!' };
  } catch (err: any) {
    return { success: false, message: `Connection failed: ${err?.message || String(err)}` };
  }
}

/**
 * Synchronizes user authentication & subscription to Supabase.
 */
export async function syncUserWithSupabase(user: User): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client) return false;

  try {
    await client.from('users').upsert({
      id: user.id,
      identifier: user.identifier,
      device_id: user.deviceId,
      plan_type: user.planType,
      trial_ends_at: user.trialEndsAt,
      subscription_ends_at: user.subscriptionEndsAt,
      created_at: user.createdAt,
      last_login_at: user.lastLoginAt,
    });
    return true;
  } catch (err) {
    console.warn('[supabase] syncUserWithSupabase error:', err);
    return false;
  }
}

/**
 * Uploads all local profiles to Supabase cloud.
 */
export async function syncProfilesToCloud(): Promise<{ success: boolean; count: number; error?: string }> {
  const client = getSupabaseClient();
  if (!client) {
    return { success: false, count: 0, error: 'Supabase not configured.' };
  }

  try {
    const db = getDb();
    const rows = db.prepare('SELECT * FROM profiles').all() as any[];

    if (rows.length === 0) {
      return { success: true, count: 0 };
    }

    const payload = rows.map((r) => {
      // Tags
      const tagRows = db
        .prepare('SELECT t.name FROM tags t JOIN profile_tags pt ON pt.tag_id = t.id WHERE pt.profile_id = ?')
        .all(r.id) as { name: string }[];
      const tags = tagRows.map((t) => t.name);

      let fingerprint = null;
      try {
        if (r.fingerprint_json) fingerprint = JSON.parse(r.fingerprint_json);
      } catch {}

      return {
        id: r.id,
        name: r.name,
        group_id: r.group_id,
        proxy_id: r.proxy_id,
        notes: r.notes,
        status: r.status,
        user_data_dir: r.user_data_dir,
        fingerprint_json: fingerprint,
        tags,
        created_at: r.created_at,
        updated_at: r.updated_at,
        last_launched_at: r.last_launched_at,
      };
    });

    const { error } = await client.from('profiles').upsert(payload);
    if (error) {
      return { success: false, count: 0, error: error.message };
    }

    return { success: true, count: payload.length };
  } catch (err: any) {
    return { success: false, count: 0, error: err?.message || String(err) };
  }
}

/**
 * Pulls profiles from Supabase cloud into local database.
 */
export async function pullProfilesFromCloud(): Promise<{ success: boolean; count: number; error?: string }> {
  const client = getSupabaseClient();
  if (!client) {
    return { success: false, count: 0, error: 'Supabase not configured.' };
  }

  try {
    const { data, error } = await client.from('profiles').select('*');
    if (error) {
      return { success: false, count: 0, error: error.message };
    }

    if (!data || data.length === 0) {
      return { success: true, count: 0 };
    }

    const db = getDb();
    db.transaction(() => {
      for (const p of data) {
        db.prepare(`
          INSERT OR REPLACE INTO profiles (id, name, group_id, proxy_id, notes, status, user_data_dir, fingerprint_json, created_at, updated_at, last_launched_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          p.id,
          p.name,
          p.group_id ?? null,
          p.proxy_id ?? null,
          p.notes ?? '',
          p.status ?? 'idle',
          p.user_data_dir ?? '',
          p.fingerprint_json ? JSON.stringify(p.fingerprint_json) : null,
          p.created_at ?? Date.now(),
          p.updated_at ?? Date.now(),
          p.last_launched_at ?? null
        );

        if (Array.isArray(p.tags)) {
          // Re-link tags
          db.prepare('DELETE FROM profile_tags WHERE profile_id = ?').run(p.id);
          for (const tagName of p.tags) {
            let tag = db.prepare('SELECT id FROM tags WHERE name = ?').get(tagName) as { id: string } | undefined;
            if (!tag) {
              const tagId = 'tag_' + Math.random().toString(36).substring(2, 9);
              db.prepare('INSERT INTO tags (id, name) VALUES (?, ?)').run(tagId, tagName);
              tag = { id: tagId };
            }
            db.prepare('INSERT OR IGNORE INTO profile_tags (profile_id, tag_id) VALUES (?, ?)').run(p.id, tag.id);
          }
        }
      }
    })();

    return { success: true, count: data.length };
  } catch (err: any) {
    return { success: false, count: 0, error: err?.message || String(err) };
  }
}

/**
 * Uploads all local proxies to Supabase cloud.
 */
export async function syncProxiesToCloud(): Promise<{ success: boolean; count: number; error?: string }> {
  const client = getSupabaseClient();
  if (!client) {
    return { success: false, count: 0, error: 'Supabase not configured.' };
  }

  try {
    const db = getDb();
    const rows = db.prepare('SELECT * FROM proxies').all() as any[];

    if (rows.length === 0) {
      return { success: true, count: 0 };
    }

    const payload = rows.map((r) => ({
      id: r.id,
      name: r.name,
      scheme: r.scheme,
      host: r.host,
      port: r.port,
      username: r.username,
      last_test_ip: r.last_test_ip,
      last_test_country: r.last_test_country,
      last_test_latency_ms: r.last_test_latency_ms,
      last_tested_at: r.last_tested_at,
    }));

    const { error } = await client.from('proxies').upsert(payload);
    if (error) {
      return { success: false, count: 0, error: error.message };
    }

    return { success: true, count: payload.length };
  } catch (err: any) {
    return { success: false, count: 0, error: err?.message || String(err) };
  }
}
