/**
 * Auth API integration tests
 * Run: npx jest tests/auth.integration.test.ts
 */
import request from 'supertest';
import app from '../src/app';

const BASE = '/auth';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const validUser = {
  name: 'Test User',
  email: `test_${Date.now()}@example.com`,
  password: 'Str0ng!Pass',
};

// ─── Register ────────────────────────────────────────────────────────────────

describe('POST /auth/register', () => {
  it('TC-AUTH-R01 – creates a user and returns tokens', async () => {
    const res = await request(app).post(`${BASE}/register`).send(validUser);
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('accessToken');
    expect(res.body).toHaveProperty('refreshToken');
    expect(res.body).toHaveProperty('expiresIn');
    expect(res.body.user.email).toBe(validUser.email);
  });

  it('TC-AUTH-R02 – returns 409 when email already registered', async () => {
    // First registration
    await request(app).post(`${BASE}/register`).send(validUser);
    // Duplicate
    const res = await request(app).post(`${BASE}/register`).send(validUser);
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('EMAIL_ALREADY_REGISTERED');
  });

  it('TC-AUTH-R03 – returns 400 when email is invalid', async () => {
    const res = await request(app)
      .post(`${BASE}/register`)
      .send({ name: 'A', email: 'not-an-email', password: 'Str0ng!Pass' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('VALIDATION_ERROR');
  });

  it('TC-AUTH-R04 – returns 400 when password is too short', async () => {
    const res = await request(app)
      .post(`${BASE}/register`)
      .send({ name: 'A', email: 'a@b.com', password: 'short' });
    expect(res.status).toBe(400);
  });

  it('TC-AUTH-R05 – returns 400 when name is missing', async () => {
    const res = await request(app)
      .post(`${BASE}/register`)
      .send({ email: 'a@b.com', password: 'Str0ng!Pass' });
    expect(res.status).toBe(400);
  });
});

// ─── Login ───────────────────────────────────────────────────────────────────

describe('POST /auth/login', () => {
  const loginUser = {
    name: 'Login User',
    email: `login_${Date.now()}@example.com`,
    password: 'LoginPass!8',
  };

  beforeAll(async () => {
    await request(app).post(`${BASE}/register`).send(loginUser);
  });

  it('TC-AUTH-L01 – returns tokens for valid credentials', async () => {
    const res = await request(app)
      .post(`${BASE}/login`)
      .send({ email: loginUser.email, password: loginUser.password });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('accessToken');
    expect(res.body).toHaveProperty('refreshToken');
    expect(res.body.user.email).toBe(loginUser.email);
  });

  it('TC-AUTH-L02 – returns 401 for wrong password', async () => {
    const res = await request(app)
      .post(`${BASE}/login`)
      .send({ email: loginUser.email, password: 'WrongPass!9' });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('INVALID_CREDENTIALS');
  });

  it('TC-AUTH-L03 – returns 401 for unknown email', async () => {
    const res = await request(app)
      .post(`${BASE}/login`)
      .send({ email: 'nobody@nowhere.com', password: 'AnyPass!1' });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('INVALID_CREDENTIALS');
  });

  it('TC-AUTH-L04 – returns 400 when body is empty', async () => {
    const res = await request(app).post(`${BASE}/login`).send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('VALIDATION_ERROR');
  });

  it('TC-AUTH-L05 – is case-insensitive for email', async () => {
    const res = await request(app)
      .post(`${BASE}/login`)
      .send({ email: loginUser.email.toUpperCase(), password: loginUser.password });
    expect(res.status).toBe(200);
  });
});

// ─── Refresh ─────────────────────────────────────────────────────────────────

describe('POST /auth/refresh', () => {
  const refreshUser = {
    name: 'Refresh User',
    email: `refresh_${Date.now()}@example.com`,
    password: 'RefreshPass!8',
  };
  let refreshToken: string;

  beforeAll(async () => {
    const res = await request(app).post(`${BASE}/register`).send(refreshUser);
    refreshToken = res.body.refreshToken;
  });

  it('TC-AUTH-RF01 – returns a new accessToken', async () => {
    const res = await request(app).post(`${BASE}/refresh`).send({ refreshToken });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('accessToken');
    expect(res.body).toHaveProperty('expiresIn');
    // Should NOT rotate the refreshToken unless the implementation does so
    expect(res.body.refreshToken).toBeUndefined();
  });

  it('TC-AUTH-RF02 – returns 401 for invalid refreshToken', async () => {
    const res = await request(app)
      .post(`${BASE}/refresh`)
      .send({ refreshToken: 'totally.invalid.token' });
    expect(res.status).toBe(401);
  });

  it('TC-AUTH-RF03 – returns 400 when refreshToken is missing', async () => {
    const res = await request(app).post(`${BASE}/refresh`).send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('VALIDATION_ERROR');
  });

  it('TC-AUTH-RF04 – returns 401 after logout (revoked token)', async () => {
    const loginRes = await request(app)
      .post(`${BASE}/login`)
      .send({ email: refreshUser.email, password: refreshUser.password });
    const token = loginRes.body.refreshToken;

    // Logout to revoke
    await request(app).post(`${BASE}/logout`).send({ refreshToken: token });

    // Refresh should now fail
    const res = await request(app).post(`${BASE}/refresh`).send({ refreshToken: token });
    expect(res.status).toBe(401);
  });
});

// ─── Logout ──────────────────────────────────────────────────────────────────

describe('POST /auth/logout', () => {
  it('TC-AUTH-LO01 – returns 204 with a valid token', async () => {
    const regRes = await request(app)
      .post(`${BASE}/register`)
      .send({ name: 'Logout User', email: `logout_${Date.now()}@example.com`, password: 'LogoutPass!8' });
    const res = await request(app)
      .post(`${BASE}/logout`)
      .send({ refreshToken: regRes.body.refreshToken });
    expect(res.status).toBe(204);
  });

  it('TC-AUTH-LO02 – returns 204 even when no token is provided (idempotent)', async () => {
    const res = await request(app).post(`${BASE}/logout`).send({});
    expect(res.status).toBe(204);
  });
});
