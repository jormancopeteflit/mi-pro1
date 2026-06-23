/**
 * Secure token storage using react-native-keychain.
 * Falls back to in-memory storage if keychain is unavailable (e.g., unit tests).
 */
import * as Keychain from 'react-native-keychain';

const ACCESS_TOKEN_KEY = 'app_access_token';
const REFRESH_TOKEN_KEY = 'app_refresh_token';

// In-memory fallback (for environments without keychain)
let memAccessToken: string | null = null;
let memRefreshToken: string | null = null;

export const tokenStorage = {
  async saveTokens(accessToken: string, refreshToken: string): Promise<void> {
    try {
      await Keychain.setGenericPassword(ACCESS_TOKEN_KEY, accessToken, {
        service: ACCESS_TOKEN_KEY,
      });
      await Keychain.setGenericPassword(REFRESH_TOKEN_KEY, refreshToken, {
        service: REFRESH_TOKEN_KEY,
      });
    } catch {
      memAccessToken = accessToken;
      memRefreshToken = refreshToken;
    }
  },

  async getAccessToken(): Promise<string | null> {
    try {
      const result = await Keychain.getGenericPassword({ service: ACCESS_TOKEN_KEY });
      return result ? result.password : null;
    } catch {
      return memAccessToken;
    }
  },

  async getRefreshToken(): Promise<string | null> {
    try {
      const result = await Keychain.getGenericPassword({ service: REFRESH_TOKEN_KEY });
      return result ? result.password : null;
    } catch {
      return memRefreshToken;
    }
  },

  async clearTokens(): Promise<void> {
    try {
      await Keychain.resetGenericPassword({ service: ACCESS_TOKEN_KEY });
      await Keychain.resetGenericPassword({ service: REFRESH_TOKEN_KEY });
    } catch {
      // ignore
    } finally {
      memAccessToken = null;
      memRefreshToken = null;
    }
  },
};
