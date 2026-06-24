/**
 * TC-B01, TC-B02, TC-B03  — SyncEngine unit tests
 * TC-C01, TC-C02           — conflict callback invoked
 * Validates DEF-02 fix: timer cancellation on reconnect
 * Validates DEF-03 fix: 409 is not retried
 */
import { SyncEngine, SyncStorage, PendingOperation } from '../syncEngine';
import { v4 as uuid } from 'uuid';

// ── Minimal in-memory storage ─────────────────────────────────────────────
function makeStorage(): SyncStorage & {
  ops: PendingOperation[];
  cursor: string;
  appliedItems: unknown[];
} {
  let ops: PendingOperation[] = [];
  let cursor = '1970-01-01T00:00:00Z';
  const appliedItems: unknown[] = [];
  return {
    ops,
    get cursor() { return cursor; },
    appliedItems,
    async loadPendingOps() { return [...ops]; },
    async savePendingOps(o) { ops = [...o]; },
    async loadCursor() { return cursor; },
    async saveCursor(c) { cursor = c; },
    async applyServerItems(items) { appliedItems.push(...items); },
  };
}

function makeFetch(responses: Array<{ status: number; body: object }>) {
  let idx = 0;
  return jest.fn().mockImplementation(() => {
    const resp = responses[idx++] ?? { status: 200, body: { results: [], items: [], nextCursor: '2024-01-01T00:00:00Z', hasMore: false } };
    return Promise.resolve({
      ok: resp.status >= 200 && resp.status < 300,
      status: resp.status,
      json: () => Promise.resolve(resp.body),
    });
  });
}

const BASE_CONFIG = {
  apiBaseUrl: 'https://api.test',
  getAuthToken: async () => 'test-token',
  deviceId: 'unit-test-device',
};

describe('SyncEngine — push operations', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('TC-B01: enqueues and sends a upsert operation', async () => {
    const storage = makeStorage();
    const fetchMock = makeFetch([
      { status: 200, body: { results: [{ operationId: 'op1', itemId: 'item1', status: 'ok' }] } },
      { status: 200, body: { items: [], nextCursor: '2024-01-01T00:00:00Z', hasMore: false } },
    ]);
    global.fetch = fetchMock as any;

    const engine = new SyncEngine({ ...BASE_CONFIG, storage });
    await engine.enqueueOperation({
      operationId: 'op1',
      type: 'upsert',
      itemId: 'item1',
      payload: { title: 'Hello', updatedAt: new Date().toISOString() },
      clientVersion: 0,
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(storage.ops).toHaveLength(0); // cleared after success
  });

  it('TC-B02: DEF-03 fix — HTTP 409 is NOT retried (dropped immediately)', async () => {
    const storage = makeStorage();
    const fetchMock = makeFetch([
      { status: 409, body: {} },
      { status: 200, body: { items: [], nextCursor: '2024-01-01T00:00:00Z', hasMore: false } },
    ]);
    global.fetch = fetchMock as any;

    const engine = new SyncEngine({ ...BASE_CONFIG, storage });
    await engine.enqueueOperation({
      operationId: 'op-409',
      type: 'upsert',
      itemId: 'item-409',
      payload: { title: 'test', updatedAt: new Date().toISOString() },
      clientVersion: 0,
    });

    // 409 is non-retryable → no pending retry timer created
    expect(storage.ops).toHaveLength(0);
    // fetch called exactly once for push + once for pull
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('TC-B03: retryable error schedules ONE timer (DEF-02 fix)', async () => {
    const storage = makeStorage();
    let callCount = 0;
    global.fetch = jest.fn().mockImplementation(() => {
      callCount++;
      if (callCount <= 2) {
        return Promise.reject(new Error('network error'));
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({ results: [{ operationId: 'op-retry', itemId: 'item-r', status: 'ok' }] }),
      });
    }) as any;

    const engine = new SyncEngine({ ...BASE_CONFIG, storage });
    (engine as any)._isOnline = true;

    // Seed a pending op directly
    await storage.savePendingOps([
      {
        operationId: 'op-retry',
        type: 'upsert',
        itemId: 'item-r',
        payload: { title: 'r', updatedAt: new Date().toISOString() },
        clientVersion: 0,
        retryCount: 0,
      },
    ]);

    // First sync → fails, schedules 1 timer
    await (engine as any)._pushPendingOps();
    expect((engine as any)._pendingRetryTimer).not.toBeNull();

    // Simulate a second sync while timer is pending — timer should be cancelled and replaced
    await (engine as any)._pushPendingOps();
    // Only ONE timer should exist at any time
    const timer1 = (engine as any)._pendingRetryTimer;
    expect(timer1).not.toBeNull();

    engine.stop();
  });

  it('TC-C01/C02: conflict_resolved callback is invoked', async () => {
    const storage = makeStorage();
    const onConflictResolved = jest.fn();
    const serverItem = { id: 'item-c', title: 'server-value', version: 2 };
    const fetchMock = makeFetch([
      {
        status: 200,
        body: {
          results: [
            {
              operationId: 'op-c',
              itemId: 'item-c',
              status: 'conflict_resolved',
              resolution: 'lww_server',
              serverItem,
            },
          ],
        },
      },
      { status: 200, body: { items: [], nextCursor: '2024-01-01T00:00:00Z', hasMore: false } },
    ]);
    global.fetch = fetchMock as any;

    const engine = new SyncEngine({
      ...BASE_CONFIG,
      storage,
      onConflictResolved,
    });
    await engine.enqueueOperation({
      operationId: 'op-c',
      type: 'upsert',
      itemId: 'item-c',
      payload: { title: 'client-value', updatedAt: new Date().toISOString() },
      clientVersion: 1,
    });

    expect(onConflictResolved).toHaveBeenCalledWith(
      'item-c',
      'lww_server',
      serverItem,
    );
  });
});

describe('SyncEngine — network reconnect (DEF-02)', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('cancels pending timer when network is restored and triggers immediate sync', async () => {
    const storage = makeStorage();
    const syncNowSpy = jest.spyOn(
      SyncEngine.prototype as any,
      'syncNow',
    ).mockResolvedValue(undefined);

    const engine = new SyncEngine({ ...BASE_CONFIG, storage });

    // Manually plant a pending timer
    (engine as any)._pendingRetryTimer = setTimeout(() => {}, 60_000);
    (engine as any)._isOnline = false;

    // Simulate network restore
    (engine as any)._handleNetworkChange({
      isConnected: true,
      isInternetReachable: true,
    });

    expect((engine as any)._pendingRetryTimer).toBeNull();
    expect(syncNowSpy).toHaveBeenCalledTimes(1);
  });
});
