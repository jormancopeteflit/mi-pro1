/**
 * requireAuth middleware
 * Validates Bearer JWT and attaches decoded payload to req.user.
 * Returns 401 on missing/invalid/expired token.
 */
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthPayload {
  id: string;
  email: string;
  iat: number;
  exp: number;
}

export function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or malformed Authorization header' });
    return;
  }

  const token = authHeader.slice(7);
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    res.status(500).json({ error: 'Server misconfiguration: JWT_SECRET not set' });
    return;
  }

  try {
    const payload = jwt.verify(token, secret) as AuthPayload;
    (req as any).user = payload;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}
