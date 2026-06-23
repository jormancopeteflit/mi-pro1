/**
 * Pruebas automatizadas del endpoint POST /auth/register
 * Ejecutar con: npx jest src/auth/register.test.ts
 */

import request from 'supertest';
import express from 'express';
import { registerHandler } from './register';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.post('/auth/register', registerHandler);
  return app;
}

describe('POST /auth/register', () => {
  const app = buildApp();

  const validPayload = {
    email: 'alice@example.com',
    password: 'SuperSecret1',
    displayName: 'Alice',
  };

  // ── Casos de éxito ────────────────────────────────────────────────────────
  it('TC-REG-01: devuelve 201 con token y datos públicos del usuario', async () => {
    const res = await request(app).post('/auth/register').send(validPayload);
    expect(res.status).toBe(201);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.email).toBe('alice@example.com');
    expect(res.body.user.passwordHash).toBeUndefined(); // no exponer hash
  });

  // ── Conflicto (regla de resolución: no hay merge, se informa al cliente) ──
  it('TC-REG-02 (TC-C01): devuelve 409 con code EMAIL_ALREADY_EXISTS cuando el email ya existe', async () => {
    // Primer registro ya realizado en TC-REG-01 (mismo proceso)
    const res = await request(app).post('/auth/register').send(validPayload);
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('EMAIL_ALREADY_EXISTS');
    // El 409 lleva información suficiente para que el cliente resuelva el
    // conflicto sin reintentar ciegamente (cumple DEF-03).
  });

  // ── Validaciones ─────────────────────────────────────────────────────────
  it('TC-REG-03: devuelve 400 con email inválido', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({ ...validPayload, email: 'not-an-email' });
    expect(res.status).toBe(400);
  });

  it('TC-REG-04: devuelve 400 con contraseña corta (<8 chars)', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({ ...validPayload, email: 'bob@example.com', password: '123' });
    expect(res.status).toBe(400);
  });

  it('TC-REG-05: devuelve 400 con displayName vacío', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({ ...validPayload, email: 'carol@example.com', displayName: '   ' });
    expect(res.status).toBe(400);
  });

  it('TC-REG-06: devuelve 400 con body vacío', async () => {
    const res = await request(app).post('/auth/register').send({});
    expect(res.status).toBe(400);
  });

  // ── Normalización ─────────────────────────────────────────────────────────
  it('TC-REG-07: email se almacena en minúsculas', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({ email: 'Dave@Example.COM', password: 'Password1', displayName: 'Dave' });
    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe('dave@example.com');
  });
});
