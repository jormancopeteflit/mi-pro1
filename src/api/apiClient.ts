/**
 * apiClient.ts
 * Instancia de Axios con interceptores para:
 *  1. Adjuntar el Bearer token vigente en cada petición.
 *  2. Refrescar el token cuando el servidor devuelve 401 y reintentar.
 *  3. Encolar peticiones que lleguen mientras hay un refresh en curso.
 */
import axios, {
  AxiosInstance,
  AxiosRequestConfig,
  InternalAxiosRequestConfig,
} from 'axios';
import { API_BASE_URL } from '../config/env';
import { sessionManager } from '../auth/sessionManager';

// Cola de callbacks que esperan el nuevo token
type QueueItem = {
  resolve: (token: string) => void;
  reject: (err: unknown) => void;
};

let _isRefreshing = false;
let _queue: QueueItem[] = [];

function processQueue(error: unknown, token: string | null): void {
  _queue.forEach(({ resolve, reject }) =>
    error ? reject(error) : resolve(token!)
  );
  _queue = [];
}

export const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15_000,
});

// ── Request interceptor: adjunta token ──────────────────────────────────────
apiClient.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    try {
      const token = await sessionManager.ensureFreshToken();
      config.headers = config.headers ?? {};
      config.headers['Authorization'] = `Bearer ${token}`;
    } catch {
      // Sin token → la petición se envía sin cabecera; el servidor retornará 401
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ── Response interceptor: maneja 401 ────────────────────────────────────────
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest: AxiosRequestConfig & { _retry?: boolean } =
      error.config ?? {};

    if (error.response?.status !== 401 || originalRequest._retry) {
      return Promise.reject(error);
    }

    if (_isRefreshing) {
      // Encolar la petición
      return new Promise<string>((resolve, reject) => {
        _queue.push({ resolve, reject });
      })
        .then((token) => {
          originalRequest.headers = {
            ...originalRequest.headers,
            Authorization: `Bearer ${token}`,
          };
          originalRequest._retry = true;
          return apiClient(originalRequest);
        })
        .catch(Promise.reject.bind(Promise));
    }

    originalRequest._retry = true;
    _isRefreshing = true;

    try {
      const token = await sessionManager.ensureFreshToken();
      processQueue(null, token);
      originalRequest.headers = {
        ...originalRequest.headers,
        Authorization: `Bearer ${token}`,
      };
      return apiClient(originalRequest);
    } catch (refreshError) {
      processQueue(refreshError, null);
      return Promise.reject(refreshError);
    } finally {
      _isRefreshing = false;
    }
  }
);
