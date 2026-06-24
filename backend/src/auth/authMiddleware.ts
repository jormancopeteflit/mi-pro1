import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthenticatedRequest extends Request {
  userId: string;
  deviceId: string;
}

const JWT_SECRET = process.env.JWT_SECRET ?? 'change-me-in-prod';

export function authenticate(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const authHeader = req.headers['authorization'] ?? '';
  const token = authHeader.startsWith('Bearer ')
    ? authHeader.slice(7)
    : null;

  if (!token) {
    res.status(401).json({ error: 'Missing bearer token' });
    return;
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET) as {
      sub: string;
      deviceId: string;
    };

    (req as AuthenticatedRequest).userId = payload.sub;
    (req as AuthenticatedRequest).deviceId = payload.deviceId;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}
