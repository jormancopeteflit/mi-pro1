/**
 * Handler HTTP para POST /auth/register.
 * Compatible con Express 4 / 5.
 */
import { Request, Response, NextFunction } from 'express';
import { registerUser, ConflictError, ValidationError } from './authService';
import { DbAdapter } from '../db/usersRepository';

interface RegisterBody {
  email?: string;
  password?: string;
  displayName?: string;
}

/**
 * Factoría que inyecta las dependencias (db, jwtSecret) y devuelve el handler.
 * Esto facilita los tests unitarios sin necesidad de mocks globales.
 */
export function makeRegisterHandler(
  db: DbAdapter,
  jwtSecret: string
) {
  return async function registerHandler(
    req: Request<object, object, RegisterBody>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { email = '', password = '', displayName } = req.body;

      const result = await registerUser(
        db,
        { email, password, displayName },
        jwtSecret
      );

      res.status(201).json({
        userId: result.userId,
        email: result.email,
        displayName: result.displayName,
        accessToken: result.tokens.accessToken,
        refreshToken: result.tokens.refreshToken,
        expiresIn: result.tokens.expiresIn,
      });
    } catch (err) {
      if (err instanceof ConflictError) {
        res.status(409).json({
          error: 'CONFLICT',
          message: err.message,
        });
        return;
      }

      if (err instanceof ValidationError) {
        res.status(422).json({
          error: 'VALIDATION_ERROR',
          message: err.message,
        });
        return;
      }

      // Errores inesperados → siguiente middleware de error
      next(err);
    }
  };
}
