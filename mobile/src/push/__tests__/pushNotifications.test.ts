/**
 * TC-P-01 … TC-P-07 — Push notification unit tests
 * Validates DEF-PUSH-01 is resolved: all functions exist and are callable.
 */
import {
  registerForPushNotifications,
  subscribeToTokenRefresh,
  subscribeToForegroundMessages,
  registerBackgroundMessageHandler,
  getInitialNotification,
  subscribeToNotificationOpened,
  createAndroidNotificationChannel,
  setDeepLinkHandler,
  initialisePush,
} from '../pushNotifications';

// ── Mock @react-native-firebase/messaging ─────────────────────────────────────
const mockToken = 'mock-fcm-token-abc123';
const mockGetToken = jest.fn().mockResolvedValue(mockToken);
const mockRequestPermission = jest
  .fn()
  .mockResolvedValue(1); // AUTHORIZED
const mockOnTokenRefresh = jest.fn().mockReturnValue(() => {});
const mockOnMessage = jest.fn().mockReturnValue(() => {});
const mockSetBackgroundMessageHandler = jest.fn();
const mockGetInitialNotification = jest.fn().mockResolvedValue(null);
const mockOnNotificationOpenedApp = jest.fn().mockReturnValue(() => {});

const messagingMock = {
  requestPermission: mockRequestPermission,
  getToken: mockGetToken,
  onTokenRefresh: mockOnTokenRefresh,
  onMessage: mockOnMessage,
  setBackgroundMessageHandler: mockSetBackgroundMessageHandler,
  getInitialNotification: mockGetInitialNotification,
  onNotificationOpenedApp: mockOnNotificationOpenedApp,
  AuthorizationStatus: { AUTHORIZED: 1, PROVISIONAL: 2 },
};

jest.mock('@react-native-firebase/messaging', () => {
  const fn = () => messagingMock;
  fn.AuthorizationStatus = { AUTHORIZED: 1, PROVISIONAL: 2 };
  return fn;
});

jest.mock('react-native', () => ({
  Platform: { OS: 'android' },
  Alert: { alert: jest.fn() },
}));

jest.mock('@notifee/react-native', () => ({
  default: {
    createChannel: jest.fn().mockResolvedValue(undefined),
  },
}));

describe('Push Notifications — DEF-PUSH-01 resolution', () => {
  it('TC-P-01: registerForPushNotifications returns token and platform', async () => {
    const result = await registerForPushNotifications();
    expect(result).not.toBeNull();
    expect(result!.token).toBe(mockToken);
    expect(result!.platform).toBe('fcm'); // Android → fcm
  });

  it('TC-P-02: registerForPushNotifications returns null when permission denied', async () => {
    mockRequestPermission.mockResolvedValueOnce(0); // DENIED
    const result = await registerForPushNotifications();
    expect(result).toBeNull();
  });

  it('TC-P-03: subscribeToTokenRefresh returns unsubscribe function', () => {
    const unsub = subscribeToTokenRefresh(jest.fn());
    expect(typeof unsub).toBe('function');
    expect(mockOnTokenRefresh).toHaveBeenCalledTimes(1);
  });

  it('TC-P-04: subscribeToForegroundMessages returns unsubscribe function', () => {
    const unsub = subscribeToForegroundMessages(jest.fn());
    expect(typeof unsub).toBe('function');
    expect(mockOnMessage).toHaveBeenCalledTimes(1);
  });

  it('TC-P-05: registerBackgroundMessageHandler calls setBackgroundMessageHandler', () => {
    registerBackgroundMessageHandler();
    expect(mockSetBackgroundMessageHandler).toHaveBeenCalledTimes(1);
    expect(typeof mockSetBackgroundMessageHandler.mock.calls[0][0]).toBe('function');
  });

  it('TC-P-06: getInitialNotification returns null when no initial notification', async () => {
    const result = await getInitialNotification();
    expect(result).toBeNull();
  });

  it('TC-P-07: setDeepLinkHandler and deep-link routing via background handler', async () => {
    const deepLinkHandler = jest.fn();
    setDeepLinkHandler(deepLinkHandler);

    // Invoke the background handler with a message containing screen data
    registerBackgroundMessageHandler();
    const handler = mockSetBackgroundMessageHandler.mock.calls[
      mockSetBackgroundMessageHandler.mock.calls.length - 1
    ][0];

    await handler({
      messageId: 'msg-1',
      data: { screen: 'ItemDetail', itemId: 'abc' },
    });

    expect(deepLinkHandler).toHaveBeenCalledWith('ItemDetail', { itemId: 'abc' });
  });

  it('TC-P-08: createAndroidNotificationChannel calls notifee', async () => {
    const notifee = await import('@notifee/react-native').then((m) => m.default);
    await createAndroidNotificationChannel();
    expect(notifee.createChannel).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'sync_updates' }),
    );
  });

  it('TC-P-09: initialisePush full flow wires everything', async () => {
    const onNewToken = jest.fn();
    const onForegroundMessage = jest.fn();
    const onNotificationOpened = jest.fn();

    const { registration, unsubscribe } = await initialisePush({
      onNewToken,
      onForegroundMessage,
      onNotificationOpened,
    });

    expect(registration?.token).toBe(mockToken);
    expect(typeof unsubscribe).toBe('function');
    unsubscribe(); // should not throw
  });
});
