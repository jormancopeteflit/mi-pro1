/**
 * SyncEngine – integration tests (E2E-style with real AsyncStorage mock)
 * Simulates a full offline → online → conflict lifecycle.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { SyncEngine } from '../syncEngine';

const mockPost = jest.fn();
jest.mock('../apiClient', () => ({
  apiClient: { post: mockPost, put: jest.fn(), patch: jest.fn(), delete: jest.fn() },
}));
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: { addEventListener: jest.fn().mockReturnValue(jest.fn()) },
}));

beforeEach(() => {
  jest.clearAllMocks();
  AsyncStorage.clear();
});

describe('Full offline→online cycle', () => {
  it('enqueues multiple ops offline then syncs all when online', async () => {
    mockPost.mockResolvedValue({ data: {} });
    const engine = new SyncEngine({
      storageKey: '@integration_test',
      conflictStrategy: 'server-wins',
    });

    // Simulate 3 offline operations
    await engine.enqueue({ id: 'op1', method: 'POST', endpoint: '/a', payload: { v: 1 }, updatedAt: 100 });
    await engine.enqueue({ id: 'op2', method: 'POST', endpoint: '/b', payload: { v: 2 }, updatedAt: 200 });
    await engine.enqueue({ id: 'op3', method: 'POST', endpoint: '/c', payload: { v: 3 }, updatedAt: 300 });

    await engine.syncPendingOperations();

    expect(mockPost).toHaveBeenCalledTimes(3);
    const queue = JSON.parse(
      (await AsyncStorage.getItem('@integration_test')) ?? '[]',
    );
    expect(queue).toHaveLength(0);
  });

  it('resolves mixed success/conflict batch correctly', async () => {
    const serverErr = new Error('conflict') as Error & { response: unknown };
    serverErr.response = { status: 409, data: { updatedAt: 999999 } };

    mockPost
      .mockResolvedValueOnce({ data: {} })          // op1 success
      .mockRejectedValueOnce(serverErr)              // op2 conflict → server-wins → discard
      .mockResolvedValueOnce({ data: {} });          // op3 success

    const engine = new SyncEngine({
      storageKey: '@integration_test_mixed',
      conflictStrategy: 'server-wins',
    });

    await engine.enqueue({ id: 'op1', method: 'POST', endpoint: '/a', payload: {}, updatedAt: 100 });
    await engine.enqueue({ id: 'op2', method: 'POST', endpoint: '/b', payload: {}, updatedAt: 200 });
    await engine.enqueue({ id: 'op3', method: 'POST', endpoint: '/c', payload: {}, updatedAt: 300 });

    await engine.syncPendingOperations();

    expect(mockPost).toHaveBeenCalledTimes(3);
    const queue = JSON.parse(
      (await AsyncStorage.getItem('@integration_test_mixed')) ?? '[]',
    );
    // All ops resolved (success or discarded)
    expect(queue).toHaveLength(0);
  });
});
