import { Router, Request, Response } from 'express';
import { AuthService } from './auth.service';
import { validateBody } from '../middleware/validate';
import { loginSchema, registerSchema, refreshSchema } from './auth.schemas';

const router = Router();
const authService = new AuthService();

/**
 * POST /auth/register
 * Registra un nuevo usuario y devuelve tokens.
 */
router.post('/register', validateBody(registerSchema), async (req: Request, res: Response) => {
  try {
    const { email, password, name } = req.body;
    const result = await authService.register({ email, password, name });
    return res.status(201).json(result);
  } catch (err: any) {
    if (err.code === 'USER_EXISTS') {
      return res.status(409).json({ error: 'EMAIL_ALREADY_REGISTERED', message: err.message });
    }
    console.error('[auth/register]', err);
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Unexpected error' });
  }
});

/**
 * POST /auth/login
 * Autentica credenciales y devuelve accessToken + refreshToken.
 */
router.post('/login', validateBody(loginSchema), async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    const result = await authService.login({ email, password });
    return res.status(200).json(result);
  } catch (err: any) {
    if (err.code === 'INVALID_CREDENTIALS') {
      return res.status(401).json({ error: 'INVALID_CREDENTIALS', message: 'Email or password is incorrect' });
    }
    console.error('[auth/login]', err);
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Unexpected error' });
  }
});

/**
 * POST /auth/refresh
 * Renueva el accessToken usando un refreshToken válido.
 */
router.post('/refresh', validateBody(refreshSchema), async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;
    const result = await authService.refresh(refreshToken);
    return res.status(200).json(result);
  } catch (err: any) {
    if (err.code === 'INVALID_REFRESH_TOKEN' || err.code === 'TOKEN_EXPIRED') {
      return res.status(401).json({ error: err.code, message: err.message });
    }
    console.error('[auth/refresh]', err);
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Unexpected error' });
  }
});

/**
 * POST /auth/logout
 * Revoca el refreshToken.
 */
router.post('/logout', async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;
    if (refreshToken) {
      await authService.revokeRefreshToken(refreshToken);
    }
    return res.status(204).send();
  } catch (err) {
    console.error('[auth/logout]', err);
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Unexpected error' });
  }
});

export default router;
