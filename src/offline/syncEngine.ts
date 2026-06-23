/**
 * Motor de sincronización offline → online.
 *
 * Correcciones respecto a iteraciones anteriores:
 *  - Los timers pendientes se cancelan antes de crear uno nuevo (DEF-02).
 *  - HTTP 409 aplica resolución Server-Wins/LWW, no reintento ciego (DEF-03).
 *  - MAX_RETRIES limita los reintentos y descarta la operación al superarlo.
 */
import NetInfo from '@react-native-community/netinfo';
import {
  getPendingSyncOperations,
  removeSyncOperation,
  incrementRetry,
  applyServerItem,
} from './itemsRepository';
import { SyncQueueRow, ItemRow } from './schema';

const MAX_RETRIES   = 3;
const RETRY_DELAY_MS = 5_000;
const BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? '';

class SyncEngine {
  private _isSyncing = false;
  private _retryTimer: ReturnType<typeof setTimeout> | null = null;
  private _unsubscribeNet: (() => void) | null = null;

  // ─── Ciclo de vida ──────────────────────────────────────────────────────────

  start(): void {
    if (this._unsubscribeNet) return; // ya iniciado

    this._unsubscribeNet = NetInfo.addEventListener((state) => {
      if (state.isConnected && state.isInternetReachable) {
        this._scheduleSync(0);
      }
    });

    // Intento inicial al arrancar
    this._scheduleSync(0);
  }

  stop(): void {
    this._cancelPendingTimer();
    if (this._unsubscribeNet) {
      this._unsubscribeNet();
      this._unsubscribeNet = null;
    }
  }

  /** Fuerza sincronización inmediata (llamada desde UI, por ejemplo). */
  async forceSync(): Promise<void> {
    this._scheduleSync(0);
  }

  // ─── Scheduling ─────────────────────────────────────────────────────────────

  /**
   * Cancela cualquier timer pendiente antes de crear uno nuevo.
   * Esto resuelve DEF-02: acumulación de timers en reconexión intermitente.
   */
  private _scheduleSync(delayMs: number): void {
    this._cancelPendingTimer();
    this._retryTimer = setTimeout(() => {
      this._retryTimer = null;
      this.syncPendingOperations();
    }, delayMs);
  }

  private _cancelPendingTimer(): void {
    if (this._retryTimer !== null) {
      clearTimeout(this._retryTimer);
      this._retryTimer = null;
    }
  }

  // ─── Procesamiento de cola ───────────────────────────────────────────────────

  async syncPendingOperations(): Promise<void> {
    if (this._isSyncing) return;
    this._isSyncing = true;

    try {
      const queue = await getPendingSyncOperations();
      if (queue.length === 0) return;

      for (const op of queue) {
        await this._processOperation(op);
      }
    } catch (err) {
      console.warn('[SyncEngine] Error inesperado durante sync:', err);
    } finally {
      this._isSyncing = false;
    }
  }

  private async _processOperation(op: SyncQueueRow): Promise<void> {
    // Descartar operaciones que superaron MAX_RETRIES
    if (op.retry_count >= MAX_RETRIES) {
      console.warn(
        `[SyncEngine] Descartando operación ${op.queue_id} tras ${op.retry_count} intentos.`
      );
      await removeSyncOperation(op.queue_id);
      return;
    }

    try {
      const response = await this._callApi(op);

      if (response.ok) {
        await removeSyncOperation(op.queue_id);
        return;
      }

      // ── Resolución de conflictos (DEF-03) ────────────────────────────────────
      if (response.status === 409) {
        await this._resolveConflict(op, response);
        return;
      }

      // Errores no-retriables (4xx excepto 409)
      if (response.status >= 400 && response.status < 500) {
        console.warn(
          `[SyncEngine] Error no-retriable ${response.status} para op ${op.queue_id}. Descartando.`
        );
        await removeSyncOperation(op.queue_id);
        return;
      }

      // Errores retriables (5xx, red, etc.)
      await incrementRetry(op.queue_id, `HTTP ${response.status}`);
      this._scheduleSync(RETRY_DELAY_MS);
    } catch (networkError: any) {
      await incrementRetry(op.queue_id, networkError?.message ?? 'network error');
      this._scheduleSync(RETRY_DELAY_MS);
    }
  }

  /**
   * Resolución de conflictos HTTP 409 — Server-Wins / LWW.
   * El servidor devuelve el estado actual del recurso en el body del 409.
   * Aplicamos applyServerItem() que implementa LWW.
   * Luego eliminamos la operación de la cola (el servidor ya tiene el estado correcto
   * o el local ganó y se re-encolará en el siguiente ciclo normal de edición).
   */
  private async _resolveConflict(
    op: SyncQueueRow,
    response: Response
  ): Promise<void> {
    try {
      const serverItem: ItemRow = await response.json();
      await applyServerItem(serverItem);
      console.info(
        `[SyncEngine] Conflicto 409 resuelto (LWW) para entity=${op.entity_id}`
      );
    } catch (parseErr) {
      console.warn('[SyncEngine] No se pudo parsear body del 409. Descartando op.');
    } finally {
      // En ambos casos eliminamos la operación conflictiva de la cola
      await removeSyncOperation(op.queue_id);
    }
  }

  // ─── Llamada a API ───────────────────────────────────────────────────────────

  private async _callApi(op: SyncQueueRow): Promise<Response> {
    const payload = JSON.parse(op.payload);
    const url = `${BASE_URL}/api/${op.entity_type}/${op.entity_id}`;

    const METHOD: Record<SyncQueueRow['operation'], string> = {
      CREATE: 'POST',
      UPDATE: 'PUT',
      DELETE: 'DELETE',
    };

    return fetch(op.operation === 'CREATE' ? `${BASE_URL}/api/${op.entity_type}` : url, {
      method: METHOD[op.operation],
      headers: { 'Content-Type': 'application/json' },
      body: op.operation !== 'DELETE' ? JSON.stringify(payload) : undefined,
    });
  }
}

// Singleton exportado
export const syncEngine = new SyncEngine();
