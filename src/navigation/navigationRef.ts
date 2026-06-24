/**
 * Global navigation ref used for deep-linking from push notifications
 * without requiring a component reference.
 */
import { createNavigationContainerRef } from '@react-navigation/native';

export const navigationRef = createNavigationContainerRef();
