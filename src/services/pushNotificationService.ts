/**
 * Push Notification Service
 * Handles FCM (Android) and APNs (iOS) token registration,
 * message handlers (foreground / background / quit), deep-linking
 * and Android notification channels.
 *
 * RESTRICTIONS: tokens are stored scoped to the authenticated user only;
 * no token or notification data crosses user boundaries.
 */

import messaging, {
  FirebaseMessagingTypes,
} from '@react-native-firebase/messaging';
import notifee, {
  AndroidImportance,
  AndroidChannel,
  EventType,
} from '@notifee/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { apiClient } from './apiClient';
import { navigationRef } from '../navigation/navigationRef';

// ─── Constants ──────────────────────────────────────────────────────────────

export const STORAGE_KEY_FCM_TOKEN = (userId: string) =>
  `@fcm_token_${userId}`;

export const ANDROID_CHANNELS: AndroidChannel[] = [
  {
    id: 'default',
    name: 'General',
    importance: AndroidImportance.DEFAULT,
  },
  {
    id: 'high_priority',
    name: 'High Priority',
    importance: AndroidImportance.HIGH,
    vibration: true,
    lights: true,
    lightColor: '#FF0000',
  },
  {
    id: 'sync',
    name: 'Sync',
    importance: AndroidImportance.LOW,
  },
];

// ─── Types ───────────────────────────────────────────────────────────────────

export interface PushPayload {
  type: string;
  screen?: string;
  params?: Record<string, string>;
  entityId?: string;
}

// ─── Android channel bootstrap ───────────────────────────────────────────────

export async function bootstrapAndroidChannels(): Promise<void> {
  if (Platform.OS !== 'android') return;
  for (const channel of ANDROID_CHANNELS) {
    await notifee.createChannel(channel);
  }
}

// ─── Permission request ───────────────────────────────────────────────────────

export async function requestPushPermission(): Promise<boolean> {
  const authStatus = await messaging().requestPermission();
  const enabled =
    authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
    authStatus === messaging.AuthorizationStatus.PROVISIONAL;
  return enabled;
}

// ─── Token registration ───────────────────────────────────────────────────────

/**
 * Registers the FCM/APNs token for the given user.
 * On iOS, waits for APNs token before requesting FCM token.
 * Persists token locally and posts it to the backend scoped to userId.
 */
export async function registerPushToken(userId: string): Promise<string | null> {
  try {
    if (Platform.OS === 'ios') {
      await messaging().registerDeviceForRemoteMessages();
    }

    const token = await messaging().getToken();
    if (!token) return null;

    const storageKey = STORAGE_KEY_FCM_TOKEN(userId);
    const cached = await AsyncStorage.getItem(storageKey);

    // Only send to backend when token changed
    if (cached !== token) {
      await apiClient.post(
        '/users/me/push-tokens',
        { token, platform: Platform.OS },
        { headers: { 'X-User-Id': userId } },
      );
      await AsyncStorage.setItem(storageKey, token);
    }

    return token;
  } catch (err) {
    console.error('[PushNotificationService] registerPushToken error:', err);
    return null;
  }
}

/**
 * Removes the FCM token for the given user from the backend and local storage.
 * Must be called on logout to prevent delivering notifications to stale sessions.
 */
export async function unregisterPushToken(userId: string): Promise<void> {
  try {
    const storageKey = STORAGE_KEY_FCM_TOKEN(userId);
    const token = await AsyncStorage.getItem(storageKey);
    if (token) {
      await apiClient.delete('/users/me/push-tokens', {
        data: { token },
        headers: { 'X-User-Id': userId },
      });
      await AsyncStorage.removeItem(storageKey);
    }
    await messaging().deleteToken();
  } catch (err) {
    console.error('[PushNotificationService] unregisterPushToken error:', err);
  }
}

// ─── Navigation helper ────────────────────────────────────────────────────────

