import axios, { AxiosInstance } from 'axios';
import { API_BASE_URL } from '../config/constants';

const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
});

export interface AuthTokensResponse {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    name: string;
  };
}

export interface RefreshResponse {
  accessToken: string;
  refreshToken: string;
}

export const authApi = {
  async register(payload: {
    name: string;
    email: string;
    password: string;
  }): Promise<AuthTokensResponse> {
    const response = await apiClient.post<AuthTokensResponse>('/auth/register', payload);
    return response.data;
  },

  async login(payload: { email: string; password: string }): Promise<AuthTokensResponse> {
    const response = await apiClient.post<AuthTokensResponse>('/auth/login', payload);
    return response.data;
  },

  async refresh(refreshToken: string): Promise<RefreshResponse> {
    const response = await apiClient.post<RefreshResponse>('/auth/refresh', { refreshToken });
    return response.data;
  },

  async logout(accessToken?: string): Promise<void> {
    await apiClient.post(
      '/auth/logout',
      {},
      accessToken ? { headers: { Authorization: `Bearer ${accessToken}` } } : undefined,
    );
  },
};

export default apiClient;
