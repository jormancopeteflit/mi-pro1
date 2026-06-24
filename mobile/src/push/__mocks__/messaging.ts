// Jest manual mock for @react-native-firebase/messaging
const mockMessaging = {
  requestPermission: jest.fn().mockResolvedValue(1),
  getToken: jest.fn().mockResolvedValue('mock-fcm-token-abc123'),
  onTokenRefresh: jest.fn().mockReturnValue(() => {}),
  onMessage: jest.fn().mockReturnValue(() => {}),
  setBackgroundMessageHandler: jest.fn(),
  getInitialNotification: jest.fn().mockResolvedValue(null),
  onNotificationOpenedApp: jest.fn().mockReturnValue(() => {}),
  AuthorizationStatus: { AUTHORIZED: 1, PROVISIONAL: 2 },
};

const fn = () => mockMessaging;
(fn as any).AuthorizationStatus = mockMessaging.AuthorizationStatus;

export default fn;
