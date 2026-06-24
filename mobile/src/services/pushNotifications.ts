/**
 * pushNotifications.ts
 * Full FCM/APNs push notification integration for React Native.
 *
 * Covers:
 *  - Permission request (iOS + Android 13+)
 *  - FCM token retrieval and registration with backend
 *  - Token refresh handler
 *  - Foreground message handler
 *  - Background / quit-state message handler
 *  - deep-link navigation on notification tap
 *  - Android notification channel creation
 */

import { Platform, Linking } from 'react-native';
import messaging, {
  FirebaseMessagingTypes,
} from '@react-native-firebase/messaging';
import notifee, { AndroidImportance, EventType } from '@notifee/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getAuthToken } from './authStore';

const API_BASE_URL = process.env.API_BASE_URL ?? 'https://api.example.com';
const DEVICE_ID_KEY = 'device_id';

// ─── Android notification channel ────────────────────────────────────────────

export async function createAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await notifee.createChannel({
    id: 'default',
    name: 'Default Notifications',
    importance: AndroidImportance.HIGH,
    sound: 'default',
    vibration: true,
  });
}

// ─── Permission request ───────────────────────────────────────────────────────

export async function requestPushPermission(): Promise<boolean> {
  if (Platform.OS === 'ios') {
    const authStatus = await messaging().requestPermission();
    const granted =
      authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
      authStatus === messaging.AuthorizationStatus.PROVISIONAL;
    return granted;
  }
  // Android 13+ requires POST_NOTIFICATIONS permission (handled by Firebase SDK)
  await messaging().registerDeviceForRemoteMessages();
  return true;
}

// ─── Stable device ID ─────────────────────────────────────────────────────────

async function getOrCreateDeviceId(): Promise<string> {
  let deviceId = await AsyncStorage.getItem(DEVICE_ID_KEY);
  if (!deviceId) {
    deviceId = `${Platform.OS}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    await AsyncStorage.setItem(DEVICE_ID_KEY, deviceId);
  }
  return deviceId;
}

// ─── Token registration ───────────────────────────────────────────────────────

async function registerTokenWithBackend(fcmToken: string): Promise<void> {
  try {
    const authToken = await getAuthToken();
    const deviceId = await getOrCreateDeviceId();
    const platform = Platform.OS as 'ios' | 'android';

    const response = await fetch(`${API_BASE_URL}/api/devices/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ device_id: deviceId, platform, token: fcmToken }),
    });

    if (!response.ok) {
      const body = await response.text();
      console.error('[push] Failed to register token with backend:', response.status, body);
    } else {
      console.info('[push] Device token registered successfully.');
    }
  } catch (err) {
    console.error('[push] Error registering token with backend:', err);
  }
}

async function unregisterTokenFromBackend(): Promise<void> {
  try {
    const authToken = await getAuthToken();
    const deviceId = await AsyncStorage.getItem(DEVICE_ID_KEY);
    if (!deviceId) return;

    await fetch(`${API_BASE_URL}/api/devices/register`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ device_id: deviceId }),
    });
  } catch (err) {
    console.error('[push] Error unregistering token:', err);
  }
}

// ─── Deep-link handler ────────────────────────────────────────────────────────

function handleDeepLink(remoteMessage: FirebaseMessagingTypes.RemoteMessage): void {
  const deepLink = remoteMessage.data?.deep_link as string | undefined;
  if (deepLink) {
    Linking.openURL(deepLink).catch((err) =>
      console.warn('[push] Failed to open deep link:', deepLink, err),
    );
  }
}

// ─── Display foreground notification via Notifee ─────────────────────────────

async function displayForegroundNotification(
  remoteMessage: FirebaseMessagingTypes.RemoteMessage,
): Promise<void> {
  const { notification, data } = remoteMessage;
  await notifee.displayNotification({
    title: notification?.title ?? 'New notification',
    body: notification?.body ?? '',
    data: (data as Record<string, string>) ?? {},
    android: {
      channelId: 'default',
      pressAction: { id: 'default' },
      importance: AndroidImportance.HIGH,
    },
  });
}

// ─── Background / quit-state handler (must be called at app entry point) ──────

/**
 * Register background handler.
 * Call this at the TOP LEVEL of index.js (before AppRegistry.registerComponent).
 */
export function registerBackgroundHandler(): void {
  messaging().setBackgroundMessageHandler(
    async (remoteMessage: FirebaseMessagingTypes.RemoteMessage) => {
      console.info('[push] Background message received:', remoteMessage.messageId);
      // Background messages are shown by the system automatically;
      // handle data-only messages here if needed.
    },
  );
}

// ─── Bootstrap: call once when the user is authenticated ─────────────────────

let _tokenRefreshUnsubscribe: (() => void) | null = null;
let _foregroundUnsubscribe: (() => void) | null = null;
let _notifeeUnsubscribe: (() => void) | null = null;

export async function initialisePushNotifications(): Promise<void> {
  // 1. Create Android channel
  await createAndroidChannel();

  // 2. Request permission
  const granted = await requestPushPermission();
  if (!granted) {
    console.warn('[push] Push notification permission denied.');
    return;
  }

  // 3. Get current FCM token
  const fcmToken = await messaging().getToken();
  console.info('[push] FCM token:', fcmToken);
  await registerTokenWithBackend(fcmToken);

  // 4. Listen for token refresh
  _tokenRefreshUnsubscribe?.();
  _tokenRefreshUnsubscribe = messaging().onTokenRefresh(
    async (newToken: string) => {
      console.info('[push] FCM token refreshed');
      await registerTokenWithBackend(newToken);
    },
  );

  // 5. Foreground message handler
  _foregroundUnsubscribe?.();
  _foregroundUnsubscribe = messaging().onMessage(
    async (remoteMessage: FirebaseMessagingTypes.RemoteMessage) => {
      console.info('[push] Foreground message:', remoteMessage.messageId);
      await displayForegroundNotification(remoteMessage);
    },
  );

  // 6. Notifee foreground event handler (notification press → deep-link)
  _notifeeUnsubscribe?.();
  _notifeeUnsubscribe = notifee.onForegroundEvent(({ type, detail }) => {
    if (type === EventType.PRESS) {
      const deepLink = detail.notification?.data?.deep_link as string | undefined;
      if (deepLink) {
        Linking.openURL(deepLink).catch((err) =>
          console.warn('[push] Failed to open deep link on press:', deepLink, err),
        );
      }
    }
  });

  // 7. Handle notification that opened the app from quit state
  const initialMessage = await messaging().getInitialNotification();
  if (initialMessage) {
    console.info('[push] App opened from quit-state notification:', initialMessage.messageId);
    handleDeepLink(initialMessage);
  }

  // 8. Handle notification that opened the app from background
  messaging().onNotificationOpenedApp(
    (remoteMessage: FirebaseMessagingTypes.RemoteMessage) => {
      console.info('[push] App opened from background notification:', remoteMessage.messageId);
      handleDeepLink(remoteMessage);
    },
  );
}

/**
 * Tear down all listeners and unregister device token.
 * Call on user logout.
 */
export async function tearDownPushNotifications(): Promise<void> {
  _tokenRefreshUnsubscribe?.();
  _foregroundUnsubscribe?.();
  _notifeeUnsubscribe?.();
  _tokenRefreshUnsubscribe = null;
  _foregroundUnsubscribe = null;
  _notifeeUnsubscribe = null;
  await unregisterTokenFromBackend();
}
