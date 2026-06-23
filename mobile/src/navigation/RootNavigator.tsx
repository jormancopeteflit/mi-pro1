import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { useAuthStore } from '../store/authStore';
import { AuthNavigator } from './AuthNavigator';

/**
 * Root navigator: switches between Auth and App stacks based on auth state.
 * Extend by adding an AppNavigator when authenticated routes are built.
 */
export const RootNavigator: React.FC = () => {
  const user = useAuthStore((s) => s.user);

  return (
    <NavigationContainer>
      {user ? (
        // Placeholder: replace with <AppNavigator /> when app screens are ready
        <AuthNavigator />
      ) : (
        <AuthNavigator />
      )}
    </NavigationContainer>
  );
};
