/**
 * Navegación principal de la app.
 * Stack: ItemList → ItemForm
 * Deep-linking: app://items/:id
 */
import React from 'react';
import { NavigationContainer, LinkingOptions } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import ItemListScreen from '../screens/ItemListScreen';
import ItemFormScreen from '../screens/ItemFormScreen';

export type RootStackParamList = {
  ItemList: undefined;
  ItemForm: { item?: import('../offline/schema').ItemRow } | undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

// ── Deep-linking ──────────────────────────────────────────────────────────────
const linking: LinkingOptions<RootStackParamList> = {
  prefixes: ['app://', 'https://myapp.example.com'],
  config: {
    screens: {
      ItemList: 'items',
      ItemForm: 'items/:id',
    },
  },
};

export default function AppNavigator() {
  return (
    <NavigationContainer linking={linking}>
      <Stack.Navigator initialRouteName="ItemList">
        <Stack.Screen
          name="ItemList"
          component={ItemListScreen}
          options={{ title: 'Mis items' }}
        />
        <Stack.Screen
          name="ItemForm"
          component={ItemFormScreen}
          options={{ title: 'Item' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
