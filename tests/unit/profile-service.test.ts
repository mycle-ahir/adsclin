import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'fs';
import { MockDatabase } from './mock-db';

// ---------------------------------------------------------------------------
// Mocks — hoisted
// ---------------------------------------------------------------------------

const { mockGetDb, setDb } = vi.hoisted(() => {
  let currentDb: unknown = null;
  return {
    mockGetDb: vi.fn(() => currentDb),
    setDb: (db: unknown) => {
      currentDb = db;
    },
  };
});

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn((_key: string) => '/mock/userData'),
  },
  safeStorage: {
    isEncryptionAvailable: vi.fn(() => true),
    encryptString: vi.fn((s: string) => Buffer.from(`enc:${s}`)),
    decryptString: vi.fn((b: Buffer) => b.toString().replace(/^enc:/, '')),
  },
}));

let uuidCounter = 0;
vi.mock('uuid', () => ({
  v4: vi.fn(() => `test-uuid-${++uuidCounter}`),
}));

vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>();
  return {
    ...actual,
    existsSync: vi.fn(() => false),
    rmSync: vi.fn(),
  };
});

vi.mock('../../src/main/db/database', () => ({
  getDb: mockGetDb,
}));

// ---------------------------------------------------------------------------
// System under test
// ---------------------------------------------------------------------------
import * as ProfileService from '../../src/main/services/profile-service';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('profile-service', () => {
  beforeEach(() => {
    uuidCounter = 0;
    const db = new MockDatabase();
    setDb(db);
  });

  it('create → list includes the new profile', () => {
    ProfileService.createProfile({ name: 'My Profile', notes: '', tags: [] });
    const profiles = ProfileService.listProfiles();
    expect(profiles).toHaveLength(1);
    expect(profiles[0].name).toBe('My Profile');
  });

  it('created profile has correct userDataDir', () => {
    const p = ProfileService.createProfile({ name: 'Dir Test', notes: '', tags: [] });
    expect(p.userDataDir).toContain('profiles');
    expect(p.userDataDir).toContain(p.id);
  });

  it('delete → list excludes the deleted profile', () => {
    const p = ProfileService.createProfile({ name: 'To Delete', notes: '', tags: [] });
    ProfileService.deleteProfile(p.id);
    const profiles = ProfileService.listProfiles();
    expect(profiles).toHaveLength(0);
  });

  it('delete calls rmSync if user_data_dir exists', () => {
    const p = ProfileService.createProfile({ name: 'Cleanup Test', notes: '', tags: [] });
    vi.mocked(fs.existsSync).mockReturnValueOnce(true);
    ProfileService.deleteProfile(p.id);
    expect(fs.rmSync).toHaveBeenCalledWith(p.userDataDir, { recursive: true, force: true });
  });

  it('duplicate profile name is allowed (no uniqueness constraint)', () => {
    ProfileService.createProfile({ name: 'Dup', notes: '', tags: [] });
    ProfileService.createProfile({ name: 'Dup', notes: '', tags: [] });
    expect(ProfileService.listProfiles()).toHaveLength(2);
  });

  it('tags round-trip through create and list', () => {
    const p = ProfileService.createProfile({ name: 'Tagged', notes: '', tags: ['alpha', 'beta'] });
    expect(p.tags).toEqual(expect.arrayContaining(['alpha', 'beta']));
    const listed = ProfileService.listProfiles();
    expect(listed[0].tags).toEqual(expect.arrayContaining(['alpha', 'beta']));
  });

  it('updateProfile replaces tags', () => {
    const p = ProfileService.createProfile({ name: 'Tag Update', notes: '', tags: ['old'] });
    const updated = ProfileService.updateProfile({ id: p.id, tags: ['new'] });
    expect(updated.tags).toContain('new');
    expect(updated.tags).not.toContain('old');
  });

  it('getProfile returns null for unknown id', () => {
    expect(ProfileService.getProfile('nonexistent')).toBeNull();
  });

  it('createGroup → listGroups includes it', () => {
    ProfileService.createGroup({ name: 'Group A' });
    const groups = ProfileService.listGroups();
    expect(groups).toHaveLength(1);
    expect(groups[0].name).toBe('Group A');
  });

  it('deleteGroup removes it from list', () => {
    const g = ProfileService.createGroup({ name: 'ToDelete' });
    ProfileService.deleteGroup(g.id);
    expect(ProfileService.listGroups()).toHaveLength(0);
  });

  it('duplicateProfile creates a clone with (Copy) name and distinct id', () => {
    const original = ProfileService.createProfile({
      name: 'Original',
      notes: 'Some notes',
      tags: ['tag1', 'tag2'],
    });

    const clone = ProfileService.duplicateProfile(original.id);
    expect(clone.id).not.toBe(original.id);
    expect(clone.name).toBe('Original (Copy)');
    expect(clone.notes).toBe('Some notes');
    expect(clone.tags).toEqual(expect.arrayContaining(['tag1', 'tag2']));
    expect(clone.userDataDir).not.toBe(original.userDataDir);
    expect(clone.userDataDir).toContain(clone.id);

    const all = ProfileService.listProfiles();
    expect(all).toHaveLength(2);
  });

  it('duplicateProfile throws for non-existent profile', () => {
    expect(() => ProfileService.duplicateProfile('non-existent')).toThrow(
      'Profile not found: non-existent'
    );
  });
});
