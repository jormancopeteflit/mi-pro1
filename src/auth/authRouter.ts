import { Router } from 'express';
import { makeRegisterHandler } from './registerHandler';
import { DbAdapter } from '../db/usersRepository';

/**
 * Monta las rutas de autenticación.
 *
 * Uso:
 *   app.use('/auth', createAuthRouter(db, process.env.JWT_SECRET!))
 */
export function createAuthRouter(db: DbAdapter, jwtSecret: string): Router {
  const router = Router();

  /**
   * POST /auth/register
   *
   * Body (JSON):
   *   { email: string, password: string, displayName?: string }
   *
   * Responses:
   *   201 – Cuenta creada. Devuelve accessToken + refreshToken.
   *   409 – E-mail ya registrado.
   *   422 – Datos de entrada inválidos.
   *   500 – Error interno.
   */
  router.post('/register', makeRegisterHandler(db, jwtSecret));

  return router;
}
