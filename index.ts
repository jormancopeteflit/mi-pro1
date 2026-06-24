/**
 * Application entry point.
 * Background message handler MUST be registered at module level,
 * before AppRegistry.registerComponent.
 */
import { AppRegistry } from 'react-native';
import { registerBackgroundMessageHandler } from './src/services/pushNotificationService';
import App from './src/App';
import { name as appName } from './app.json';

// Register FCM background handler (module level — required by Firebase)
registerBackgroundMessageHandler();

AppRegistry.registerComponent(appName, () => App);
