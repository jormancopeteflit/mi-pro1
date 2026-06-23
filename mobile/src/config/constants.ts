import { Platform } from 'react-native';

/**
 * Base URL for the API.
 * On Android emulators, localhost maps to 10.0.2.2.
 * On iOS simulators and real devices, localhost works directly.
 */
export const API_BASE_URL =
  process.env.API_BASE_URL ??
  (Platform.OS === 'android' ? 'http://10.0.2.2:3000' : 'http://localhost:3000');
