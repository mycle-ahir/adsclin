-- ==============================================================================
-- ADSCLIN ENTERPRISE ANTI-DETECT BROWSER - SUPABASE CLOUD DATABASE SCHEMA
-- Execute this script in your Supabase Project: SQL Editor -> New Query -> Run
-- ==============================================================================

-- 1. USERS & SUBSCRIPTION STATE
CREATE TABLE IF NOT EXISTS public.users (
  id TEXT PRIMARY KEY,
  identifier TEXT UNIQUE NOT NULL,
  device_id TEXT NOT NULL,
  plan_type TEXT NOT NULL DEFAULT 'trial' CHECK (plan_type IN ('trial', 'active', 'expired')),
  trial_ends_at BIGINT NOT NULL,
  subscription_ends_at BIGINT,
  created_at BIGINT NOT NULL,
  last_login_at BIGINT NOT NULL
);

-- 2. HARDWARE DEVICE LOCKS (1 Free Trial per Machine)
CREATE TABLE IF NOT EXISTS public.device_records (
  device_id TEXT PRIMARY KEY,
  first_user_id TEXT NOT NULL,
  has_claimed_trial BOOLEAN NOT NULL DEFAULT TRUE,
  first_claimed_at BIGINT NOT NULL
);

-- 3. PROXIES
CREATE TABLE IF NOT EXISTS public.proxies (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES public.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  scheme TEXT NOT NULL CHECK (scheme IN ('http', 'https', 'socks5')),
  host TEXT NOT NULL,
  port INTEGER NOT NULL,
  username TEXT,
  last_test_ip TEXT,
  last_test_country TEXT,
  last_test_latency_ms INTEGER,
  last_tested_at BIGINT
);

-- 4. PROFILE GROUPS
CREATE TABLE IF NOT EXISTS public.groups (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at BIGINT NOT NULL
);

-- 5. BROWSER PROFILES & FINGERPRINTS
CREATE TABLE IF NOT EXISTS public.profiles (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES public.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  group_id TEXT,
  proxy_id TEXT REFERENCES public.proxies(id) ON DELETE SET NULL,
  notes TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'idle' CHECK (status IN ('idle', 'running', 'error')),
  user_data_dir TEXT,
  fingerprint_json JSONB,
  tags TEXT[] DEFAULT '{}',
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL,
  last_launched_at BIGINT
);

-- 6. SUBSCRIPTION CRYPTO TRANSACTIONS
CREATE TABLE IF NOT EXISTS public.subscription_transactions (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  user_id TEXT REFERENCES public.users(id) ON DELETE CASCADE,
  currency TEXT NOT NULL,
  tx_hash TEXT NOT NULL,
  amount_usd NUMERIC(10, 2) NOT NULL DEFAULT 9.00,
  status TEXT NOT NULL DEFAULT 'confirmed',
  created_at BIGINT NOT NULL
);

-- 7. AUDIT & ACTIVITY LOGS
CREATE TABLE IF NOT EXISTS public.activity_logs (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  user_id TEXT,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  details TEXT,
  created_at BIGINT NOT NULL
);

-- ==============================================================================
-- INDEXES FOR MAXIMUM QUERY PERFORMANCE
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_users_identifier ON public.users(identifier);
CREATE INDEX IF NOT EXISTS idx_users_device_id ON public.users(device_id);
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON public.profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_proxies_user_id ON public.proxies(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_created_at ON public.activity_logs(created_at DESC);

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proxies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- Allow read/write access via Supabase Anon API key for desktop client
DROP POLICY IF EXISTS "Public anonymous access for users" ON public.users;
CREATE POLICY "Public anonymous access for users" ON public.users FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public anonymous access for device_records" ON public.device_records;
CREATE POLICY "Public anonymous access for device_records" ON public.device_records FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public anonymous access for proxies" ON public.proxies;
CREATE POLICY "Public anonymous access for proxies" ON public.proxies FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public anonymous access for groups" ON public.groups;
CREATE POLICY "Public anonymous access for groups" ON public.groups FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public anonymous access for profiles" ON public.profiles;
CREATE POLICY "Public anonymous access for profiles" ON public.profiles FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public anonymous access for subscription_transactions" ON public.subscription_transactions;
CREATE POLICY "Public anonymous access for subscription_transactions" ON public.subscription_transactions FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public anonymous access for activity_logs" ON public.activity_logs;
CREATE POLICY "Public anonymous access for activity_logs" ON public.activity_logs FOR ALL USING (true) WITH CHECK (true);