export function handleNotificationNavigation(data?: Record<string, string>): void {
  if (!data || !navigationRef.isReady()) return;
  const { screen, params } = data as PushPayload & Record<string, string>;
  if (screen) {
    navigationRef.navigate(screen as never, (params ?? {}) as never);
  }
}

// ─── Message display (foreground) ─────────────────────────────────────────────

async function displayLocalNotification(
  remoteMessage: FirebaseMessagingTypes.RemoteMessage,
): Promise<void> {
  const channelId =
    (remoteMessage.data?.channelId as string | undefined) ?? 'default';
  await notifee.displayNotification({
    title: remoteMessage.notification?.title ?? 'Notification',
    body: remoteMessage.notification?.body ?? '',
    data: remoteMessage.data,
    android: { channelId, pressAction: { id: 'default' } },
    ios: { foregroundPresentationOptions: { alert: true, badge: true, sound: true } },
  });
}

// ─── Foreground handler ───────────────────────────────────────────────────────

/**
 * Must be called once inside the root component (e.g. App.tsx useEffect).
 * Returns an unsubscribe function.
 */
export function subscribeForegroundMessages(
  onReceive?: (message: FirebaseMessagingTypes.RemoteMessage) => void,
): () => void {
  const unsubscribe = messaging().onMessage(async (remoteMessage) => {
    await displayLocalNotification(remoteMessage);
    onReceive?.(remoteMessage);
  });
  return unsubscribe;
}

// ─── Background / quit message handler ───────────────────────────────────────

/**
 * Must be called at the module level (outside of any component),
 * typically in index.js / index.ts, BEFORE AppRegistry.registerComponent.
 */
export function registerBackgroundMessageHandler(): void {
  messaging().setBackgroundMessageHandler(async (remoteMessage) => {
    // Background: display via notifee so the notification appears
    await displayLocalNotification(remoteMessage);
  });
}

// ─── Notification-open handlers ───────────────────────────────────────────────

/**
 * Handles notification tap when app is in background (not quit).
 * Returns unsubscribe function.
 */
export function subscribeNotificationOpenedApp(): () => void {
  const unsubFirebase = messaging().onNotificationOpenedApp((remoteMessage) => {
    handleNotificationNavigation(
      remoteMessage.data as Record<string, string> | undefined,
    );
  });

  // notifee foreground events (tap on local notification while in foreground)
  const unsubNotifee = notifee.onForegroundEvent(({ type, detail }) => {
    if (type === EventType.PRESS) {
      handleNotificationNavigation(
        detail.notification?.data as Record<string, string> | undefined,
      );
    }
  });

  return () => {
    unsubFirebase();
    unsubNotifee();
  };
}

/**
 * Handles notification that opened the app from QUIT state.
 * Must be called once early in the app lifecycle (e.g. in App.tsx, before nav is ready).
 */
export async function checkInitialNotification(): Promise<void> {
  // Firebase quit-state
  const remoteMessage = await messaging().getInitialNotification();
  if (remoteMessage?.data) {
    handleNotificationNavigation(
      remoteMessage.data as Record<string, string>,
    );
  }

  // notifee quit-state
  const initialNotifee = await notifee.getInitialNotification();
  if (initialNotifee?.notification?.data) {
    handleNotificationNavigation(
      initialNotifee.notification.data as Record<string, string>,
    );
  }
}

// ─── Token-refresh listener ───────────────────────────────────────────────────

/**
 * Listens for FCM token refresh and re-registers with the backend.
 * Returns unsubscribe function.
 */
export function subscribeTokenRefresh(userId: string): () => void {
  return messaging().onTokenRefresh(async (newToken) => {
    try {
      await apiClient.post(
        '/users/me/push-tokens',
        { token: newToken, platform: Platform.OS },
        { headers: { 'X-User-Id': userId } },
      );
      await AsyncStorage.setItem(STORAGE_KEY_FCM_TOKEN(userId), newToken);
    } catch (err) {
      console.error('[PushNotificationService] onTokenRefresh error:', err);
    }
  });
}
