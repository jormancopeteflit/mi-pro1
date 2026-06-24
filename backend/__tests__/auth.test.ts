/**
 * TC-AUTH-01 … TC-AUTH-04
 * Authentication endpoint tests.
 */
import request from 'supertest';
import app from '../src/app';
import pool from '../src/db';

const DEVICE = 'test-device-auth';

afterAll(() => pool.end());

describe('Auth', () => {
  const email = `user-${Date.now()}@example.com`;
  const password = 'Secret123!';

  it('TC-AUTH-01: registers a new user', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({ email, password, deviceId: DEVICE });
    expect(res.status).toBe(201);
    expect(res.body.token).toBeDefined();
    expect(res.body.userId).toBeDefined();
  });

  it('TC-AUTH-02: rejects duplicate email', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({ email, password, deviceId: DEVICE });
    expect(res.status).toBe(409);
  });

  it('TC-AUTH-03: login returns token', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ email, password, deviceId: DEVICE });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
  });

  it('TC-AUTH-04: wrong password is rejected', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ email, password: 'wrong', deviceId: DEVICE });
    expect(res.status).toBe(401);
  });
});
