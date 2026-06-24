/**
 * Axios API client singleton.
 * Auth token is injected via request interceptor from the auth store.
 * Ensures every request carries the current user's token so data
 * is always scoped to the authenticated user.
 */

import axios, { AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BASE_URL = process.env.API_BASE_URL ?? 'https://api.example.com/v1';

const instance: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

instance.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    const token = await AsyncStorage.getItem('@auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

export const apiClient = instance;
