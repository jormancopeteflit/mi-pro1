/**
 * pushNotifications.ts
 *
 * Full FCM + APNs integration for React Native via @react-native-firebase/messaging.
 * Fixes DEF-PUSH-01: implements token registration, message handlers,
 * background handler, deep-linking and channel setup.
 */
import messaging, {
  FirebaseMessagingTypes,
} from '@react-native-firebase/messaging';
import { Platform, Alert } from 'react-native';

export type PushPlatform = 'fcm' | 'apns';

export interface PushRegistrationResult {
  token: string;
  platform: PushPlatform;
}

export type DeepLinkHandler = (screen: string, params: Record<string, string>) => void;

let _deepLinkHandler: DeepLinkHandler | null = null;

export function setDeepLinkHandler(handler: DeepLinkHandler): void {
  _deepLinkHandler = handler;
}

// ── Permission + token registration ──────────────────────────────────────────
export async function registerForPushNotifications(): Promise<PushRegistrationResult | null> {
  const authStatus = await messaging().requestPermission();
  const enabled =
    authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
    authStatus === messaging.AuthorizationStatus.PROVISIONAL;

  if (!enabled) {
    console.warn('[Push] Permission not granted');
    return null;
  }

  const token = await messaging().getToken();
  const platform: PushPlatform = Platform.OS === 'ios' ? 'apns' : 'fcm';

  return { token, platform };
}

// ── Token refresh ─────────────────────────────────────────────────────────────
export function subscribeToTokenRefresh(
  onNewToken: (result: PushRegistrationResult) => void,
): () => void {
  return messaging().onTokenRefresh((token) => {
    const platform: PushPlatform = Platform.OS === 'ios' ? 'apns' : 'fcm';
    onNewToken({ token, platform });
  });
}

// ── Foreground message handler ────────────────────────────────────────────────
export function subscribeToForegroundMessages(
  onMessage: (remoteMessage: FirebaseMessagingTypes.RemoteMessage) => void,
): () => void {
  return messaging().onMessage(onMessage);
}

// ── Background & quit-state message handler ──────────────────────────────────
// Must be registered before the app is mounted (call from index.js / App.tsx root).
export function registerBackgroundMessageHandler(): void {
  messaging().setBackgroundMessageHandler(
    async (remoteMessage: FirebaseMessagingTypes.RemoteMessage) => {
      console.log('[Push] Background message received', remoteMessage.messageId);
      _handlePushPayload(remoteMessage);
    },
  );
}

// ── Initial notification (app opened from quit state via tap) ─────────────────
export async function getInitialNotification(): Promise<FirebaseMessagingTypes.RemoteMessage | null> {
  return messaging().getInitialNotification();
}

// ── Notification opened handler (background → foreground tap) ────────────────
export function subscribeToNotificationOpened(
  handler: (remoteMessage: FirebaseMessagingTypes.RemoteMessage) => void,
): () => void {
  return messaging().onNotificationOpenedApp(handler);
}

// ── Deep-link extraction from push payload ────────────────────────────────────
function _handlePushPayload(
  remoteMessage: FirebaseMessagingTypes.RemoteMessage,
): void {
  const data = remoteMessage.data ?? {};
  if (data['screen'] && _deepLinkHandler) {
    const screen = data['screen'] as string;
    const params: Record<string, string> = {};
    for (const [k, v] of Object.entries(data)) {
      if (k !== 'screen') params[k] = String(v);
    }
    _deepLinkHandler(screen, params);
  }
}

// ── Android notification channel setup ───────────────────────────────────────
// Call once at app startup on Android.
export async function createAndroidNotificationChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  // Dynamically import to avoid issues on iOS
  const notifee = await import('@notifee/react-native').then((m) => m.default);
  await notifee.createChannel({
    id: 'sync_updates',
    name: 'Sync Updates',
    description: 'Notifications when your data is synced across devices',
    importance: 3, // IMPORTANCE_DEFAULT
  });
}

// ── Convenience: full initialisation sequence ─────────────────────────────────
export async function initialisePush(options: {
  onNewToken: (result: PushRegistrationResult) => void;
  onForegroundMessage: (msg: FirebaseMessagingTypes.RemoteMessage) => void;
  onNotificationOpened?: (msg: FirebaseMessagingTypes.RemoteMessage) => void;
  deepLinkHandler?: DeepLinkHandler;
}): Promise<{
  registration: PushRegistrationResult | null;
  unsubscribe: () => void;
}> {
  if (options.deepLinkHandler) {
    setDeepLinkHandler(options.deepLinkHandler);
  }

  await createAndroidNotificationChannel();
  registerBackgroundMessageHandler();

  const registration = await registerForPushNotifications();

  const unsubTokenRefresh = subscribeToTokenRefresh(options.onNewToken);
  const unsubForeground = subscribeToForegroundMessages(
    options.onForegroundMessage,
  );
  const unsubOpened = options.onNotificationOpened
    ? subscribeToNotificationOpened(options.onNotificationOpened)
    : () => {};

  // Handle initial notification (app opened from quit state)
  const initialNotif = await getInitialNotification();
  if (initialNotif && options.onNotificationOpened) {
    options.onNotificationOpened(initialNotif);
  }

  return {
    registration,
    unsubscribe: () => {
      unsubTokenRefresh();
      unsubForeground();
      unsubOpened();
    },
  };
}
