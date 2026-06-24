/**
 * Push token registration/deregistration endpoints.
 *
 * POST /push/token    — register or refresh a device token
 * DELETE /push/token  — deregister a device token
 */
import { Router, Response } from 'express';
import { authenticate, AuthenticatedRequest } from '../auth/authMiddleware';
import { PushService } from './pushService';

const router = Router();
router.use(authenticate as any);

const svc = new PushService();

// POST /push/token
router.post('/token', async (req, res: Response) => {
  const { userId, deviceId } = req as AuthenticatedRequest;
  const { token, platform } = req.body as { token: string; platform: 'fcm' | 'apns' };

  if (!token || !platform) {
    return res.status(400).json({ error: 'token and platform are required' });
  }
  if (!['fcm', 'apns'].includes(platform)) {
    return res.status(400).json({ error: 'platform must be fcm or apns' });
  }

  await svc.registerToken(userId, deviceId, token, platform);
  return res.status(204).send();
});

// DELETE /push/token
router.delete('/token', async (req, res: Response) => {
  const { userId, deviceId } = req as AuthenticatedRequest;
  await svc.deregisterToken(userId, deviceId);
  return res.status(204).send();
});

export default router;
