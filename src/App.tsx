/**
 * App.tsx — Punto de entrada de la aplicación.
 */
import React from 'react';
import { AuthProvider } from './auth/AuthContext';
import RootNavigator from './navigation/RootNavigator';

export default function App() {
  return (
    <AuthProvider>
      <RootNavigator />
    </AuthProvider>
  );
}
