import { afterEach, describe, expect, it, vi } from 'vitest';
import jwt from 'jsonwebtoken';
import { TokenManager } from '../token-manager.js';
import { UnexpectedError } from '../../../exceptions/exceptions.js';

describe('TokenManager', () => {
  describe('generateAccessToken', () => {
    it('signs a token that verifies against the access secret and carries the payload', () => {
      const tokenManager = new TokenManager();

      const accessToken = tokenManager.generateAccessToken({ payload: { userId: 'user-123' } });
      const decoded = jwt.verify(accessToken, process.env.JWT_ACCESS_SECRET as string);

      expect(decoded).toMatchObject({ userId: 'user-123' });
    });

    it('throws UnexpectedError when JWT_ACCESS_SECRET is not set', () => {
      const originalSecret = process.env.JWT_ACCESS_SECRET;
      delete process.env.JWT_ACCESS_SECRET;

      try {
        expect(() => new TokenManager().generateAccessToken({ payload: { userId: 'user-123' } }))
          .toThrow(UnexpectedError);
      } finally {
        process.env.JWT_ACCESS_SECRET = originalSecret;
      }
    });
  });

  describe('generateRefreshToken', () => {
    it('signs a token that verifies against the refresh secret and carries the payload', () => {
      const tokenManager = new TokenManager();

      const refreshToken = tokenManager.generateRefreshToken({ payload: { userId: 'user-123' } });
      const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET as string);

      expect(decoded).toMatchObject({ userId: 'user-123' });
    });

    it('throws UnexpectedError when JWT_REFRESH_SECRET is not set', () => {
      const originalSecret = process.env.JWT_REFRESH_SECRET;
      delete process.env.JWT_REFRESH_SECRET;

      try {
        expect(() => new TokenManager().generateRefreshToken({ payload: { userId: 'user-123' } }))
          .toThrow(UnexpectedError);
      } finally {
        process.env.JWT_REFRESH_SECRET = originalSecret;
      }
    });
  });

  describe('default expiries', () => {
    const decodePayload = (token: string): jwt.JwtPayload => {
      const decoded = jwt.decode(token);

      if (decoded === null || typeof decoded === 'string') {
        throw new Error('Expected a decoded JWT payload');
      }

      return decoded;
    };

    it('falls back to a 60 second access token expiry when JWT_ACCESS_EXPIRY is not set', () => {
      const originalExpiry = process.env.JWT_ACCESS_EXPIRY;
      delete process.env.JWT_ACCESS_EXPIRY;

      try {
        const tokenManager = new TokenManager();
        const accessToken = tokenManager.generateAccessToken({ payload: { userId: 'user-123' } });
        const { exp, iat } = decodePayload(accessToken);

        if (exp === undefined || iat === undefined) {
          throw new Error('Expected exp and iat claims');
        }

        expect(exp - iat).toBe(60);
      } finally {
        process.env.JWT_ACCESS_EXPIRY = originalExpiry;
      }
    });

    it('falls back to a 120 second refresh token expiry when JWT_REFRESH_EXPIRY is not set', () => {
      const originalExpiry = process.env.JWT_REFRESH_EXPIRY;
      delete process.env.JWT_REFRESH_EXPIRY;

      try {
        const tokenManager = new TokenManager();
        const refreshToken = tokenManager.generateRefreshToken({ payload: { userId: 'user-123' } });
        const { exp, iat } = decodePayload(refreshToken);

        if (exp === undefined || iat === undefined) {
          throw new Error('Expected exp and iat claims');
        }

        expect(exp - iat).toBe(120);
      } finally {
        process.env.JWT_REFRESH_EXPIRY = originalExpiry;
      }
    });
  });

  describe('generateRefreshTokenHash', () => {
    it('returns the same hash for the same refresh token', () => {
      const tokenManager = new TokenManager();
      const refreshToken = 'sample-refresh-token';

      expect(tokenManager.generateRefreshTokenHash({ refreshToken }))
        .toBe(tokenManager.generateRefreshTokenHash({ refreshToken }));
    });

    it('returns different hashes for different refresh tokens', () => {
      const tokenManager = new TokenManager();

      const hashA = tokenManager.generateRefreshTokenHash({ refreshToken: 'token-a' });
      const hashB = tokenManager.generateRefreshTokenHash({ refreshToken: 'token-b' });

      expect(hashA).not.toBe(hashB);
    });

    it('throws UnexpectedError when REFRESH_TOKEN_HASH_SECRET is not set', () => {
      const originalSecret = process.env.REFRESH_TOKEN_HASH_SECRET;
      delete process.env.REFRESH_TOKEN_HASH_SECRET;

      try {
        expect(() => new TokenManager().generateRefreshTokenHash({ refreshToken: 'token' }))
          .toThrow(UnexpectedError);
      } finally {
        process.env.REFRESH_TOKEN_HASH_SECRET = originalSecret;
      }
    });
  });

  describe('verifyAccessToken', () => {
    it('returns the payload for a valid token', () => {
      const tokenManager = new TokenManager();
      const accessToken = tokenManager.generateAccessToken({ payload: { userId: 'user-123' } });

      expect(tokenManager.verifyAccessToken({ accessToken })).toMatchObject({ userId: 'user-123' });
    });

    it('returns null once the token has expired', () => {
      vi.useFakeTimers();

      try {
        vi.stubEnv('JWT_ACCESS_EXPIRY', '1s');
        const tokenManager = new TokenManager();
        const accessToken = tokenManager.generateAccessToken({ payload: { userId: 'user-123' } });

        vi.advanceTimersByTime(2000);

        expect(tokenManager.verifyAccessToken({ accessToken })).toBeNull();
      } finally {
        vi.useRealTimers();
      }
    });

    it('throws when the token was signed with a different secret', () => {
      const tokenManager = new TokenManager();
      const foreignToken = jwt.sign({ userId: 'user-123' }, 'some-other-secret', { algorithm: 'HS256' });

      expect(() => tokenManager.verifyAccessToken({ accessToken: foreignToken })).toThrow();
    });
  });

  describe('verifyRefreshToken', () => {
    it('returns the payload for a valid token', () => {
      const tokenManager = new TokenManager();
      const refreshToken = tokenManager.generateRefreshToken({ payload: { userId: 'user-123' } });

      expect(tokenManager.verifyRefreshToken({ refreshToken })).toMatchObject({ userId: 'user-123' });
    });

    it('returns null once the token has expired', () => {
      vi.useFakeTimers();

      try {
        vi.stubEnv('JWT_REFRESH_EXPIRY', '1s');
        const tokenManager = new TokenManager();
        const refreshToken = tokenManager.generateRefreshToken({ payload: { userId: 'user-123' } });

        vi.advanceTimersByTime(2000);

        expect(tokenManager.verifyRefreshToken({ refreshToken })).toBeNull();
      } finally {
        vi.useRealTimers();
      }
    });

    it('throws when the token was signed with a different secret', () => {
      const tokenManager = new TokenManager();
      const foreignToken = jwt.sign({ userId: 'user-123' }, 'some-other-secret', { algorithm: 'HS256' });

      expect(() => tokenManager.verifyRefreshToken({ refreshToken: foreignToken })).toThrow();
    });
  });

  describe('getRefreshTokenExpiryDate', () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it('returns the current time offset by the configured refresh expiry', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
      vi.stubEnv('JWT_REFRESH_EXPIRY', '7d');

      const tokenManager = new TokenManager();

      expect(tokenManager.getRefreshTokenExpiryDate().toISOString()).toBe('2026-01-08T00:00:00.000Z');
    });
  });
});
