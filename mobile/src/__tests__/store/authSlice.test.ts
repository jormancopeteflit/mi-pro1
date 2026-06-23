import { configureStore } from '@reduxjs/toolkit';
import authReducer, {
  loginThunk,
  registerThunk,
  logoutThunk,
  refreshThunk,
  clearError,
} from '../../store/slices/authSlice';
import { authApi } from '../../api/authApi';
import { tokenStorage } from '../../utils/tokenStorage';

jest.mock('../../api/authApi');
jest.mock('../../utils/tokenStorage');

const mockAuthApi = authApi as jest.Mocked<typeof authApi>;
const mockTokenStorage = tokenStorage as jest.Mocked<typeof tokenStorage>;

const mockAuthResponse = {
  accessToken: 'mock.access.token',
  refreshToken: 'mock.refresh.token',
  user: { id: 'uuid-001', email: 'user@example.com', name: 'Test User' },
};

const makeStore = () => configureStore({ reducer: { auth: authReducer } });

describe('authSlice', () => {
  let store: ReturnType<typeof makeStore>;

  beforeEach(() => {
    store = makeStore();
    jest.clearAllMocks();
    mockTokenStorage.saveTokens.mockResolvedValue(undefined);
    mockTokenStorage.clearTokens.mockResolvedValue(undefined);
    mockTokenStorage.getAccessToken.mockResolvedValue('stored.access.token');
    mockTokenStorage.getRefreshToken.mockResolvedValue('stored.refresh.token');
  });

  describe('loginThunk', () => {
    it('TC-STORE-L01: sets isAuthenticated and tokens on success', async () => {
      mockAuthApi.login.mockResolvedValue(mockAuthResponse);

      await store.dispatch(loginThunk({ email: 'user@example.com', password: 'pass' }));

      const state = store.getState().auth;
      expect(state.isAuthenticated).toBe(true);
      expect(state.accessToken).toBe('mock.access.token');
      expect(state.user?.email).toBe('user@example.com');
      expect(state.isLoading).toBe(false);
      expect(mockTokenStorage.saveTokens).toHaveBeenCalledWith(
        'mock.access.token',
        'mock.refresh.token',
      );
    });

    it('TC-STORE-L02: sets error on failure', async () => {
      mockAuthApi.login.mockRejectedValue({ message: 'Invalid credentials' });

      await store.dispatch(loginThunk({ email: 'x@x.com', password: 'wrong' }));

      const state = store.getState().auth;
      expect(state.isAuthenticated).toBe(false);
      expect(state.error).toBeTruthy();
    });
  });

  describe('registerThunk', () => {
    it('TC-STORE-R01: sets isAuthenticated and tokens on success', async () => {
      mockAuthApi.register.mockResolvedValue(mockAuthResponse);

      await store.dispatch(
        registerThunk({ name: 'User', email: 'user@example.com', password: 'ValidPass1!' }),
      );

      const state = store.getState().auth;
      expect(state.isAuthenticated).toBe(true);
      expect(state.accessToken).toBe('mock.access.token');
    });
  });

  describe('logoutThunk', () => {
    it('TC-STORE-LO01: resets state on logout', async () => {
      // First login
      mockAuthApi.login.mockResolvedValue(mockAuthResponse);
      await store.dispatch(loginThunk({ email: 'user@example.com', password: 'pass' }));

      // Then logout
      mockAuthApi.logout.mockResolvedValue(undefined);
      await store.dispatch(logoutThunk());

      const state = store.getState().auth;
      expect(state.isAuthenticated).toBe(false);
      expect(state.user).toBeNull();
      expect(state.accessToken).toBeNull();
      expect(mockTokenStorage.clearTokens).toHaveBeenCalled();
    });
  });

  describe('refreshThunk', () => {
    it('TC-STORE-RF01: updates tokens on successful refresh', async () => {
      mockAuthApi.refresh.mockResolvedValue({
        accessToken: 'new.access.token',
        refreshToken: 'new.refresh.token',
      });

      await store.dispatch(refreshThunk());

      const state = store.getState().auth;
      expect(state.accessToken).toBe('new.access.token');
      expect(state.isAuthenticated).toBe(true);
    });

    it('TC-STORE-RF02: clears auth state on refresh failure', async () => {
      mockTokenStorage.getRefreshToken.mockResolvedValue(null);

      await store.dispatch(refreshThunk());

      const state = store.getState().auth;
      expect(state.isAuthenticated).toBe(false);
      expect(state.accessToken).toBeNull();
    });
  });

  describe('clearError', () => {
    it('TC-STORE-CE01: clears the error field', async () => {
      mockAuthApi.login.mockRejectedValue({ message: 'fail' });
      await store.dispatch(loginThunk({ email: 'x@x.com', password: 'wrong' }));

      store.dispatch(clearError());

      expect(store.getState().auth.error).toBeNull();
    });
  });
});
