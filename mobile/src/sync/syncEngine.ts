/**
 * SyncEngine — mobile client
 *
 * Fixes:
 *  DEF-02: Cancels pending retry timers on reconnect; no timer accumulation.
 *  DEF-03: Never blindly retries HTTP 409; conflicts are resolved server-side.
 *          409 is treated as a non-retryable error (handled by SyncService).
 */
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';

export interface PendingOperation {
  operationId: string;
  type: 'upsert' | 'delete';
  itemId: string;
  payload?: {
    title?: string;
    body?: string;
    updatedAt: string;
  };
  clientVersion: number;
  retryCount: number;
}

export interface SyncEngineConfig {
  apiBaseUrl: string;
  getAuthToken: () => Promise<string>;
  deviceId: string;
  onSyncComplete?: (pulledCount: number) => void;
  onConflictResolved?: (
    itemId: string,
    resolution: string,
    serverItem: unknown,
  ) => void;
  storage: SyncStorage;
}

export interface SyncStorage {
  loadPendingOps(): Promise<PendingOperation[]>;
  savePendingOps(ops: PendingOperation[]): Promise<void>;
  loadCursor(): Promise<string>;
  saveCursor(cursor: string): Promise<void>;
  applyServerItems(items: unknown[]): Promise<void>;
}

const MAX_RETRIES = 3;
const NON_RETRYABLE_STATUSES = new Set([400, 401, 403, 409]); // 409 → server handles conflict, no retry
const RETRY_BASE_DELAY_MS = 1_000;

export class SyncEngine {
  private readonly config: SyncEngineConfig;
  private _isSyncing = false;
  private _pendingRetryTimer: ReturnType<typeof setTimeout> | null = null;
  private _unsubscribeNetInfo: (() => void) | null = null;
  private _isOnline = true;

  constructor(config: SyncEngineConfig) {
    this.config = config;
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────
  start(): void {
    this._unsubscribeNetInfo = NetInfo.addEventListener(
      (state: NetInfoState) => this._handleNetworkChange(state),
    );
  }

  stop(): void {
    this._unsubscribeNetInfo?.();
    this._unsubscribeNetInfo = null;
    this._cancelPendingTimer();
  }

  // ── Network change handler — DEF-02 fix ────────────────────────────────────
  private _handleNetworkChange(state: NetInfoState): void {
    const wasOffline = !this._isOnline;
    this._isOnline = !!(state.isConnected && state.isInternetReachable !== false);

    if (this._isOnline && wasOffline) {
      // Network restored: cancel any accumulated timers and sync immediately
      this._cancelPendingTimer();
      this.syncNow().catch(console.error);
    }
  }

  private _cancelPendingTimer(): void {
    if (this._pendingRetryTimer !== null) {
      clearTimeout(this._pendingRetryTimer);
      this._pendingRetryTimer = null;
    }
  }

  // ── Public API ─────────────────────────────────────────────────────────────
  async syncNow(): Promise<void> {
    if (this._isSyncing) return;
    this._isSyncing = true;
    try {
      await this._pushPendingOps();
      await this._pullServerChanges();
    } finally {
      this._isSyncing = false;
    }
  }

  async enqueueOperation(op: Omit<PendingOperation, 'retryCount'>): Promise<void> {
    const ops = await this.config.storage.loadPendingOps();
    // Replace any existing op for the same item (last write wins locally)
    const filtered = ops.filter((o) => o.itemId !== op.itemId || o.type !== op.type);
    filtered.push({ ...op, retryCount: 0 });
    await this.config.storage.savePendingOps(filtered);

    if (this._isOnline) {
      await this.syncNow();
    }
  }

  // ── Push pending operations ────────────────────────────────────────────────
  private async _pushPendingOps(): Promise<void> {
    const ops = await this.config.storage.loadPendingOps();
    if (ops.length === 0) return;

    const remaining: PendingOperation[] = [];

    for (const op of ops) {
      const { success, retryable } = await this._sendOperation(op);
      if (success) continue;

      if (retryable && op.retryCount < MAX_RETRIES) {
        remaining.push({ ...op, retryCount: op.retryCount + 1 });
      } else if (!retryable) {
        // Non-retryable (400/401/403/409) — drop the operation
        console.warn(
          `[SyncEngine] Dropping non-retryable operation ${op.operationId}`,
        );
      } else {
        // Exceeded MAX_RETRIES — drop to avoid infinite loop
        console.warn(
          `[SyncEngine] Operation ${op.operationId} exceeded MAX_RETRIES (${MAX_RETRIES}), dropping.`,
        );
      }
    }

    await this.config.storage.savePendingOps(remaining);

    // If there are still retryable ops, schedule ONE retry with back-off
    if (remaining.length > 0) {
      this._cancelPendingTimer(); // ensure no double-scheduling
      const maxRetries = Math.max(...remaining.map((o) => o.retryCount));
      const delay = RETRY_BASE_DELAY_MS * Math.pow(2, maxRetries);
      this._pendingRetryTimer = setTimeout(() => {
        this._pendingRetryTimer = null;
        this.syncNow().catch(console.error);
      }, delay);
    }
  }

  private async _sendOperation(
    op: PendingOperation,
  ): Promise<{ success: boolean; retryable: boolean }> {
    try {
      const token = await this.config.getAuthToken();
      const res = await fetch(`${this.config.apiBaseUrl}/sync/push`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ operations: [op] }),
      });

      if (res.ok) {
        const body = await res.json();
        const result = body.results?.[0];
        if (result?.status === 'conflict_resolved') {
          this.config.onConflictResolved?.(
            result.itemId,
            result.resolution,
            result.serverItem,
          );
        }
        return { success: true, retryable: false };
      }

      const retryable = !NON_RETRYABLE_STATUSES.has(res.status);
      return { success: false, retryable };
    } catch {
      // Network error — retryable
      return { success: false, retryable: true };
    }
  }

  // ── Pull server changes ────────────────────────────────────────────────────
  private async _pullServerChanges(): Promise<void> {
    let cursor = await this.config.storage.loadCursor();
    let hasMore = true;
    let totalPulled = 0;

    while (hasMore) {
      const token = await this.config.getAuthToken();
      const url =
        `${this.config.apiBaseUrl}/sync/pull` +
        `?cursor=${encodeURIComponent(cursor)}&limit=200`;

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        console.error(`[SyncEngine] Pull failed with status ${res.status}`);
        break;
      }

      const body = await res.json();
      await this.config.storage.applyServerItems(body.items);
      await this.config.storage.saveCursor(body.nextCursor);
      cursor = body.nextCursor;
      hasMore = body.hasMore;
      totalPulled += body.items.length;
    }

    this.config.onSyncComplete?.(totalPulled);
  }
}
