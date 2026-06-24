/**
 * auth.ts
 * POST /api/auth/login  – returns a signed JWT.
 * POST /api/auth/register – creates a user and returns a signed JWT.
 */
import { Router, Request, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from '../db';

const router = Router();
const SALT_ROUNDS = 12;
const TOKEN_TTL = '7d';

function signToken(userId: string, email: string): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET not set');
  return jwt.sign({ id: userId, email }, secret, { expiresIn: TOKEN_TTL });
}

// ── POST /api/auth/register ────────────────────────────────────────────────────
router.post(
  '/register',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 8 }).withMessage('Password must be ≥ 8 characters'),
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });

      const { email, password } = req.body as { email: string; password: string };
      const hash = await bcrypt.hash(password, SALT_ROUNDS);

      const result = await db.query<{ id: string }>(
        `INSERT INTO users (email, password_hash) VALUES ($1, $2)
         ON CONFLICT (email) DO NOTHING
         RETURNING id`,
        [email, hash],
      );

      if (result.rows.length === 0) {
        return res.status(409).json({ error: 'Email already registered' });
      }

      const token = signToken(result.rows[0].id, email);
      return res.status(201).json({ token });
    } catch (err) {
      next(err);
    }
  },
);

// ── POST /api/auth/login ───────────────────────────────────────────────────────
router.post(
  '/login',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').notEmpty(),
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });

      const { email, password } = req.body as { email: string; password: string };

      const result = await db.query<{ id: string; password_hash: string }>(
        `SELECT id, password_hash FROM users WHERE email = $1 LIMIT 1`,
        [email],
      );

      if (result.rows.length === 0) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const valid = await bcrypt.compare(password, result.rows[0].password_hash);
      if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

      const token = signToken(result.rows[0].id, email);
      return res.status(200).json({ token });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
