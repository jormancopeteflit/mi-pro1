/**
 * SyncEngine – unit tests
 * Covers: TC-B01 auto-sync on reconnect (with timer cancellation),
 * TC-B02 timer accumulation guard, TC-B03 concurrent sync guard,
 * TC-C01/TC-C02 conflict resolution (Server-Wins, LWW, Client-Wins),
 * TC-D01 successful operation flush, TC-D02 non-retriable discard,
 * TC-D03 max-retries discard.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { SyncEngine, PendingOperation, SyncEngineConfig } from '../syncEngine';

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockPost = jest.fn();
const mockPut = jest.fn();
const mockPatch = jest.fn();
const mockDelete = jest.fn();

jest.mock('../apiClient', () => ({
  apiClient: {
    post: (...args: unknown[]) => mockPost(...args),
    put: (...args: unknown[]) => mockPut(...args),
    patch: (...args: unknown[]) => mockPatch(...args),
    delete: (...args: unknown[]) => mockDelete(...args),
  },
}));

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

let netInfoCallback: ((state: { isConnected: boolean; isInternetReachable: boolean }) => void) | null = null;
const mockNetInfoUnsub = jest.fn();
const mockAddEventListener = jest.fn().mockImplementation((cb) => {
  netInfoCallback = cb;
  return mockNetInfoUnsub;
});

jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: { addEventListener: (...args: unknown[]) => mockAddEventListener(...args) },
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeOp(
  overrides: Partial<PendingOperation> = {},
): Omit<PendingOperation, 'retries'> {
  return {
    id: `op-${Math.random()}`,
    method: 'POST',
    endpoint: '/items',
    payload: { name: 'test' },
    updatedAt: Date.now(),
    ...overrides,
  };
}

function makeEngine(config: SyncEngineConfig = {}) {
  return new SyncEngine({
    storageKey: `@test_sync_${Math.random()}`,
    retryDelayMs: 0,
    ...config,
  });
}

function axiosError(status: number, data: unknown = {}) {
  const err = new Error('Request failed') as Error & { response: unknown };
  (err as { response: unknown }).response = { status, data };
  return err;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  AsyncStorage.clear();
  netInfoCallback = null;
});

afterEach(() => {
  jest.runAllTimers();
  jest.useRealTimers();
});

// TC-D01
describe('syncPendingOperations – success', () => {
  it('flushes all queued operations on success', async () => {
    mockPost.mockResolvedValue({ data: {} });
    const engine = makeEngine();
    await engine.enqueue(makeOp({ method: 'POST' }));
    await engine.enqueue(makeOp({ method: 'POST' }));
    await engine.syncPendingOperations();
    // Queue should be empty
    const remaining = JSON.parse(
      (await AsyncStorage.getItem((engine as unknown as { storageKey: string }).storageKey)) ?? '[]',
    );
    expect(remaining).toHaveLength(0);
    expect(mockPost).toHaveBeenCalledTimes(2);
  });

  it('supports PUT, PATCH, DELETE methods', async () => {
    mockPut.mockResolvedValue({});
    mockPatch.mockResolvedValue({});
    mockDelete.mockResolvedValue({});
    const engine = makeEngine();
    await engine.enqueue(makeOp({ method: 'PUT', endpoint: '/items/1' }));
    await engine.enqueue(makeOp({ method: 'PATCH', endpoint: '/items/2' }));
    await engine.enqueue(makeOp({ method: 'DELETE', endpoint: '/items/3' }));
    await engine.syncPendingOperations();
    expect(mockPut).toHaveBeenCalledTimes(1);
    expect(mockPatch).toHaveBeenCalledTimes(1);
    expect(mockDelete).toHaveBeenCalledTimes(1);
  });
});

// TC-D02
describe('syncPendingOperations – non-retriable errors', () => {
  it.each([400, 401, 403, 404, 422])(
    'discards operation on HTTP %i without retry',
    async (status) => {
      mockPost.mockRejectedValueOnce(axiosError(status));
      const engine = makeEngine();
      await engine.enqueue(makeOp());
      await engine.syncPendingOperations();
      const remaining = JSON.parse(
        (await AsyncStorage.getItem((engine as unknown as { storageKey: string }).storageKey)) ?? '[]',
      );
      expect(remaining).toHaveLength(0);
    },
  );
});

// TC-D03
describe('syncPendingOperations – max retries', () => {
  it('discards operation after MAX_RETRIES network failures', async () => {
    const maxRetries = 2;
    mockPost.mockRejectedValue(new Error('Network Error'));
    const engine = makeEngine({ maxRetries, retryDelayMs: 10 });
    await engine.enqueue(makeOp());

    await engine.syncPendingOperations();
    // First attempt fails → schedules timer
    jest.runAllTimers();
    // Allow timer microtasks to run
    await Promise.resolve();
    jest.runAllTimers();
    await Promise.resolve();

    // After maxRetries the op should be discarded
    const remaining = JSON.parse(
      (await AsyncStorage.getItem((engine as unknown as { storageKey: string }).storageKey)) ?? '[]',
    );
    expect(remaining).toHaveLength(0);
  });
});

// TC-C01: Server-Wins conflict resolution
describe('conflict resolution – server-wins', () => {
  it('discards local op when server returns 409 (server-wins)', async () => {
    const serverData = { id: '1', name: 'server-value', updatedAt: Date.now() + 1000 };
    mockPost.mockRejectedValueOnce(axiosError(409, serverData));
    const engine = makeEngine({ conflictStrategy: 'server-wins' });
    await engine.enqueue(makeOp());
    await engine.syncPendingOperations();
    // Op discarded (server wins), no further call
    expect(mockPost).toHaveBeenCalledTimes(1);
    const remaining = JSON.parse(
      (await AsyncStorage.getItem((engine as unknown as { storageKey: string }).storageKey)) ?? '[]',
    );
    expect(remaining).toHaveLength(0);
  });

  it('resolveConflict returns server winner', async () => {
    const engine = makeEngine({ conflictStrategy: 'server-wins' });
    const op: PendingOperation = { ...makeOp(), retries: 0 };
    const result = await engine.resolveConflict(op, { id: '1' });
    expect(result.winner).toBe('server');
  });
});

// TC-C02: LWW conflict resolution
describe('conflict resolution – lww', () => {
  it('client wins when local updatedAt > server updatedAt', async () => {
    const now = Date.now();
    const serverData = { updatedAt: now - 5000 };
    mockPost
      .mockRejectedValueOnce(axiosError(409, serverData))
      .mockResolvedValueOnce({ data: {} }); // force-write succeeds
    const engine = makeEngine({ conflictStrategy: 'lww' });
    const op = makeOp({ updatedAt: now });
    await engine.enqueue(op);
    await engine.syncPendingOperations();
    // First call: original POST → 409
    // Second call: force-write POST
    expect(mockPost).toHaveBeenCalledTimes(2);
    expect(mockPost).toHaveBeenLastCalledWith(
      expect.any(String),
      expect.any(Object),
      { headers: { 'X-Force-Write': 'true' } },
    );
  });

  it('server wins when server updatedAt > local updatedAt', async () => {
    const now = Date.now();
    const serverData = { updatedAt: now + 5000 };
    mockPost.mockRejectedValueOnce(axiosError(409, serverData));
    const engine = makeEngine({ conflictStrategy: 'lww' });
    const op = makeOp({ updatedAt: now });
    await engine.enqueue(op);
    await engine.syncPendingOperations();
    expect(mockPost).toHaveBeenCalledTimes(1); // no force-write
    const remaining = JSON.parse(
      (await AsyncStorage.getItem((engine as unknown as { storageKey: string }).storageKey)) ?? '[]',
    );
    expect(remaining).toHaveLength(0);
  });

  it('client wins when timestamps equal', async () => {
    const now = Date.now();
    mockPost
      .mockRejectedValueOnce(axiosError(409, { updatedAt: now }))
      .mockResolvedValueOnce({ data: {} });
    const engine = makeEngine({ conflictStrategy: 'lww' });
    await engine.enqueue(makeOp({ updatedAt: now }));
    await engine.syncPendingOperations();
    expect(mockPost).toHaveBeenCalledTimes(2);
  });
});

// Client-Wins strategy
describe('conflict resolution – client-wins', () => {
  it('force-pushes client payload when server returns 409', async () => {
    mockPost
      .mockRejectedValueOnce(axiosError(409, {}))
      .mockResolvedValueOnce({ data: {} });
    const engine = makeEngine({ conflictStrategy: 'client-wins' });
    await engine.enqueue(makeOp());
    await engine.syncPendingOperations();
    expect(mockPost).toHaveBeenCalledTimes(2);
    expect(mockPost).toHaveBeenLastCalledWith(
      expect.any(String),
      expect.any(Object),
      { headers: { 'X-Force-Write': 'true' } },
    );
  });
});

// TC-B03: concurrent sync guard
describe('concurrent sync guard', () => {
  it('does not start a second sync while one is running', async () => {
    let resolveFirst!: () => void;
    mockPost.mockImplementationOnce(
      () =>
        new Promise<void>((res) => {
          resolveFirst = res;
        }),
    );
    const engine = makeEngine();
    await engine.enqueue(makeOp());

    const first = engine.syncPendingOperations();
    const second = engine.syncPendingOperations(); // should be a no-op
    resolveFirst();
    await first;
    await second;
    expect(mockPost).toHaveBeenCalledTimes(1);
  });
});

// TC-B01: auto-sync on network recovery
describe('network listener – auto sync on reconnect', () => {
  it('triggers syncPendingOperations when network reconnects', async () => {
    mockPost.mockResolvedValue({ data: {} });
    const engine = makeEngine();
    await engine.enqueue(makeOp());
    engine.startNetworkListener();

    expect(mockAddEventListener).toHaveBeenCalled();
    // Simulate reconnection
    netInfoCallback!({ isConnected: true, isInternetReachable: true });
    await Promise.resolve(); // flush microtasks
    // Sync was triggered (post called)
    expect(mockPost).toHaveBeenCalledTimes(1);
  });

  it('does not trigger on disconnect', () => {
    const engine = makeEngine();
    engine.startNetworkListener();
    netInfoCallback!({ isConnected: false, isInternetReachable: false });
    expect(mockPost).not.toHaveBeenCalled();
  });

  it('unsubscribes network listener on stopNetworkListener', () => {
    const engine = makeEngine();
    engine.startNetworkListener();
    engine.stopNetworkListener();
    expect(mockNetInfoUnsub).toHaveBeenCalled();
  });
});

// TC-B02: timer accumulation guard
describe('timer cancellation on reconnect', () => {
  it('cancels pending retry timer when network reconnects', async () => {
    // First attempt fails (retriable) → schedules a retry timer
    mockPost
      .mockRejectedValueOnce(new Error('Network Error'))
      .mockResolvedValue({ data: {} });
    const engine = makeEngine({ retryDelayMs: 10000 });
    await engine.enqueue(makeOp());
    engine.startNetworkListener();

    await engine.syncPendingOperations(); // fails, schedules timer at T+10000ms

    // Simulate reconnect BEFORE the timer fires
    netInfoCallback!({ isConnected: true, isInternetReachable: true });
    await Promise.resolve();

    // Only one sync should run now (the reconnect-triggered one)
    // The delayed timer should have been cancelled
    jest.runAllTimers();
    await Promise.resolve();

    // post was called: once in the first sync (fail) + once on reconnect (success)
    expect(mockPost).toHaveBeenCalledTimes(2);
  });
});
