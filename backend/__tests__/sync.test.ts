/**
 * TC-B01, TC-B02, TC-B03  — basic CRUD sync
 * TC-C01, TC-C02           — conflict resolution (LWW + Server-Wins)
 * TC-D01, TC-D02           — delete operations
 * TC-ISO-01               — user isolation (no cross-user data leak)
 */
import request from 'supertest';
import { v4 as uuid } from 'uuid';
import app from '../src/app';
import pool from '../src/db';

afterAll(() => pool.end());

async function registerAndLogin(
  email: string,
  deviceId: string,
): Promise<string> {
  const r = await request(app)
    .post('/auth/register')
    .send({ email, password: 'Pass123!', deviceId });
  return r.body.token as string;
}

describe('Sync — basic CRUD (TC-B01 to TC-B03)', () => {
  const deviceId = 'device-sync-basic';
  let token: string;

  beforeAll(async () => {
    token = await registerAndLogin(
      `sync-basic-${Date.now()}@test.com`,
      deviceId,
    );
  });

  it('TC-B01: push upsert creates item and pull returns it', async () => {
    const itemId = uuid();
    const pushRes = await request(app)
      .post('/sync/push')
      .set('Authorization', `Bearer ${token}`)
      .send({
        operations: [
          {
            operationId: uuid(),
            type: 'upsert',
            itemId,
            payload: { title: 'Hello', body: 'World', updatedAt: new Date().toISOString() },
            clientVersion: 0,
          },
        ],
      });
    expect(pushRes.status).toBe(200);
    expect(pushRes.body.results[0].status).toBe('ok');

    const pullRes = await request(app)
      .get('/sync/pull?cursor=1970-01-01T00:00:00Z&limit=50')
      .set('Authorization', `Bearer ${token}`);
    expect(pullRes.status).toBe(200);
    const item = pullRes.body.items.find((i: any) => i.id === itemId);
    expect(item).toBeDefined();
    expect(item.title).toBe('Hello');
  });

  it('TC-B02: push upsert updates existing item', async () => {
    const itemId = uuid();
    // Create
    await request(app)
      .post('/sync/push')
      .set('Authorization', `Bearer ${token}`)
      .send({
        operations: [
          {
            operationId: uuid(),
            type: 'upsert',
            itemId,
            payload: { title: 'v1', body: null, updatedAt: new Date().toISOString() },
            clientVersion: 0,
          },
        ],
      });

    // Update (version=1 now on server)
    const upd = await request(app)
      .post('/sync/push')
      .set('Authorization', `Bearer ${token}`)
      .send({
        operations: [
          {
            operationId: uuid(),
            type: 'upsert',
            itemId,
            payload: { title: 'v2', body: null, updatedAt: new Date(Date.now() + 1000).toISOString() },
            clientVersion: 1,
          },
        ],
      });
    expect(upd.status).toBe(200);
    expect(upd.body.results[0].status).toBe('ok');
    expect(upd.body.results[0].serverItem.title).toBe('v2');
  });

  it('TC-B03: cursor advances after pull', async () => {
    const c1 = await request(app)
      .get('/sync/cursor')
      .set('Authorization', `Bearer ${token}`);
    expect(c1.status).toBe(200);
    const cursorBefore = c1.body.cursor;

    // Push a new item to advance cursor
    await request(app)
      .post('/sync/push')
      .set('Authorization', `Bearer ${token}`)
      .send({
        operations: [
          {
            operationId: uuid(),
            type: 'upsert',
            itemId: uuid(),
            payload: { title: 'advance', updatedAt: new Date().toISOString() },
            clientVersion: 0,
          },
        ],
      });

    await request(app)
      .get('/sync/pull?cursor=' + encodeURIComponent(cursorBefore) + '&limit=50')
      .set('Authorization', `Bearer ${token}`);

    const c2 = await request(app)
      .get('/sync/cursor')
      .set('Authorization', `Bearer ${token}`);
    expect(new Date(c2.body.cursor).getTime()).toBeGreaterThanOrEqual(
      new Date(cursorBefore).getTime(),
    );
  });
});

