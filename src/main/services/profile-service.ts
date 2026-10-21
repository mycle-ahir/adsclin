import * as path from 'path';
import * as fs from 'fs';
import { app } from 'electron';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db/database';
import { recordActivity } from './activity-service';
import type { Profile, Group, FingerprintConfig } from '../../shared/types';
import type { CreateProfileInput, UpdateProfileInput, CreateGroupInput } from '../../shared/schemas';

import { generateFingerprint, repairFingerprintConsistency } from './fingerprint-generator';
import { validateFingerprint } from './fingerprint-validator';
import { adjustFingerprintToGeo } from '../../shared/geo-utils';

// ---------------------------------------------------------------------------
// Internal row shapes (snake_case from SQLite)
// ---------------------------------------------------------------------------
interface ProfileRow {
  id: string;
  name: string;
  group_id: string | null;
  proxy_id: string | null;
  notes: string;
  status: string;
  user_data_dir: string;
  fingerprint_json: string | null;
  extensions_json: string | null;
  created_at: number;
  updated_at: number;
  last_launched_at: number | null;
}

interface GroupRow {
  id: string;
  name: string;
  created_at: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function rowToProfile(row: ProfileRow, tags: string[]): Profile {
  let fingerprint: Profile['fingerprint'] = null;
  if (row.fingerprint_json) {
    try {
      fingerprint = JSON.parse(row.fingerprint_json) as Profile['fingerprint'];
      if (fingerprint && validateFingerprint(fingerprint).length > 0) {
        fingerprint = repairFingerprintConsistency(fingerprint);
      }
    } catch {
      fingerprint = null;
    }
  }

  let extensions: string[] = [];
  if (row.extensions_json) {
    try {
      extensions = JSON.parse(row.extensions_json) as string[];
    } catch {
      extensions = [];
    }
  }

  return {
    id: row.id,
    name: row.name,
    groupId: row.group_id,
    proxyId: row.proxy_id,
    notes: row.notes,
    status: row.status as Profile['status'],
    userDataDir: row.user_data_dir,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastLaunchedAt: row.last_launched_at,
    tags,
    fingerprint,
    extensions,
  };
}

function rowToGroup(row: GroupRow): Group {
  return {
    id: row.id,
    name: row.name,
    createdAt: row.created_at,
  };
}

function getTagsForProfile(profileId: string): string[] {
  const db = getDb();
  const rows = db
    .prepare<string>(
      `SELECT t.name FROM tags t
       JOIN profile_tags pt ON pt.tag_id = t.id
       WHERE pt.profile_id = ?
       ORDER BY t.name`
    )
    .all(profileId) as Array<{ name: string }>;
  return rows.map((r) => r.name);
}

/** Upsert a tag by name, return its id. */
function upsertTag(name: string): string {
  const db = getDb();
  const existing = db
    .prepare<string>('SELECT id FROM tags WHERE name = ?')
    .get(name) as { id: string } | undefined;
  if (existing) return existing.id;
  const id = uuidv4();
  db.prepare('INSERT INTO tags (id, name) VALUES (?, ?)').run(id, name);
  return id;
}

/** Replace all tags for a profile. */
function setProfileTags(profileId: string, tagNames: string[]): void {
  const db = getDb();
  db.prepare<string>('DELETE FROM profile_tags WHERE profile_id = ?').run(profileId);
  for (const name of tagNames) {
    const tagId = upsertTag(name);
    db.prepare('INSERT OR IGNORE INTO profile_tags (profile_id, tag_id) VALUES (?, ?)').run(
      profileId,
      tagId
    );
  }
}

function getUserDataDir(): string {
  try {
    if (app?.getPath) {
      return app.getPath('userData');
    }
  } catch {
    // ignore
  }
  return path.join(process.cwd(), '.user_data');
}

// ---------------------------------------------------------------------------
// Profile CRUD
// ---------------------------------------------------------------------------
export function createProfile(input: CreateProfileInput): Profile {
  const db = getDb();
  const id = uuidv4();
  const now = Date.now();
  const userDataDir = path.join(getUserDataDir(), 'profiles', id);
  // Directory is NOT created until launch

  let fingerprint = input.fingerprint ?? generateFingerprint();

  if (input.proxyId) {
    try {
      const proxyRow = db
        .prepare<string>('SELECT * FROM proxies WHERE id = ?')
        .get(input.proxyId) as { last_test_country?: string | null; last_test_timezone?: string | null; last_test_loc?: string | null; last_test_ip?: string | null } | undefined;
      if (proxyRow?.last_test_country) {
        fingerprint = adjustFingerprintToGeo(fingerprint, {
          country: proxyRow.last_test_country,
          timezone: proxyRow.last_test_timezone,
          loc: proxyRow.last_test_loc,
          ip: proxyRow.last_test_ip,
        });
      }
    } catch {
      // Non-blocking geo lookup
    }
  }

  if (validateFingerprint(fingerprint).length > 0) {
    fingerprint = repairFingerprintConsistency(fingerprint);
  }

  const fingerprintJson = JSON.stringify(fingerprint);
  const extensionsJson = JSON.stringify(input.extensions ?? []);

  db.prepare(
    `INSERT INTO profiles
       (id, name, group_id, proxy_id, notes, status, user_data_dir, fingerprint_json, extensions_json, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'idle', ?, ?, ?, ?, ?)`
  ).run(
    id,
    input.name,
    input.groupId ?? null,
    input.proxyId ?? null,
    input.notes ?? '',
    userDataDir,
    fingerprintJson,
    extensionsJson,
    now,
    now
  );

  const tags = input.tags ?? [];
  setProfileTags(id, tags);

  const row = db
    .prepare<string>('SELECT * FROM profiles WHERE id = ?')
    .get(id) as ProfileRow;

  try {
    recordActivity('profile:create', 'profile', id, { name: input.name });
  } catch {
    // Non-blocking
  }

  return rowToProfile(row, tags);
}

export function listProfiles(): Profile[] {
  const db = getDb();
  let rows = db.prepare('SELECT * FROM profiles ORDER BY created_at DESC').all() as ProfileRow[];
  if (rows.length === 0) {
    seedDemoProfilesIfEmpty();
    rows = db.prepare('SELECT * FROM profiles ORDER BY created_at DESC').all() as ProfileRow[];
  }
  return rows.map((row) => rowToProfile(row, getTagsForProfile(row.id)));
}

export function getProfile(id: string): Profile | null {
  const db = getDb();
  const row = db
    .prepare<string>('SELECT * FROM profiles WHERE id = ?')
    .get(id) as ProfileRow | undefined;
  if (!row) return null;
  return rowToProfile(row, getTagsForProfile(id));
}

export function duplicateProfile(id: string): Profile {
  const existing = getProfile(id);
  if (!existing) throw new Error(`Profile not found: ${id}`);

  return createProfile({
    name: `${existing.name} (Copy)`,
    groupId: existing.groupId,
    proxyId: existing.proxyId,
    notes: existing.notes,
    tags: [...existing.tags],
    fingerprint: existing.fingerprint
      ? { ...existing.fingerprint, seed: uuidv4() }
      : undefined,
    extensions: existing.extensions ? [...existing.extensions] : [],
  });
}

export function updateProfile(input: UpdateProfileInput): Profile {
  const db = getDb();
  const now = Date.now();

  let targetFp: FingerprintConfig | null | undefined = input.fingerprint;

  if ('proxyId' in input && input.proxyId) {
    try {
      const proxyRow = db
        .prepare<string>('SELECT * FROM proxies WHERE id = ?')
        .get(input.proxyId) as { last_test_country?: string | null; last_test_timezone?: string | null; last_test_loc?: string | null; last_test_ip?: string | null } | undefined;
      if (proxyRow?.last_test_country) {
        if (!targetFp) {
          const existing = db
            .prepare<string>('SELECT fingerprint_json FROM profiles WHERE id = ?')
            .get(input.id) as { fingerprint_json: string | null } | undefined;
          if (existing?.fingerprint_json) {
            try {
              targetFp = JSON.parse(existing.fingerprint_json);
            } catch {
              targetFp = null;
            }
          }
        }
        if (targetFp) {
          targetFp = adjustFingerprintToGeo(targetFp, {
            country: proxyRow.last_test_country,
            timezone: proxyRow.last_test_timezone,
            loc: proxyRow.last_test_loc,
            ip: proxyRow.last_test_ip,
          });
          input.fingerprint = targetFp;
        }
      }
    } catch {
      // Non-blocking geo adjustment
    }
  }

  // Build SET clause dynamically from provided fields
  const sets: string[] = ['updated_at = ?'];
  const values: unknown[] = [now];

  if (input.name !== undefined) { sets.push('name = ?'); values.push(input.name); }
  if ('groupId' in input) { sets.push('group_id = ?'); values.push(input.groupId ?? null); }
  if ('proxyId' in input) { sets.push('proxy_id = ?'); values.push(input.proxyId ?? null); }
  if (input.notes !== undefined) { sets.push('notes = ?'); values.push(input.notes); }
  if ('fingerprint' in input || targetFp !== undefined) {
    let finalFp = input.fingerprint !== undefined ? input.fingerprint : targetFp;
    if (finalFp && validateFingerprint(finalFp).length > 0) {
      finalFp = repairFingerprintConsistency(finalFp);
    }
    sets.push('fingerprint_json = ?');
    values.push(finalFp ? JSON.stringify(finalFp) : null);
  }
  if ('extensions' in input && input.extensions !== undefined) {
    sets.push('extensions_json = ?');
    values.push(JSON.stringify(input.extensions));
  }

  values.push(input.id);
  db.prepare(`UPDATE profiles SET ${sets.join(', ')} WHERE id = ?`).run(...values);

  if (input.tags !== undefined) {
    setProfileTags(input.id, input.tags);
  }

  const row = db
    .prepare<string>('SELECT * FROM profiles WHERE id = ?')
    .get(input.id) as ProfileRow | undefined;
  if (!row) throw new Error(`Profile not found: ${input.id}`);

  try {
    recordActivity('profile:update', 'profile', input.id, { name: input.name });
  } catch {
    // Non-blocking
  }

  return rowToProfile(row, getTagsForProfile(input.id));
}

export function deleteProfile(id: string): void {
  const db = getDb();
  const row = db
    .prepare<string>('SELECT user_data_dir FROM profiles WHERE id = ?')
    .get(id) as { user_data_dir: string } | undefined;

  db.prepare<string>('DELETE FROM profiles WHERE id = ?').run(id);

  // Remove user-data directory if it exists (profile_tags deleted via CASCADE)
  if (row && fs.existsSync(row.user_data_dir)) {
    fs.rmSync(row.user_data_dir, { recursive: true, force: true });
  }

  try {
    recordActivity('profile:delete', 'profile', id);
  } catch {
    // Non-blocking
  }
}

// ---------------------------------------------------------------------------
// Group CRUD
// ---------------------------------------------------------------------------
export function createGroup(input: CreateGroupInput): Group {
  const db = getDb();
  const id = uuidv4();
  const now = Date.now();
  db.prepare('INSERT INTO groups (id, name, created_at) VALUES (?, ?, ?)').run(id, input.name, now);
  const row = db
    .prepare<string>('SELECT * FROM groups WHERE id = ?')
    .get(id) as GroupRow;
  return rowToGroup(row);
}

export function listGroups(): Group[] {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM groups ORDER BY name').all() as GroupRow[];
  return rows.map(rowToGroup);
}

export function deleteGroup(id: string): void {
  const db = getDb();
  // group_id on profiles is SET NULL via FK ON DELETE SET NULL
  db.prepare<string>('DELETE FROM groups WHERE id = ?').run(id);
}

// ---------------------------------------------------------------------------
// Status update — called by launcher-service ONLY
// ---------------------------------------------------------------------------

/**
 * Updates the status (and timestamps) of a profile.
 * This function is intentionally narrow — it only touches status-related columns
 * so that the launcher cannot accidentally mutate user-visible profile fields.
 *
 * Called by launcher-service; NEVER exposed via IPC.
 */
export function updateProfileStatus(id: string, status: import('../../shared/types').ProfileStatus): void {
  const db = getDb();
  const now = Date.now();

  if (status === 'running') {
    db.prepare<[string, number, number, string]>(
      `UPDATE profiles SET status = ?, updated_at = ?, last_launched_at = ? WHERE id = ?`
    ).run(status, now, now, id);
  } else {
    db.prepare<[string, number, string]>(
      `UPDATE profiles SET status = ?, updated_at = ? WHERE id = ?`
    ).run(status, now, id);
  }
}

/**
 * Seeds the 5 demo profiles shown in the screenshot if the profiles table is empty.
 * Can also be triggered to reset demo state.
 */
export function seedDemoProfilesIfEmpty(force = false): void {
  const db = getDb();
  if (!force) {
    const countRow = db.prepare('SELECT count(*) as count FROM profiles').get() as { count: number };
    if (countRow && countRow.count > 0) return;
  }

  const now = Date.now();

  const demoProxies = [
    {
      id: 'demo-proxy-us',
      name: 'US - New York',
      scheme: 'http',
      host: '192.168.1.23',
      port: 8080,
      lastTestIp: '192.168.1.23',
      lastTestCountry: 'US',
      lastTestLatencyMs: 42,
    },
    {
      id: 'demo-proxy-uk',
      name: 'UK - London',
      scheme: 'http',
      host: '185.199.110.45',
      port: 8080,
      lastTestIp: '185.199.110.45',
      lastTestCountry: 'GB',
      lastTestLatencyMs: 65,
    },
    {
      id: 'demo-proxy-de',
      name: 'DE - Berlin',
      scheme: 'http',
      host: '31.13.77.12',
      port: 8080,
      lastTestIp: '31.13.77.12',
      lastTestCountry: 'DE',
      lastTestLatencyMs: 51,
    },
    {
      id: 'demo-proxy-ca',
      name: 'CA - Toronto',
      scheme: 'http',
      host: '142.93.12.78',
      port: 8080,
      lastTestIp: '142.93.12.78',
      lastTestCountry: 'CA',
      lastTestLatencyMs: 78,
    },
    {
      id: 'demo-proxy-sg',
      name: 'SG - Singapore',
      scheme: 'http',
      host: '103.21.56.78',
      port: 8080,
      lastTestIp: '103.21.56.78',
      lastTestCountry: 'SG',
      lastTestLatencyMs: 110,
    },
  ];

  for (const p of demoProxies) {
    db.prepare(`
      INSERT OR REPLACE INTO proxies (id, name, scheme, host, port, last_test_ip, last_test_country, last_test_latency_ms, last_tested_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(p.id, p.name, p.scheme, p.host, p.port, p.lastTestIp, p.lastTestCountry, p.lastTestLatencyMs, now);
  }

  const demoProfiles = [
    {
      id: 'demo-profile-1',
      name: 'Profile 1',
      proxyId: 'demo-proxy-us',
      notes: '#ADS-001 [starred]',
      status: 'idle',
      tags: ['Facebook', 'Ads'],
      lastLaunchedAt: now - 2 * 3600 * 1000,
    },
    {
      id: 'demo-profile-2',
      name: 'Marketing-1',
      proxyId: 'demo-proxy-uk',
      notes: '#ADS-002',
      status: 'idle',
      tags: ['TikTok', 'Social'],
      lastLaunchedAt: now - 24 * 3600 * 1000,
    },
    {
      id: 'demo-profile-3',
      name: 'Ecommerce-3',
      proxyId: 'demo-proxy-de',
      notes: '#ADS-003',
      status: 'idle',
      tags: ['Shopify', 'Ecom'],
      lastLaunchedAt: now - 48 * 3600 * 1000,
    },
    {
      id: 'demo-profile-4',
      name: 'Test-Group',
      proxyId: 'demo-proxy-ca',
      notes: '#ADS-004',
      status: 'idle',
      tags: ['Google', 'Research'],
      lastLaunchedAt: now - 72 * 3600 * 1000,
    },
    {
      id: 'demo-profile-5',
      name: 'Client-Alpha',
      proxyId: 'demo-proxy-sg',
      notes: '#ADS-005',
      status: 'idle',
      tags: ['Instagram', 'Brand'],
      lastLaunchedAt: now - 96 * 3600 * 1000,
    },
  ];

  for (const prof of demoProfiles) {
    const userDataDir = path.join(getUserDataDir(), 'profiles', prof.id);
    const fp = generateFingerprint();
    db.prepare(`
      INSERT OR REPLACE INTO profiles (id, name, group_id, proxy_id, notes, status, user_data_dir, fingerprint_json, created_at, updated_at, last_launched_at)
      VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      prof.id,
      prof.name,
      prof.proxyId,
      prof.notes,
      prof.status,
      userDataDir,
      JSON.stringify(fp),
      now,
      now,
      prof.lastLaunchedAt
    );
    setProfileTags(prof.id, prof.tags);
  }
}
