import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { authApi } from '../../api/authApi';
import { tokenStorage } from '../../utils/tokenStorage';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
}

export interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  isLoading: boolean;
  error: string | null;
  isAuthenticated: boolean;
}

const initialState: AuthState = {
  user: null,
  accessToken: null,
  refreshToken: null,
  isLoading: false,
  error: null,
  isAuthenticated: false,
};

// ─── Thunks ───────────────────────────────────────────────────────────────────

export const loginThunk = createAsyncThunk(
  'auth/login',
  async (credentials: { email: string; password: string }, { rejectWithValue }) => {
    try {
      const data = await authApi.login(credentials);
      await tokenStorage.saveTokens(data.accessToken, data.refreshToken);
      return data;
    } catch (error: any) {
      return rejectWithValue(
        error?.response?.data?.message ?? error?.message ?? 'Login failed',
      );
    }
  },
);

export const registerThunk = createAsyncThunk(
  'auth/register',
  async (
    credentials: { name: string; email: string; password: string },
    { rejectWithValue },
  ) => {
    try {
      const data = await authApi.register(credentials);
      await tokenStorage.saveTokens(data.accessToken, data.refreshToken);
      return data;
    } catch (error: any) {
      return rejectWithValue(
        error?.response?.data?.message ?? error?.message ?? 'Registration failed',
      );
    }
  },
);

export const logoutThunk = createAsyncThunk('auth/logout', async (_, { rejectWithValue }) => {
  try {
    await authApi.logout();
    await tokenStorage.clearTokens();
  } catch (error: any) {
    // Still clear local tokens even if server call fails
    await tokenStorage.clearTokens();
    return rejectWithValue(error?.message ?? 'Logout failed');
  }
});

export const refreshThunk = createAsyncThunk('auth/refresh', async (_, { rejectWithValue }) => {
  try {
    const storedRefresh = await tokenStorage.getRefreshToken();
    if (!storedRefresh) throw new Error('No refresh token stored');
    const data = await authApi.refresh(storedRefresh);
    await tokenStorage.saveTokens(data.accessToken, data.refreshToken);
    return data;
  } catch (error: any) {
    await tokenStorage.clearTokens();
    return rejectWithValue(
      error?.response?.data?.message ?? error?.message ?? 'Token refresh failed',
    );
  }
});

export const hydrateAuthThunk = createAsyncThunk(
  'auth/hydrate',
  async (_, { rejectWithValue }) => {
    try {
      const [accessToken, refreshToken] = await Promise.all([
        tokenStorage.getAccessToken(),
        tokenStorage.getRefreshToken(),
      ]);
      if (!accessToken || !refreshToken) throw new Error('No tokens');
      return { accessToken, refreshToken };
    } catch (error: any) {
      return rejectWithValue('No persisted session');
    }
  },
);

// ─── Slice ────────────────────────────────────────────────────────────────────

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    clearError(state) {
      state.error = null;
    },
    setTokens(state, action: PayloadAction<{ accessToken: string; refreshToken: string }>) {
      state.accessToken = action.payload.accessToken;
      state.refreshToken = action.payload.refreshToken;
      state.isAuthenticated = true;
    },
  },
  extraReducers: (builder) => {
    // LOGIN
    builder
      .addCase(loginThunk.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(loginThunk.fulfilled, (state, action) => {
        state.isLoading = false;
        state.user = action.payload.user as AuthUser;
        state.accessToken = action.payload.accessToken;
        state.refreshToken = action.payload.refreshToken;
        state.isAuthenticated = true;
        state.error = null;
      })
      .addCase(loginThunk.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
        state.isAuthenticated = false;
      });

    // REGISTER
    builder
      .addCase(registerThunk.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(registerThunk.fulfilled, (state, action) => {
        state.isLoading = false;
        state.user = action.payload.user as AuthUser;
        state.accessToken = action.payload.accessToken;
        state.refreshToken = action.payload.refreshToken;
        state.isAuthenticated = true;
        state.error = null;
      })
      .addCase(registerThunk.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
        state.isAuthenticated = false;
      });

    // LOGOUT
    builder
      .addCase(logoutThunk.fulfilled, (state) => {
        return { ...initialState };
      })
      .addCase(logoutThunk.rejected, (state) => {
        // Still clear state even if server call failed
        return { ...initialState };
      });

    // REFRESH
    builder
      .addCase(refreshThunk.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(refreshThunk.fulfilled, (state, action) => {
        state.isLoading = false;
        state.accessToken = action.payload.accessToken;
        state.refreshToken = action.payload.refreshToken;
        state.isAuthenticated = true;
      })
      .addCase(refreshThunk.rejected, (state) => {
        state.isLoading = false;
        state.isAuthenticated = false;
        state.user = null;
        state.accessToken = null;
        state.refreshToken = null;
      });

    // HYDRATE
    builder
      .addCase(hydrateAuthThunk.fulfilled, (state, action) => {
        state.accessToken = action.payload.accessToken;
        state.refreshToken = action.payload.refreshToken;
        state.isAuthenticated = true;
      })
      .addCase(hydrateAuthThunk.rejected, (state) => {
        state.isAuthenticated = false;
      });
  },
});

export const { clearError, setTokens } = authSlice.actions;
export default authSlice.reducer;
