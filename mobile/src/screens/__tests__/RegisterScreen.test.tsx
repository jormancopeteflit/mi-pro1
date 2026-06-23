/**
 * Unit tests for RegisterScreen
 * Run: npx jest src/screens/__tests__/RegisterScreen.test.tsx
 */
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import RegisterScreen from '../RegisterScreen';
import { useAuthStore } from '../../store/authStore';

// Mock the store
jest.mock('../../store/authStore');

const mockRegister = jest.fn();
const mockNavigation = { navigate: jest.fn() };

beforeEach(() => {
  jest.clearAllMocks();
  (useAuthStore as unknown as jest.Mock).mockReturnValue({
    register: mockRegister,
    isLoading: false,
    error: null,
  });
});

describe('RegisterScreen', () => {
  it('TC-UI-R01 – renders all form fields', () => {
    const { getByTestId } = render(<RegisterScreen navigation={mockNavigation} />);
    expect(getByTestId('register-name-input')).toBeTruthy();
    expect(getByTestId('register-email-input')).toBeTruthy();
    expect(getByTestId('register-password-input')).toBeTruthy();
    expect(getByTestId('register-confirm-password-input')).toBeTruthy();
    expect(getByTestId('register-submit-button')).toBeTruthy();
  });

  it('TC-UI-R02 – shows field errors when submitted with empty fields', async () => {
    const { getByTestId, getByText } = render(<RegisterScreen navigation={mockNavigation} />);
    fireEvent.press(getByTestId('register-submit-button'));
    await waitFor(() => {
      expect(getByText('Name must be at least 2 characters.')).toBeTruthy();
      expect(getByText('Enter a valid email address.')).toBeTruthy();
      expect(getByText('Password must be at least 8 characters.')).toBeTruthy();
    });
    expect(mockRegister).not.toHaveBeenCalled();
  });

  it('TC-UI-R03 – shows error when passwords do not match', async () => {
    const { getByTestId, getByText } = render(<RegisterScreen navigation={mockNavigation} />);
    fireEvent.changeText(getByTestId('register-name-input'), 'Jane');
    fireEvent.changeText(getByTestId('register-email-input'), 'jane@test.com');
    fireEvent.changeText(getByTestId('register-password-input'), 'Password1!');
    fireEvent.changeText(getByTestId('register-confirm-password-input'), 'Different1!');
    fireEvent.press(getByTestId('register-submit-button'));
    await waitFor(() => {
      expect(getByText('Passwords do not match.')).toBeTruthy();
    });
    expect(mockRegister).not.toHaveBeenCalled();
  });

  it('TC-UI-R04 – calls register with correct data on valid submit', async () => {
    mockRegister.mockResolvedValueOnce(undefined);
    const { getByTestId } = render(<RegisterScreen navigation={mockNavigation} />);
    fireEvent.changeText(getByTestId('register-name-input'), 'Jane Doe');
    fireEvent.changeText(getByTestId('register-email-input'), 'jane@test.com');
    fireEvent.changeText(getByTestId('register-password-input'), 'Password1!');
    fireEvent.changeText(getByTestId('register-confirm-password-input'), 'Password1!');
    fireEvent.press(getByTestId('register-submit-button'));
    await waitFor(() => {
      expect(mockRegister).toHaveBeenCalledWith({
        name: 'Jane Doe',
        email: 'jane@test.com',
        password: 'Password1!',
      });
    });
  });

  it('TC-UI-R05 – navigates to Login when link is pressed', () => {
    const { getByTestId } = render(<RegisterScreen navigation={mockNavigation} />);
    fireEvent.press(getByTestId('go-to-login'));
    expect(mockNavigation.navigate).toHaveBeenCalledWith('Login');
  });
});
