/**
 * Root application component.
 * Wires up:
 *  - NavigationContainer with the global navigationRef
 *  - Push notification bootstrap via usePushNotifications
 *  - SyncEngine network listener
 */

import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { navigationRef } from './navigation/navigationRef';
import { usePushNotifications } from './hooks/usePushNotifications';
import { syncEngine } from './services/syncEngine';
import RootNavigator from './navigation/RootNavigator';

// Replace with real auth hook/store
function useCurrentUserId(): string | null {
  // TODO: wire up real auth state (e.g. from Redux / Context)
  return null;
}

export default function App() {
  const userId = useCurrentUserId();

  // Push notification lifecycle
  usePushNotifications(userId);

  // Sync engine: start/stop network listener with app lifecycle
  useEffect(() => {
    syncEngine.startNetworkListener();
    return () => {
      syncEngine.stopNetworkListener();
    };
  }, []);

  return (
    <NavigationContainer ref={navigationRef}>
      <RootNavigator />
    </NavigationContainer>
  );
}
