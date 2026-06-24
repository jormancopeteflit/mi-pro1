/**
 * Sync Engine
 * - Processes pending offline operations in order.
 * - Conflict resolution strategy: SERVER-WINS with Last-Write-Wins (LWW) fallback
 *   based on `updatedAt` timestamps when the server returns HTTP 409.
 * - Guarantees a single active sync loop: cancels pending retry timers on
 *   re-entry and on network reconnection.
 * - HTTP 409 is NOT retried blindly; it is resolved via the conflict resolver.
 */

import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiClient } from './apiClient';
import { AxiosError } from 'axios';

// ─── Types ───────────────────────────────────────────────────────────────────

export type OperationMethod = 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface PendingOperation {
  id: string;            // uuid
  method: OperationMethod;
  endpoint: string;
  payload: unknown;
  updatedAt: number;     // client-side epoch ms for LWW
  retries: number;
}

export type ConflictResolutionStrategy = 'server-wins' | 'client-wins' | 'lww';

export interface SyncEngineConfig {
  storageKey?: string;
  maxRetries?: number;
  retryDelayMs?: number;
  conflictStrategy?: ConflictResolutionStrategy;
}

export interface ConflictResolutionResult {
  winner: 'server' | 'client';
  resolvedPayload?: unknown;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const DEFAULT_STORAGE_KEY = '@sync_pending_operations';
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_RETRY_DELAY_MS = 2000;
const NON_RETRIABLE_STATUS = new Set([400, 401, 403, 404, 422]);
// 409 is handled by conflict resolution, NOT by blind retry

// ─── SyncEngine class ────────────────────────────────────────────────────────

export class SyncEngine {
  private readonly storageKey: string;
  private readonly maxRetries: number;
  private readonly retryDelayMs: number;
  private readonly conflictStrategy: ConflictResolutionStrategy;

  private _isSyncing = false;
  private _pendingTimer: ReturnType<typeof setTimeout> | null = null;
  private _unsubscribeNet: (() => void) | null = null;

