import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuid } from 'uuid';
import pool from '../db';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET ?? 'change-me-in-prod';
const JWT_EXPIRES = process.env.JWT_EXPIRES ?? '7d';

// POST /auth/register
router.post('/register', async (req: Request, res: Response) => {
  const { email, password, deviceId } = req.body as {
    email: string;
    password: string;
    deviceId: string;
  };

  if (!email || !password || !deviceId) {
    return res.status(400).json({ error: 'email, password and deviceId are required' });
  }

  const hash = await bcrypt.hash(password, 12);
  const id = uuid();

  try {
    await pool.query(
      'INSERT INTO users(id, email, password_hash) VALUES($1,$2,$3)',
      [id, email.toLowerCase().trim(), hash],
    );
  } catch (err: any) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Email already registered' });
    }
    throw err;
  }

  const token = jwt.sign({ sub: id, deviceId }, JWT_SECRET, {
    expiresIn: JWT_EXPIRES,
  });
  return res.status(201).json({ token, userId: id });
});

// POST /auth/login
router.post('/login', async (req: Request, res: Response) => {
  const { email, password, deviceId } = req.body as {
    email: string;
    password: string;
    deviceId: string;
  };

  if (!email || !password || !deviceId) {
    return res.status(400).json({ error: 'email, password and deviceId are required' });
  }

  const result = await pool.query(
    'SELECT id, password_hash FROM users WHERE email = $1',
    [email.toLowerCase().trim()],
  );

  if (result.rowCount === 0) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const user = result.rows[0];
  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = jwt.sign({ sub: user.id, deviceId }, JWT_SECRET, {
    expiresIn: JWT_EXPIRES,
  });
  return res.json({ token, userId: user.id });
});

export default router;
