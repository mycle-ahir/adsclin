import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';

let db: Database.Database | null = null;

export function initDatabase(customPath?: string): void {
  const dbPath = customPath || (app?.getPath ? path.join(app.getPath('userData'), 'profilebrowser.db') : path.join(process.cwd(), 'profilebrowser.db'));
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  runMigrations(db);
  resetStaleRunningProfiles(db);
  repairInconsistentProfiles(db);
}

export function getDb(): Database.Database {
  if (!db) throw new Error('Database not initialized — call initDatabase() first');
  return db;
}

function runMigrations(database: Database.Database): void {
  // Ensure migration tracking table exists before we query it
  database.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      applied_at INTEGER NOT NULL
    )
  `);

  let migrationsDir = path.join(__dirname, 'migrations');
  if (!fs.existsSync(migrationsDir)) {
    const candidateAppPath = app?.getAppPath ? path.join(app.getAppPath(), 'dist/main/main/db/migrations') : '';
    if (candidateAppPath && fs.existsSync(candidateAppPath)) {
      migrationsDir = candidateAppPath;
    } else {
      const srcDir = path.resolve(__dirname, '../../../src/main/db/migrations');
      if (fs.existsSync(srcDir)) {
        migrationsDir = srcDir;
      } else {
        const directSrc = path.resolve(process.cwd(), 'src/main/db/migrations');
        if (fs.existsSync(directSrc)) {
          migrationsDir = directSrc;
        }
      }
    }
  }

  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const versionStr = file.split('_')[0] ?? '0';
    const version = parseInt(versionStr, 10);
    const applied = database
      .prepare('SELECT 1 FROM schema_migrations WHERE version = ?')
      .get(version);
    if (applied) continue;

    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    database.exec(sql);
    database
      .prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)')
      .run(version, Date.now());
  }
}

// On startup, reset any profile stuck in 'running' due to a crash
function resetStaleRunningProfiles(database: Database.Database): void {
  database
    .prepare("UPDATE profiles SET status = 'idle', updated_at = ? WHERE status = 'running'")
    .run(Date.now());
}

// On startup, heal any profile with inconsistent fingerprint data
function repairInconsistentProfiles(database: Database.Database): void {
  try {
    const rows = database
      .prepare('SELECT id, fingerprint_json FROM profiles WHERE fingerprint_json IS NOT NULL')
      .all() as Array<{ id: string; fingerprint_json: string }>;

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { validateFingerprint } = require('../services/fingerprint-validator');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { repairFingerprintConsistency } = require('../services/fingerprint-generator');

    for (const row of rows) {
      try {
        const fp = JSON.parse(row.fingerprint_json);
        if (fp && validateFingerprint(fp).length > 0) {
          const repaired = repairFingerprintConsistency(fp);
          database
            .prepare('UPDATE profiles SET fingerprint_json = ? WHERE id = ?')
            .run(JSON.stringify(repaired), row.id);
        }
      } catch {
        // Skip invalid JSON
      }
    }
  } catch (err) {
    console.warn('[database] Failed to run repairInconsistentProfiles:', err);
  }
}
