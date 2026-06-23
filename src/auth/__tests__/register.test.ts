/**
 * Tests unitarios del endpoint de registro.
 * Ejecutar con: npx jest src/auth/__tests__/register.test.ts
 */
import { registerUser, ConflictError, ValidationError } from '../authService';
import { DbAdapter } from '../../db/usersRepository';

// ─── Stub de DbAdapter en memoria ────────────────────────────────────────────

function createInMemoryDb(): DbAdapter & { _users: Map<string, unknown> } {
  const users = new Map<string, unknown>();
  const sessions: unknown[] = [];

  return {
    _users: users,
    get<T>(sql: string, params?: unknown[]): T | undefined {
      if (sql.includes('FROM users WHERE email')) {
        const email = (params?.[0] as string).toLowerCase().trim();
        return (users.get(email) as T) ?? undefined;
      }
      if (sql.includes('FROM users WHERE id')) {
        const id = params?.[0] as string;
        for (const u of users.values()) {
          if ((u as { id: string }).id === id) return u as T;
        }
      }
      return undefined;
    },
    run(sql: string, params?: unknown[]): void {
      if (sql.includes('INSERT INTO users')) {
        const [id, email, passwordHash, displayName, createdAt, updatedAt] = params as string[];
        users.set(email, { id, email, passwordHash, displayName, createdAt, updatedAt });
      }
      if (sql.includes('INSERT INTO sessions')) {
        sessions.push(params);
      }
    },
  };
}

const JWT_SECRET = 'test-secret-32-chars-long-enough!!';

// ─── Casos de prueba ──────────────────────────────────────────────────────────

describe('registerUser()', () => {
  it('TC-REG-01 – Registro exitoso devuelve userId, email y tokens', async () => {
    const db = createInMemoryDb();
    const result = await registerUser(
      db,
      { email: 'alice@example.com', password: 'Passw0rd!', displayName: 'Alice' },
      JWT_SECRET
    );

    expect(result.userId).toBeTruthy();
    expect(result.email).toBe('alice@example.com');
    expect(result.displayName).toBe('Alice');
    expect(result.tokens.accessToken).toBeTruthy();
    expect(result.tokens.refreshToken).toBeTruthy();
    expect(result.tokens.expiresIn).toBe(3600);
  });

  it('TC-REG-02 – Email duplicado lanza ConflictError (409)', async () => {
    const db = createInMemoryDb();
    await registerUser(
      db,
      { email: 'bob@example.com', password: 'Passw0rd!' },
      JWT_SECRET
    );

    await expect(
      registerUser(db, { email: 'bob@example.com', password: 'OtherPass1' }, JWT_SECRET)
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it('TC-REG-03 – Email con distinto case se normaliza y detecta duplicado', async () => {
    const db = createInMemoryDb();
    await registerUser(
      db,
      { email: 'Carol@Example.COM', password: 'Passw0rd!' },
      JWT_SECRET
    );

    await expect(
      registerUser(db, { email: 'carol@example.com', password: 'OtherPass1' }, JWT_SECRET)
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it('TC-REG-04 – Email inválido lanza ValidationError (422)', async () => {
    const db = createInMemoryDb();
    await expect(
      registerUser(db, { email: 'not-an-email', password: 'Passw0rd!' }, JWT_SECRET)
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('TC-REG-05 – Contraseña corta lanza ValidationError (422)', async () => {
    const db = createInMemoryDb();
    await expect(
      registerUser(db, { email: 'dave@example.com', password: 'short' }, JWT_SECRET)
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('TC-REG-06 – displayName opcional: se almacena string vacío si no se proporciona', async () => {
    const db = createInMemoryDb();
    const result = await registerUser(
      db,
      { email: 'eve@example.com', password: 'Passw0rd!' },
      JWT_SECRET
    );
    expect(result.displayName).toBe('');
  });
});
