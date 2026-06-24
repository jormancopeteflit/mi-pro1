-- Migration: 001_create_sync_tables
-- Creates tables for sync operations, device tokens and conflict log

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (base)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Items table (the data being synced)
CREATE TABLE IF NOT EXISTS items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT,
  version BIGINT NOT NULL DEFAULT 1,           -- monotonically increasing per item
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,                       -- soft-delete
  server_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_items_user_id        ON items(user_id);
CREATE INDEX IF NOT EXISTS idx_items_user_updated   ON items(user_id, server_updated_at);

-- Sync cursor: last server_updated_at the client has already seen
CREATE TABLE IF NOT EXISTS sync_cursors (
  user_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_id TEXT NOT NULL,
  cursor    TIMESTAMPTZ NOT NULL DEFAULT '1970-01-01T00:00:00Z',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, device_id)
);

-- Conflict log for auditing
CREATE TABLE IF NOT EXISTS conflict_log (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  item_id       UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_id     TEXT NOT NULL,
  client_version BIGINT NOT NULL,
  server_version BIGINT NOT NULL,
  resolution    TEXT NOT NULL,   -- 'server_wins' | 'client_wins' | 'lww_server' | 'lww_client'
  resolved_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Push notification device tokens
CREATE TABLE IF NOT EXISTS push_tokens (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_id  TEXT NOT NULL,
  token      TEXT NOT NULL,
  platform   TEXT NOT NULL CHECK (platform IN ('fcm', 'apns')),
  active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, device_id)
);

CREATE INDEX IF NOT EXISTS idx_push_tokens_user ON push_tokens(user_id);
