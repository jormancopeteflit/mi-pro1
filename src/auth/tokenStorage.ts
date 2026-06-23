/**
 * tokenStorage.ts
 * Almacenamiento seguro de tokens usando expo-secure-store (iOS Keychain / Android Keystore).
 * NO se persiste ningún secreto en AsyncStorage ni en el bundle.
 */
import * as SecureStore from 'expo-secure-store';

const ACCESS_TOKEN_KEY = 'auth_access_token';
const REFRESH_TOKEN_KEY = 'auth_refresh_token';
const TOKEN_EXPIRY_KEY = 'auth_token_expiry';

export interface TokenSet {
  accessToken: string;
  refreshToken: string;
  /** Timestamp en ms cuando vence el access token */
  expiresAt: number;
}

export async function saveTokens(tokens: TokenSet): Promise<void> {
  await Promise.all([
    SecureStore.setItemAsync(ACCESS_TOKEN_KEY, tokens.accessToken),
    SecureStore.setItemAsync(REFRESH_TOKEN_KEY, tokens.refreshToken),
    SecureStore.setItemAsync(TOKEN_EXPIRY_KEY, String(tokens.expiresAt)),
  ]);
}

export async function loadTokens(): Promise<TokenSet | null> {
  const [accessToken, refreshToken, expiresAtStr] = await Promise.all([
    SecureStore.getItemAsync(ACCESS_TOKEN_KEY),
    SecureStore.getItemAsync(REFRESH_TOKEN_KEY),
    SecureStore.getItemAsync(TOKEN_EXPIRY_KEY),
  ]);

  if (!accessToken || !refreshToken || !expiresAtStr) return null;

  return {
    accessToken,
    refreshToken,
    expiresAt: Number(expiresAtStr),
  };
}

export async function clearTokens(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY),
    SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY),
    SecureStore.deleteItemAsync(TOKEN_EXPIRY_KEY),
  ]);
}

/** Devuelve true si el access token ya venció o vence en menos de `bufferMs` ms */
export function isTokenExpired(expiresAt: number, bufferMs = 30_000): boolean {
  return Date.now() >= expiresAt - bufferMs;
}
