/**
 * Zustand store for authentication state.
 * Persists tokens to AsyncStorage.
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authApi, LoginPayload, RegisterPayload } from '../api/authApi';

export interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  expiresIn: number | null;
  user: { id: string; email: string; name: string } | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  register: (payload: RegisterPayload) => Promise<void>;
  login: (payload: LoginPayload) => Promise<void>;
  logout: () => Promise<void>;
  refreshAccessToken: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      accessToken: null,
      refreshToken: null,
      expiresIn: null,
      user: null,
      isLoading: false,
      error: null,

      clearError: () => set({ error: null }),

      register: async (payload) => {
        set({ isLoading: true, error: null });
        try {
          const res = await authApi.register(payload);
          set({
            accessToken: res.accessToken,
            refreshToken: res.refreshToken,
            expiresIn: res.expiresIn,
            user: res.user,
            isLoading: false,
          });
        } catch (e: any) {
          set({ isLoading: false, error: e.message });
          throw e;
        }
      },

      login: async (payload) => {
        set({ isLoading: true, error: null });
        try {
          const res = await authApi.login(payload);
          set({
            accessToken: res.accessToken,
            refreshToken: res.refreshToken,
            expiresIn: res.expiresIn,
            user: res.user,
            isLoading: false,
          });
        } catch (e: any) {
          set({ isLoading: false, error: e.message });
          throw e;
        }
      },

      logout: async () => {
        const { refreshToken } = get();
        set({ isLoading: true, error: null });
        try {
          if (refreshToken) await authApi.logout(refreshToken);
        } catch (_) {
          // best-effort logout
        } finally {
          set({
            accessToken: null,
            refreshToken: null,
            expiresIn: null,
            user: null,
            isLoading: false,
          });
        }
      },

      refreshAccessToken: async () => {
        const { refreshToken } = get();
        if (!refreshToken) return;
        try {
          const res = await authApi.refresh(refreshToken);
          set({ accessToken: res.accessToken, expiresIn: res.expiresIn });
        } catch (_) {
          // If refresh fails, force logout
          set({ accessToken: null, refreshToken: null, user: null });
        }
      },
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        expiresIn: state.expiresIn,
        user: state.user,
      }),
    },
  ),
);
