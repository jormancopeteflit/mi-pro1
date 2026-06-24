/**
 * SyncService — core business logic
 *
 * Conflict resolution strategy:
 *   • LWW (Last-Write-Wins) by updated_at timestamp.
 *   • On tie → Server-Wins (safe default).
 *
 * This eliminates blind retry of HTTP 409 (DEF-03).
 */
import { PoolClient } from 'pg';
import { v4 as uuid } from 'uuid';
import pool from '../db';
import { SyncOperation } from './syncRouter';
import { PushService } from '../push/pushService';

const pushSvc = new PushService();

export interface PullResult {
  items: ServerItem[];
  nextCursor: string;
  hasMore: boolean;
}

export interface OperationResult {
  operationId: string;
  itemId: string;
  status: 'ok' | 'conflict_resolved' | 'skipped';
  resolution?: 'lww_server' | 'lww_client' | 'server_wins' | 'delete_wins';
  serverItem?: ServerItem;
}

export interface ServerItem {
  id: string;
  userId: string;
  title: string;
  body: string | null;
  version: number;
  updatedAt: string;
  deletedAt: string | null;
  serverUpdatedAt: string;
}

export class SyncService {
  // ── cursor ─────────────────────────────────────────────────────────────────
  async getCursor(userId: string, deviceId: string): Promise<string> {
    const r = await pool.query(
      `SELECT cursor FROM sync_cursors WHERE user_id=$1 AND device_id=$2`,
      [userId, deviceId],
    );
    return r.rows[0]?.cursor ?? '1970-01-01T00:00:00.000Z';
  }

  private async upsertCursor(
    client: PoolClient,
    userId: string,
    deviceId: string,
    cursor: string,
  ): Promise<void> {
    await client.query(
      `INSERT INTO sync_cursors(user_id, device_id, cursor, updated_at)
         VALUES($1,$2,$3,NOW())
         ON CONFLICT (user_id, device_id)
         DO UPDATE SET cursor=$3, updated_at=NOW()`,
      [userId, deviceId, cursor],
    );
  }

  // ── pull ───────────────────────────────────────────────────────────────────
  async pull(
    userId: string,
    deviceId: string,
    cursor: string,
    limit: number,
  ): Promise<PullResult> {
    const r = await pool.query(
      `SELECT id, user_id, title, body, version, updated_at, deleted_at, server_updated_at
         FROM items
        WHERE user_id = $1
          AND server_updated_at > $2
        ORDER BY server_updated_at ASC
        LIMIT $3`,
      [userId, cursor, limit + 1],
    );

    const hasMore = r.rows.length > limit;
    const rows = hasMore ? r.rows.slice(0, limit) : r.rows;

    const items: ServerItem[] = rows.map(this.rowToItem);
    const nextCursor =
      rows.length > 0
        ? rows[rows.length - 1].server_updated_at.toISOString()
        : cursor;

    // Update cursor so future pulls are efficient
    const client = await pool.connect();
    try {
      await this.upsertCursor(client, userId, deviceId, nextCursor);
    } finally {
      client.release();
    }

    return { items, nextCursor, hasMore };
  }

  // ── push ───────────────────────────────────────────────────────────────────
  async push(
    userId: string,
    deviceId: string,
    operations: SyncOperation[],
  ): Promise<OperationResult[]> {
    const results: OperationResult[] = [];

    for (const op of operations) {
      const result = await this.applyOperation(userId, deviceId, op);
      results.push(result);
    }

    // Fire push notifications to OTHER devices of the same user
    await pushSvc
      .notifyOtherDevices(userId, deviceId, {
        type: 'sync_available',
        updatedItemCount: results.filter((r) => r.status !== 'skipped').length,
      })
      .catch(() => {/* push failures must not break sync */});

    return results;
  }

  // ── single operation (transactional) ──────────────────────────────────────
  private async applyOperation(
    userId: string,
    deviceId: string,
    op: SyncOperation,
  ): Promise<OperationResult> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Fetch current server state (FOR UPDATE to prevent race)
      const existing = await client.query(
        `SELECT id, user_id, title, body, version, updated_at, deleted_at, server_updated_at
           FROM items
          WHERE id = $1 AND user_id = $2
          FOR UPDATE`,
        [op.itemId, userId],
      );

      let result: OperationResult;

