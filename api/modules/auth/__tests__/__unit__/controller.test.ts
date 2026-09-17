import { describe, expect, it, vi } from 'vitest';

const { mockAuthService } = vi.hoisted(() => ({
  mockAuthService: {
    createUser: vi.fn(),
    authenticateUser: vi.fn(),
    refreshToken: vi.fn(),
    logout: vi.fn(),
    logoutFromAllDevices: vi.fn()
  }
}));

vi.mock('../../service/auth-service', () => ({
  default: vi.fn(function AuthServiceMock() {
    return mockAuthService;
  })
}));

import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import AuthController from '../../controller.js';
import { ConflictError, ForbiddenError, UnauthorizedError } from '../../../../exceptions/exceptions.js';
import type { StaffUserSchema } from '../../../../models/staff-user-model.js';
import { getRequestContext, getUserId, requestContextStorage } from '../../../../utils/request-context/request-context.js';

interface MockResponse {
  errorDetails?: unknown;
  status: ReturnType<typeof vi.fn>;
  send: ReturnType<typeof vi.fn>;
  sendStatus: ReturnType<typeof vi.fn>;
  cookie: ReturnType<typeof vi.fn>;
}

const createMockRequest = (overrides: Record<string, unknown> = {}): Request => ({
  body: {},
  headers: {},
  ...overrides
} as unknown as Request);

const createMockResponse = (): MockResponse => {
  const res: MockResponse = { status: vi.fn(), send: vi.fn(), sendStatus: vi.fn(), cookie: vi.fn() };
  res.status.mockReturnValue(res);
  res.cookie.mockReturnValue(res);
  return res;
};

