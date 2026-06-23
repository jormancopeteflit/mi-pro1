/**
 * Punto de entrada de la aplicación React Native.
 * Inicializa sincronización offline y push notifications.
 */
import React, { useEffect } from 'react';
import { syncEngine } from './offline/syncEngine';
import {
  createDefaultNotificationChannel,
  setBackgroundMessageHandler,
} from './notifications/pushService';
import AppNavigator from './navigation/AppNavigator';

// Configurar handler de background ANTES de que React monte el árbol.
setBackgroundMessageHandler();

export default function App() {
  useEffect(() => {
    // Iniciar motor de sincronización
    syncEngine.start();

    // Canal de notificaciones Android
    createDefaultNotificationChannel();

    return () => {
      syncEngine.stop();
    };
  }, []);

  return <AppNavigator />;
}
