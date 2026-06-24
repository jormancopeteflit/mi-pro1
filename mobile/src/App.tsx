/**
 * Root application component.
 * Initialises push notifications and sync engine after authentication.
 */
import React, { useEffect } from 'react';
import { SafeAreaView, Text, StyleSheet } from 'react-native';
import {
  initialisePushNotifications,
  tearDownPushNotifications,
} from './services/pushNotifications';
import { syncEngine } from './services/syncEngine';

export default function App(): React.JSX.Element {
  useEffect(() => {
    // Start sync engine (listens for network changes)
    syncEngine.start();

    // Initialise push notifications (runs after user is authenticated)
    initialisePushNotifications().catch((err) =>
      console.error('[App] Push init error:', err),
    );

    return () => {
      // Clean up on unmount / logout
      syncEngine.stop();
      tearDownPushNotifications().catch(() => {});
    };
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>App running</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 20 },
});
