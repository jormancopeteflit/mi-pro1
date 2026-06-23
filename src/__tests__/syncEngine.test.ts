/**
 * Tests del motor de sincronización.
 * Verifica: MAX_RETRIES, resolución 409, cancelación de timers.
 */
import { syncEngine } from '../offline/syncEngine';
import * as repo from '../offline/itemsRepository';

// Mock de @react-native-community/netinfo
jest.mock('@react-native-community/netinfo', () => ({
  addEventListener: jest.fn(() => jest.fn()),
}));

// Mock del repositorio
jest.mock('../offline/itemsRepository', () => ({
  getPendingSyncOperations: jest.fn(),
  removeSyncOperation: jest.fn().mockResolvedValue(undefined),
  incrementRetry: jest.fn().mockResolvedValue(undefined),
  applyServerItem: jest.fn().mockResolvedValue(undefined),
}));

const mockOp = {
  queue_id: 1,
  operation: 'UPDATE' as const,
  entity_type: 'items',
  entity_id: 'abc',
  payload: JSON.stringify({ id: 'abc', title: 'T' }),
  created_at: Date.now(),
  retry_count: 0,
  last_error: null,
};

beforeEach(() => {
  jest.clearAllMocks();
  (global as any).fetch = jest.fn();
});

describe('syncEngine - HTTP 200', () => {
  it('elimina la operación de la cola en éxito', async () => {
    (repo.getPendingSyncOperations as jest.Mock).mockResolvedValue([mockOp]);
    (fetch as jest.Mock).mockResolvedValue({ ok: true, status: 200 });

    await syncEngine.syncPendingOperations();

    expect(repo.removeSyncOperation).toHaveBeenCalledWith(1);
    expect(repo.incrementRetry).not.toHaveBeenCalled();
  });
});

describe('syncEngine - HTTP 409 (resolución de conflicto)', () => {
  it('aplica Server-Wins y elimina la op de la cola (no reintenta ciegamente)', async () => {
    const serverItem = { id: 'abc', title: 'Servidor', body: '', owner_id: 'u1',
      created_at: 1, updated_at: 2000, server_updated_at: 2000, is_deleted: 0 };
    (repo.getPendingSyncOperations as jest.Mock).mockResolvedValue([mockOp]);
    (fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 409,
      json: jest.fn().mockResolvedValue(serverItem),
    });

    await syncEngine.syncPendingOperations();

    expect(repo.applyServerItem).toHaveBeenCalledWith(serverItem);
    expect(repo.removeSyncOperation).toHaveBeenCalledWith(1);
    expect(repo.incrementRetry).not.toHaveBeenCalled();
  });
});

describe('syncEngine - MAX_RETRIES', () => {
  it('descarta la operación cuando retry_count >= MAX_RETRIES', async () => {
    const expiredOp = { ...mockOp, retry_count: 3 };
    (repo.getPendingSyncOperations as jest.Mock).mockResolvedValue([expiredOp]);

    await syncEngine.syncPendingOperations();

    expect(repo.removeSyncOperation).toHaveBeenCalledWith(1);
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe('syncEngine - cancelación de timers (DEF-02)', () => {
  it('no acumula timers en reconexiones rápidas', () => {
    jest.useFakeTimers();
    (repo.getPendingSyncOperations as jest.Mock).mockResolvedValue([]);

    // Simular 5 reconexiones rápidas
    const engine = syncEngine as any;
    for (let i = 0; i < 5; i++) {
      engine._scheduleSync(5000);
    }

    // Solo debe existir un timer activo
    expect(jest.getTimerCount()).toBe(1);
    jest.useRealTimers();
  });
});
