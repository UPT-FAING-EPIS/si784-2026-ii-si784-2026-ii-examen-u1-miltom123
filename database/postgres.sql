BEGIN;
CREATE SCHEMA IF NOT EXISTS betsport;
REVOKE ALL ON SCHEMA betsport FROM PUBLIC, anon, authenticated;
CREATE TABLE IF NOT EXISTS betsport.users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL CHECK(role IN ('admin','bettor')),
  balance_cents BIGINT NOT NULL DEFAULT 0 CHECK(balance_cents >= 0),
  data JSONB NOT NULL,
  created_order BIGSERIAL UNIQUE
);
CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower ON betsport.users(lower(email));
CREATE TABLE IF NOT EXISTS betsport.events (id TEXT PRIMARY KEY, data JSONB NOT NULL, created_order BIGSERIAL UNIQUE);
CREATE TABLE IF NOT EXISTS betsport.markets (id TEXT PRIMARY KEY, event_id TEXT NOT NULL REFERENCES betsport.events(id), created_order BIGSERIAL UNIQUE);
CREATE TABLE IF NOT EXISTS betsport.outcomes (id TEXT PRIMARY KEY, market_id TEXT NOT NULL REFERENCES betsport.markets(id), created_order BIGSERIAL UNIQUE);
CREATE TABLE IF NOT EXISTS betsport.bets (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES betsport.users(id), data JSONB NOT NULL, created_order BIGSERIAL UNIQUE);
CREATE TABLE IF NOT EXISTS betsport.bet_items (id TEXT PRIMARY KEY, bet_id TEXT NOT NULL REFERENCES betsport.bets(id), event_id TEXT NOT NULL REFERENCES betsport.events(id), outcome_id TEXT NOT NULL REFERENCES betsport.outcomes(id), created_order BIGSERIAL UNIQUE);
CREATE TABLE IF NOT EXISTS betsport.transactions (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES betsport.users(id), reference_id TEXT NOT NULL, data JSONB NOT NULL, created_order BIGSERIAL UNIQUE);
CREATE TABLE IF NOT EXISTS betsport.balance_references (reference TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES betsport.users(id), created_order BIGSERIAL UNIQUE);
CREATE TABLE IF NOT EXISTS betsport.notifications (id TEXT PRIMARY KEY, user_id TEXT REFERENCES betsport.users(id), data JSONB NOT NULL, created_order BIGSERIAL UNIQUE);
CREATE INDEX IF NOT EXISTS bets_user ON betsport.bets(user_id);
CREATE INDEX IF NOT EXISTS transactions_user ON betsport.transactions(user_id);
CREATE INDEX IF NOT EXISTS items_event ON betsport.bet_items(event_id);
-- Only a revision signal is public. User data and password hashes stay private.
CREATE TABLE IF NOT EXISTS public.betsport_updates (id INTEGER PRIMARY KEY CHECK(id=1), version BIGINT NOT NULL DEFAULT 0, updated_at TIMESTAMPTZ NOT NULL DEFAULT now());
INSERT INTO public.betsport_updates(id) VALUES (1) ON CONFLICT DO NOTHING;
ALTER TABLE public.betsport_updates ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.betsport_updates FROM anon, authenticated;
GRANT SELECT ON public.betsport_updates TO anon, authenticated;
DROP POLICY IF EXISTS betsport_revision_read ON public.betsport_updates;
CREATE POLICY betsport_revision_read ON public.betsport_updates FOR SELECT TO anon, authenticated USING (true);
DO $$ BEGIN
  IF EXISTS(SELECT 1 FROM pg_publication WHERE pubname='supabase_realtime') AND NOT EXISTS(SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='betsport_updates') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.betsport_updates;
  END IF;
END $$;
COMMIT;
