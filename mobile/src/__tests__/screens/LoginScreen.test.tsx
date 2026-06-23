import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { Provider } from 'react-redux';
import { NavigationContainer } from '@react-navigation/native';
import { configureStore } from '@reduxjs/toolkit';
import { LoginScreen } from '../../screens/auth/LoginScreen';
import authReducer, { loginThunk } from '../../store/slices/authSlice';

// Mock navigation
const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({ navigate: mockNavigate }),
}));

// Mock useAuth hook
const mockLogin = jest.fn();
jest.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({
    login: mockLogin,
    isLoading: false,
    error: null,
    isAuthenticated: false,
  }),
}));

const renderWithProviders = (ui: React.ReactElement) => {
  const store = configureStore({ reducer: { auth: authReducer } });
  return render(
    <Provider store={store}>
      <NavigationContainer>{ui}</NavigationContainer>
    </Provider>,
  );
};

describe('LoginScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('TC-UI-L01: renders email and password inputs', () => {
    const { getByTestId } = renderWithProviders(<LoginScreen />);
    expect(getByTestId('login-email-input')).toBeTruthy();
    expect(getByTestId('login-password-input')).toBeTruthy();
    expect(getByTestId('login-submit-button')).toBeTruthy();
  });

  it('TC-UI-L02: shows validation errors when submitting empty form', async () => {
    const { getByTestId, getByText } = renderWithProviders(<LoginScreen />);

    fireEvent.press(getByTestId('login-submit-button'));

    await waitFor(() => {
      expect(getByText('Email is required')).toBeTruthy();
      expect(getByText('Password is required')).toBeTruthy();
    });

    expect(mockLogin).not.toHaveBeenCalled();
  });

  it('TC-UI-L03: shows error for invalid email format', async () => {
    const { getByTestId, getByText } = renderWithProviders(<LoginScreen />);

    fireEvent.changeText(getByTestId('login-email-input'), 'not-valid');
    fireEvent.press(getByTestId('login-submit-button'));

    await waitFor(() => {
      expect(getByText('Enter a valid email address')).toBeTruthy();
    });
  });

  it('TC-UI-L04: shows error for short password', async () => {
    const { getByTestId, getByText } = renderWithProviders(<LoginScreen />);

    fireEvent.changeText(getByTestId('login-email-input'), 'user@example.com');
    fireEvent.changeText(getByTestId('login-password-input'), 'short');
    fireEvent.press(getByTestId('login-submit-button'));

    await waitFor(() => {
      expect(getByText('Password must be at least 8 characters')).toBeTruthy();
    });
  });

  it('TC-UI-L05: calls login with correct credentials on valid form', async () => {
    mockLogin.mockResolvedValue(undefined);
    const { getByTestId } = renderWithProviders(<LoginScreen />);

    fireEvent.changeText(getByTestId('login-email-input'), 'user@example.com');
    fireEvent.changeText(getByTestId('login-password-input'), 'ValidPass1!');

    await act(async () => {
      fireEvent.press(getByTestId('login-submit-button'));
    });

    expect(mockLogin).toHaveBeenCalledWith({
      email: 'user@example.com',
      password: 'ValidPass1!',
    });
  });

  it('TC-UI-L06: navigates to Register screen', () => {
    const { getByText } = renderWithProviders(<LoginScreen />);
    fireEvent.press(getByText('Sign Up'));
    expect(mockNavigate).toHaveBeenCalledWith('Register');
  });
});
