/**
 * Inicialización y helpers de la base de datos SQLite local.
 * Usa expo-sqlite (API síncrona/async v2).
 */
import * as SQLite from 'expo-sqlite';
import { CREATE_TABLES_SQL, SCHEMA_VERSION } from './schema';

let _db: SQLite.SQLiteDatabase | null = null;

export async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (_db) return _db;
  _db = await SQLite.openDatabaseAsync('offline.db');
  await migrate(_db);
  return _db;
}

async function migrate(db: SQLite.SQLiteDatabase): Promise<void> {
  await db.execAsync('PRAGMA journal_mode = WAL;');
  await db.execAsync('PRAGMA foreign_keys = ON;');

  for (const sql of CREATE_TABLES_SQL) {
    await db.execAsync(sql);
  }

  const meta = await db.getFirstAsync<{ version: number }>(
    'SELECT version FROM schema_meta WHERE id = 1'
  );

  const currentVersion = meta?.version ?? 0;

  if (currentVersion < SCHEMA_VERSION) {
    // Aquí irían las migraciones incrementales en el futuro
    await db.runAsync(
      'INSERT OR REPLACE INTO schema_meta (id, version) VALUES (1, ?)',
      [SCHEMA_VERSION]
    );
  }
}

/** Cierra la conexión (útil en tests). */
export async function closeDb(): Promise<void> {
  if (_db) {
    await _db.closeAsync();
    _db = null;
  }
}
