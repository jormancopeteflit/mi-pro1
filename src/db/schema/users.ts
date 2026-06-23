/**
 * Schema de usuarios y sesiones
 * Diseñado para ser compatible con cualquier ORM/query-builder (se exportan
 * las definiciones como objetos planos para que el adaptador de BD las consuma).
 */

export interface UserRecord {
  id: string;           // UUID v4
  email: string;        // único, lower-cased
  passwordHash: string; // bcrypt hash
  displayName: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SessionRecord {
  id: string;        // UUID v4
  userId: string;    // FK → users.id
  token: string;     // JWT opaco almacenado para revocación
  expiresAt: Date;
  createdAt: Date;
}

/** SQL DDL de referencia (PostgreSQL / SQLite compatible) */
export const USER_TABLE_DDL = `
CREATE TABLE IF NOT EXISTS users (
  id           TEXT        PRIMARY KEY,
  email        TEXT        NOT NULL UNIQUE,
  password_hash TEXT       NOT NULL,
  display_name TEXT        NOT NULL,
  created_at   DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP
);
`;

export const SESSION_TABLE_DDL = `
CREATE TABLE IF NOT EXISTS sessions (
  id         TEXT     PRIMARY KEY,
  user_id    TEXT     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token      TEXT     NOT NULL UNIQUE,
  expires_at DATETIME NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
`;
