import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { DbAdapter, findUserByEmail, createUser, createSession } from '../db/usersRepository';

const SALT_ROUNDS = 12;
const ACCESS_TOKEN_TTL_SECONDS = 60 * 60;       // 1 h
const REFRESH_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 d

export interface RegisterInput {
  email: string;
  password: string;
  displayName?: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number; // segundos
}

export interface RegisterResult {
  userId: string;
  email: string;
  displayName: string;
  tokens: AuthTokens;
}

/**
 * Registra un nuevo usuario.
 *
 * @throws {ConflictError} si el e-mail ya existe (HTTP 409).
 * @throws {ValidationError} si los datos de entrada no son válidos.
 */
export async function registerUser(
  db: DbAdapter,
  input: RegisterInput,
  jwtSecret: string
): Promise<RegisterResult> {
  // 1. Validación básica
  validateRegisterInput(input);

  // 2. Verificar unicidad de email — ANTES del hash para evitar trabajo innecesario
  const existing = findUserByEmail(db, input.email);
  if (existing) {
    throw new ConflictError(`El e-mail '${input.email}' ya está registrado.`);
  }

  // 3. Hash de contraseña
  const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);

  // 4. Persistir usuario
  const user = createUser(db, {
    email: input.email,
    passwordHash,
    displayName: input.displayName?.trim() || '',
  });

  // 5. Generar tokens
  const tokens = generateTokens(user.id, jwtSecret);

  // 6. Persistir sesión (refresh token)
  const expiresAt = new Date(
    Date.now() + REFRESH_TOKEN_TTL_SECONDS * 1000
  ).toISOString();
  createSession(db, { userId: user.id, token: tokens.refreshToken, expiresAt });

  return {
    userId: user.id,
    email: user.email,
    displayName: user.displayName,
    tokens,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateTokens(userId: string, secret: string): AuthTokens {
  const accessToken = jwt.sign(
    { sub: userId, type: 'access' },
    secret,
    { expiresIn: ACCESS_TOKEN_TTL_SECONDS }
  );

  const refreshToken = jwt.sign(
    { sub: userId, type: 'refresh' },
    secret,
    { expiresIn: REFRESH_TOKEN_TTL_SECONDS }
  );

  return { accessToken, refreshToken, expiresIn: ACCESS_TOKEN_TTL_SECONDS };
}

function validateRegisterInput(input: RegisterInput): void {
  const errors: string[] = [];

  if (!input.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) {
    errors.push('email inválido.');
  }

  if (!input.password || input.password.length < 8) {
    errors.push('La contraseña debe tener al menos 8 caracteres.');
  }

  if (errors.length > 0) {
    throw new ValidationError(errors.join(' '));
  }
}

// ─── Errores de dominio ───────────────────────────────────────────────────────

export class ConflictError extends Error {
  readonly statusCode = 409;
  constructor(message: string) {
    super(message);
    this.name = 'ConflictError';
  }
}

export class ValidationError extends Error {
  readonly statusCode = 422;
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}
