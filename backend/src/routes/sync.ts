/**
 * sync.ts
 * POST /api/sync  – receives a batch of client operations, applies LWW,
 *                   and returns the server-side current state.
 *
 * Conflict detection: if serverUpdatedAt > X-Client-Updated-At header
 * and no X-Conflict-Resolution: client-wins header is present → HTTP 409
 * with serverUpdatedAt in the response body so the client can decide.
 */
import { Router, Request, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';
import { requireAuth } from '../middleware/requireAuth';
import { db } from '../db';

const router = Router();

router.post(
  '/',
  requireAuth,
  [
    body('resource_type').isString().notEmpty(),
    body('resource_id').isString().notEmpty(),
    body('payload').isObject(),
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });

      const userId = (req as any).user.id as string;
      const clientUpdatedAt = req.headers['x-client-updated-at'] as string | undefined;
      const conflictResolution = req.headers['x-conflict-resolution'] as string | undefined;

      const { resource_type, resource_id, payload } = req.body as {
        resource_type: string;
        resource_id: string;
        payload: Record<string, unknown>;
      };

      // Fetch current server record (ONLY this user's data)
      const existing = await db.query<{ updated_at: Date; data: Record<string, unknown> }>(
        `SELECT updated_at, data FROM sync_records
         WHERE user_id = $1 AND resource_type = $2 AND resource_id = $3
         LIMIT 1`,
        [userId, resource_type, resource_id],
      );

      if (existing.rows.length > 0 && clientUpdatedAt) {
        const serverTs = existing.rows[0].updated_at.getTime();
        const clientTs = new Date(clientUpdatedAt).getTime();

        // Conflict: server is newer and client has NOT explicitly said client-wins
        if (serverTs > clientTs && conflictResolution !== 'client-wins') {
          return res.status(409).json({
            error: 'Conflict',
            serverUpdatedAt: existing.rows[0].updated_at.toISOString(),
            serverData: existing.rows[0].data,
          });
        }
      }

      // Upsert with LWW: only update if client timestamp is newer OR force-write
      const upsertResult = await db.query<{ updated_at: Date }>(
        `INSERT INTO sync_records (user_id, resource_type, resource_id, data, updated_at)
         VALUES ($1, $2, $3, $4, COALESCE($5::timestamptz, now()))
         ON CONFLICT (user_id, resource_type, resource_id)
           DO UPDATE SET
             data       = EXCLUDED.data,
             updated_at = EXCLUDED.updated_at
           WHERE EXCLUDED.updated_at >= sync_records.updated_at
              OR $6 = 'client-wins'
         RETURNING updated_at`,
        [userId, resource_type, resource_id, JSON.stringify(payload), clientUpdatedAt ?? null, conflictResolution ?? null],
      );

      return res.status(200).json({
        success: true,
        updatedAt: upsertResult.rows[0]?.updated_at ?? null,
      });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
