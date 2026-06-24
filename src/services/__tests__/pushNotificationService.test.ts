/**
 * Push Notification Service – unit tests
 * Covers: TC-P-01 token registration iOS, TC-P-02 token registration Android,
 * TC-P-03 foreground message display, TC-P-04 background handler,
 * TC-P-05 notification-open navigation, TC-P-06 quit-state deep link,
 * TC-P-07 token refresh, TC-P-08 token unregister on logout,
 * TC-P-09 Android channels bootstrap, TC-P-10 duplicate token suppression.
 */

import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockGetToken = jest.fn().mockResolvedValue('mock-fcm-token');
const mockDeleteToken = jest.fn().mockResolvedValue(undefined);
const mockRegisterDevice = jest.fn().mockResolvedValue(undefined);
const mockRequestPermission = jest
  .fn()
  .mockResolvedValue(1 /* AUTHORIZED */);
const mockOnMessage = jest.fn().mockReturnValue(jest.fn());
const mockOnNotificationOpenedApp = jest.fn().mockReturnValue(jest.fn());
const mockOnTokenRefresh = jest.fn().mockReturnValue(jest.fn());
const mockGetInitialNotification = jest.fn().mockResolvedValue(null);
const mockSetBackgroundMessageHandler = jest.fn();

jest.mock('@react-native-firebase/messaging', () => {
  const m = () => ({
    getToken: mockGetToken,
    deleteToken: mockDeleteToken,
    registerDeviceForRemoteMessages: mockRegisterDevice,
    requestPermission: mockRequestPermission,
    onMessage: mockOnMessage,
    onNotificationOpenedApp: mockOnNotificationOpenedApp,
    onTokenRefresh: mockOnTokenRefresh,
    getInitialNotification: mockGetInitialNotification,
    setBackgroundMessageHandler: mockSetBackgroundMessageHandler,
  });
  m.AuthorizationStatus = { AUTHORIZED: 1, PROVISIONAL: 2, DENIED: 0, NOT_DETERMINED: -1 };
  return m;
});

const mockCreateChannel = jest.fn().mockResolvedValue(undefined);
const mockDisplayNotification = jest.fn().mockResolvedValue(undefined);
const mockGetInitialNotifee = jest.fn().mockResolvedValue(null);
const mockOnForegroundEvent = jest.fn().mockReturnValue(jest.fn());

jest.mock('@notifee/react-native', () => ({
  __esModule: true,
  default: {
    createChannel: mockCreateChannel,
    displayNotification: mockDisplayNotification,
    getInitialNotification: mockGetInitialNotifee,
    onForegroundEvent: mockOnForegroundEvent,
  },
  AndroidImportance: { DEFAULT: 3, HIGH: 4, LOW: 2 },
  EventType: { PRESS: 1, DISMISSED: 0 },
}));

const mockPost = jest.fn().mockResolvedValue({ data: {} });
const mockDelete = jest.fn().mockResolvedValue({ data: {} });
jest.mock('../apiClient', () => ({
  apiClient: { post: mockPost, delete: mockDelete },
}));

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

jest.mock('../../navigation/navigationRef', () => ({
  navigationRef: { isReady: jest.fn().mockReturnValue(true), navigate: jest.fn() },
}));

// ── Import SUT after mocks ────────────────────────────────────────────────────

