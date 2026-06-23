import { v4 as uuidv4 } from 'uuid';
import { UserRecord, SessionRecord } from './schema/users';

/**
 * Interfaz de base de datos que puede sustituirse por cualquier adaptador
 * (better-sqlite3, pg, etc.).
 */
export interface DbAdapter {
  get<T>(sql: string, params?: unknown[]): T | undefined;
  run(sql: string, params?: unknown[]): void;
}

// ─── Users ───────────────────────────────────────────────────────────────────

export function findUserByEmail(
  db: DbAdapter,
  email: string
): UserRecord | undefined {
  return db.get<UserRecord>(
    'SELECT * FROM users WHERE email = ? LIMIT 1',
    [email.toLowerCase().trim()]
  );
}

export function findUserById(
  db: DbAdapter,
  id: string
): UserRecord | undefined {
  return db.get<UserRecord>('SELECT * FROM users WHERE id = ? LIMIT 1', [id]);
}

export function createUser(
  db: DbAdapter,
  data: Omit<UserRecord, 'id' | 'createdAt' | 'updatedAt'>
): UserRecord {
  const now = new Date().toISOString();
  const user: UserRecord = {
    id: uuidv4(),
    email: data.email.toLowerCase().trim(),
    passwordHash: data.passwordHash,
    displayName: data.displayName,
    createdAt: now,
    updatedAt: now,
  };

  db.run(
    `INSERT INTO users (id, email, passwordHash, displayName, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [user.id, user.email, user.passwordHash, user.displayName, user.createdAt, user.updatedAt]
  );

  return user;
}

// ─── Sessions ─────────────────────────────────────────────────────────────────

export function createSession(
  db: DbAdapter,
  data: Omit<SessionRecord, 'id' | 'createdAt' | 'revokedAt'>
): SessionRecord {
  const now = new Date().toISOString();
  const session: SessionRecord = {
    id: uuidv4(),
    userId: data.userId,
    token: data.token,
    expiresAt: data.expiresAt,
    createdAt: now,
    revokedAt: null,
  };

  db.run(
    `INSERT INTO sessions (id, userId, token, expiresAt, createdAt, revokedAt)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [session.id, session.userId, session.token, session.expiresAt, session.createdAt, null]
  );

  return session;
}

export function revokeSession(db: DbAdapter, sessionId: string): void {
  db.run(
    'UPDATE sessions SET revokedAt = ? WHERE id = ?',
    [new Date().toISOString(), sessionId]
  );
}
