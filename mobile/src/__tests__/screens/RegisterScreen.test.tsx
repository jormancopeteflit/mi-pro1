import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { Provider } from 'react-redux';
import { NavigationContainer } from '@react-navigation/native';
import { configureStore } from '@reduxjs/toolkit';
import { RegisterScreen } from '../../screens/auth/RegisterScreen';
import authReducer from '../../store/slices/authSlice';

const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({ navigate: mockNavigate }),
}));

const mockRegister = jest.fn();
jest.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({
    register: mockRegister,
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

describe('RegisterScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('TC-UI-R01: renders all input fields', () => {
    const { getByTestId } = renderWithProviders(<RegisterScreen />);
    expect(getByTestId('register-name-input')).toBeTruthy();
    expect(getByTestId('register-email-input')).toBeTruthy();
    expect(getByTestId('register-password-input')).toBeTruthy();
    expect(getByTestId('register-confirm-password-input')).toBeTruthy();
    expect(getByTestId('register-submit-button')).toBeTruthy();
  });

  it('TC-UI-R02: shows validation errors on empty submit', async () => {
    const { getByTestId, getByText } = renderWithProviders(<RegisterScreen />);

    fireEvent.press(getByTestId('register-submit-button'));

    await waitFor(() => {
      expect(getByText('Name must be at least 2 characters')).toBeTruthy();
      expect(getByText('Email is required')).toBeTruthy();
      expect(getByText('Password is required')).toBeTruthy();
    });

    expect(mockRegister).not.toHaveBeenCalled();
  });

  it('TC-UI-R03: shows error when passwords do not match', async () => {
    const { getByTestId, getByText } = renderWithProviders(<RegisterScreen />);

    fireEvent.changeText(getByTestId('register-name-input'), 'John Doe');
    fireEvent.changeText(getByTestId('register-email-input'), 'john@example.com');
    fireEvent.changeText(getByTestId('register-password-input'), 'ValidPass1!');
    fireEvent.changeText(getByTestId('register-confirm-password-input'), 'DifferentPass1!');
    fireEvent.press(getByTestId('register-submit-button'));

    await waitFor(() => {
      expect(getByText('Passwords do not match')).toBeTruthy();
    });
  });

  it('TC-UI-R04: shows error for weak password (no uppercase)', async () => {
    const { getByTestId, getByText } = renderWithProviders(<RegisterScreen />);

    fireEvent.changeText(getByTestId('register-name-input'), 'John Doe');
    fireEvent.changeText(getByTestId('register-email-input'), 'john@example.com');
    fireEvent.changeText(getByTestId('register-password-input'), 'weakpassword1');
    fireEvent.changeText(getByTestId('register-confirm-password-input'), 'weakpassword1');
    fireEvent.press(getByTestId('register-submit-button'));

    await waitFor(() => {
      expect(getByText('Password must contain uppercase, lowercase and a number')).toBeTruthy();
    });
  });

  it('TC-UI-R05: calls register with correct payload on valid form', async () => {
    mockRegister.mockResolvedValue(undefined);
    const { getByTestId } = renderWithProviders(<RegisterScreen />);

    fireEvent.changeText(getByTestId('register-name-input'), 'John Doe');
    fireEvent.changeText(getByTestId('register-email-input'), 'john@example.com');
    fireEvent.changeText(getByTestId('register-password-input'), 'ValidPass1!');
    fireEvent.changeText(getByTestId('register-confirm-password-input'), 'ValidPass1!');

    await act(async () => {
      fireEvent.press(getByTestId('register-submit-button'));
    });

    expect(mockRegister).toHaveBeenCalledWith({
      name: 'John Doe',
      email: 'john@example.com',
      password: 'ValidPass1!',
    });
  });

  it('TC-UI-R06: navigates to Login screen', () => {
    const { getByText } = renderWithProviders(<RegisterScreen />);
    fireEvent.press(getByText('Sign In'));
    expect(mockNavigate).toHaveBeenCalledWith('Login');
  });
});
