/**
 * Sync API contract
 *
 * GET  /sync/pull?cursor=<ISO8601>&limit=<n>  — fetch server changes since cursor
 * POST /sync/push                             — push a batch of client mutations
 * GET  /sync/cursor                           — read current cursor for this device
 */
import { Router, Response } from 'express';
import {
  authenticate,
  AuthenticatedRequest,
} from '../auth/authMiddleware';
import { SyncService } from './syncService';

const router = Router();
router.use(authenticate as any);

const svc = new SyncService();

// ── GET /sync/cursor ──────────────────────────────────────────────────────────
router.get('/cursor', async (req, res: Response) => {
  const { userId, deviceId } = req as AuthenticatedRequest;
  const cursor = await svc.getCursor(userId, deviceId);
  res.json({ cursor });
});

// ── GET /sync/pull ────────────────────────────────────────────────────────────
router.get('/pull', async (req, res: Response) => {
  const { userId, deviceId } = req as AuthenticatedRequest;
  const cursor = (req.query['cursor'] as string) ?? '1970-01-01T00:00:00Z';
  const limit = Math.min(Number(req.query['limit'] ?? 200), 500);

  if (isNaN(limit) || limit < 1) {
    return res.status(400).json({ error: 'Invalid limit' });
  }

  const { items, nextCursor, hasMore } = await svc.pull(
    userId,
    deviceId,
    cursor,
    limit,
  );
  return res.json({ items, nextCursor, hasMore });
});

// ── POST /sync/push ───────────────────────────────────────────────────────────
router.post('/push', async (req, res: Response) => {
  const { userId, deviceId } = req as AuthenticatedRequest;
  const { operations } = req.body as { operations: SyncOperation[] };

  if (!Array.isArray(operations) || operations.length === 0) {
    return res.status(400).json({ error: 'operations must be a non-empty array' });
  }

  const results = await svc.push(userId, deviceId, operations);
  return res.json({ results });
});

export default router;

export interface SyncOperation {
  operationId: string;         // client-generated idempotency key
  type: 'upsert' | 'delete';
  itemId: string;
  payload?: {
    title?: string;
    body?: string;
    updatedAt: string;         // client-side ISO8601 timestamp (used for LWW)
  };
  clientVersion: number;       // last known server version for this item
}
