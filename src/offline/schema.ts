/**
 * Modelo de datos local offline
 * Tablas SQLite para persistencia offline-first
 */

export const SCHEMA_VERSION = 1;

export const CREATE_TABLES_SQL = [
  `CREATE TABLE IF NOT EXISTS schema_meta (
     id       INTEGER PRIMARY KEY CHECK (id = 1),
     version  INTEGER NOT NULL DEFAULT 0
   )`,

  `CREATE TABLE IF NOT EXISTS items (
     id            TEXT    PRIMARY KEY,
     title         TEXT    NOT NULL,
     body          TEXT    NOT NULL DEFAULT '',
     owner_id      TEXT    NOT NULL,
     created_at    INTEGER NOT NULL,  -- Unix ms
     updated_at    INTEGER NOT NULL,  -- Unix ms
     server_updated_at INTEGER,       -- Unix ms (NULL = nunca sincronizado)
     is_deleted    INTEGER NOT NULL DEFAULT 0  -- soft-delete
   )`,

  `CREATE TABLE IF NOT EXISTS sync_queue (
     queue_id      INTEGER PRIMARY KEY AUTOINCREMENT,
     operation     TEXT    NOT NULL CHECK (operation IN ('CREATE','UPDATE','DELETE')),
     entity_type   TEXT    NOT NULL DEFAULT 'items',
     entity_id     TEXT    NOT NULL,
     payload       TEXT    NOT NULL DEFAULT '{}', -- JSON
     created_at    INTEGER NOT NULL,
     retry_count   INTEGER NOT NULL DEFAULT 0,
     last_error    TEXT
   )`,
];

export interface ItemRow {
  id: string;
  title: string;
  body: string;
  owner_id: string;
  created_at: number;
  updated_at: number;
  server_updated_at: number | null;
  is_deleted: 0 | 1;
}

export interface SyncQueueRow {
  queue_id: number;
  operation: 'CREATE' | 'UPDATE' | 'DELETE';
  entity_type: string;
  entity_id: string;
  payload: string;
  created_at: number;
  retry_count: number;
  last_error: string | null;
}
