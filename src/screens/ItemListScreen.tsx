/**
 * Pantalla principal: lista de items con soporte offline.
 */
import React, { useLayoutEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useOfflineItems } from '../offline/useOfflineItems';
import { ItemRow } from '../offline/schema';

export default function ItemListScreen() {
  const navigation = useNavigation<any>();
  const { items, loading, error, refresh, removeItem } = useOfflineItems();

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => navigation.navigate('ItemForm')}
          accessibilityLabel="Añadir item"
        >
          <Text style={styles.addBtnText}>＋</Text>
        </TouchableOpacity>
      ),
    });
  }, [navigation]);

  const confirmDelete = (item: ItemRow) => {
    Alert.alert(
      'Eliminar',
      `¿Eliminar "${item.title}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => removeItem(item.id),
        },
      ]
    );
  };

  if (loading && items.length === 0) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <FlatList
        data={items}
        keyExtractor={(i) => i.id}
        onRefresh={refresh}
        refreshing={loading}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.row}
            onPress={() => navigation.navigate('ItemForm', { item })}
            onLongPress={() => confirmDelete(item)}
          >
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.subtitle} numberOfLines={1}>
              {item.body}
            </Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.centered}>
            <Text>Sin items. Pulsa ＋ para crear uno.</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container:  { flex: 1, backgroundColor: '#fff' },
  centered:   { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  error:      { color: 'red', padding: 12 },
  row:        { padding: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: '#ccc' },
  title:      { fontSize: 16, fontWeight: '600' },
  subtitle:   { fontSize: 13, color: '#666', marginTop: 4 },
  addBtn:     { marginRight: 12 },
  addBtnText: { fontSize: 24, color: '#007AFF' },
});
