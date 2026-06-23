/**
 * Endpoint de registro: POST /auth/register
 *
 * Body esperado (JSON):
 *   { email: string, password: string, displayName: string }
 *
 * Respuestas:
 *   201 – { user: UserPublic, token: string }  → registro exitoso
 *   400 – { error: string }                    → validación fallida
 *   409 – { error: string }                    → email ya registrado
 *   500 – { error: string }                    → error interno
 */

import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import jwt from 'jsonwebtoken';
import { getUserByEmail, createUser, createSession } from './userRepository';

const BCRYPT_ROUNDS = 12;
const JWT_SECRET = process.env.JWT_SECRET ?? 'change-me-in-production';
const JWT_EXPIRES_IN = '7d';

/** Campos públicos del usuario (sin datos sensibles) */
export interface UserPublic {
  id: string;
  email: string;
  displayName: string;
  createdAt: string;
}

/** Validaciones básicas del payload de registro */
function validateRegisterPayload(
  body: unknown
): { email: string; password: string; displayName: string } | null {
  if (!body || typeof body !== 'object') return null;
  const { email, password, displayName } = body as Record<string, unknown>;

  if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return null;
  if (typeof password !== 'string' || password.length < 8) return null;
  if (typeof displayName !== 'string' || displayName.trim().length === 0)
    return null;

  return {
    email: email.toLowerCase().trim(),
    password,
    displayName: displayName.trim(),
  };
}

/**
 * Handler Express para POST /auth/register
 */
export async function registerHandler(
  req: Request,
  res: Response
): Promise<void> {
  const payload = validateRegisterPayload(req.body);
  if (!payload) {
    res.status(400).json({
      error:
        'Datos inválidos. Se requiere email válido, contraseña de mínimo 8 caracteres y nombre de usuario.',
    });
    return;
  }

  const { email, password, displayName } = payload;

  try {
    // ── Verificar duplicado ──────────────────────────────────────────────────
    const existing = await getUserByEmail(email);
    if (existing) {
      // HTTP 409: el cliente NO debe reintentar sin resolver el conflicto
      res.status(409).json({
        error: 'El correo electrónico ya está registrado.',
        code: 'EMAIL_ALREADY_EXISTS',
      });
      return;
    }

    // ── Crear usuario ────────────────────────────────────────────────────────
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const now = new Date();
    const userId = uuidv4();

    await createUser({
      id: userId,
      email,
      passwordHash,
      displayName,
      createdAt: now,
      updatedAt: now,
    });

    // ── Crear sesión / token ─────────────────────────────────────────────────
    const sessionId = uuidv4();
    const token = jwt.sign(
      { sub: userId, sessionId, email },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await createSession({
      id: sessionId,
      userId,
      token,
      expiresAt,
      createdAt: now,
    });

    const userPublic: UserPublic = {
      id: userId,
      email,
      displayName,
      createdAt: now.toISOString(),
    };

    res.status(201).json({ user: userPublic, token });
  } catch (err) {
    console.error('[register] Error inesperado:', err);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
}
