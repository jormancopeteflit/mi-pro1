/**
 * Tests unitarios para tokenStorage.
 */
import * as SecureStore from 'expo-secure-store';
import {
  saveTokens,
  loadTokens,
  clearTokens,
  isTokenExpired,
} from '../tokenStorage';

jest.mock('expo-secure-store');

const mockSet = SecureStore.setItemAsync as jest.Mock;
const mockGet = SecureStore.getItemAsync as jest.Mock;
const mockDel = SecureStore.deleteItemAsync as jest.Mock;

const NOW = 1_700_000_000_000;

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Date, 'now').mockReturnValue(NOW);
});

describe('saveTokens / loadTokens', () => {
  it('persiste y recupera tokens correctamente', async () => {
    mockSet.mockResolvedValue(undefined);
    mockGet.mockImplementation((key: string) => {
      const map: Record<string, string> = {
        auth_access_token: 'at',
        auth_refresh_token: 'rt',
        auth_token_expiry: String(NOW + 3_600_000),
      };
      return Promise.resolve(map[key] ?? null);
    });

    await saveTokens({ accessToken: 'at', refreshToken: 'rt', expiresAt: NOW + 3_600_000 });
    const loaded = await loadTokens();

    expect(loaded).toEqual({
      accessToken: 'at',
      refreshToken: 'rt',
      expiresAt: NOW + 3_600_000,
    });
  });

  it('devuelve null si falta algún valor', async () => {
    mockGet.mockResolvedValue(null);
    const result = await loadTokens();
    expect(result).toBeNull();
  });
});

describe('clearTokens', () => {
  it('elimina las tres claves', async () => {
    mockDel.mockResolvedValue(undefined);
    await clearTokens();
    expect(mockDel).toHaveBeenCalledTimes(3);
  });
});

describe('isTokenExpired', () => {
  it('devuelve false si queda más del buffer', () => {
    expect(isTokenExpired(NOW + 60_000, 30_000)).toBe(false);
  });

  it('devuelve true si queda menos del buffer', () => {
    expect(isTokenExpired(NOW + 10_000, 30_000)).toBe(true);
  });

  it('devuelve true si ya venció', () => {
    expect(isTokenExpired(NOW - 1_000)).toBe(true);
  });
});
