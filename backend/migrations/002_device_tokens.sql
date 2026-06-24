-- Migration: 002_device_tokens
-- Creates the device_tokens table for storing FCM/APNs push tokens per user-device pair.

CREATE TABLE IF NOT EXISTS device_tokens (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_id     TEXT          NOT NULL,
  platform      TEXT          NOT NULL CHECK (platform IN ('ios', 'android', 'web')),
  token         TEXT          NOT NULL,
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ   NOT NULL DEFAULT now(),
  UNIQUE (user_id, device_id)          -- one active token per user+device
);

CREATE INDEX IF NOT EXISTS idx_device_tokens_user_id ON device_tokens(user_id);

-- Auto-update updated_at on upsert
CREATE OR REPLACE FUNCTION set_device_tokens_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_device_tokens_updated_at ON device_tokens;
CREATE TRIGGER trg_device_tokens_updated_at
  BEFORE UPDATE ON device_tokens
  FOR EACH ROW EXECUTE FUNCTION set_device_tokens_updated_at();
