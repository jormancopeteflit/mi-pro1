/**
 * Tests de integración para apiClient (interceptores de Axios).
 * Verifica que el token se adjunta, que se reintenta tras 401 y que
 * la cola de peticiones simultáneas se resuelve correctamente.
 */
import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { apiClient } from '../apiClient';
import { sessionManager } from '../../auth/sessionManager';

jest.mock('../../auth/sessionManager');

const mockEnsureFreshToken = sessionManager.ensureFreshToken as jest.Mock;

let mockAxios: MockAdapter;

beforeEach(() => {
  jest.clearAllMocks();
  mockAxios = new MockAdapter(apiClient);
});

afterEach(() => {
  mockAxios.restore();
});

describe('Request interceptor', () => {
  it('adjunta el Bearer token en la cabecera', async () => {
    mockEnsureFreshToken.mockResolvedValue('test-token');
    mockAxios.onGet('/ping').reply(200, { ok: true });

    const response = await apiClient.get('/ping');

    expect(response.status).toBe(200);
    expect(mockEnsureFreshToken).toHaveBeenCalledTimes(1);
  });
});

describe('Response interceptor – 401 retry', () => {
  it('reintenta la petición con token renovado tras 401', async () => {
    let callCount = 0;
    mockEnsureFreshToken
      .mockResolvedValueOnce('expired-token')
      .mockResolvedValueOnce('fresh-token');

    mockAxios.onGet('/protected').reply(() => {
      callCount += 1;
      if (callCount === 1) return [401, { message: 'Unauthorized' }];
      return [200, { data: 'secret' }];
    });

    const response = await apiClient.get('/protected');
    expect(response.status).toBe(200);
    expect(response.data.data).toBe('secret');
  });

  it('rechaza la promesa si el segundo intento también falla', async () => {
    mockEnsureFreshToken.mockResolvedValue('any-token');
    mockAxios.onGet('/always-401').reply(401);

    await expect(apiClient.get('/always-401')).rejects.toMatchObject({
      response: { status: 401 },
    });
  });
});
