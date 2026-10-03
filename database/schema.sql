CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  role TEXT NOT NULL CHECK(role IN ('admin','bettor')),
  balance_cents INTEGER NOT NULL DEFAULT 0 CHECK(balance_cents >= 0),
  data TEXT NOT NULL CHECK(json_valid(data))
) STRICT;
CREATE TABLE IF NOT EXISTS events (id TEXT PRIMARY KEY, data TEXT NOT NULL CHECK(json_valid(data))) STRICT;
CREATE TABLE IF NOT EXISTS markets (id TEXT PRIMARY KEY, event_id TEXT NOT NULL REFERENCES events(id)) STRICT;
CREATE TABLE IF NOT EXISTS outcomes (id TEXT PRIMARY KEY, market_id TEXT NOT NULL REFERENCES markets(id)) STRICT;
CREATE TABLE IF NOT EXISTS bets (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), data TEXT NOT NULL CHECK(json_valid(data))) STRICT;
CREATE TABLE IF NOT EXISTS bet_items (id TEXT PRIMARY KEY, bet_id TEXT NOT NULL REFERENCES bets(id), event_id TEXT NOT NULL REFERENCES events(id), outcome_id TEXT NOT NULL REFERENCES outcomes(id)) STRICT;
CREATE TABLE IF NOT EXISTS transactions (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), reference_id TEXT NOT NULL, data TEXT NOT NULL CHECK(json_valid(data))) STRICT;
CREATE TABLE IF NOT EXISTS balance_references (reference TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id)) STRICT;
CREATE TABLE IF NOT EXISTS notifications (id TEXT PRIMARY KEY, user_id TEXT REFERENCES users(id), data TEXT NOT NULL CHECK(json_valid(data))) STRICT;
CREATE INDEX IF NOT EXISTS bets_user ON bets(user_id);
CREATE INDEX IF NOT EXISTS transactions_user ON transactions(user_id);
CREATE INDEX IF NOT EXISTS items_event ON bet_items(event_id);
