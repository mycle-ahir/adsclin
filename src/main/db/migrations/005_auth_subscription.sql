CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  identifier TEXT UNIQUE NOT NULL,
  device_id TEXT NOT NULL,
  plan_type TEXT NOT NULL DEFAULT 'trial',
  trial_ends_at INTEGER NOT NULL,
  subscription_ends_at INTEGER,
  created_at INTEGER NOT NULL,
  last_login_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS device_records (
  device_id TEXT PRIMARY KEY,
  first_user_id TEXT NOT NULL,
  has_claimed_trial INTEGER NOT NULL DEFAULT 1,
  first_claimed_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS crypto_transactions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  currency TEXT NOT NULL,
  amount_usd REAL NOT NULL,
  tx_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'completed',
  created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