describe('Sync — conflict resolution (TC-C01, TC-C02)', () => {
  const deviceId = 'device-conflict';
  let token: string;

  beforeAll(async () => {
    token = await registerAndLogin(
      `sync-conflict-${Date.now()}@test.com`,
      deviceId,
    );
  });

  it('TC-C01: LWW — client wins when client timestamp is newer', async () => {
    const itemId = uuid();
    const serverTs = new Date('2024-01-01T10:00:00Z');

    // Seed item at version 1
    await request(app)
      .post('/sync/push')
      .set('Authorization', `Bearer ${token}`)
      .send({
        operations: [
          {
            operationId: uuid(),
            type: 'upsert',
            itemId,
            payload: { title: 'server-value', updatedAt: serverTs.toISOString() },
            clientVersion: 0,
          },
        ],
      });

    // Simulate another device updating it (version → 2)
    await pool.query(
      `UPDATE items SET version=2, updated_at=$1, server_updated_at=NOW()
        WHERE id=$2`,
      [new Date('2024-01-01T11:00:00Z'), itemId],
    );

    // Client pushes with stale clientVersion=1 but NEWER timestamp
    const clientTs = new Date('2024-01-01T12:00:00Z');
    const res = await request(app)
      .post('/sync/push')
      .set('Authorization', `Bearer ${token}`)
      .send({
        operations: [
          {
            operationId: uuid(),
            type: 'upsert',
            itemId,
            payload: { title: 'client-wins-value', updatedAt: clientTs.toISOString() },
            clientVersion: 1,  // stale — server is at 2
          },
        ],
      });

    expect(res.status).toBe(200);
    const r = res.body.results[0];
    expect(r.status).toBe('conflict_resolved');
    expect(r.resolution).toBe('lww_client');
    expect(r.serverItem.title).toBe('client-wins-value');
  });

  it('TC-C02: LWW — server wins when server timestamp is newer', async () => {
    const itemId = uuid();
    const serverTs = new Date('2024-02-01T12:00:00Z');

    await request(app)
      .post('/sync/push')
      .set('Authorization', `Bearer ${token}`)
      .send({
        operations: [
          {
            operationId: uuid(),
            type: 'upsert',
            itemId,
            payload: { title: 'server-newer', updatedAt: serverTs.toISOString() },
            clientVersion: 0,
          },
        ],
      });

    // Bump server version
    await pool.query(
      `UPDATE items SET version=2, updated_at=$1, server_updated_at=NOW()
        WHERE id=$2`,
      [serverTs, itemId],
    );

    // Client pushes with OLDER timestamp
    const oldClientTs = new Date('2024-02-01T10:00:00Z');
    const res = await request(app)
      .post('/sync/push')
      .set('Authorization', `Bearer ${token}`)
      .send({
        operations: [
          {
            operationId: uuid(),
            type: 'upsert',
            itemId,
            payload: { title: 'client-old', updatedAt: oldClientTs.toISOString() },
            clientVersion: 1,
          },
        ],
      });

    expect(res.status).toBe(200);
    const r = res.body.results[0];
    expect(r.status).toBe('conflict_resolved');
    expect(r.resolution).toBe('lww_server');
    expect(r.serverItem.title).toBe('server-newer'); // server value preserved
  });

  it('TC-C-TIE: exact timestamp tie → server_wins', async () => {
    const itemId = uuid();
    const ts = new Date('2024-03-01T00:00:00Z');

    await request(app)
      .post('/sync/push')
      .set('Authorization', `Bearer ${token}`)
      .send({
        operations: [
          {
            operationId: uuid(),
            type: 'upsert',
            itemId,
            payload: { title: 'tie-server', updatedAt: ts.toISOString() },
            clientVersion: 0,
          },
        ],
      });

    await pool.query(
      `UPDATE items SET version=2, updated_at=$1, server_updated_at=NOW() WHERE id=$2`,
      [ts, itemId],
    );

    const res = await request(app)
      .post('/sync/push')
      .set('Authorization', `Bearer ${token}`)
      .send({
        operations: [
          {
            operationId: uuid(),
            type: 'upsert',
            itemId,
            payload: { title: 'tie-client', updatedAt: ts.toISOString() },
            clientVersion: 1,
          },
        ],
      });

    expect(res.status).toBe(200);
    const r = res.body.results[0];
    expect(r.resolution).toBe('server_wins');
    expect(r.serverItem.title).toBe('tie-server');
  });
});

describe('Sync — delete (TC-D01, TC-D02)', () => {
  const deviceId = 'device-delete';
  let token: string;

  beforeAll(async () => {
    token = await registerAndLogin(
      `sync-delete-${Date.now()}@test.com`,
      deviceId,
    );
  });

  it('TC-D01: soft delete is propagated on pull', async () => {
    const itemId = uuid();
    await request(app)
      .post('/sync/push')
      .set('Authorization', `Bearer ${token}`)
      .send({
        operations: [
          {
            operationId: uuid(),
            type: 'upsert',
            itemId,
            payload: { title: 'to-delete', updatedAt: new Date().toISOString() },
            clientVersion: 0,
          },
        ],
      });

    await request(app)
      .post('/sync/push')
      .set('Authorization', `Bearer ${token}`)
      .send({
        operations: [
          {
            operationId: uuid(),
            type: 'delete',
            itemId,
            clientVersion: 1,
          },
        ],
      });

    const pull = await request(app)
      .get('/sync/pull?cursor=1970-01-01T00:00:00Z&limit=100')
      .set('Authorization', `Bearer ${token}`);
    const item = pull.body.items.find((i: any) => i.id === itemId);
    expect(item?.deletedAt).not.toBeNull();
  });

  it('TC-D02: deleting non-existent item is idempotent (skipped)', async () => {
    const res = await request(app)
      .post('/sync/push')
      .set('Authorization', `Bearer ${token}`)
      .send({
        operations: [
          {
            operationId: uuid(),
            type: 'delete',
            itemId: uuid(),
            clientVersion: 1,
          },
        ],
      });
    expect(res.status).toBe(200);
    expect(res.body.results[0].status).toBe('skipped');
  });
});

describe('Sync — user isolation (TC-ISO-01)', () => {
  it('user A cannot see user B items', async () => {
    const tokenA = await registerAndLogin(
      `iso-a-${Date.now()}@test.com`,
      'device-iso-a',
    );
    const tokenB = await registerAndLogin(
      `iso-b-${Date.now()}@test.com`,
      'device-iso-b',
    );

    const itemId = uuid();
    await request(app)
      .post('/sync/push')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        operations: [
          {
            operationId: uuid(),
            type: 'upsert',
            itemId,
            payload: { title: 'user-A-secret', updatedAt: new Date().toISOString() },
            clientVersion: 0,
          },
        ],
      });

    const pullB = await request(app)
      .get('/sync/pull?cursor=1970-01-01T00:00:00Z&limit=100')
      .set('Authorization', `Bearer ${tokenB}`);

    expect(pullB.status).toBe(200);
    const ids = pullB.body.items.map((i: any) => i.id);
    expect(ids).not.toContain(itemId);
  });
});
