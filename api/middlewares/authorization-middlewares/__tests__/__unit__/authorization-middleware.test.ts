import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextFunction, Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import AuthorizationMiddleware from '../../authorization-middleware.js';
import { TokenManager } from '../../../../utils/token-manager/token-manager.js';
import { UnauthorizedError } from '../../../../exceptions/exceptions.js';
import testingConfig from '../../../../config/environment-config/config.js';
import { getRequestContext, getUserId, requestContextStorage } from '../../../../utils/request-context/request-context.js';

const tokenManager = new TokenManager();

const createMockRequest = (overrides: Record<string, unknown> = {}): Request => ({
  path: '/api/protected-resource',
  headers: {},
  ...overrides
} as unknown as Request);

const createMockResponse = (): { status: ReturnType<typeof vi.fn>; send: ReturnType<typeof vi.fn> } => {
  const res = { status: vi.fn(), send: vi.fn() };
  res.status.mockReturnValue(res);
  return res;
};

describe('AuthorizationMiddleware', () => {
  describe('verifyAccessToken', () => {
    let middleware: (req: Request, res: Response, next: NextFunction) => void;
    let next: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      middleware = new AuthorizationMiddleware().verifyAccessToken();
      next = vi.fn();
    });

    it('sets the request context for logging purposes regardless of the outcome', () => {
      const req = createMockRequest();
      const res = createMockResponse();

      requestContextStorage.run({ requestId: 'req-1' }, () => {
        middleware(req, res as unknown as Response, next as unknown as NextFunction);

        expect(getRequestContext()).toEqual({ className: 'AuthorizationMiddleware', methodName: 'verifyAccessToken' });
      });
    });

    it('skips authentication for public routes', () => {
      const [ publicRoute ] = testingConfig.application.publicRoutes;
      const req = createMockRequest({ path: publicRoute });
      const res = createMockResponse();

      middleware(req, res as unknown as Response, next as unknown as NextFunction);

      expect(next).toHaveBeenCalledOnce();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('rejects requests without an authorization header', () => {
      const req = createMockRequest();
      const res = createMockResponse();

      middleware(req, res as unknown as Response, next as unknown as NextFunction);

      expect(res.status).toHaveBeenCalledWith(StatusCodes.PRECONDITION_FAILED);
      expect(res.send).toHaveBeenCalledWith({ message: 'Authorization header missing', code: 'NO_AUTH_HEADER' });
      expect(next).not.toHaveBeenCalled();
    });

    it('rejects an authorization header that is not a Bearer token', () => {
      const req = createMockRequest({ headers: { authorization: 'Basic some-credentials' } });
      const res = createMockResponse();

      middleware(req, res as unknown as Response, next as unknown as NextFunction);

      expect(res.status).toHaveBeenCalledWith(StatusCodes.PRECONDITION_FAILED);
      expect(res.send).toHaveBeenCalledWith({ message: 'Invalid token type', code: 'INVALID_AUTH_HEADER_TYPE' });
      expect(next).not.toHaveBeenCalled();
    });

    it('attaches the userId to the request and calls next for a valid token', () => {
      const accessToken = tokenManager.generateAccessToken({ payload: { userId: 'user-123' } });
      const req = createMockRequest({ headers: { authorization: `Bearer ${accessToken}` } });
      const res = createMockResponse();

      middleware(req, res as unknown as Response, next as unknown as NextFunction);

      expect(req.user).toBe('user-123');
      expect(next).toHaveBeenCalledOnce();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('mirrors the userId into the request context on successful verification', () => {
      const accessToken = tokenManager.generateAccessToken({ payload: { userId: 'user-123' } });
      const req = createMockRequest({ headers: { authorization: `Bearer ${accessToken}` } });
      const res = createMockResponse();

      requestContextStorage.run({ requestId: 'req-1' }, () => {
        middleware(req, res as unknown as Response, next as unknown as NextFunction);

        expect(getUserId()).toBe('user-123');
      });
    });

    it('returns 401 for an expired token', () => {
      vi.useFakeTimers();

      try {
        vi.stubEnv('JWT_ACCESS_EXPIRY', '1s');
        const accessToken = new TokenManager().generateAccessToken({ payload: { userId: 'user-123' } });
        vi.advanceTimersByTime(2000);

        const req = createMockRequest({ headers: { authorization: `Bearer ${accessToken}` } });
        const res = createMockResponse();

        middleware(req, res as unknown as Response, next as unknown as NextFunction);

        expect(res.status).toHaveBeenCalledWith(StatusCodes.UNAUTHORIZED);
        expect(res.send).toHaveBeenCalledWith({ message: 'Invalid or expired token', code: 'INVALID_TOKEN' });
        expect(next).not.toHaveBeenCalled();
      } finally {
        vi.useRealTimers();
      }
    });

    it('returns 500 when the token signature cannot be verified', () => {
      const foreignToken = new TokenManager().generateAccessToken({ payload: { userId: 'user-123' } });
      const req = createMockRequest({ headers: { authorization: `Bearer ${foreignToken}garbage` } });
      const res = createMockResponse();

      middleware(req, res as unknown as Response, next as unknown as NextFunction);

      expect(res.status).toHaveBeenCalledWith(StatusCodes.INTERNAL_SERVER_ERROR);
      expect(res.send).toHaveBeenCalledWith({ message: 'Error verifying accessToken', code: 'INTERNAL_SERVER_ERROR' });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('handleUserId', () => {
    const authorizationMiddleware = new AuthorizationMiddleware();

    it('returns the userId when present on the request', () => {
      const req = createMockRequest({ user: 'user-123' });

      const userId = authorizationMiddleware.handleUserId(req);

      expect(userId).toBe('user-123');
    });

    it('throws UnauthorizedError when the request has no userId', () => {
      const req = createMockRequest();

      expect(() => authorizationMiddleware.handleUserId(req)).toThrow(UnauthorizedError);
    });
  });

  describe('handleGetRefreshToken', () => {
    const authorizationMiddleware = new AuthorizationMiddleware();

    it('reads the refresh token from cookies for non-mobile platforms', () => {
      const req = createMockRequest({ platformType: 'web', cookies: { refreshToken: 'cookie-refresh-token' } });

      const refreshToken = authorizationMiddleware.handleGetRefreshToken(req);

      expect(refreshToken).toBe('cookie-refresh-token');
    });

    it('reads the refresh token from headers for mobile platforms', () => {
      const req = createMockRequest({ platformType: 'mobile', headers: { 'refresh-token': 'cookie-refresh-token' } });

      const refreshToken = authorizationMiddleware.handleGetRefreshToken(req);

      expect(refreshToken).toBe('cookie-refresh-token');
    });

    it('reads the refresh token from headers for the mobile platform', () => {
      const req = createMockRequest({
        platformType: 'mobile',
        headers: { 'refresh-token': 'header-refresh-token' }
      });

      const refreshToken = authorizationMiddleware.handleGetRefreshToken(req);

      expect(refreshToken).toBe('header-refresh-token');
    });

    it('returns undefined when no cookie is present for non-mobile platforms', () => {
      const req = createMockRequest({ platformType: 'web' });

      const refreshToken = authorizationMiddleware.handleGetRefreshToken(req);

      expect(refreshToken).toBeUndefined();
    });
  });
});
