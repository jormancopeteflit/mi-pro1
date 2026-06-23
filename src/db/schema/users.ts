/**
 * Schema de usuarios y sesiones.
 * Usa tipos compatibles con cualquier ORM ligero o query-builder SQL.
 */

export interface UserRecord {
  id: string;           // UUID v4
  email: string;        // único, índice único
  passwordHash: string; // bcrypt hash
  displayName: string;
  createdAt: string;    // ISO-8601
  updatedAt: string;    // ISO-8601
}

export interface SessionRecord {
  id: string;        // UUID v4
  userId: string;    // FK → users.id
  token: string;     // JWT opaco almacenado (refresh token)
  expiresAt: string; // ISO-8601
  createdAt: string; // ISO-8601
  revokedAt: string | null;
}

/** DDL de referencia (SQLite / PostgreSQL compatible) */
export const CREATE_USERS_TABLE = `
CREATE TABLE IF NOT EXISTS users (
  id           TEXT        PRIMARY KEY,
  email        TEXT        NOT NULL UNIQUE,
  passwordHash TEXT        NOT NULL,
  displayName  TEXT        NOT NULL DEFAULT '',
  createdAt    TEXT        NOT NULL,
  updatedAt    TEXT        NOT NULL
);
`;

export const CREATE_SESSIONS_TABLE = `
CREATE TABLE IF NOT EXISTS sessions (
  id        TEXT     PRIMARY KEY,
  userId    TEXT     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token     TEXT     NOT NULL,
  expiresAt TEXT     NOT NULL,
  createdAt TEXT     NOT NULL,
  revokedAt TEXT     DEFAULT NULL
);
`;
