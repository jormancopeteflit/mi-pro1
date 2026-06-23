/**
 * AuthContext.tsx
 * Proveedor de contexto de autenticación.
 * - Inicializa la sesión al montar.
 * - Expone login, logout y el estado de autenticación.
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { sessionManager } from './sessionManager';
import { loginRequest, logoutRequest } from './authApi';
import type { LoginPayload } from './authApi';

interface AuthContextValue {
  isAuthenticated: boolean;
  isInitializing: boolean;
  login: (payload: LoginPayload) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  // Guardar referencia al unsubscribe para limpiarlo
  const unsubscribeRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    // Escuchar cambios de sesión (ej. refresh que falla → logout automático)
    unsubscribeRef.current = sessionManager.addListener((authenticated) => {
      setIsAuthenticated(authenticated);
    });

    // Inicializar sesión desde almacenamiento seguro
    sessionManager.initialize().then((authenticated) => {
      setIsAuthenticated(authenticated);
      setIsInitializing(false);
    });

    return () => {
      unsubscribeRef.current?.();
    };
  }, []);

  const login = useCallback(async (payload: LoginPayload) => {
    const tokens = await loginRequest(payload);
    sessionManager.setTokens(tokens);
    setIsAuthenticated(true);
  }, []);

  const logout = useCallback(async () => {
    const refreshToken = sessionManager.refreshToken;
    await sessionManager.signOut();
    if (refreshToken) {
      await logoutRequest(refreshToken);
    }
    setIsAuthenticated(false);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ isAuthenticated, isInitializing, login, logout }),
    [isAuthenticated, isInitializing, login, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
