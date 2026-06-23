/**
 * Hook React para lectura/escritura offline de items.
 * Expone estado reactivo y operaciones CRUD que funcionan sin red.
 */
import { useState, useEffect, useCallback } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import {
  getAllItems,
  createItem,
  updateItem,
  deleteItem,
} from './itemsRepository';
import { syncEngine } from './syncEngine';
import { ItemRow } from './schema';

export interface UseOfflineItemsReturn {
  items: ItemRow[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  addItem: (data: Pick<ItemRow, 'title' | 'body' | 'owner_id'>) => Promise<void>;
  editItem: (id: string, data: Partial<Pick<ItemRow, 'title' | 'body'>>) => Promise<void>;
  removeItem: (id: string) => Promise<void>;
}

export function useOfflineItems(): UseOfflineItemsReturn {
  const [items, setItems]   = useState<ItemRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getAllItems();
      setItems(data);
    } catch (e: any) {
      setError(e?.message ?? 'Error al leer datos locales');
    } finally {
      setLoading(false);
    }
  }, []);

  // Recarga cuando la app vuelve al primer plano
  useEffect(() => {
    refresh();

    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') refresh();
    });

    return () => sub.remove();
  }, [refresh]);

  const addItem = useCallback(
    async (data: Pick<ItemRow, 'title' | 'body' | 'owner_id'>) => {
      await createItem(data);
      await refresh();
      syncEngine.forceSync();
    },
    [refresh]
  );

  const editItem = useCallback(
    async (id: string, data: Partial<Pick<ItemRow, 'title' | 'body'>>) => {
      await updateItem(id, data);
      await refresh();
      syncEngine.forceSync();
    },
    [refresh]
  );

  const removeItem = useCallback(
    async (id: string) => {
      await deleteItem(id);
      await refresh();
      syncEngine.forceSync();
    },
    [refresh]
  );

  return { items, loading, error, refresh, addItem, editItem, removeItem };
}
