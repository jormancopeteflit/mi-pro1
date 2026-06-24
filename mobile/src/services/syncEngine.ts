/**
 * syncEngine.ts
 * Handles offline-first sync with:
 *  - Last-Write-Wins (LWW) conflict resolution (DEF-03 fix)
 *  - Single pending timer with proper cancellation on reconnect (DEF-02 fix)
 *  - HTTP 409 treated as a resolvable conflict, NOT retried blindly
 */

import NetInfo, { NetInfoState } from '@react-native-community/netinfo';

export interface PendingOperation {
  id: string;
  endpoint: string;
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  payload: Record<string, unknown>;
  /** ISO-8601 timestamp of when this operation was created locally */
  clientUpdatedAt: string;
  retryCount: number;
}

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2_000;
// HTTP status codes that must NOT be retried blindly
const NON_RETRIABLE_STATUSES = new Set([400, 401, 403, 404, 422]);

class SyncEngine {
  private _pendingOperations: PendingOperation[] = [];
  private _isSyncing = false;
  /** Single pending timer handle – always cancelled before setting a new one */
  private _retryTimer: ReturnType<typeof setTimeout> | null = null;
  private _unsubscribeNetInfo: (() => void) | null = null;

  // ─── Lifecycle ──────────────────────────────────────────────────────────────

  start(): void {
    this._unsubscribeNetInfo = NetInfo.addEventListener((state: NetInfoState) => {
      if (state.isConnected && state.isInternetReachable) {
        // Network came back → cancel any pending retry timer and sync immediately
        this._cancelRetryTimer();
        this.syncPendingOperations();
      }
    });
  }

  stop(): void {
    this._unsubscribeNetInfo?.();
    this._unsubscribeNetInfo = null;
    this._cancelRetryTimer();
  }

  // ─── Queue management ───────────────────────────────────────────────────────

  enqueue(op: Omit<PendingOperation, 'retryCount'>): void {
    this._pendingOperations.push({ ...op, retryCount: 0 });
    this.syncPendingOperations();
  }

  // ─── Main sync loop ─────────────────────────────────────────────────────────

  async syncPendingOperations(): Promise<void> {
    if (this._isSyncing || this._pendingOperations.length === 0) return;

    const netState = await NetInfo.fetch();
    if (!netState.isConnected || !netState.isInternetReachable) return;

    this._isSyncing = true;
    this._cancelRetryTimer(); // ensure no stale timer fires during active sync

    // Process operations sequentially to preserve ordering guarantees
    while (this._pendingOperations.length > 0) {
      const op = this._pendingOperations[0]!;
      const success = await this._executeOperation(op);
      if (success) {
        this._pendingOperations.shift(); // remove processed op
      } else {
        break; // stop processing; retry scheduled inside _executeOperation
      }
    }

    this._isSyncing = false;
  }

  // ─── Single operation execution ─────────────────────────────────────────────

  private async _executeOperation(op: PendingOperation): Promise<boolean> {
    try {
      const token = await this._getAuthToken();
      const response = await fetch(op.endpoint, {
        method: op.method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          // Send client timestamp so server can apply LWW
          'X-Client-Updated-At': op.clientUpdatedAt,
        },
        body: op.method !== 'DELETE' ? JSON.stringify(op.payload) : undefined,
      });

      if (response.ok) {
        return true;
      }

      // ── Conflict resolution: HTTP 409 → Last-Write-Wins ────────────────────
      if (response.status === 409) {
        return this._resolveConflict(op, response);
      }

      // ── Non-retriable errors → drop the operation ───────────────────────────
      if (NON_RETRIABLE_STATUSES.has(response.status)) {
        console.warn(
          `[sync] Operation ${op.id} dropped: non-retriable status ${response.status}`,
        );
        return true; // remove from queue
      }

      // ── Retriable server errors (5xx, 429, network hiccup) ──────────────────
      return this._scheduleRetry(op);
    } catch (networkError) {
      console.warn(`[sync] Network error for operation ${op.id}:`, networkError);
      return this._scheduleRetry(op);
    }
  }

  // ─── Conflict resolution: Last-Write-Wins ───────────────────────────────────
  // If clientUpdatedAt > serverUpdatedAt → force-write client version (client wins).
  // Otherwise → accept server version and discard local change (server wins).

  private async _resolveConflict(
    op: PendingOperation,
    conflictResponse: Response,
  ): Promise<boolean> {
    try {
      const serverData = (await conflictResponse.json()) as {
        serverUpdatedAt?: string;
        [key: string]: unknown;
      };

      const clientTs = new Date(op.clientUpdatedAt).getTime();
      const serverTs = serverData.serverUpdatedAt
        ? new Date(serverData.serverUpdatedAt as string).getTime()
        : 0;

      if (clientTs > serverTs) {
        // Client is newer → force-write with a dedicated header
        const token = await this._getAuthToken();
        const forceResponse = await fetch(op.endpoint, {
          method: op.method,
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
            'X-Client-Updated-At': op.clientUpdatedAt,
            'X-Conflict-Resolution': 'client-wins',
          },
          body: op.method !== 'DELETE' ? JSON.stringify(op.payload) : undefined,
        });

        if (forceResponse.ok) {
          console.info(`[sync] Conflict resolved: client-wins for operation ${op.id}`);
          return true;
        }
        // Force-write also failed → drop to avoid infinite loop
        console.warn(`[sync] Force-write failed for ${op.id}, dropping operation.`);
        return true;
      } else {
        // Server is newer → server-wins: discard local change
        console.info(`[sync] Conflict resolved: server-wins for operation ${op.id}`);
        return true; // remove from queue without re-applying
      }
    } catch (err) {
      console.error(`[sync] Error resolving conflict for ${op.id}:`, err);
      return true; // drop to prevent stuck queue
    }
  }

  // ─── Retry scheduling ───────────────────────────────────────────────────────

  private _scheduleRetry(op: PendingOperation): boolean {
    if (op.retryCount >= MAX_RETRIES) {
      console.error(
        `[sync] Operation ${op.id} exceeded MAX_RETRIES (${MAX_RETRIES}), dropping.`,
      );
      return true; // drop from queue
    }

    op.retryCount += 1;
    const delay = RETRY_DELAY_MS * Math.pow(2, op.retryCount - 1); // exponential back-off

    // Cancel any existing timer before scheduling a new one (DEF-02 fix)
    this._cancelRetryTimer();
    this._retryTimer = setTimeout(() => {
      this._retryTimer = null;
      this.syncPendingOperations();
    }, delay);

    console.info(
      `[sync] Operation ${op.id} scheduled for retry ${op.retryCount}/${MAX_RETRIES} in ${delay}ms`,
    );
    return false; // keep in queue head
  }

  private _cancelRetryTimer(): void {
    if (this._retryTimer !== null) {
      clearTimeout(this._retryTimer);
      this._retryTimer = null;
    }
  }

  // ─── Auth token helper ──────────────────────────────────────────────────────

  private async _getAuthToken(): Promise<string> {
    // Import lazily to avoid circular deps; replace with your auth store selector.
    const { getAuthToken } = await import('./authStore');
    return getAuthToken();
  }
}

export const syncEngine = new SyncEngine();
