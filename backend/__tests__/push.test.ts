/**
 * TC-P-01 … TC-P-05  — push token registration and deregistration
 *
 * Firebase Admin is mocked so tests run without real credentials.
 */
import request from 'supertest';
import app from '../src/app';
import pool from '../src/db';

// ── Mock firebase-admin ──────────────────────────────────────────────────────
jest.mock('firebase-admin', () => {
  const sendMock = jest.fn().mockResolvedValue('message-id-123');
  return {
    initializeApp: jest.fn().mockReturnValue({
      messaging: () => ({ send: sendMock }),
    }),
    credential: {
      cert: jest.fn(),
    },
    __sendMock: sendMock,
  };
});

// Provide a dummy service account so PushService won't throw
process.env.FIREBASE_SERVICE_ACCOUNT_JSON = JSON.stringify({
  type: 'service_account',
  project_id: 'test',
  private_key_id: 'key',
  private_key: 'pk',
  client_email: 'sa@test.iam.gserviceaccount.com',
  client_id: '1',
  auth_uri: '',
  token_uri: '',
});

afterAll(() => pool.end());

async function registerAndGetToken(email: string, deviceId: string): Promise<string> {
  const r = await request(app)
    .post('/auth/register')
    .send({ email, password: 'Pass123!', deviceId });
  return r.body.token as string;
}

describe('Push token registration (TC-P-01 to TC-P-05)', () => {
  let token: string;
  const deviceId = 'device-push-test';

  beforeAll(async () => {
    token = await registerAndGetToken(
      `push-test-${Date.now()}@example.com`,
      deviceId,
    );
  });

  it('TC-P-01: registers FCM token successfully', async () => {
    const res = await request(app)
      .post('/push/token')
      .set('Authorization', `Bearer ${token}`)
      .send({ token: 'fcm-token-abc', platform: 'fcm' });
    expect(res.status).toBe(204);

    // Verify in DB
    const row = await pool.query(
      `SELECT token, platform, active FROM push_tokens WHERE device_id=$1`,
      [deviceId],
    );
    expect(row.rows[0].token).toBe('fcm-token-abc');
    expect(row.rows[0].platform).toBe('fcm');
    expect(row.rows[0].active).toBe(true);
  });

  it('TC-P-02: registers APNs token successfully', async () => {
    const res = await request(app)
      .post('/push/token')
      .set('Authorization', `Bearer ${token}`)
      .send({ token: 'apns-token-xyz', platform: 'apns' });
    expect(res.status).toBe(204);
  });

  it('TC-P-03: rejects unknown platform', async () => {
    const res = await request(app)
      .post('/push/token')
      .set('Authorization', `Bearer ${token}`)
      .send({ token: 'some-token', platform: 'wns' });
    expect(res.status).toBe(400);
  });

  it('TC-P-04: deregisters token (sets active=false)', async () => {
    const res = await request(app)
      .delete('/push/token')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(204);

    const row = await pool.query(
      `SELECT active FROM push_tokens WHERE device_id=$1`,
      [deviceId],
    );
    expect(row.rows[0].active).toBe(false);
  });

  it('TC-P-05: unauthenticated request is rejected', async () => {
    const res = await request(app)
      .post('/push/token')
      .send({ token: 'x', platform: 'fcm' });
    expect(res.status).toBe(401);
  });
});
