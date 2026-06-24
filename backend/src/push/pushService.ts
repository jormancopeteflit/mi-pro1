/**
 * PushService — sends FCM / APNs notifications to a user's OTHER devices.
 * Uses Firebase Admin SDK (works for both FCM and APNs via Firebase).
 *
 * Fixes DEF-PUSH-01: full token registration + send implementation.
 */
import * as admin from 'firebase-admin';
import pool from '../db';

let firebaseApp: admin.app.App | null = null;

function getFirebaseApp(): admin.app.App {
  if (firebaseApp) return firebaseApp;

  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!serviceAccountJson) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON env var is required');
  }
  const serviceAccount = JSON.parse(serviceAccountJson) as admin.ServiceAccount;
  firebaseApp = admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
  return firebaseApp;
}

export class PushService {
  // ── token registration ─────────────────────────────────────────────────────
  async registerToken(
    userId: string,
    deviceId: string,
    token: string,
    platform: 'fcm' | 'apns',
  ): Promise<void> {
    await pool.query(
      `INSERT INTO push_tokens(id, user_id, device_id, token, platform, active, created_at, updated_at)
         VALUES(gen_random_uuid(), $1, $2, $3, $4, TRUE, NOW(), NOW())
         ON CONFLICT (user_id, device_id)
         DO UPDATE SET token=$3, platform=$4, active=TRUE, updated_at=NOW()`,
      [userId, deviceId, token, platform],
    );
  }

  // ── token deactivation ─────────────────────────────────────────────────────
  async deregisterToken(userId: string, deviceId: string): Promise<void> {
    await pool.query(
      `UPDATE push_tokens SET active=FALSE, updated_at=NOW()
        WHERE user_id=$1 AND device_id=$2`,
      [userId, deviceId],
    );
  }

  // ── send to all OTHER active devices of the user ──────────────────────────
  async notifyOtherDevices(
    userId: string,
    excludeDeviceId: string,
    data: Record<string, unknown>,
  ): Promise<void> {
    const r = await pool.query(
      `SELECT token, platform FROM push_tokens
        WHERE user_id=$1 AND device_id <> $2 AND active=TRUE`,
      [userId, excludeDeviceId],
    );

    if (r.rowCount === 0) return;

    const app = getFirebaseApp();
    const messaging = app.messaging();

    const stringData: Record<string, string> = {};
    for (const [k, v] of Object.entries(data)) {
      stringData[k] = String(v);
    }

    const sends = r.rows.map(async (row: { token: string; platform: string }) => {
      const message: admin.messaging.Message = {
        token: row.token,
        data: stringData,
        notification: {
          title: 'Sync available',
          body: 'Your data has been updated.',
        },
        ...(row.platform === 'apns'
          ? {
              apns: {
                payload: {
                  aps: {
                    contentAvailable: true,
                    sound: 'default',
                  },
                },
              },
            }
          : {
              android: {
                priority: 'high' as const,
              },
            }),
      };

      try {
        await messaging.send(message);
      } catch (err: any) {
        // Token is stale — deactivate it
        if (
          err?.errorInfo?.code === 'messaging/registration-token-not-registered' ||
          err?.errorInfo?.code === 'messaging/invalid-registration-token'
        ) {
          await pool.query(
            `UPDATE push_tokens SET active=FALSE, updated_at=NOW()
              WHERE token=$1`,
            [row.token],
          );
        }
        // Swallow other push errors — they must not break sync
      }
    });

    await Promise.allSettled(sends);
  }
}
