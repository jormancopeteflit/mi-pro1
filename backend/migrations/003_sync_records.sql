-- Migration: 003_sync_records
-- Table that stores server-side sync state per user+resource.

CREATE TABLE IF NOT EXISTS sync_records (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  resource_type TEXT          NOT NULL,
  resource_id   TEXT          NOT NULL,
  data          JSONB         NOT NULL DEFAULT '{}',
  updated_at    TIMESTAMPTZ   NOT NULL DEFAULT now(),
  UNIQUE (user_id, resource_type, resource_id)  -- ensures per-user isolation
);

CREATE INDEX IF NOT EXISTS idx_sync_records_user_id ON sync_records(user_id);
