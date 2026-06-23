import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { UserRepository } from '../user/user.repository';
import { RefreshTokenRepository } from './refreshToken.repository';

const ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET || 'dev_access_secret';
const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET || 'dev_refresh_secret';
const ACCESS_TOKEN_EXPIRES_IN = process.env.ACCESS_TOKEN_EXPIRES_IN || '15m';
const REFRESH_TOKEN_EXPIRES_IN = process.env.REFRESH_TOKEN_EXPIRES_IN || '30d';
const SALT_ROUNDS = 12;

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface RegisterInput {
  email: string;
  password: string;
  name: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export class AuthService {
  private userRepo: UserRepository;
  private refreshTokenRepo: RefreshTokenRepository;

  constructor() {
    this.userRepo = new UserRepository();
    this.refreshTokenRepo = new RefreshTokenRepository();
  }

  async register(input: RegisterInput): Promise<AuthTokens & { user: { id: string; email: string; name: string } }> {
    const existing = await this.userRepo.findByEmail(input.email);
    if (existing) {
      const err: any = new Error('Email already registered');
      err.code = 'USER_EXISTS';
      throw err;
    }

    const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);
    const user = await this.userRepo.create({
      id: uuidv4(),
      email: input.email.toLowerCase().trim(),
      name: input.name.trim(),
      passwordHash,
    });

    const tokens = await this._generateTokens(user.id, user.email);
    return { ...tokens, user: { id: user.id, email: user.email, name: user.name } };
  }

  async login(input: LoginInput): Promise<AuthTokens & { user: { id: string; email: string; name: string } }> {
    const user = await this.userRepo.findByEmail(input.email.toLowerCase().trim());
    if (!user) {
      const err: any = new Error('Invalid credentials');
      err.code = 'INVALID_CREDENTIALS';
      throw err;
    }

    const valid = await bcrypt.compare(input.password, user.passwordHash);
    if (!valid) {
      const err: any = new Error('Invalid credentials');
      err.code = 'INVALID_CREDENTIALS';
      throw err;
    }

    const tokens = await this._generateTokens(user.id, user.email);
    return { ...tokens, user: { id: user.id, email: user.email, name: user.name } };
  }

  async refresh(token: string): Promise<Pick<AuthTokens, 'accessToken' | 'expiresIn'>> {
    let payload: any;
    try {
      payload = jwt.verify(token, REFRESH_TOKEN_SECRET);
    } catch (e: any) {
      const err: any = new Error('Refresh token expired or invalid');
      err.code = e.name === 'TokenExpiredError' ? 'TOKEN_EXPIRED' : 'INVALID_REFRESH_TOKEN';
      throw err;
    }

    const stored = await this.refreshTokenRepo.findByToken(token);
    if (!stored || stored.revoked) {
      const err: any = new Error('Refresh token has been revoked');
      err.code = 'INVALID_REFRESH_TOKEN';
      throw err;
    }

    const expiresInSeconds = 15 * 60; // 15 minutes in seconds
    const accessToken = jwt.sign(
      { sub: payload.sub, email: payload.email },
      ACCESS_TOKEN_SECRET,
      { expiresIn: ACCESS_TOKEN_EXPIRES_IN } as any,
    );

    return { accessToken, expiresIn: expiresInSeconds };
  }

  async revokeRefreshToken(token: string): Promise<void> {
    await this.refreshTokenRepo.revoke(token);
  }

  // ─── Private helpers ──────────────────────────────────────────────────────────

  private async _generateTokens(userId: string, email: string): Promise<AuthTokens> {
    const expiresInSeconds = 15 * 60;
    const accessToken = jwt.sign(
      { sub: userId, email },
      ACCESS_TOKEN_SECRET,
      { expiresIn: ACCESS_TOKEN_EXPIRES_IN } as any,
    );

    const refreshToken = jwt.sign(
      { sub: userId, email, jti: uuidv4() },
      REFRESH_TOKEN_SECRET,
      { expiresIn: REFRESH_TOKEN_EXPIRES_IN } as any,
    );

    await this.refreshTokenRepo.save({
      token: refreshToken,
      userId,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    });

    return { accessToken, refreshToken, expiresIn: expiresInSeconds };
  }
}
