// Jest manual mock for @react-native-community/netinfo
export default {
  addEventListener: jest.fn().mockReturnValue(() => {}),
  fetch: jest.fn().mockResolvedValue({ isConnected: true, isInternetReachable: true }),
};