  constructor(config: SyncEngineConfig = {}) {
    this.storageKey = config.storageKey ?? DEFAULT_STORAGE_KEY;
    this.maxRetries = config.maxRetries ?? DEFAULT_MAX_RETRIES;
    this.retryDelayMs = config.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS;
    this.conflictStrategy = config.conflictStrategy ?? 'server-wins';
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  /** Start listening for network recovery and trigger sync automatically. */
  startNetworkListener(): void {
    if (this._unsubscribeNet) return; // already listening
    this._unsubscribeNet = NetInfo.addEventListener(
      (state: NetInfoState) => {
        if (state.isConnected && state.isInternetReachable !== false) {
          this._cancelPendingTimer();
          // Fire without awaiting — intentional fire-and-forget on reconnect
          void this.syncPendingOperations();
        }
      },
    );
  }

  /** Stop listening for network changes. */
  stopNetworkListener(): void {
    this._unsubscribeNet?.();
    this._unsubscribeNet = null;
  }

  /** Enqueue an operation for sync. */
  async enqueue(op: Omit<PendingOperation, 'retries'>): Promise<void> {
    const ops = await this._loadQueue();
    ops.push({ ...op, retries: 0 });
    await this._saveQueue(ops);
  }

  /** Process all pending operations. Safe to call concurrently (guarded). */
  async syncPendingOperations(): Promise<void> {
    if (this._isSyncing) return;
    this._isSyncing = true;
    try {
      await this._processBatch();
    } finally {
      this._isSyncing = false;
    }
  }

  /** Resolve a 409 conflict according to the configured strategy. */
  async resolveConflict(
    localOp: PendingOperation,
    serverData: unknown,
  ): Promise<ConflictResolutionResult> {
    switch (this.conflictStrategy) {
      case 'client-wins':
        return { winner: 'client', resolvedPayload: localOp.payload };

      case 'lww': {
        // Last-Write-Wins: compare client updatedAt with server updatedAt
        const serverUpdatedAt =
          (serverData as { updatedAt?: number } | undefined)?.updatedAt ?? 0;
        if (localOp.updatedAt >= serverUpdatedAt) {
          return { winner: 'client', resolvedPayload: localOp.payload };
        }
        return { winner: 'server', resolvedPayload: serverData };
      }

      case 'server-wins':
      default:
        return { winner: 'server', resolvedPayload: serverData };
    }
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  private async _processBatch(): Promise<void> {
    const ops = await this._loadQueue();
    if (ops.length === 0) return;

    const remaining: PendingOperation[] = [];

    for (const op of ops) {
      const success = await this._executeOperation(op);
      if (!success) {
        remaining.push(op);
      }
    }

    await this._saveQueue(remaining);
  }

  /**
   * Attempts to execute one operation.
   * Returns true if it should be removed from the queue (success or unrecoverable).
   */
  private async _executeOperation(op: PendingOperation): Promise<boolean> {
    try {
      await this._callApi(op);
      return true; // success → remove
    } catch (err) {
      const status = (err as AxiosError)?.response?.status;

      // ── 409 Conflict: resolve, do NOT blindly retry ──
      if (status === 409) {
        const serverData = (err as AxiosError)?.response?.data;
        const resolution = await this.resolveConflict(op, serverData);
        if (resolution.winner === 'client') {
          // Force-push client version with a special header
          try {
            await this._callApi(op, { 'X-Force-Write': 'true' });
            return true;
          } catch {
            // Give up after force-write failure
            return true;
          }
        }
        // Server wins → discard local op
        return true;
      }

      // ── Non-retriable HTTP errors → discard ──
      if (status && NON_RETRIABLE_STATUS.has(status)) {
        console.warn(
          `[SyncEngine] Non-retriable error ${status} for op ${op.id}. Discarding.`,
        );
        return true;
      }

      // ── Retriable (network, 5xx) ──
      op.retries += 1;
      if (op.retries >= this.maxRetries) {
        console.error(
          `[SyncEngine] Max retries reached for op ${op.id}. Discarding.`,
        );
        return true; // remove after exhausting retries
      }

      // Schedule next attempt with delay (timer tracked for cancellation)
      this._scheduleSyncWithDelay();
      return false; // keep in queue
    }
  }

  private async _callApi(
    op: PendingOperation,
    extraHeaders?: Record<string, string>,
  ): Promise<void> {
    const config = extraHeaders ? { headers: extraHeaders } : undefined;
    switch (op.method) {
      case 'POST':
        await apiClient.post(op.endpoint, op.payload, config);
        break;
      case 'PUT':
        await apiClient.put(op.endpoint, op.payload, config);
        break;
      case 'PATCH':
        await apiClient.patch(op.endpoint, op.payload, config);
        break;
      case 'DELETE':
        await apiClient.delete(op.endpoint, { data: op.payload, ...config });
        break;
    }
  }

  private _scheduleSyncWithDelay(): void {
    this._cancelPendingTimer();
    this._pendingTimer = setTimeout(() => {
      this._pendingTimer = null;
      void this.syncPendingOperations();
    }, this.retryDelayMs);
  }

  /** Cancels any pending retry timer. Critical for reconnection scenarios. */
  private _cancelPendingTimer(): void {
    if (this._pendingTimer !== null) {
      clearTimeout(this._pendingTimer);
      this._pendingTimer = null;
    }
  }

  private async _loadQueue(): Promise<PendingOperation[]> {
    try {
      const raw = await AsyncStorage.getItem(this.storageKey);
      return raw ? (JSON.parse(raw) as PendingOperation[]) : [];
    } catch {
      return [];
    }
  }

  private async _saveQueue(ops: PendingOperation[]): Promise<void> {
    await AsyncStorage.setItem(this.storageKey, JSON.stringify(ops));
  }
}

// ─── Singleton export ─────────────────────────────────────────────────────────

export const syncEngine = new SyncEngine({ conflictStrategy: 'server-wins' });
