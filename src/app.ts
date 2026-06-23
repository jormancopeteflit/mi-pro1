/**
 * Punto de entrada de la aplicación Express.
 */

import express from 'express';
import { registerHandler } from './auth/register';

export function createApp() {
  const app = express();

  app.use(express.json());

  // ── Auth routes ──────────────────────────────────────────────────────────
  app.post('/auth/register', registerHandler);

  // ── Health check ─────────────────────────────────────────────────────────
  app.get('/health', (_req, res) => res.json({ status: 'ok' }));

  return app;
}
