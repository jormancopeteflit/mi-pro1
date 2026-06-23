/**
 * Hook React para integrar push notifications en componentes.
 */
import { useEffect, useState } from 'react';
import { FirebaseMessagingTypes } from '@react-native-firebase/messaging';
import {
  registerPushToken,
  onForegroundMessage,
  onNotificationOpenedApp,
  getInitialPushMessage,
} from './pushService';

export interface UsePushNotificationsReturn {
  token: string | null;
  lastMessage: FirebaseMessagingTypes.RemoteMessage | null;
}

export function usePushNotifications(
  onMessage?: (msg: FirebaseMessagingTypes.RemoteMessage) => void
): UsePushNotificationsReturn {
  const [token, setToken] = useState<string | null>(null);
  const [lastMessage, setLastMessage] =
    useState<FirebaseMessagingTypes.RemoteMessage | null>(null);

  useEffect(() => {
    let mounted = true;

    // Registro del token
    registerPushToken().then((t) => {
      if (mounted) setToken(t);
    });

    // Mensaje que abrió la app desde killed
    getInitialPushMessage().then((msg) => {
      if (msg && mounted) {
        setLastMessage(msg);
        onMessage?.(msg);
      }
    });

    // Mensajes en foreground
    const unsubFg = onForegroundMessage((msg) => {
      if (!mounted) return;
      setLastMessage(msg);
      onMessage?.(msg);
    });

    // App abierta desde notificación en background
    const unsubBg = onNotificationOpenedApp((msg) => {
      if (!mounted) return;
      setLastMessage(msg);
      onMessage?.(msg);
    });

    return () => {
      mounted = false;
      unsubFg();
      unsubBg();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return { token, lastMessage };
}
