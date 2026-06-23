/**
 * Repositorio de usuarios y sesiones.
 *
 * Implementación con Map en memoria para desarrollo/pruebas.
 * En producción, sustituir los métodos por llamadas al ORM/DB real.
 */

import { UserRecord, SessionRecord } from '../db/schema/users';

// ── Almacenes en memoria (sustituir por BD en producción) ──────────────────────
const usersStore = new Map<string, UserRecord>();   // key: email
const sessionsStore = new Map<string, SessionRecord>(); // key: sessionId

// ── Users ──────────────────────────────────────────────────────────────────────

export async function getUserByEmail(
  email: string
): Promise<UserRecord | null> {
  return usersStore.get(email.toLowerCase()) ?? null;
}

export async function getUserById(id: string): Promise<UserRecord | null> {
  for (const user of usersStore.values()) {
    if (user.id === id) return user;
  }
  return null;
}

export async function createUser(user: UserRecord): Promise<void> {
  usersStore.set(user.email.toLowerCase(), user);
}

export async function updateUser(
  id: string,
  changes: Partial<Omit<UserRecord, 'id' | 'createdAt'>>
): Promise<void> {
  const user = await getUserById(id);
  if (!user) throw new Error(`Usuario ${id} no encontrado`);
  Object.assign(user, changes, { updatedAt: new Date() });
}

// ── Sessions ───────────────────────────────────────────────────────────────────

export async function createSession(session: SessionRecord): Promise<void> {
  sessionsStore.set(session.id, session);
}

export async function getSessionById(
  id: string
): Promise<SessionRecord | null> {
  return sessionsStore.get(id) ?? null;
}

export async function deleteSession(id: string): Promise<void> {
  sessionsStore.delete(id);
}

export async function deleteSessionsByUserId(userId: string): Promise<void> {
  for (const [key, session] of sessionsStore.entries()) {
    if (session.userId === userId) sessionsStore.delete(key);
  }
}
