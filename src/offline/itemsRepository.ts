/**
 * Repositorio offline para la entidad "items".
 * Toda escritura encola una operación de sync.
 */
import { v4 as uuidv4 } from 'uuid';
import { getDb } from './database';
import { ItemRow, SyncQueueRow } from './schema';

// ─── Lectura ─────────────────────────────────────────────────────────────────

export async function getAllItems(): Promise<ItemRow[]> {
  const db = await getDb();
  return db.getAllAsync<ItemRow>(
    'SELECT * FROM items WHERE is_deleted = 0 ORDER BY updated_at DESC'
  );
}

export async function getItemById(id: string): Promise<ItemRow | null> {
  const db = await getDb();
  return db.getFirstAsync<ItemRow>(
    'SELECT * FROM items WHERE id = ? AND is_deleted = 0',
    [id]
  );
}

// ─── Escritura local + enqueue ────────────────────────────────────────────────

export async function createItem(
  data: Pick<ItemRow, 'title' | 'body' | 'owner_id'>
): Promise<ItemRow> {
  const db = await getDb();
  const now = Date.now();
  const id = uuidv4();

  await db.runAsync(
    `INSERT INTO items (id, title, body, owner_id, created_at, updated_at, server_updated_at, is_deleted)
     VALUES (?, ?, ?, ?, ?, ?, NULL, 0)`,
    [id, data.title, data.body, data.owner_id, now, now]
  );

  await enqueueSyncOperation('CREATE', 'items', id, { id, ...data, created_at: now, updated_at: now });

  return { id, ...data, created_at: now, updated_at: now, server_updated_at: null, is_deleted: 0 };
}

export async function updateItem(
  id: string,
  data: Partial<Pick<ItemRow, 'title' | 'body'>>
): Promise<void> {
  const db = await getDb();
  const now = Date.now();

  const fields: string[] = [];
  const values: (string | number)[] = [];

  if (data.title !== undefined) { fields.push('title = ?'); values.push(data.title); }
  if (data.body  !== undefined) { fields.push('body = ?');  values.push(data.body); }
  fields.push('updated_at = ?');
  values.push(now);
  values.push(id);

  await db.runAsync(
    `UPDATE items SET ${fields.join(', ')} WHERE id = ?`,
    values as SQLiteBindValue[]
  );

  await enqueueSyncOperation('UPDATE', 'items', id, { id, ...data, updated_at: now });
}

export async function deleteItem(id: string): Promise<void> {
  const db = await getDb();
  const now = Date.now();

  await db.runAsync(
    'UPDATE items SET is_deleted = 1, updated_at = ? WHERE id = ?',
    [now, id]
  );

  await enqueueSyncOperation('DELETE', 'items', id, { id });
}

// ─── Cola de sincronización ───────────────────────────────────────────────────

export async function enqueueSyncOperation(
  operation: SyncQueueRow['operation'],
  entityType: string,
  entityId: string,
  payload: object
): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO sync_queue (operation, entity_type, entity_id, payload, created_at, retry_count)
     VALUES (?, ?, ?, ?, ?, 0)`,
    [operation, entityType, entityId, JSON.stringify(payload), Date.now()]
  );
}

export async function getPendingSyncOperations(): Promise<SyncQueueRow[]> {
  const db = await getDb();
  return db.getAllAsync<SyncQueueRow>(
    'SELECT * FROM sync_queue ORDER BY queue_id ASC'
  );
}

export async function removeSyncOperation(queueId: number): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM sync_queue WHERE queue_id = ?', [queueId]);
}

export async function incrementRetry(queueId: number, error: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'UPDATE sync_queue SET retry_count = retry_count + 1, last_error = ? WHERE queue_id = ?',
    [error, queueId]
  );
}

/**
 * Aplica un ítem recibido del servidor (resolución Server-Wins / LWW).
 * Si server_updated_at del servidor es mayor que el local → el servidor gana.
 */
export async function applyServerItem(serverItem: ItemRow): Promise<void> {
  const db = await getDb();
  const local = await db.getFirstAsync<ItemRow>(
    'SELECT * FROM items WHERE id = ?',
    [serverItem.id]
  );

  if (!local) {
    // Registro nuevo desde servidor
    await db.runAsync(
      `INSERT INTO items (id, title, body, owner_id, created_at, updated_at, server_updated_at, is_deleted)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        serverItem.id,
        serverItem.title,
        serverItem.body,
        serverItem.owner_id,
        serverItem.created_at,
        serverItem.updated_at,
        serverItem.server_updated_at ?? serverItem.updated_at,
        serverItem.is_deleted,
      ]
    );
    return;
  }

  // LWW: gana quien tenga updated_at más reciente
  const serverTs = serverItem.server_updated_at ?? serverItem.updated_at;
  const localTs  = local.updated_at;

  if (serverTs >= localTs) {
    // Server-Wins
    await db.runAsync(
      `UPDATE items
         SET title = ?, body = ?, updated_at = ?, server_updated_at = ?, is_deleted = ?
       WHERE id = ?`,
      [
        serverItem.title,
        serverItem.body,
        serverItem.updated_at,
        serverTs,
        serverItem.is_deleted,
        serverItem.id,
      ]
    );
  }
  // Si local es más reciente, se preserva el dato local (Client-Wins de facto)
  // y se volverá a intentar en el siguiente ciclo de sync.
}

// Re-export de tipo para evitar imports cruzados
type SQLiteBindValue = string | number | null | boolean;
