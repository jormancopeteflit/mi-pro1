/**
 * sessionManager.ts
 * Gestiona el ciclo de vida de la sesión:
 *  - Carga tokens al arrancar.
 *  - Refresca proactivamente antes de que venza.
 *  - Expone el token vigente de forma síncrona para el interceptor de Axios.
 *  - Cancela timers pendientes correctamente.
 */
import {
  loadTokens,
  saveTokens,
  clearTokens,
  isTokenExpired,
  TokenSet,
} from './tokenStorage';
import { refreshRequest } from './authApi';

type SessionListener = (authenticated: boolean) => void;

class SessionManager {
  private _tokens: TokenSet | null = null;
  private _refreshTimer: ReturnType<typeof setTimeout> | null = null;
  private _refreshPromise: Promise<TokenSet> | null = null;
  private _listeners: SessionListener[] = [];

  // ─── Inicialización ─────────────────────────────────────────────────────────

  /** Debe llamarse al arrancar la app (p.ej. en el componente raíz). */
  async initialize(): Promise<boolean> {
    const stored = await loadTokens();
    if (!stored) return false;

    if (isTokenExpired(stored.expiresAt)) {
      try {
        const fresh = await this._doRefresh(stored.refreshToken);
        this._applyTokens(fresh);
        return true;
      } catch {
        await clearTokens();
        return false;
      }
    }

    this._applyTokens(stored);
    return true;
  }

  // ─── Setters ────────────────────────────────────────────────────────────────

  setTokens(tokens: TokenSet): void {
    this._applyTokens(tokens);
    saveTokens(tokens); // fire-and-forget; errores son no-fatales aquí
  }

  // ─── Getters ────────────────────────────────────────────────────────────────

  get isAuthenticated(): boolean {
    return !!this._tokens;
  }

  /** Devuelve el access token actual (sin verificar expiración). */
  get accessToken(): string | null {
    return this._tokens?.accessToken ?? null;
  }

  get refreshToken(): string | null {
    return this._tokens?.refreshToken ?? null;
  }

  // ─── Refresco ───────────────────────────────────────────────────────────────

  /**
   * Garantiza que se devuelve un access token válido.
   * Si ya hay un refresh en curso, reutiliza la misma promesa (no dispara dos).
   */
  async ensureFreshToken(): Promise<string> {
    if (this._tokens && !isTokenExpired(this._tokens.expiresAt)) {
      return this._tokens.accessToken;
    }

    if (!this._tokens?.refreshToken) {
      throw new Error('NO_REFRESH_TOKEN');
    }

    // Reutilizar promesa de refresh en vuelo
    if (!this._refreshPromise) {
      this._refreshPromise = this._doRefresh(this._tokens.refreshToken)
        .then((fresh) => {
          this._applyTokens(fresh);
          saveTokens(fresh);
          return fresh;
        })
        .catch(async (err) => {
          await this.signOut();
          throw err;
        })
        .finally(() => {
          this._refreshPromise = null;
        });
    }

    const fresh = await this._refreshPromise;
    return fresh.accessToken;
  }

  // ─── Cierre de sesión ───────────────────────────────────────────────────────

  async signOut(): Promise<void> {
    this._cancelRefreshTimer();
    this._tokens = null;
    this._refreshPromise = null;
    await clearTokens();
    this._notifyListeners(false);
  }

  // ─── Listeners ──────────────────────────────────────────────────────────────

  addListener(fn: SessionListener): () => void {
    this._listeners.push(fn);
    return () => {
      this._listeners = this._listeners.filter((l) => l !== fn);
    };
  }

  // ─── Privados ───────────────────────────────────────────────────────────────

  private _applyTokens(tokens: TokenSet): void {
    const wasAuthenticated = this.isAuthenticated;
    this._tokens = tokens;
    this._scheduleProactiveRefresh(tokens.expiresAt);
    if (!wasAuthenticated) this._notifyListeners(true);
  }

  /** Programa el refresco 30 s antes del vencimiento, cancelando el timer anterior. */
  private _scheduleProactiveRefresh(expiresAt: number): void {
    this._cancelRefreshTimer();
    const delay = expiresAt - Date.now() - 30_000; // 30 s de margen
    if (delay <= 0) return; // ya venció o vence muy pronto → ensureFreshToken lo manejará

    this._refreshTimer = setTimeout(async () => {
      try {
        await this.ensureFreshToken();
      } catch {
        // signOut ya fue llamado internamente
      }
    }, delay);
  }

  private _cancelRefreshTimer(): void {
    if (this._refreshTimer !== null) {
      clearTimeout(this._refreshTimer);
      this._refreshTimer = null;
    }
  }

  private async _doRefresh(refreshToken: string): Promise<TokenSet> {
    return refreshRequest(refreshToken);
  }

  private _notifyListeners(authenticated: boolean): void {
    this._listeners.forEach((fn) => fn(authenticated));
  }
}

// Singleton accesible en toda la app
export const sessionManager = new SessionManager();
