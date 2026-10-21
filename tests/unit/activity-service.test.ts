import { describe, it, expect, vi, beforeEach } from 'vitest';
import { recordActivity, listActivities } from '../../src/main/services/activity-service';

// In-memory rows array for DB mock
const rows: Array<{
  id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  details: string | null;
  created_at: number;
}> = [];

vi.mock('../../src/main/db/database', () => ({
  getDb: () => ({
    prepare: (query: string) => ({
      run: (id: string, action: string, entity_type: string, entity_id: string | null, details: string | null, created_at: number) => {
        rows.unshift({ id, action, entity_type, entity_id, details, created_at });
        return { changes: 1 };
      },
      all: (...params: unknown[]) => {
        let result = [...rows];
        if (query.includes('WHERE entity_type = ?')) {
          const type = params[0] as string;
          result = result.filter((r) => r.entity_type === type);
        }
        return result;
      },
    }),
  }),
}));

describe('Append-Only Activity Log Service (§9)', () => {
  beforeEach(() => {
    rows.length = 0;
  });

  it('records an activity with action, entityType, and details', () => {
    const entry = recordActivity('profile:launch', 'profile', 'prof-123', { pid: 4567 });

    expect(entry).toBeDefined();
    expect(entry.id).toBeDefined();
    expect(entry.action).toBe('profile:launch');
    expect(entry.entityType).toBe('profile');
    expect(entry.entityId).toBe('prof-123');
    expect(entry.createdAt).toBeGreaterThan(0);
    expect(entry.details).toContain('"pid":4567');
  });

  it('automatically redacts sensitive credentials (passwords, tokens, keys)', () => {
    const sensitivePayload = {
      user: 'alice',
      password: 'super_secret_password_123',
      apiToken: 'secret-bearer-token',
      nested: {
        privateKey: 'private-key-material',
        host: '192.168.1.1',
      },
    };

    const entry = recordActivity('auth:login', 'auth', 'user-1', sensitivePayload);

    expect(entry.details).not.toContain('super_secret_password_123');
    expect(entry.details).not.toContain('secret-bearer-token');
    expect(entry.details).not.toContain('private-key-material');
    expect(entry.details).toContain('[REDACTED]');
    expect(entry.details).toContain('"user":"alice"');
    expect(entry.details).toContain('"host":"192.168.1.1"');
  });

  it('lists activities and supports filtering by entityType', () => {
    recordActivity('profile:launch', 'profile', 'p1');
    recordActivity('proxy:test', 'proxy', 'px1');
    recordActivity('profile:stop', 'profile', 'p1');

    const all = listActivities();
    expect(all).toHaveLength(3);

    const proxiesOnly = listActivities({ entityType: 'proxy' });
    expect(proxiesOnly).toHaveLength(1);
    expect(proxiesOnly[0].action).toBe('proxy:test');
  });
});
