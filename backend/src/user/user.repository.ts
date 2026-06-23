/**
 * In-memory user repository.
 * Replace with a DB-backed implementation in production.
 */

export interface UserRecord {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  createdAt: Date;
}

export class UserRepository {
  private store: Map<string, UserRecord> = new Map();

  async findByEmail(email: string): Promise<UserRecord | null> {
    for (const user of this.store.values()) {
      if (user.email === email) return user;
    }
    return null;
  }

  async findById(id: string): Promise<UserRecord | null> {
    return this.store.get(id) ?? null;
  }

  async create(data: { id: string; email: string; name: string; passwordHash: string }): Promise<UserRecord> {
    const user: UserRecord = { ...data, createdAt: new Date() };
    this.store.set(data.id, user);
    return user;
  }
}
