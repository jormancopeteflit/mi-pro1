import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { DataSource } from 'typeorm';

describe('Auth API (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let accessToken: string;
  let refreshToken: string;

  const testUser = {
    email: `test_${Date.now()}@example.com`,
    password: 'TestPassword123!',
    name: 'Test User',
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }));
    await app.init();

    dataSource = moduleFixture.get<DataSource>(DataSource);
  });

  afterAll(async () => {
    // Clean up test user
    await dataSource.query(`DELETE FROM users WHERE email = $1`, [testUser.email]);
    await app.close();
  });

  // ─── REGISTER ─────────────────────────────────────────────────────────────

  describe('POST /auth/register', () => {
    it('TC-AUTH-R01: should register a new user and return tokens', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .send(testUser)
        .expect(201);

      expect(res.body).toHaveProperty('accessToken');
      expect(res.body).toHaveProperty('refreshToken');
      expect(res.body.user.email).toBe(testUser.email);
      expect(res.body.user).not.toHaveProperty('password');
      expect(res.body.user).not.toHaveProperty('refreshToken');
    });

    it('TC-AUTH-R02: should return 409 when email already exists', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .send(testUser)
        .expect(409);

      expect(res.body.message).toMatch(/already registered/i);
    });

    it('TC-AUTH-R03: should return 400 for invalid email', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ ...testUser, email: 'not-an-email' })
        .expect(400);
    });

    it('TC-AUTH-R04: should return 400 for short password', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ ...testUser, email: 'other@example.com', password: 'short' })
        .expect(400);
    });

    it('TC-AUTH-R05: should return 400 when required fields are missing', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'missing@example.com' })
        .expect(400);
    });
  });

  // ─── LOGIN ────────────────────────────────────────────────────────────────

  describe('POST /auth/login', () => {
    it('TC-AUTH-L01: should login with valid credentials and return tokens', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: testUser.email, password: testUser.password })
        .expect(200);

      expect(res.body).toHaveProperty('accessToken');
      expect(res.body).toHaveProperty('refreshToken');
      expect(res.body.user.email).toBe(testUser.email);

      accessToken = res.body.accessToken;
      refreshToken = res.body.refreshToken;
    });

    it('TC-AUTH-L02: should return 401 for wrong password', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: testUser.email, password: 'WrongPassword!' })
        .expect(401);

      expect(res.body.message).toMatch(/invalid credentials/i);
    });

    it('TC-AUTH-L03: should return 401 for non-existent user', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'ghost@example.com', password: 'SomePassword123' })
        .expect(401);
    });

    it('TC-AUTH-L04: should return 400 for invalid email format', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'bad-email', password: 'SomePassword123' })
        .expect(400);
    });
  });

  // ─── REFRESH ─────────────────────────────────────────────────────────────

  describe('POST /auth/refresh', () => {
    it('TC-AUTH-RF01: should return new access and refresh tokens', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken })
        .expect(200);

      expect(res.body).toHaveProperty('accessToken');
      expect(res.body).toHaveProperty('refreshToken');

      // Rotate tokens for next tests
      accessToken = res.body.accessToken;
      refreshToken = res.body.refreshToken;
    });

    it('TC-AUTH-RF02: should return 401 for invalid refresh token', async () => {
      await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken: 'totally.invalid.token' })
        .expect(401);
    });

    it('TC-AUTH-RF03: old refresh token should be rejected after rotation', async () => {
      // The previous refreshToken was already rotated in RF01 — reuse the old one
      const oldToken = refreshToken; // this was already rotated once
      // Log in fresh to get a known-good pair
      const loginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: testUser.email, password: testUser.password })
        .expect(200);

      const freshRefresh = loginRes.body.refreshToken;

      // Rotate once
      await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken: freshRefresh })
        .expect(200);

      // Attempt to reuse the already-rotated token
      await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken: freshRefresh })
        .expect(401);
    });

    it('TC-AUTH-RF04: should return 400 when refreshToken field is missing', async () => {
      await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({})
        .expect(400);
    });
  });

  // ─── LOGOUT ──────────────────────────────────────────────────────────────

  describe('POST /auth/logout', () => {
    it('TC-AUTH-LO01: should logout successfully with valid token', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.message).toMatch(/logged out/i);
    });

    it('TC-AUTH-LO02: refresh token should be invalid after logout', async () => {
      await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken })
        .expect(401);
    });

    it('TC-AUTH-LO03: should return 401 without auth header', async () => {
      await request(app.getHttpServer())
        .post('/auth/logout')
        .expect(401);
    });
  });
});