const createUserFixture = (overrides: Partial<StaffUserSchema> = {}): StaffUserSchema => ({
  id: 'internal-uuid-1',
  userId: 'user-public-id-1',
  tenantId: 'tenant-id-1',
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

const authResultFixture = {
  accessToken: 'generated-access-token',
  refreshToken: 'generated-refresh-token',
  userId: 'user-public-id-1'
};

describe('AuthController', () => {
  const controller = new AuthController();

  describe('signUp', () => {
    it('creates the user and returns only the public fields', async () => {
      const req = createMockRequest({
        body: {
          name: 'Alice',
          email: 'alice@example.com',
          password: 'super-secret',
          phone: '+15551234567',
          birthdate: new Date('1990-01-01'),
          tenantId: 'tenant-id-1'
        }
      });
      const res = createMockResponse();
      mockAuthService.createUser.mockResolvedValueOnce(createUserFixture());

      await controller.signUp(req, res as unknown as Response);

      expect(mockAuthService.createUser).toHaveBeenCalledWith({
        name: 'Alice',
        email: 'alice@example.com',
        password: 'super-secret',
        phone: '+15551234567',
        birthdate: new Date('1990-01-01'),
        tenantId: 'tenant-id-1'
      });
      expect(res.status).toHaveBeenCalledWith(StatusCodes.OK);
      expect(res.send).toHaveBeenCalledWith({
        userId: 'user-public-id-1',
        name: 'Alice',
        email: 'alice@example.com',
        phone: '+15551234567'
      });
    });

    it('propagates a duplicate-email error for the centralized error handler to map', async () => {
      const req = createMockRequest({ body: {} });
      const res = createMockResponse();
      mockAuthService.createUser.mockRejectedValueOnce(
        new ConflictError({ message: 'Email is already registered.', code: 'EMAIL_ALREADY_REGISTERED' })
      );

      await expect(controller.signUp(req, res as unknown as Response)).rejects.toThrow(ConflictError);

      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe('login', () => {
    it('sets a cookie and returns only the access token for non-mobile platforms', async () => {
      const req = createMockRequest({ body: { email: 'alice@example.com', password: 'x' }, platformType: 'web' });
      const res = createMockResponse();
      mockAuthService.authenticateUser.mockResolvedValueOnce(authResultFixture);

      await requestContextStorage.run({ requestId: 'req-1' }, async () => {
        await controller.login(req, res as unknown as Response);

        expect(getRequestContext()).toEqual({ className: 'AuthController', methodName: 'login' });
        expect(getUserId()).toBe('user-public-id-1');
      });

      expect(req.user).toBe('user-public-id-1');
      expect(res.cookie).toHaveBeenCalledWith('refreshToken', 'generated-refresh-token', {
        httpOnly: true,
        secure: true,
        sameSite: 'strict'
      });
      expect(res.status).toHaveBeenCalledWith(StatusCodes.OK);
      expect(res.send).toHaveBeenCalledWith({ accessToken: 'generated-access-token' });
    });

    it('returns both tokens in the body and does not set a cookie for mobile platforms', async () => {
      const req = createMockRequest({ body: { email: 'alice@example.com', password: 'x' }, platformType: 'mobile' });
      const res = createMockResponse();
      mockAuthService.authenticateUser.mockResolvedValueOnce(authResultFixture);

      await controller.login(req, res as unknown as Response);

      expect(res.cookie).not.toHaveBeenCalled();
      expect(res.send).toHaveBeenCalledWith({ accessToken: 'generated-access-token', refreshToken: 'generated-refresh-token' });
    });

    it('passes the request user-agent through to the service', async () => {
      const req = createMockRequest({
        body: { email: 'alice@example.com', password: 'x' },
        platformType: 'web',
        headers: { 'user-agent': 'TestBrowser/1.0' }
      });
      const res = createMockResponse();
      mockAuthService.authenticateUser.mockResolvedValueOnce(authResultFixture);

      await controller.login(req, res as unknown as Response);

      expect(mockAuthService.authenticateUser).toHaveBeenCalledWith({
        email: 'alice@example.com',
        password: 'x',
        userAgent: 'TestBrowser/1.0'
      });
    });

    it('propagates authentication errors for the centralized error handler to map', async () => {
      const req = createMockRequest({ body: { email: 'alice@example.com', password: 'wrong' }, platformType: 'web' });
      const res = createMockResponse();
      mockAuthService.authenticateUser.mockRejectedValueOnce(
        new UnauthorizedError({ message: 'Invalid email or password', code: 'INVALID_CREDENTIALS' })
      );

      await expect(controller.login(req, res as unknown as Response)).rejects.toThrow(UnauthorizedError);

      expect(res.status).not.toHaveBeenCalled();
      expect(res.cookie).not.toHaveBeenCalled();
    });
  });

  describe('refreshToken', () => {
    it('throws ForbiddenError when no refresh token is present', async () => {
      const req = createMockRequest({ platformType: 'web', cookies: {} });
      const res = createMockResponse();

      await expect(controller.refreshToken(req, res as unknown as Response)).rejects.toThrow(ForbiddenError);

      expect(mockAuthService.refreshToken).not.toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('reads the refresh token from the cookie, sets a new one, and returns only the access token for non-mobile platforms', async () => {
      const req = createMockRequest({ platformType: 'web', cookies: { refreshToken: 'current-refresh-token' } });
      const res = createMockResponse();
      mockAuthService.refreshToken.mockResolvedValueOnce(authResultFixture);

      await controller.refreshToken(req, res as unknown as Response);

      expect(mockAuthService.refreshToken).toHaveBeenCalledWith({
        refreshToken: 'current-refresh-token',
        userAgent: undefined
      });
      expect(res.cookie).toHaveBeenCalledWith('refreshToken', 'generated-refresh-token', {
        httpOnly: true,
        secure: true,
        sameSite: 'strict'
      });
      expect(res.send).toHaveBeenCalledWith({ accessToken: 'generated-access-token' });
    });

    it('reads the refresh token from the header and returns both tokens for mobile platforms', async () => {
      const req = createMockRequest({ platformType: 'mobile', headers: { 'refresh-token': 'current-refresh-token' } });
      const res = createMockResponse();
      mockAuthService.refreshToken.mockResolvedValueOnce(authResultFixture);

      await controller.refreshToken(req, res as unknown as Response);

      expect(res.cookie).not.toHaveBeenCalled();
      expect(res.send).toHaveBeenCalledWith({ accessToken: 'generated-access-token', refreshToken: 'generated-refresh-token' });
    });

    it('propagates rotation errors for the centralized error handler to map', async () => {
      const req = createMockRequest({ platformType: 'web', cookies: { refreshToken: 'stale-token' } });
      const res = createMockResponse();
      mockAuthService.refreshToken.mockRejectedValueOnce(
        new UnauthorizedError({ message: 'Invalid refresh token', code: 'INVALID_REFRESH_TOKEN' })
      );

      await expect(controller.refreshToken(req, res as unknown as Response)).rejects.toThrow(UnauthorizedError);

      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe('logout', () => {
    it('throws UnauthorizedError when the request has no authenticated user', async () => {
      const req = createMockRequest({ platformType: 'web' });
      const res = createMockResponse();

      await expect(controller.logout(req, res as unknown as Response)).rejects.toThrow(UnauthorizedError);

      expect(mockAuthService.logout).not.toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('clears the cookie and returns 204 for non-mobile platforms', async () => {
      const req = createMockRequest({ user: 'user-public-id-1', platformType: 'web', cookies: { refreshToken: 'current-token' } });
      const res = createMockResponse();
      mockAuthService.logout.mockResolvedValueOnce(undefined);

      await requestContextStorage.run({ requestId: 'req-1' }, async () => {
        await controller.logout(req, res as unknown as Response);

        expect(getRequestContext()).toEqual({ className: 'AuthController', methodName: 'logout' });
      });

      expect(mockAuthService.logout).toHaveBeenCalledWith({ userId: 'user-public-id-1', refreshToken: 'current-token' });
      expect(res.cookie).toHaveBeenCalledWith('refreshToken', '', {
        httpOnly: true,
        secure: true,
        sameSite: 'strict',
        expires: new Date(0),
        path: '/'
      });
      expect(res.sendStatus).toHaveBeenCalledWith(StatusCodes.NO_CONTENT);
    });

    it('does not clear a cookie for mobile platforms', async () => {
      const req = createMockRequest({ user: 'user-public-id-1', platformType: 'mobile', headers: { 'refresh-token': 'current-token' } });
      const res = createMockResponse();
      mockAuthService.logout.mockResolvedValueOnce(undefined);

      await controller.logout(req, res as unknown as Response);

      expect(res.cookie).not.toHaveBeenCalled();
      expect(res.sendStatus).toHaveBeenCalledWith(StatusCodes.NO_CONTENT);
    });

    it('propagates unexpected service errors for the centralized error handler to map', async () => {
      const req = createMockRequest({ user: 'user-public-id-1', platformType: 'web', cookies: {} });
      const res = createMockResponse();
      mockAuthService.logout.mockRejectedValueOnce(new Error('unexpected'));

      await expect(controller.logout(req, res as unknown as Response)).rejects.toThrow('unexpected');

      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe('logoutFromAllDevices', () => {
    it('throws UnauthorizedError when the request has no authenticated user', async () => {
      const req = createMockRequest({ platformType: 'web' });
      const res = createMockResponse();

      await expect(controller.logoutFromAllDevices(req, res as unknown as Response)).rejects.toThrow(UnauthorizedError);

      expect(mockAuthService.logoutFromAllDevices).not.toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('clears the cookie and returns 204 for non-mobile platforms', async () => {
      const req = createMockRequest({ user: 'user-public-id-1', platformType: 'web' });
      const res = createMockResponse();
      mockAuthService.logoutFromAllDevices.mockResolvedValueOnce(undefined);

      await requestContextStorage.run({ requestId: 'req-1' }, async () => {
        await controller.logoutFromAllDevices(req, res as unknown as Response);

        expect(getRequestContext()).toEqual({ className: 'AuthController', methodName: 'logoutFromAllDevices' });
      });

      expect(mockAuthService.logoutFromAllDevices).toHaveBeenCalledWith({ userId: 'user-public-id-1' });
      expect(res.cookie).toHaveBeenCalledWith('refreshToken', '', {
        httpOnly: true,
        secure: true,
        sameSite: 'strict',
        expires: new Date(0),
        path: '/'
      });
      expect(res.sendStatus).toHaveBeenCalledWith(StatusCodes.NO_CONTENT);
    });

    it('does not clear a cookie for mobile platforms', async () => {
      const req = createMockRequest({ user: 'user-public-id-1', platformType: 'mobile' });
      const res = createMockResponse();
      mockAuthService.logoutFromAllDevices.mockResolvedValueOnce(undefined);

      await controller.logoutFromAllDevices(req, res as unknown as Response);

      expect(res.cookie).not.toHaveBeenCalled();
      expect(res.sendStatus).toHaveBeenCalledWith(StatusCodes.NO_CONTENT);
    });

    it('propagates unexpected service errors for the centralized error handler to map', async () => {
      const req = createMockRequest({ user: 'user-public-id-1', platformType: 'web' });
      const res = createMockResponse();
      mockAuthService.logoutFromAllDevices.mockRejectedValueOnce(new Error('unexpected'));

      await expect(controller.logoutFromAllDevices(req, res as unknown as Response)).rejects.toThrow('unexpected');

      expect(res.status).not.toHaveBeenCalled();
    });
  });
});
