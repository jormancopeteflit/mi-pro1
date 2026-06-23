/**
 * authApi.ts
 * Llamadas de autenticación usando una instancia de axios SIN interceptores
 * para evitar recursión durante el refresco de tokens.
 */
import axios from 'axios';
import { API_BASE_URL } from '../config/env';
import type { TokenSet } from './tokenStorage';

const authAxios = axios.create({ baseURL: API_BASE_URL });

export interface LoginPayload {
  email: string;
  password: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  /** Segundos hasta vencimiento */
  expiresIn: number;
}

function buildTokenSet(data: AuthResponse): TokenSet {
  return {
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
    expiresAt: Date.now() + data.expiresIn * 1_000,
  };
}

export async function loginRequest(payload: LoginPayload): Promise<TokenSet> {
  const { data } = await authAxios.post<AuthResponse>('/auth/login', payload);
  return buildTokenSet(data);
}

export async function refreshRequest(refreshToken: string): Promise<TokenSet> {
  const { data } = await authAxios.post<AuthResponse>('/auth/refresh', {
    refreshToken,
  });
  return buildTokenSet(data);
}

export async function logoutRequest(refreshToken: string): Promise<void> {
  await authAxios
    .post('/auth/logout', { refreshToken })
    .catch(() => {/* best-effort */});
}
