/**
 * Tests unitarios para SessionManager.
 * Cubre: persistencia, refresco proactivo, cola de peticiones, signOut limpio.
 */
import { sessionManager } from '../sessionManager';
import * as tokenStorage from '../tokenStorage';
import * as authApi from '../authApi';

jest.mock('../tokenStorage');
jest.mock('../authApi');

const NOW = 1_700_000_000_000;

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  jest.spyOn(Date, 'now').mockReturnValue(NOW);
  // Resetear estado interno
  (sessionManager as any)._tokens = null;
  (sessionManager as any)._refreshTimer = null;
  (sessionManager as any)._refreshPromise = null;
});

afterEach(() => {
  jest.useRealTimers();
});

// ── initialize ───────────────────────────────────────────────────────────────

describe('initialize()', () => {
  it('devuelve false si no hay tokens almacenados', async () => {
    (tokenStorage.loadTokens as jest.Mock).mockResolvedValue(null);
    const result = await sessionManager.initialize();
    expect(result).toBe(false);
  });

  it('restaura sesión con token válido', async () => {
    const tokens = {
      accessToken: 'valid-at',
      refreshToken: 'rt',
      expiresAt: NOW + 60_000,
    };
    (tokenStorage.loadTokens as jest.Mock).mockResolvedValue(tokens);
    (tokenStorage.isTokenExpired as jest.Mock).mockReturnValue(false);
    const result = await sessionManager.initialize();
    expect(result).toBe(true);
    expect(sessionManager.accessToken).toBe('valid-at');
  });

  it('refresca si el token almacenado está vencido', async () => {
    const stored = {
      accessToken: 'expired-at',
      refreshToken: 'rt',
      expiresAt: NOW - 1_000,
    };
    const fresh = {
      accessToken: 'new-at',
      refreshToken: 'new-rt',
      expiresAt: NOW + 3_600_000,
    };
    (tokenStorage.loadTokens as jest.Mock).mockResolvedValue(stored);
    (tokenStorage.isTokenExpired as jest.Mock).mockReturnValue(true);
    (authApi.refreshRequest as jest.Mock).mockResolvedValue(fresh);
    const result = await sessionManager.initialize();
    expect(result).toBe(true);
    expect(sessionManager.accessToken).toBe('new-at');
  });

  it('devuelve false y limpia tokens si el refresh falla', async () => {
    const stored = {
      accessToken: 'expired-at',
      refreshToken: 'rt',
      expiresAt: NOW - 1_000,
    };
    (tokenStorage.loadTokens as jest.Mock).mockResolvedValue(stored);
    (tokenStorage.isTokenExpired as jest.Mock).mockReturnValue(true);
    (authApi.refreshRequest as jest.Mock).mockRejectedValue(new Error('401'));
    const result = await sessionManager.initialize();
    expect(result).toBe(false);
    expect(tokenStorage.clearTokens).toHaveBeenCalled();
  });
});

// ── ensureFreshToken ─────────────────────────────────────────────────────────

describe('ensureFreshToken()', () => {
  it('devuelve el access token si está vigente', async () => {
    (sessionManager as any)._tokens = {
      accessToken: 'at',
      refreshToken: 'rt',
      expiresAt: NOW + 60_000,
    };
    (tokenStorage.isTokenExpired as jest.Mock).mockReturnValue(false);
    const token = await sessionManager.ensureFreshToken();
    expect(token).toBe('at');
    expect(authApi.refreshRequest).not.toHaveBeenCalled();
  });

  it('refresca y devuelve el nuevo token si está vencido', async () => {
    (sessionManager as any)._tokens = {
      accessToken: 'old-at',
      refreshToken: 'rt',
      expiresAt: NOW - 1_000,
    };
    const fresh = { accessToken: 'new-at', refreshToken: 'new-rt', expiresAt: NOW + 3_600_000 };
    (tokenStorage.isTokenExpired as jest.Mock).mockReturnValue(true);
    (authApi.refreshRequest as jest.Mock).mockResolvedValue(fresh);
    const token = await sessionManager.ensureFreshToken();
    expect(token).toBe('new-at');
  });

  it('reutiliza la promesa de refresh en vuelo (no dispara dos llamadas)', async () => {
    (sessionManager as any)._tokens = {
      accessToken: 'old-at',
      refreshToken: 'rt',
      expiresAt: NOW - 1_000,
    };
    const fresh = { accessToken: 'new-at', refreshToken: 'new-rt', expiresAt: NOW + 3_600_000 };
    (tokenStorage.isTokenExpired as jest.Mock).mockReturnValue(true);
    (authApi.refreshRequest as jest.Mock).mockResolvedValue(fresh);

    const [t1, t2] = await Promise.all([
      sessionManager.ensureFreshToken(),
      sessionManager.ensureFreshToken(),
    ]);

    expect(authApi.refreshRequest).toHaveBeenCalledTimes(1);
    expect(t1).toBe('new-at');
    expect(t2).toBe('new-at');
  });

  it('llama a signOut si el refresh falla', async () => {
    (sessionManager as any)._tokens = {
      accessToken: 'old-at',
      refreshToken: 'rt',
      expiresAt: NOW - 1_000,
    };
    (tokenStorage.isTokenExpired as jest.Mock).mockReturnValue(true);
    (authApi.refreshRequest as jest.Mock).mockRejectedValue(new Error('401'));
    (tokenStorage.clearTokens as jest.Mock).mockResolvedValue(undefined);

    await expect(sessionManager.ensureFreshToken()).rejects.toThrow('401');
    expect(tokenStorage.clearTokens).toHaveBeenCalled();
  });
});

// ── Refresco proactivo ───────────────────────────────────────────────────────

describe('refresco proactivo con timer', () => {
  it('cancela el timer anterior al aplicar nuevos tokens', async () => {
    const clearSpy = jest.spyOn(global, 'clearTimeout');

    const tokens1 = { accessToken: 'at1', refreshToken: 'rt', expiresAt: NOW + 120_000 };
    const tokens2 = { accessToken: 'at2', refreshToken: 'rt', expiresAt: NOW + 120_000 };

    (tokenStorage.isTokenExpired as jest.Mock).mockReturnValue(false);
    (tokenStorage.saveTokens as jest.Mock).mockResolvedValue(undefined);

    sessionManager.setTokens(tokens1);
    sessionManager.setTokens(tokens2);

    expect(clearSpy).toHaveBeenCalled();
  });
});

// ── signOut ──────────────────────────────────────────────────────────────────

describe('signOut()', () => {
  it('limpia tokens, cancela timer y notifica listeners', async () => {
    (tokenStorage.clearTokens as jest.Mock).mockResolvedValue(undefined);
    const listener = jest.fn();
    sessionManager.addListener(listener);

    (sessionManager as any)._tokens = {
      accessToken: 'at',
      refreshToken: 'rt',
      expiresAt: NOW + 60_000,
    };

    await sessionManager.signOut();

    expect(tokenStorage.clearTokens).toHaveBeenCalled();
    expect(sessionManager.accessToken).toBeNull();
    expect(listener).toHaveBeenCalledWith(false);
  });
});
