/**
 * Auth API client.
 * All calls go through this module; swap BASE_URL via env.
 */

const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface UserInfo {
  id: string;
  email: string;
  name: string;
}

export interface RegisterPayload {
  name: string;
  email: string;
  password: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

async function request<T>(path: string, options: RequestInit): Promise<T> {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers ?? {}) },
  });

  const data = await res.json();
  if (!res.ok) {
    const err: any = new Error(data?.message || 'Request failed');
    err.status = res.status;
    err.code = data?.error;
    throw err;
  }
  return data as T;
}

export const authApi = {
  register(payload: RegisterPayload) {
    return request<AuthTokens & { user: UserInfo }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  login(payload: LoginPayload) {
    return request<AuthTokens & { user: UserInfo }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  refresh(refreshToken: string) {
    return request<Pick<AuthTokens, 'accessToken' | 'expiresIn'>>('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    });
  },

  logout(refreshToken: string) {
    return request<void>('/auth/logout', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    });
  },
};
