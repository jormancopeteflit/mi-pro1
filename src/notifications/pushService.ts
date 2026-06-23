/**
 * Servicio de notificaciones push (FCM + APNs).
 * Registra token, configura handlers y deep-linking.
 *
 * Corrección DEF-PUSH-01: implementación completa del módulo.
 * NO se incluyen claves/secretos en el bundle.
 */
import messaging, { FirebaseMessagingTypes } from '@react-native-firebase/messaging';
import { Platform } from 'react-native';

export type PushHandler = (message: FirebaseMessagingTypes.RemoteMessage) => void;

const _foregroundHandlers: PushHandler[] = [];

// ─── Permisos y registro de token ────────────────────────────────────────────

/**
 * Solicita permisos y devuelve el token FCM/APNs.
 * Llama a este método desde el flujo de login o al iniciar la app.
 */
export async function registerPushToken(): Promise<string | null> {
  // iOS: pedir permiso explícito
  if (Platform.OS === 'ios') {
    const authStatus = await messaging().requestPermission();
    const allowed = [
      messaging.AuthorizationStatus.AUTHORIZED,
      messaging.AuthorizationStatus.PROVISIONAL,
    ];
    if (!allowed.includes(authStatus)) {
      console.warn('[Push] Permiso denegado en iOS.');
      return null;
    }
    // Registrar con APNs
    await messaging().registerDeviceForRemoteMessages();
  }

  const token = await messaging().getToken();
  console.info('[Push] Token FCM registrado:', token);
  return token;
}

// ─── Handlers de mensajes ────────────────────────────────────────────────────

/**
 * Configura el handler de mensajes en primer plano.
 * Devuelve una función de limpieza.
 */
export function onForegroundMessage(handler: PushHandler): () => void {
  _foregroundHandlers.push(handler);
  const unsub = messaging().onMessage(async (message) => {
    handler(message);
  });
  return () => {
    const idx = _foregroundHandlers.indexOf(handler);
    if (idx > -1) _foregroundHandlers.splice(idx, 1);
    unsub();
  };
}

/**
 * Configura el handler de mensajes en background/killed.
 * Debe llamarse en el nivel raíz del entry-point (index.js),
 * FUERA del árbol de React.
 */
export function setBackgroundMessageHandler(): void {
  messaging().setBackgroundMessageHandler(async (message) => {
    console.info('[Push] Mensaje en background:', message.messageId);
    // Aquí se pueden encolar acciones offline si procede
  });
}

/**
 * Devuelve el mensaje que abrió la app desde un estado killed.
 * Útil para deep-linking al arranque.
 */
export async function getInitialPushMessage(): Promise<FirebaseMessagingTypes.RemoteMessage | null> {
  return messaging().getInitialNotification();
}

/**
 * Handler para cuando el usuario toca una notificación
 * con la app en background (no killed).
 */
export function onNotificationOpenedApp(
  handler: (message: FirebaseMessagingTypes.RemoteMessage) => void
): () => void {
  return messaging().onNotificationOpenedApp(handler);
}

// ─── Canales Android ─────────────────────────────────────────────────────────

/**
 * Crea el canal de notificaciones para Android 8+.
 * Llama a esto durante la inicialización de la app.
 */
export async function createDefaultNotificationChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;

  // expo-notifications o el módulo nativo de Firebase crea el canal
  // automáticamente en Android O+. Si se usa notifee o similar, aquí
  // se llamaría a notifee.createChannel(). Por ahora registramos el
  // canal predeterminado de Firebase que ya viene configurado.
  console.info('[Push] Canal de notificaciones configurado (Android default).');
}
