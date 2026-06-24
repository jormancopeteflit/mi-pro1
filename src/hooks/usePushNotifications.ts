/**
 * usePushNotifications hook
 * - Bootstraps Android channels once.
 * - Requests permission.
 * - Registers FCM/APNs token scoped to the authenticated user.
 * - Subscribes to foreground messages, notification-open events, token refresh.
 * - Checks initial notification (quit-state deep link).
 * - Unregisters all listeners on unmount / logout.
 */

import { useEffect, useRef } from 'react';
import {
  bootstrapAndroidChannels,
  requestPushPermission,
  registerPushToken,
  unregisterPushToken,
  subscribeForegroundMessages,
  subscribeNotificationOpenedApp,
  subscribeTokenRefresh,
  checkInitialNotification,
} from '../services/pushNotificationService';

export function usePushNotifications(userId: string | null): void {
  const unsubRefs = useRef<Array<() => void>>([]);

  useEffect(() => {
    if (!userId) return;

    let cancelled = false;

    async function init() {
      await bootstrapAndroidChannels();
      const granted = await requestPushPermission();
      if (!granted || cancelled) return;

      await registerPushToken(userId!);
      await checkInitialNotification();

      if (cancelled) return;

      unsubRefs.current.push(
        subscribeForegroundMessages(),
        subscribeNotificationOpenedApp(),
        subscribeTokenRefresh(userId!),
      );
    }

    void init();

    return () => {
      cancelled = true;
      unsubRefs.current.forEach((fn) => fn());
      unsubRefs.current = [];
    };
  }, [userId]);

  // Unregister token on logout (userId becomes null)
  const prevUserId = useRef<string | null>(null);
  useEffect(() => {
    if (prevUserId.current && !userId) {
      void unregisterPushToken(prevUserId.current);
    }
    prevUserId.current = userId;
  }, [userId]);
}
