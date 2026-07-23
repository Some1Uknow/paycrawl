CREATE TABLE IF NOT EXISTS settlements (
  transaction_hash TEXT PRIMARY KEY NOT NULL,
  payer_hash TEXT NOT NULL,
  amount_atomic TEXT NOT NULL,
  route_pattern TEXT NOT NULL,
  latency_ms INTEGER NOT NULL,
  settled_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS settlements_settled_at_idx ON settlements (settled_at DESC);
CREATE INDEX IF NOT EXISTS settlements_payer_hash_idx ON settlements (payer_hash);

-- This contains only aggregate-safe failure telemetry. It never stores an IP,
-- payment signature, URL, origin content, or payer address.
CREATE TABLE IF NOT EXISTS payment_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  route_kind TEXT NOT NULL,
  outcome TEXT NOT NULL,
  occurred_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS payment_attempts_occurred_at_idx ON payment_attempts (occurred_at DESC);
