/**
 * Unit tests for LoginScreen
 * Run: npx jest src/screens/__tests__/LoginScreen.test.tsx
 */
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import LoginScreen from '../LoginScreen';
import { useAuthStore } from '../../store/authStore';

jest.mock('../../store/authStore');

const mockLogin = jest.fn();
const mockNavigation = { navigate: jest.fn() };

beforeEach(() => {
  jest.clearAllMocks();
  (useAuthStore as unknown as jest.Mock).mockReturnValue({
    login: mockLogin,
    isLoading: false,
    error: null,
  });
});

describe('LoginScreen', () => {
  it('TC-UI-L01 – renders email, password fields and submit button', () => {
    const { getByTestId } = render(<LoginScreen navigation={mockNavigation} />);
    expect(getByTestId('login-email-input')).toBeTruthy();
    expect(getByTestId('login-password-input')).toBeTruthy();
    expect(getByTestId('login-submit-button')).toBeTruthy();
  });

  it('TC-UI-L02 – shows validation errors for empty submit', async () => {
    const { getByTestId, getByText } = render(<LoginScreen navigation={mockNavigation} />);
    fireEvent.press(getByTestId('login-submit-button'));
    await waitFor(() => {
      expect(getByText('Enter a valid email address.')).toBeTruthy();
      expect(getByText('Password is required.')).toBeTruthy();
    });
    expect(mockLogin).not.toHaveBeenCalled();
  });

  it('TC-UI-L03 – calls login with correct payload on valid submit', async () => {
    mockLogin.mockResolvedValueOnce(undefined);
    const { getByTestId } = render(<LoginScreen navigation={mockNavigation} />);
    fireEvent.changeText(getByTestId('login-email-input'), 'jane@test.com');
    fireEvent.changeText(getByTestId('login-password-input'), 'Password1!');
    fireEvent.press(getByTestId('login-submit-button'));
    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith({
        email: 'jane@test.com',
        password: 'Password1!',
      });
    });
  });

  it('TC-UI-L04 – navigates to Register when link is pressed', () => {
    const { getByTestId } = render(<LoginScreen navigation={mockNavigation} />);
    fireEvent.press(getByTestId('go-to-register'));
    expect(mockNavigation.navigate).toHaveBeenCalledWith('Register');
  });

  it('TC-UI-L05 – disables button while loading', () => {
    (useAuthStore as unknown as jest.Mock).mockReturnValue({
      login: mockLogin,
      isLoading: true,
      error: null,
    });
    const { getByTestId } = render(<LoginScreen navigation={mockNavigation} />);
    const btn = getByTestId('login-submit-button');
    // Button should exist but be disabled
    expect(btn.props.accessibilityState?.disabled).toBe(true);
  });
});
