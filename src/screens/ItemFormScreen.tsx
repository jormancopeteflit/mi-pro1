/**
 * Pantalla de creación/edición de un item (funciona offline).
 */
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { useOfflineItems } from '../offline/useOfflineItems';
import { ItemRow } from '../offline/schema';

type RouteParams = { item?: ItemRow };

export default function ItemFormScreen() {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<{ ItemForm: RouteParams }, 'ItemForm'>>();
  const existingItem = route.params?.item;

  const { addItem, editItem } = useOfflineItems();

  const [title, setTitle] = useState(existingItem?.title ?? '');
  const [body,  setBody]  = useState(existingItem?.body  ?? '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    navigation.setOptions({
      title: existingItem ? 'Editar item' : 'Nuevo item',
    });
  }, [navigation, existingItem]);

  const handleSave = async () => {
    if (!title.trim()) {
      Alert.alert('Validación', 'El título es obligatorio.');
      return;
    }
    setSaving(true);
    try {
      if (existingItem) {
        await editItem(existingItem.id, { title: title.trim(), body: body.trim() });
      } else {
        // owner_id vendría del contexto de autenticación;
        // usamos placeholder para que la demo funcione sin auth.
        await addItem({ title: title.trim(), body: body.trim(), owner_id: 'local-user' });
      }
      navigation.goBack();
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'No se pudo guardar.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Text style={styles.label}>Título *</Text>
      <TextInput
        style={styles.input}
        value={title}
        onChangeText={setTitle}
        placeholder="Escribe un título"
        returnKeyType="next"
        accessibilityLabel="Título"
      />

      <Text style={styles.label}>Descripción</Text>
      <TextInput
        style={[styles.input, styles.textArea]}
        value={body}
        onChangeText={setBody}
        placeholder="Descripción opcional"
        multiline
        accessibilityLabel="Descripción"
      />

      <TouchableOpacity
        style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
        onPress={handleSave}
        disabled={saving}
        accessibilityLabel="Guardar"
      >
        {saving
          ? <ActivityIndicator color="#fff" />
          : <Text style={styles.saveBtnText}>Guardar</Text>
        }
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container:      { flex: 1, padding: 20, backgroundColor: '#fff' },
  label:          { fontSize: 14, fontWeight: '600', marginBottom: 4, marginTop: 16 },
  input:          { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 10, fontSize: 16 },
  textArea:       { height: 100, textAlignVertical: 'top' },
  saveBtn:        { marginTop: 32, backgroundColor: '#007AFF', borderRadius: 8, padding: 14, alignItems: 'center' },
  saveBtnDisabled:{ opacity: 0.6 },
  saveBtnText:    { color: '#fff', fontSize: 16, fontWeight: '600' },
});