import {
  bootstrapAndroidChannels,
  registerPushToken,
  unregisterPushToken,
  subscribeForegroundMessages,
  subscribeNotificationOpenedApp,
  subscribeTokenRefresh,
  checkInitialNotification,
  registerBackgroundMessageHandler,
  requestPushPermission,
  STORAGE_KEY_FCM_TOKEN,
  ANDROID_CHANNELS,
} from '../pushNotificationService';
import { navigationRef } from '../../navigation/navigationRef';

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('pushNotificationService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    AsyncStorage.clear();
  });

  // TC-P-09
  describe('bootstrapAndroidChannels', () => {
    it('creates all Android channels on Android', async () => {
      Platform.OS = 'android';
      await bootstrapAndroidChannels();
      expect(mockCreateChannel).toHaveBeenCalledTimes(ANDROID_CHANNELS.length);
      ANDROID_CHANNELS.forEach((ch) =>
        expect(mockCreateChannel).toHaveBeenCalledWith(ch),
      );
    });

    it('does nothing on iOS', async () => {
      Platform.OS = 'ios';
      await bootstrapAndroidChannels();
      expect(mockCreateChannel).not.toHaveBeenCalled();
    });
  });

  // TC-P-01 / TC-P-02
  describe('registerPushToken', () => {
    it('registers FCM device on iOS and posts token to backend', async () => {
      Platform.OS = 'ios';
      const token = await registerPushToken('user-1');
      expect(mockRegisterDevice).toHaveBeenCalled();
      expect(mockGetToken).toHaveBeenCalled();
      expect(mockPost).toHaveBeenCalledWith(
        '/users/me/push-tokens',
        { token: 'mock-fcm-token', platform: 'ios' },
        expect.any(Object),
      );
      expect(token).toBe('mock-fcm-token');
    });

    it('registers token on Android without APNs call', async () => {
      Platform.OS = 'android';
      const token = await registerPushToken('user-1');
      expect(mockRegisterDevice).not.toHaveBeenCalled();
      expect(mockPost).toHaveBeenCalledWith(
        '/users/me/push-tokens',
        { token: 'mock-fcm-token', platform: 'android' },
        expect.any(Object),
      );
      expect(token).toBe('mock-fcm-token');
    });

    // TC-P-10: duplicate suppression
    it('does NOT post to backend when token is unchanged', async () => {
      Platform.OS = 'android';
      await AsyncStorage.setItem(
        STORAGE_KEY_FCM_TOKEN('user-1'),
        'mock-fcm-token',
      );
      await registerPushToken('user-1');
      expect(mockPost).not.toHaveBeenCalled();
    });

    it('scopes token to the authenticated user (no cross-user exposure)', async () => {
      Platform.OS = 'android';
      await registerPushToken('user-A');
      await registerPushToken('user-B');
      const tokenA = await AsyncStorage.getItem(STORAGE_KEY_FCM_TOKEN('user-A'));
      const tokenB = await AsyncStorage.getItem(STORAGE_KEY_FCM_TOKEN('user-B'));
      // Both stored under their own keys
      expect(tokenA).toBe('mock-fcm-token');
      expect(tokenB).toBe('mock-fcm-token');
      // But the API was called twice, once per user
      expect(mockPost).toHaveBeenCalledTimes(2);
      // Headers carry respective user ids
      expect(mockPost).toHaveBeenNthCalledWith(
        1,
        '/users/me/push-tokens',
        expect.any(Object),
        { headers: { 'X-User-Id': 'user-A' } },
      );
      expect(mockPost).toHaveBeenNthCalledWith(
        2,
        '/users/me/push-tokens',
        expect.any(Object),
        { headers: { 'X-User-Id': 'user-B' } },
      );
    });
  });

  // TC-P-08
  describe('unregisterPushToken', () => {
    it('deletes token from backend and local storage on logout', async () => {
      await AsyncStorage.setItem(
        STORAGE_KEY_FCM_TOKEN('user-1'),
        'mock-fcm-token',
      );
      await unregisterPushToken('user-1');
      expect(mockDelete).toHaveBeenCalledWith('/users/me/push-tokens', {
        data: { token: 'mock-fcm-token' },
        headers: { 'X-User-Id': 'user-1' },
      });
      expect(mockDeleteToken).toHaveBeenCalled();
      const stored = await AsyncStorage.getItem(
        STORAGE_KEY_FCM_TOKEN('user-1'),
      );
      expect(stored).toBeNull();
    });
  });

  // TC-P-03
  describe('subscribeForegroundMessages', () => {
    it('subscribes to onMessage and displays local notification', () => {
      const unsub = subscribeForegroundMessages();
      expect(mockOnMessage).toHaveBeenCalled();
      expect(typeof unsub).toBe('function');
    });

    it('calls provided onReceive callback', async () => {
      const onReceive = jest.fn();
      subscribeForegroundMessages(onReceive);
      // Simulate incoming message by calling the registered handler
      const handler = mockOnMessage.mock.calls[0][0];
      const fakeMsg = {
        notification: { title: 'T', body: 'B' },
        data: { channelId: 'default' },
      };
      await handler(fakeMsg);
      expect(mockDisplayNotification).toHaveBeenCalled();
      expect(onReceive).toHaveBeenCalledWith(fakeMsg);
    });
  });

  // TC-P-04
  describe('registerBackgroundMessageHandler', () => {
    it('registers a background message handler', () => {
      registerBackgroundMessageHandler();
      expect(mockSetBackgroundMessageHandler).toHaveBeenCalledWith(
        expect.any(Function),
      );
    });

    it('background handler displays local notification', async () => {
      registerBackgroundMessageHandler();
      const handler = mockSetBackgroundMessageHandler.mock.calls[0][0];
      const fakeMsg = {
        notification: { title: 'BG Title', body: 'BG Body' },
        data: {},
      };
      await handler(fakeMsg);
      expect(mockDisplayNotification).toHaveBeenCalled();
    });
  });

  // TC-P-05
  describe('subscribeNotificationOpenedApp', () => {
    it('navigates when notification is tapped (background)', () => {
      subscribeNotificationOpenedApp();
      const handler = mockOnNotificationOpenedApp.mock.calls[0][0];
      handler({ data: { screen: 'Details', params: { id: '42' } } });
      expect(navigationRef.navigate).toHaveBeenCalledWith(
        'Details',
        { id: '42' },
      );
    });
  });

  // TC-P-06
  describe('checkInitialNotification', () => {
    it('navigates when app opened from quit via Firebase', async () => {
      mockGetInitialNotification.mockResolvedValueOnce({
        data: { screen: 'Profile', params: {} },
      });
      await checkInitialNotification();
      expect(navigationRef.navigate).toHaveBeenCalledWith('Profile', {});
    });

    it('navigates when app opened from quit via notifee', async () => {
      mockGetInitialNotifee.mockResolvedValueOnce({
        notification: { data: { screen: 'Settings' } },
      });
      await checkInitialNotification();
      expect(navigationRef.navigate).toHaveBeenCalledWith(
        'Settings',
        undefined,
      );
    });
  });

  // TC-P-07
  describe('subscribeTokenRefresh', () => {
    it('re-registers new token with backend on refresh', async () => {
      subscribeTokenRefresh('user-1');
      const handler = mockOnTokenRefresh.mock.calls[0][0];
      await handler('new-token-xyz');
      expect(mockPost).toHaveBeenCalledWith(
        '/users/me/push-tokens',
        { token: 'new-token-xyz', platform: expect.any(String) },
        { headers: { 'X-User-Id': 'user-1' } },
      );
      const stored = await AsyncStorage.getItem(
        STORAGE_KEY_FCM_TOKEN('user-1'),
      );
      expect(stored).toBe('new-token-xyz');
    });
  });

  // Permission
  describe('requestPushPermission', () => {
    it('returns true when AUTHORIZED', async () => {
      mockRequestPermission.mockResolvedValueOnce(1);
      const result = await requestPushPermission();
      expect(result).toBe(true);
    });

    it('returns true when PROVISIONAL (iOS)', async () => {
      mockRequestPermission.mockResolvedValueOnce(2);
      const result = await requestPushPermission();
      expect(result).toBe(true);
    });

    it('returns false when DENIED', async () => {
      mockRequestPermission.mockResolvedValueOnce(0);
      const result = await requestPushPermission();
      expect(result).toBe(false);
    });
  });
});
