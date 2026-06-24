/**
 * App entry point.
 * Background push handler MUST be registered before AppRegistry.
 */
import { AppRegistry } from 'react-native';
import { registerBackgroundHandler } from './src/services/pushNotifications';
import App from './src/App';
import { name as appName } from './app.json';

// Register FCM background handler at top level (required by Firebase)
registerBackgroundHandler();

AppRegistry.registerComponent(appName, () => App);
