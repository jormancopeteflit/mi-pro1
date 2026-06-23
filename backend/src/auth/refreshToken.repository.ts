/**
 * In-memory repository for refresh tokens.
 * Replace with a DB implementation (e.g. TypeORM / Prisma) in production.
 */

export interface RefreshTokenRecord {
  token: string;
  userId: string;
  expiresAt: Date;
  revoked: boolean;
  createdAt: Date;
}

export class RefreshTokenRepository {
  /** In tests this is replaced by the in-memory store seeded via the constructor. */
  private store: Map<string, RefreshTokenRecord> = new Map();

  async save(data: { token: string; userId: string; expiresAt: Date }): Promise<RefreshTokenRecord> {
    const record: RefreshTokenRecord = {
      ...data,
      revoked: false,
      createdAt: new Date(),
    };
    this.store.set(data.token, record);
    return record;
  }

  async findByToken(token: string): Promise<RefreshTokenRecord | null> {
    return this.store.get(token) ?? null;
  }

  async revoke(token: string): Promise<void> {
    const record = this.store.get(token);
    if (record) {
      record.revoked = true;
      this.store.set(token, record);
    }
  }

  async revokeAllForUser(userId: string): Promise<void> {
    for (const [key, record] of this.store.entries()) {
      if (record.userId === userId) {
        record.revoked = true;
        this.store.set(key, record);
      }
    }
  }
}
