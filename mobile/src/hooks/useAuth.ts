import { useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type { RootState, AppDispatch } from '../store';
import { loginThunk, registerThunk, logoutThunk, refreshThunk } from '../store/slices/authSlice';

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterCredentials {
  name: string;
  email: string;
  password: string;
}

export const useAuth = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { user, accessToken, isLoading, error, isAuthenticated } = useSelector(
    (state: RootState) => state.auth,
  );

  const login = useCallback(
    (credentials: LoginCredentials) => dispatch(loginThunk(credentials)).unwrap(),
    [dispatch],
  );

  const register = useCallback(
    (credentials: RegisterCredentials) => dispatch(registerThunk(credentials)).unwrap(),
    [dispatch],
  );

  const logout = useCallback(() => dispatch(logoutThunk()).unwrap(), [dispatch]);

  const refresh = useCallback(() => dispatch(refreshThunk()).unwrap(), [dispatch]);

  return {
    user,
    accessToken,
    isLoading,
    error,
    isAuthenticated,
    login,
    register,
    logout,
    refresh,
  };
};
