import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockUserService, mockRefreshTokenRepository, mockPasswordManager, mockTokenManager } = vi.hoisted(() => ({
  mockUserService: {
    createUser: vi.fn(),
    findUserByEmail: vi.fn(),
    findUserById: vi.fn()
  },
  mockRefreshTokenRepository: {
    create: vi.fn(),
    deleteByHash: vi.fn(),
    revokeAllForUser: vi.fn(),
    rotateToken: vi.fn()
  },
  mockPasswordManager: {
    createPasswordHash: vi.fn(),
    verifyPasswordHash: vi.fn()
  },
  mockTokenManager: {
    generateAccessToken: vi.fn(),
    generateRefreshToken: vi.fn(),
    generateRefreshTokenHash: vi.fn(),
    getRefreshTokenExpiryDate: vi.fn(),
    verifyRefreshToken: vi.fn()
  }
}));

vi.mock('../../../users/service/user-service', () => ({
  default: vi.fn(function UserServiceMock() {
    return mockUserService;
  })
}));

vi.mock('../../repository/user-refresh-token-repository', () => ({
  default: vi.fn(function UserRefreshTokenRepositoryMock() {
    return mockRefreshTokenRepository;
  })
}));

vi.mock('../../../../utils/password-manager/password-manager', () => ({
  default: vi.fn(function PasswordManagerMock() {
    return mockPasswordManager;
  })
}));

vi.mock('../../../../utils/token-manager/token-manager', () => ({
  TokenManager: vi.fn(function TokenManagerMock() {
    return mockTokenManager;
  })
}));

vi.mock('nanoid', () => ({
  nanoid: vi.fn(() => 'fixed-nanoid')
}));

import AuthService from '../auth-service.js';
import {
  RefreshTokenExpiredError,
  RefreshTokenNotFoundError,
  RefreshTokenOwnershipError,
  RefreshTokenRevokedError
} from '../../../../exceptions/exceptions.js';
import type { UserSchema } from '../../../../models/user-model.js';

const createUserFixture = (overrides: Partial<UserSchema> = {}): UserSchema => ({
  id: 'internal-uuid-1',
  userId: 'user-public-id-1',
  name: 'Alice',
  contacts: { email: 'alice@example.com', phone: '+15551234567' },
  passwordHash: 'hashed-password',
  birthdate: new Date('1990-01-01'),
  status: 'active',
  profilePictureUrl: null,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  deletedAt: null,
  ...overrides
});

