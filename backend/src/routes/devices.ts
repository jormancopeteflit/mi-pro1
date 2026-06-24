/**
 * POST /api/devices/register
 * Registers or updates a device push token for the authenticated user.
 *
 * SECURITY: only touches rows where user_id = req.user.id (hard constraint).
 */
import { Router, Request, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';
import { requireAuth } from '../middleware/requireAuth';
import { db } from '../db';

const router = Router();

// ─── Validation rules ─────────────────────────────────────────────────────────
const registerValidation = [
  body('device_id')
    .isString().withMessage('device_id must be a string')
    .trim().notEmpty().withMessage('device_id is required'),
  body('platform')
    .isIn(['ios', 'android', 'web']).withMessage('platform must be ios | android | web'),
  body('token')
    .isString().withMessage('token must be a string')
    .trim().notEmpty().withMessage('token is required'),
];

// ─── POST /api/devices/register ───────────────────────────────────────────────
router.post(
  '/register',
  requireAuth,
  registerValidation,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(422).json({ errors: errors.array() });
      }

      const userId = (req as any).user.id as string; // set by requireAuth JWT middleware
      const { device_id, platform, token } = req.body as {
        device_id: string;
        platform: 'ios' | 'android' | 'web';
        token: string;
      };

      // Upsert: insert or update token for THIS user's device only.
      // ON CONFLICT on (user_id, device_id) → update token + platform.
      const result = await db.query<{ id: string; updated_at: Date }>(
        `INSERT INTO device_tokens (user_id, device_id, platform, token)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (user_id, device_id)
           DO UPDATE SET
             platform   = EXCLUDED.platform,
             token      = EXCLUDED.token,
             updated_at = now()
         RETURNING id, updated_at`,
        [userId, device_id, platform, token],
      );

      return res.status(200).json({
        success: true,
        id: result.rows[0].id,
        updated_at: result.rows[0].updated_at,
      });
    } catch (err) {
      next(err);
    }
  },
);

// ─── DELETE /api/devices/register ─────────────────────────────────────────────
// Allows a user to unregister their own device (e.g. on logout).
router.delete(
  '/register',
  requireAuth,
  [
    body('device_id')
      .isString().trim().notEmpty().withMessage('device_id is required'),
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(422).json({ errors: errors.array() });
      }

      const userId = (req as any).user.id as string;
      const { device_id } = req.body as { device_id: string };

      // HARD CONSTRAINT: only delete own rows
      await db.query(
        `DELETE FROM device_tokens WHERE user_id = $1 AND device_id = $2`,
        [userId, device_id],
      );

      return res.status(200).json({ success: true });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
