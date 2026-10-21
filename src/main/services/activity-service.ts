/**
 * Activity log service for ProfileBrowser.
 *
 * Requirements (SPEC.md §9):
 *  - Append-only activity log recording profile launches, stops, creations,
 *    modifications, cookie operations, and proxy checks.
 *  - Automatically redacts sensitive fields (passwords, tokens, credentials).
 */

import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db/database';
import type { ActivityLog, ActivityEntityType } from '../../shared/types';

interface ActivityLogRow {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  details: string | null;
  created_at: number;
}

function sanitizeDetails(details: unknown): string | null {
  if (!details) return null;
  if (typeof details === 'string') return details;

  try {
    const cloned = JSON.parse(JSON.stringify(details)) as Record<string, unknown>;
    // Recursively redact known sensitive keys
    const redact = (obj: unknown) => {
      if (!obj || typeof obj !== 'object') return;
      for (const [k, v] of Object.entries(obj)) {
        const lowerKey = k.toLowerCase();
        if (
          lowerKey.includes('password') ||
          lowerKey.includes('token') ||
          lowerKey.includes('secret') ||
          lowerKey.includes('key')
        ) {
          (obj as Record<string, unknown>)[k] = '[REDACTED]';
        } else if (typeof v === 'object') {
          redact(v);
        }
      }
    };
    redact(cloned);
    return JSON.stringify(cloned);
  } catch {
    return typeof details === 'string' ? details : '[Unserializable Payload]';
  }
}

/**
 * Appends a new activity entry to the audit log.
 */
export function recordActivity(
  action: string,
  entityType: ActivityEntityType,
  entityId: string | null = null,
  details: unknown = null
): ActivityLog {
  const db = getDb();
  const id = uuidv4();
  const createdAt = Date.now();
  const sanitized = sanitizeDetails(details);

  db.prepare(
    `INSERT INTO activity_logs (id, action, entity_type, entity_id, details, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(id, action, entityType, entityId, sanitized, createdAt);

  return {
    id,
    action,
    entityType,
    entityId,
    details: sanitized,
    createdAt,
  };
}

/**
 * Queries the append-only activity log, newest first.
 */
export function listActivities(options?: {
  limit?: number;
  offset?: number;
  entityType?: ActivityEntityType;
}): ActivityLog[] {
  const db = getDb();
  const limit = options?.limit ?? 100;
  const offset = options?.offset ?? 0;

  let query = 'SELECT * FROM activity_logs';
  const params: unknown[] = [];

  if (options?.entityType) {
    query += ' WHERE entity_type = ?';
    params.push(options.entityType);
  }

  query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  const rows = db.prepare(query).all(...params) as ActivityLogRow[];

  return rows.map((r) => ({
    id: r.id,
    action: r.action,
    entityType: r.entity_type as ActivityEntityType,
    entityId: r.entity_id,
    details: r.details,
    createdAt: r.created_at,
  }));
}
