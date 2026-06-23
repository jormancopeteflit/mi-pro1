import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET || 'dev_access_secret';

export interface AuthenticatedRequest extends Request {
  user?: { id: string; email: string };
}

export function authenticate(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'MISSING_TOKEN', message: 'Authorization header is required' });
    return;
  }

  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, ACCESS_TOKEN_SECRET) as { sub: string; email: string };
    req.user = { id: payload.sub, email: payload.email };
    next();
  } catch (e: any) {
    const code = e.name === 'TokenExpiredError' ? 'TOKEN_EXPIRED' : 'INVALID_TOKEN';
    res.status(401).json({ error: code, message: e.message });
  }
}