      if (op.type === 'delete') {
        result = await this.handleDelete(client, userId, deviceId, op, existing.rows[0]);
      } else {
        result = await this.handleUpsert(client, userId, deviceId, op, existing.rows[0]);
      }

      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  // ── upsert with LWW conflict resolution ───────────────────────────────────
  private async handleUpsert(
    client: PoolClient,
    userId: string,
    deviceId: string,
    op: SyncOperation,
    serverRow: any,
  ): Promise<OperationResult> {
    const clientUpdatedAt = new Date(op.payload!.updatedAt);

    if (!serverRow) {
      // Item does not exist on server → create it
      const newVersion = 1;
      await client.query(
        `INSERT INTO items(id, user_id, title, body, version, updated_at, server_updated_at)
           VALUES($1,$2,$3,$4,$5,$6,NOW())`,
        [
          op.itemId,
          userId,
          op.payload!.title ?? '',
          op.payload!.body ?? null,
          newVersion,
          clientUpdatedAt,
        ],
      );
      const created = await this.fetchItem(client, op.itemId, userId);
      return {
        operationId: op.operationId,
        itemId: op.itemId,
        status: 'ok',
        serverItem: created,
      };
    }

    // Item exists — check for conflict
    const serverUpdatedAt = new Date(serverRow.updated_at);
    const serverVersion: number = serverRow.version;

    if (op.clientVersion === serverVersion) {
      // No conflict — fast-path apply
      const nextVersion = serverVersion + 1;
      await client.query(
        `UPDATE items
            SET title=$1, body=$2, version=$3, updated_at=$4, server_updated_at=NOW()
          WHERE id=$5 AND user_id=$6`,
        [
          op.payload!.title ?? serverRow.title,
          op.payload!.body ?? serverRow.body,
          nextVersion,
          clientUpdatedAt,
          op.itemId,
          userId,
        ],
      );
      const updated = await this.fetchItem(client, op.itemId, userId);
      return {
        operationId: op.operationId,
        itemId: op.itemId,
        status: 'ok',
        serverItem: updated,
      };
    }

    // ── CONFLICT: versions diverged ────────────────────────────────────────
    // LWW: whichever has the later updated_at timestamp wins.
    // On exact tie → Server-Wins.
    let resolution: OperationResult['resolution'];
    let winner: 'client' | 'server';

    if (clientUpdatedAt > serverUpdatedAt) {
      winner = 'client';
      resolution = 'lww_client';
    } else {
      winner = 'server';
      resolution = clientUpdatedAt.getTime() === serverUpdatedAt.getTime()
        ? 'server_wins'
        : 'lww_server';
    }

    // Log the conflict regardless of winner
    await client.query(
      `INSERT INTO conflict_log
         (id, item_id, user_id, device_id, client_version, server_version, resolution)
         VALUES($1,$2,$3,$4,$5,$6,$7)`,
      [
        uuid(),
        op.itemId,
        userId,
        deviceId,
        op.clientVersion,
        serverVersion,
        resolution,
      ],
    );

    if (winner === 'client') {
      const nextVersion = serverVersion + 1;
      await client.query(
        `UPDATE items
            SET title=$1, body=$2, version=$3, updated_at=$4, server_updated_at=NOW()
          WHERE id=$5 AND user_id=$6`,
        [
          op.payload!.title ?? serverRow.title,
          op.payload!.body ?? serverRow.body,
          nextVersion,
          clientUpdatedAt,
          op.itemId,
          userId,
        ],
      );
    }
    // server_wins → no write needed, server state is already correct

    const finalItem = await this.fetchItem(client, op.itemId, userId);
    return {
      operationId: op.operationId,
      itemId: op.itemId,
      status: 'conflict_resolved',
      resolution,
      serverItem: finalItem,
    };
  }

  // ── delete ────────────────────────────────────────────────────────────────
  private async handleDelete(
    client: PoolClient,
    userId: string,
    deviceId: string,
    op: SyncOperation,
    serverRow: any,
  ): Promise<OperationResult> {
    if (!serverRow || serverRow.deleted_at) {
      // Already deleted or never existed → idempotent skip
      return {
        operationId: op.operationId,
        itemId: op.itemId,
        status: 'skipped',
      };
    }

    const serverVersion: number = serverRow.version;

    if (op.clientVersion !== serverVersion) {
      // Conflict: server has newer version. Delete wins (delete-wins policy).
      await client.query(
        `INSERT INTO conflict_log
           (id, item_id, user_id, device_id, client_version, server_version, resolution)
           VALUES($1,$2,$3,$4,$5,$6,$7)`,
        [
          uuid(),
          op.itemId,
          userId,
          deviceId,
          op.clientVersion,
          serverVersion,
          'delete_wins',
        ],
      );
    }

    await client.query(
      `UPDATE items
          SET deleted_at=NOW(), server_updated_at=NOW()
        WHERE id=$1 AND user_id=$2`,
      [op.itemId, userId],
    );

    return {
      operationId: op.operationId,
      itemId: op.itemId,
      status: op.clientVersion !== serverVersion ? 'conflict_resolved' : 'ok',
      resolution: op.clientVersion !== serverVersion ? 'delete_wins' : undefined,
    };
  }

  // ── helpers ───────────────────────────────────────────────────────────────
  private async fetchItem(
    client: PoolClient,
    itemId: string,
    userId: string,
  ): Promise<ServerItem> {
    const r = await client.query(
      `SELECT id, user_id, title, body, version, updated_at, deleted_at, server_updated_at
         FROM items WHERE id=$1 AND user_id=$2`,
      [itemId, userId],
    );
    return this.rowToItem(r.rows[0]);
  }

  private rowToItem(row: any): ServerItem {
    return {
      id: row.id,
      userId: row.user_id,
      title: row.title,
      body: row.body,
      version: Number(row.version),
      updatedAt: row.updated_at instanceof Date
        ? row.updated_at.toISOString()
        : row.updated_at,
      deletedAt: row.deleted_at
        ? (row.deleted_at instanceof Date ? row.deleted_at.toISOString() : row.deleted_at)
        : null,
      serverUpdatedAt: row.server_updated_at instanceof Date
        ? row.server_updated_at.toISOString()
        : row.server_updated_at,
    };
  }
}