describe('AuthService', () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let authService: AuthService;

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    mockTokenManager.generateAccessToken.mockReturnValue('generated-access-token');
    mockTokenManager.generateRefreshToken.mockReturnValue('generated-refresh-token');
    mockTokenManager.generateRefreshTokenHash.mockImplementation(
      ({ refreshToken }: { refreshToken: string }) => `hash-of-${refreshToken}`
    );
    mockTokenManager.getRefreshTokenExpiryDate.mockReturnValue(new Date('2099-01-01'));
    mockPasswordManager.createPasswordHash.mockResolvedValue('hashed-password');
    mockPasswordManager.verifyPasswordHash.mockResolvedValue(true);

    authService = new AuthService();
  });

  const getLoggedOutput = (): string =>
    (consoleLogSpy.mock.calls as unknown[][]).map((call) => call.join(' ')).join('\n');

  describe('createUser', () => {
    it('hashes the password, generates a userId, and delegates to userService.createUser', async () => {
      const createdUser = createUserFixture();
      mockUserService.createUser.mockResolvedValueOnce(createdUser);

      const result = await authService.createUser({
        name: 'Alice',
        phone: '+15551234567',
        email: 'alice@example.com',
        password: 'plain-text-password',
        birthdate: new Date('1990-01-01')
      });

      expect(mockPasswordManager.createPasswordHash).toHaveBeenCalledWith({ password: 'plain-text-password' });
      expect(mockUserService.createUser).toHaveBeenCalledWith({
        user: {
          userId: 'fixed-nanoid',
          name: 'Alice',
          contacts: { phone: '+15551234567', email: 'alice@example.com' },
          passwordHash: 'hashed-password',
          birthdate: new Date('1990-01-01')
        }
      });
      expect(result).toEqual(createdUser);
    });
  });

  describe('authenticateUser', () => {
    it('throws UnauthorizedError when no user matches the email', async () => {
      mockUserService.findUserByEmail.mockResolvedValueOnce(null);

      await expect(authService.authenticateUser({ email: 'nobody@example.com', password: 'x' }))
        .rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });

      expect(mockPasswordManager.verifyPasswordHash).not.toHaveBeenCalled();
      expect(mockRefreshTokenRepository.create).not.toHaveBeenCalled();
    });

    it('throws UnauthorizedError when the password does not match', async () => {
      mockUserService.findUserByEmail.mockResolvedValueOnce(createUserFixture());
      mockPasswordManager.verifyPasswordHash.mockResolvedValueOnce(false);

      await expect(authService.authenticateUser({ email: 'alice@example.com', password: 'wrong' }))
        .rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });

      expect(mockRefreshTokenRepository.create).not.toHaveBeenCalled();
    });

    it('generates tokens, stores the refresh token hash, and returns the tokens on success', async () => {
      const user = createUserFixture();
      mockUserService.findUserByEmail.mockResolvedValueOnce(user);

      const result = await authService.authenticateUser({
        email: 'alice@example.com',
        password: 'correct',
        userAgent: 'TestBrowser/1.0'
      });

      expect(mockTokenManager.generateAccessToken).toHaveBeenCalledWith({ payload: { userId: user.userId } });
      expect(mockTokenManager.generateRefreshToken).toHaveBeenCalledWith({ payload: { userId: user.userId } });
      expect(mockRefreshTokenRepository.create).toHaveBeenCalledWith({
        userId: user.id,
        tokenHash: 'hash-of-generated-refresh-token',
        expiresAt: new Date('2099-01-01'),
        deviceId: 'unknown',
        userAgent: 'TestBrowser/1.0'
      });
      expect(result).toEqual({
        accessToken: 'generated-access-token',
        refreshToken: 'generated-refresh-token',
        userId: user.userId
      });
    });

    it('defaults userAgent to "unknown" when not provided', async () => {
      mockUserService.findUserByEmail.mockResolvedValueOnce(createUserFixture());

      await authService.authenticateUser({ email: 'alice@example.com', password: 'correct' });

      expect(mockRefreshTokenRepository.create).toHaveBeenCalledWith(expect.objectContaining({ userAgent: 'unknown' }));
    });
  });

  describe('refreshToken', () => {
    it('throws UnauthorizedError when the refresh token cannot be verified', async () => {
      mockTokenManager.verifyRefreshToken.mockReturnValueOnce(null);

      await expect(authService.refreshToken({ refreshToken: 'bad-token' }))
        .rejects.toMatchObject({ code: 'INVALID_REFRESH_TOKEN' });

      expect(mockUserService.findUserById).not.toHaveBeenCalled();
    });

    it('throws UnauthorizedError when no user matches the token payload', async () => {
      mockTokenManager.verifyRefreshToken.mockReturnValueOnce({ userId: 'user-public-id-1' });
      mockUserService.findUserById.mockResolvedValueOnce(null);

      await expect(authService.refreshToken({ refreshToken: 'some-token' })).rejects.toMatchObject({
        code: 'INVALID_REFRESH_TOKEN',
        message: 'No user related to refresh token'
      });
    });

    it('rotates the token and returns new tokens on success', async () => {
      const user = createUserFixture();
      mockTokenManager.verifyRefreshToken.mockReturnValueOnce({ userId: user.userId });
      mockUserService.findUserById.mockResolvedValueOnce(user);
      mockTokenManager.generateAccessToken.mockReturnValueOnce('new-access-token');
      mockTokenManager.generateRefreshToken.mockReturnValueOnce('new-refresh-token');

      const result = await authService.refreshToken({ refreshToken: 'current-token', userAgent: 'TestBrowser/1.0' });

      expect(mockRefreshTokenRepository.rotateToken).toHaveBeenCalledWith({
        currentTokenHash: 'hash-of-current-token',
        newTokenHash: 'hash-of-new-refresh-token',
        userId: user.id,
        expiresAt: new Date('2099-01-01'),
        deviceId: 'unknown',
        userAgent: 'TestBrowser/1.0'
      });
      expect(result).toEqual({
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
        userId: user.userId
      });
    });

    it.each([
      [ RefreshTokenNotFoundError, 'INVALID_REFRESH_TOKEN' ],
      [ RefreshTokenOwnershipError, 'INVALID_REFRESH_TOKEN' ],
      [ RefreshTokenRevokedError, 'INVALID_REFRESH_TOKEN' ],
      [ RefreshTokenExpiredError, 'EXPIRED_REFRESH_TOKEN' ]
    ] as const)('maps %s from rotateToken to UnauthorizedError with code %s', async (ErrorClass, expectedCode) => {
      const user = createUserFixture();
      mockTokenManager.verifyRefreshToken.mockReturnValueOnce({ userId: user.userId });
      mockUserService.findUserById.mockResolvedValueOnce(user);
      mockRefreshTokenRepository.rotateToken.mockRejectedValueOnce(new ErrorClass());

      await expect(authService.refreshToken({ refreshToken: 'current-token' })).rejects.toMatchObject({
        code: expectedCode
      });
    });

    it('rethrows unrecognized errors from rotateToken unchanged', async () => {
      const user = createUserFixture();
      mockTokenManager.verifyRefreshToken.mockReturnValueOnce({ userId: user.userId });
      mockUserService.findUserById.mockResolvedValueOnce(user);
      const unexpectedError = new Error('connection lost');
      mockRefreshTokenRepository.rotateToken.mockRejectedValueOnce(unexpectedError);

      await expect(authService.refreshToken({ refreshToken: 'current-token' })).rejects.toThrow(unexpectedError);
    });
  });

  describe('logout', () => {
    it('logs and returns early when no refresh token is provided', async () => {
      await authService.logout({ userId: 'user-public-id-1', refreshToken: undefined });

      expect(mockUserService.findUserById).not.toHaveBeenCalled();
      expect(mockRefreshTokenRepository.deleteByHash).not.toHaveBeenCalled();
      expect(getLoggedOutput()).toContain('No refresh token found');
    });

    it('logs and returns early when no user matches the userId', async () => {
      mockUserService.findUserById.mockResolvedValueOnce(null);

      await authService.logout({ userId: 'missing-user', refreshToken: 'some-token' });

      expect(mockRefreshTokenRepository.deleteByHash).not.toHaveBeenCalled();
      expect(getLoggedOutput()).toContain('No user matches userId');
    });

    it('deletes the refresh token scoped to the internal user id', async () => {
      const user = createUserFixture();
      mockUserService.findUserById.mockResolvedValueOnce(user);

      await authService.logout({ userId: user.userId, refreshToken: 'some-token' });

      expect(mockRefreshTokenRepository.deleteByHash).toHaveBeenCalledWith({
        tokenHash: 'hash-of-some-token',
        userId: user.id
      });
    });
  });

  describe('logoutFromAllDevices', () => {
    it('logs and returns early when no user matches the userId', async () => {
      mockUserService.findUserById.mockResolvedValueOnce(null);

      await authService.logoutFromAllDevices({ userId: 'missing-user' });

      expect(mockRefreshTokenRepository.revokeAllForUser).not.toHaveBeenCalled();
      const output = getLoggedOutput();
      expect(output).toContain('method: [logoutFromAllDevices]');
      expect(output).toContain('No user matches userId');
    });

    it('revokes all refresh tokens for the internal user id', async () => {
      const user = createUserFixture();
      mockUserService.findUserById.mockResolvedValueOnce(user);

      await authService.logoutFromAllDevices({ userId: user.userId });

      expect(mockRefreshTokenRepository.revokeAllForUser).toHaveBeenCalledWith({ userId: user.id });
    });
  });
});
