/**
 * pushNotificationService.ts
 * Sends push notifications to a user's registered devices using FCM (HTTP v1).
 * APNs is handled transparently by FCM for iOS devices.
 *
 * SECURITY: always scopes queries by user_id to prevent cross-user data leaks.
 */
import * as admin from 'firebase-admin';
import { db } from '../db';

// Initialise Firebase Admin SDK once (idempotent).
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(), // uses GOOGLE_APPLICATION_CREDENTIALS env var
  });
}

export interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
  /** Deep-link target, e.g. "myapp://items/42" */
  deepLink?: string;
}

/**
 * Sends a push notification to ALL devices registered by `userId`.
 * Invalid/expired tokens are automatically cleaned up.
 */
export async function sendPushToUser(
  userId: string,
  payload: PushPayload,
): Promise<void> {
  // Fetch only this user's tokens (never another user's)
  const { rows } = await db.query<{
    id: string;
    token: string;
    platform: 'ios' | 'android' | 'web';
  }>(
    `SELECT id, token, platform FROM device_tokens WHERE user_id = $1`,
    [userId],
  );

  if (rows.length === 0) return;

  const messaging = admin.messaging();
  const staleTokenIds: string[] = [];

  await Promise.allSettled(
    rows.map(async (row) => {
      const message: admin.messaging.Message = {
        token: row.token,
        notification: {
          title: payload.title,
          body: payload.body,
        },
        data: {
          ...(payload.data ?? {}),
          ...(payload.deepLink ? { deep_link: payload.deepLink } : {}),
        },
        android:
          row.platform === 'android'
            ? {
                priority: 'high',
                notification: {
                  channelId: 'default',
                  sound: 'default',
                },
              }
            : undefined,
        apns:
          row.platform === 'ios'
            ? {
                payload: {
                  aps: {
                    sound: 'default',
                    badge: 1,
                  },
                },
              }
            : undefined,
      };

      try {
        await messaging.send(message);
      } catch (err: any) {
        // Mark stale tokens for cleanup
        const staleErrorCodes = [
          'messaging/invalid-registration-token',
          'messaging/registration-token-not-registered',
        ];
        if (staleErrorCodes.includes(err?.errorInfo?.code)) {
          staleTokenIds.push(row.id);
        } else {
          console.error(`[push] Failed to send to device ${row.id}:`, err?.errorInfo ?? err);
        }
      }
    }),
  );

  // Clean up stale tokens (still scoped by user_id for safety)
  if (staleTokenIds.length > 0) {
    await db.query(
      `DELETE FROM device_tokens WHERE id = ANY($1) AND user_id = $2`,
      [staleTokenIds, userId],
    );
  }
}
