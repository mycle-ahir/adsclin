/**
 * In-memory mock database for unit tests.
 * Implements the better-sqlite3 Database interface used by services:
 *   db.prepare(sql).run(...params)
 *   db.prepare(sql).get(...params)
 *   db.prepare(sql).all(...params)
 *   db.pragma(str)
 *   db.exec(sql)
 *
 * This allows Vitest unit tests to run in standard Node.js without requiring
 * native module compilation matching the host Node version vs Electron ABI.
 */

export interface MockRow {
  [column: string]: unknown;
}

export class MockDatabase {
  groups = new Map<string, MockRow>();
  proxies = new Map<string, MockRow>();
  profiles = new Map<string, MockRow>();
  tags = new Map<string, MockRow>();
  users = new Map<string, MockRow>();
  deviceRecords = new Map<string, MockRow>();
  cryptoTransactions = new Map<string, MockRow>();
  profileTags: Array<{ profile_id: string; tag_id: string }> = [];

  pragma(_cmd: string): void {
    // no-op
  }

  exec(_sql: string): void {
    // no-op schema setup
  }

  transaction<F extends (...args: any[]) => any>(fn: F): F {
    return ((...args: any[]) => fn(...args)) as F;
  }

  prepare<T = unknown>(sql: string) {
    const trimmed = sql.trim().replace(/\s+/g, ' ');

    return {
      run: (...params: unknown[]) => {
        // --- Groups ---
        if (trimmed.startsWith('INSERT INTO groups')) {
          const [id, name, created_at] = params as [string, string, number];
          this.groups.set(id, { id, name, created_at });
          return { changes: 1 };
        }
        if (trimmed.startsWith('DELETE FROM groups WHERE id = ?')) {
          const [id] = params as [string];
          this.groups.delete(id);
          return { changes: 1 };
        }

        // --- Tags ---
        if (trimmed.startsWith('INSERT INTO tags')) {
          const [id, name] = params as [string, string];
          this.tags.set(id, { id, name });
          return { changes: 1 };
        }
        if (trimmed.startsWith('DELETE FROM profile_tags WHERE profile_id = ?')) {
          const [profileId] = params as [string];
          this.profileTags = this.profileTags.filter((pt) => pt.profile_id !== profileId);
          return { changes: 1 };
        }
        if (trimmed.startsWith('INSERT OR IGNORE INTO profile_tags')) {
          const [profile_id, tag_id] = params as [string, string];
          const exists = this.profileTags.some(
            (pt) => pt.profile_id === profile_id && pt.tag_id === tag_id
          );
          if (!exists) {
            this.profileTags.push({ profile_id, tag_id });
          }
          return { changes: 1 };
        }

        // --- Profiles ---
        if (trimmed.startsWith('INSERT INTO profiles')) {
          if (trimmed.includes('fingerprint_json')) {
            const [id, name, group_id, proxy_id, notes, user_data_dir, fingerprint_json, created_at, updated_at] =
              params as [string, string, string | null, string | null, string, string, string | null, number, number];
            this.profiles.set(id, {
              id,
              name,
              group_id,
              proxy_id,
              notes,
              status: 'idle',
              user_data_dir,
              fingerprint_json,
              created_at,
              updated_at,
              last_launched_at: null,
            });
            return { changes: 1 };
          }
          const [id, name, group_id, proxy_id, notes, user_data_dir, created_at, updated_at] =
            params as [string, string, string | null, string | null, string, string, number, number];
          this.profiles.set(id, {
            id,
            name,
            group_id,
            proxy_id,
            notes,
            status: 'idle',
            user_data_dir,
            fingerprint_json: null,
            created_at,
            updated_at,
            last_launched_at: null,
          });
          return { changes: 1 };
        }
        if (trimmed.startsWith('UPDATE profiles SET status = ?, updated_at = ?, last_launched_at = ? WHERE id = ?')) {
          const [status, updated_at, last_launched_at, id] = params as [string, number, number, string];
          const p = this.profiles.get(id);
          if (p) {
            p.status = status;
            p.updated_at = updated_at;
            p.last_launched_at = last_launched_at;
          }
          return { changes: 1 };
        }
        if (trimmed.startsWith('UPDATE profiles SET status = ?, updated_at = ? WHERE id = ?')) {
          const [status, updated_at, id] = params as [string, number, string];
          const p = this.profiles.get(id);
          if (p) {
            p.status = status;
            p.updated_at = updated_at;
          }
          return { changes: 1 };
        }
        if (trimmed.startsWith("UPDATE profiles SET status = 'idle', updated_at = ? WHERE status = 'running'")) {
          const [updated_at] = params as [number];
          let count = 0;
          for (const p of this.profiles.values()) {
            if (p.status === 'running') {
              p.status = 'idle';
              p.updated_at = updated_at;
              count++;
            }
          }
          return { changes: count };
        }
        if (trimmed.startsWith('UPDATE profiles SET')) {
          // Dynamic update in profile-service: last param is id
          const id = params[params.length - 1] as string;
          const p = this.profiles.get(id);
          if (p) {
            // parse SET assignments
            const setPart = trimmed.substring('UPDATE profiles SET '.length, trimmed.indexOf(' WHERE'));
            const cols = setPart.split(',').map((c) => c.trim().split(' ')[0]);
            for (let i = 0; i < cols.length; i++) {
              p[cols[i]] = params[i];
            }
          }
          return { changes: 1 };
        }
        if (trimmed.startsWith('DELETE FROM profiles WHERE id = ?')) {
          const [id] = params as [string];
          this.profiles.delete(id);
          this.profileTags = this.profileTags.filter((pt) => pt.profile_id !== id);
          return { changes: 1 };
        }

        // --- Proxies ---
        if (trimmed.startsWith('INSERT INTO proxies')) {
          const [id, name, scheme, host, port, username, password_enc] =
            params as [string, string, string, string, number, string | null, Buffer | null];
          this.proxies.set(id, {
            id,
            name,
            scheme,
            host,
            port,
            username,
            password_enc,
            last_test_ip: null,
            last_test_country: null,
            last_test_latency_ms: null,
            last_tested_at: null,
          });
          return { changes: 1 };
        }
        if (trimmed.startsWith('UPDATE proxies SET last_test_ip = ?')) {
          const id = params[params.length - 1] as string;
          const px = this.proxies.get(id);
          if (px) {
            px.last_test_ip = params[0];
            px.last_test_country = params[1];
            px.last_test_latency_ms = params[2];
            px.last_tested_at = params[3];
            if (params.length > 5) {
              px.last_test_timezone = params[4];
              px.last_test_loc = params[5];
            }
          }
          return { changes: 1 };
        }
        if (trimmed.startsWith('UPDATE proxies SET')) {
          const id = params[params.length - 1] as string;
          const px = this.proxies.get(id);
          if (px) {
            const setPart = trimmed.substring('UPDATE proxies SET '.length, trimmed.indexOf(' WHERE'));
            const cols = setPart.split(',').map((c) => c.trim().split(' ')[0]);
            for (let i = 0; i < cols.length; i++) {
              px[cols[i]] = params[i];
            }
          }
          return { changes: 1 };
        }
        if (trimmed.startsWith('DELETE FROM proxies WHERE id = ?')) {
          const [id] = params as [string];
          this.proxies.delete(id);
          return { changes: 1 };
        }

        // --- Auth & Users ---
        if (trimmed.startsWith('INSERT INTO users')) {
          const isExpired = trimmed.includes("'expired'");
          const [id, identifier, device_id, trial_ends_at, created_at, last_login_at] =
            params as [string, string, string, number, number, number];
          this.users.set(id, {
            id,
            identifier,
            device_id,
            plan_type: isExpired ? 'expired' : 'trial',
            trial_ends_at,
            subscription_ends_at: null,
            created_at,
            last_login_at,
          });
          return { changes: 1 };
        }
        if (trimmed.includes('INTO device_records')) {
          const [device_id, first_user_id, first_claimed_at] = params as [string, string, number];
          this.deviceRecords.set(device_id, {
            device_id,
            first_user_id,
            has_claimed_trial: 1,
            first_claimed_at,
          });
          return { changes: 1 };
        }
        if (trimmed.includes('UPDATE users SET plan_type =')) {
          const [sub_ends, last_login, id] = params as [number, number, string];
          const u = this.users.get(id);
          if (u) {
            u.plan_type = 'active';
            u.subscription_ends_at = sub_ends;
            u.last_login_at = last_login;
          }
          return { changes: 1 };
        }
        if (trimmed.startsWith('UPDATE users SET last_login_at = ? WHERE id = ?')) {
          const [last_login, id] = params as [number, string];
          const u = this.users.get(id);
          if (u) {
            u.last_login_at = last_login;
          }
          return { changes: 1 };
        }
        if (trimmed.startsWith('INSERT INTO crypto_transactions')) {
          const [id, user_id, currency, tx_hash, created_at] =
            params as [string, string, string, string, number];
          this.cryptoTransactions.set(id, {
            id,
            user_id,
            currency,
            amount_usd: 9.0,
            tx_hash,
            status: 'confirmed',
            created_at,
          });
          return { changes: 1 };
        }

        return { changes: 0 };
      },

      get: (...params: unknown[]): T | undefined => {
        // --- Auth & Users ---
        if (trimmed.startsWith('SELECT * FROM users WHERE identifier = ?')) {
          const [identifier] = params as [string];
          for (const u of this.users.values()) {
            if (u.identifier === identifier) return { ...u } as T;
          }
          return undefined;
        }
        if (trimmed.startsWith('SELECT * FROM users WHERE id = ?')) {
          const [id] = params as [string];
          const u = this.users.get(id);
          return u ? ({ ...u } as T) : undefined;
        }
        if (trimmed.startsWith('SELECT * FROM users ORDER BY last_login_at DESC LIMIT 1')) {
          const list = Array.from(this.users.values()).sort(
            (a, b) => Number(b.last_login_at) - Number(a.last_login_at)
          );
          return list[0] ? ({ ...list[0] } as T) : undefined;
        }
        if (trimmed.startsWith('SELECT * FROM device_records WHERE device_id = ?')) {
          const [device_id] = params as [string];
          const rec = this.deviceRecords.get(device_id);
          return rec ? ({ ...rec } as T) : undefined;
        }
        if (trimmed.startsWith('SELECT COUNT(*) as count FROM crypto_transactions WHERE tx_hash = ?')) {
          const [txHash] = params as [string];
          let count = 0;
          for (const tx of this.cryptoTransactions.values()) {
            if (tx.tx_hash === txHash) count++;
          }
          return { count } as T;
        }
        if (trimmed.startsWith('SELECT * FROM crypto_transactions WHERE user_id = ?')) {
          const [userId] = params as [string];
          for (const tx of this.cryptoTransactions.values()) {
            if (tx.user_id === userId) return { ...tx } as T;
          }
          return undefined;
        }

        // --- Groups ---
        if (trimmed.startsWith('SELECT * FROM groups WHERE id = ?')) {
          const [id] = params as [string];
          return (this.groups.get(id) as T) ?? undefined;
        }

        // --- Tags ---
        if (trimmed.startsWith('SELECT id FROM tags WHERE name = ?')) {
          const [name] = params as [string];
          for (const t of this.tags.values()) {
            if (t.name === name) return { id: t.id } as T;
          }
          return undefined;
        }

        // --- Profiles ---
        if (trimmed.includes('FROM profiles WHERE id = ?')) {
          const [id] = params as [string];
          const p = this.profiles.get(id);
          return p ? ({ ...p } as T) : undefined;
        }

        // --- Proxies ---
        if (trimmed.startsWith('SELECT * FROM proxies WHERE id = ?')) {
          const [id] = params as [string];
          const px = this.proxies.get(id);
          return px ? ({ ...px } as T) : undefined;
        }

        return undefined;
      },

      all: (...params: unknown[]): T[] => {
        // --- Groups ---
        if (trimmed.startsWith('SELECT * FROM groups ORDER BY name')) {
          return Array.from(this.groups.values()).sort((a, b) =>
            String(a.name).localeCompare(String(b.name))
          ) as T[];
        }

        // --- Tags for Profile ---
        if (trimmed.includes('FROM tags t JOIN profile_tags pt')) {
          const [profileId] = params as [string];
          const tagIds = this.profileTags
            .filter((pt) => pt.profile_id === profileId)
            .map((pt) => pt.tag_id);
          const names = tagIds
            .map((id) => this.tags.get(id)?.name as string)
            .filter(Boolean)
            .sort();
          return names.map((name) => ({ name })) as T[];
        }

        // --- Profiles ---
        if (trimmed.startsWith('SELECT * FROM profiles ORDER BY created_at DESC')) {
          return Array.from(this.profiles.values())
            .map((p) => ({ ...p }))
            .sort((a, b) => Number(b.created_at) - Number(a.created_at)) as T[];
        }

        // --- Proxies ---
        if (trimmed.startsWith('SELECT * FROM proxies ORDER BY name')) {
          return Array.from(this.proxies.values())
            .map((px) => ({ ...px }))
            .sort((a, b) => String(a.name).localeCompare(String(b.name))) as T[];
        }

        return [];
      },
    };
  }
}
