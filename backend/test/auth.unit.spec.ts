import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from '../src/auth/auth.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from '../src/users/entities/user.entity';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

const mockUser: User = {
  id: 'uuid-001',
  email: 'user@example.com',
  password: '',
  name: 'Test User',
  refreshToken: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockRepository = {
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  update: jest.fn(),
};

const mockJwtService = {
  signAsync: jest.fn().mockResolvedValue('mock.jwt.token'),
  verify: jest.fn(),
};

const mockConfigService = {
  get: jest.fn((key: string, fallback?: string) => {
    const map: Record<string, string> = {
      JWT_SECRET: 'test-secret',
      JWT_REFRESH_SECRET: 'test-refresh-secret',
      JWT_EXPIRES_IN: '15m',
      JWT_REFRESH_EXPIRES_IN: '7d',
    };
    return map[key] ?? fallback;
  }),
};

describe('AuthService (unit)', () => {
  let service: AuthService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getRepositoryToken(User), useValue: mockRepository },
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  // ─── REGISTER ─────────────────────────────────────────────────────────────

  describe('register()', () => {
    it('TC-U-R01: should hash password and save user', async () => {
      mockRepository.findOne.mockResolvedValue(null);
      mockRepository.create.mockReturnValue({ ...mockUser });
      mockRepository.save.mockResolvedValue({ ...mockUser });
      mockRepository.update.mockResolvedValue(undefined);

      const result = await service.register({
        email: 'user@example.com',
        password: 'ValidPass1!',
        name: 'Test User',
      });

      expect(mockRepository.findOne).toHaveBeenCalledWith({ where: { email: 'user@example.com' } });
      expect(mockRepository.save).toHaveBeenCalled();
      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result.user).not.toHaveProperty('password');
    });

    it('TC-U-R02: should throw ConflictException if email exists', async () => {
      mockRepository.findOne.mockResolvedValue({ ...mockUser });

      await expect(
        service.register({ email: 'user@example.com', password: 'ValidPass1!', name: 'X' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  // ─── LOGIN ─────────────────────────────────────────────────────────────────

  describe('login()', () => {
    it('TC-U-L01: should return tokens for valid credentials', async () => {
      const hashedPassword = await bcrypt.hash('ValidPass1!', 10);
      mockRepository.findOne.mockResolvedValue({ ...mockUser, password: hashedPassword });
      mockRepository.update.mockResolvedValue(undefined);

      const result = await service.login({ email: 'user@example.com', password: 'ValidPass1!' });

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
    });

    it('TC-U-L02: should throw UnauthorizedException for unknown email', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(
        service.login({ email: 'nobody@example.com', password: 'ValidPass1!' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('TC-U-L03: should throw UnauthorizedException for wrong password', async () => {
      const hashedPassword = await bcrypt.hash('CorrectPass1!', 10);
      mockRepository.findOne.mockResolvedValue({ ...mockUser, password: hashedPassword });

      await expect(
        service.login({ email: 'user@example.com', password: 'WrongPass1!' }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  // ─── REFRESH ──────────────────────────────────────────────────────────────

  describe('refreshTokens()', () => {
    it('TC-U-RF01: should return new tokens when refresh token is valid', async () => {
      const plainRefresh = 'plain.refresh.token';
      const hashedRefresh = await bcrypt.hash(plainRefresh, 10);

      mockJwtService.verify.mockReturnValue({ sub: 'uuid-001', email: 'user@example.com' });
      mockRepository.findOne.mockResolvedValue({ ...mockUser, refreshToken: hashedRefresh });
      mockRepository.update.mockResolvedValue(undefined);

      const result = await service.refreshTokens(plainRefresh);

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
    });

    it('TC-U-RF02: should throw UnauthorizedException for tampered token', async () => {
      mockJwtService.verify.mockImplementation(() => {
        throw new Error('jwt malformed');
      });

      await expect(service.refreshTokens('bad.token')).rejects.toThrow(UnauthorizedException);
    });

    it('TC-U-RF03: should throw UnauthorizedException when stored token does not match', async () => {
      mockJwtService.verify.mockReturnValue({ sub: 'uuid-001', email: 'user@example.com' });
      const differentHashedToken = await bcrypt.hash('different.token', 10);
      mockRepository.findOne.mockResolvedValue({ ...mockUser, refreshToken: differentHashedToken });

      await expect(service.refreshTokens('original.token')).rejects.toThrow(UnauthorizedException);
    });
  });

  // ─── LOGOUT ───────────────────────────────────────────────────────────────

  describe('logout()', () => {
    it('TC-U-LO01: should nullify refreshToken in DB', async () => {
      mockRepository.update.mockResolvedValue(undefined);

      const result = await service.logout('uuid-001');

      expect(mockRepository.update).toHaveBeenCalledWith('uuid-001', { refreshToken: null });
      expect(result.message).toMatch(/logged out/i);
    });
  });
});
