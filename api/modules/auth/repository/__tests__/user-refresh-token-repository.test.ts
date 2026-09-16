import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Pool, PoolClient } from 'pg';
import UserRefreshTokenRepository from '../user-refresh-token-repository.js';
import { setPostgresPool } from '../../../../config/database/postgres-client.js';
import {
  RefreshTokenExpiredError,
  RefreshTokenNotFoundError,
  RefreshTokenOwnershipError,
  RefreshTokenRevokedError
} from '../../../../exceptions/exceptions.js';

interface FakePool {
  query: ReturnType<typeof vi.fn>;
  connect: ReturnType<typeof vi.fn>;
}

interface FakeClient {
  query: ReturnType<typeof vi.fn>;
  release: ReturnType<typeof vi.fn>;
}

const createFakeClient = (): FakeClient => ({
  query: vi.fn(),
  release: vi.fn()
});

const createFakePool = (): FakePool => ({
  query: vi.fn(),
  connect: vi.fn()
});

const createStoredToken = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  id: 'token-row-id',
  user_id: 'user-1',
  token_hash: 'current-hash',
  issued_at: new Date('2024-01-01T00:00:00Z'),
  expires_at: new Date('2999-01-01T00:00:00Z'),
  last_used_at: new Date('2024-01-01T00:00:00Z'),
  device_id: 'device-1',
  user_agent: 'agent-1',
  revoked_at: null,
  created_at: new Date('2024-01-01T00:00:00Z'),
  updated_at: new Date('2024-01-01T00:00:00Z'),
  ...overrides
});

describe('UserRefreshTokenRepository', () => {
  let fakePool: FakePool;
  let repository: UserRefreshTokenRepository;

  beforeEach(() => {
    fakePool = createFakePool();
    setPostgresPool(fakePool as unknown as Pool);
    repository = new UserRefreshTokenRepository();
  });

  describe('create', () => {
    it('uses the pool when no client is provided', async () => {
      fakePool.query.mockResolvedValueOnce({ rows: [ createStoredToken() ] });

      const token = await repository.create({
        userId: 'user-1',
        tokenHash: 'hash-1',
        expiresAt: new Date('2099-01-01'),
        deviceId: 'device-1',
        userAgent: 'agent-1'
      });

      expect(fakePool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO user_refresh_tokens'),
        [ 'user-1', 'hash-1', new Date('2099-01-01'), 'device-1', 'agent-1' ]
      );
      expect(token.id).toBe('token-row-id');
    });

    it('uses the given client instead of the pool when provided', async () => {
      const fakeClient = createFakeClient();
      fakeClient.query.mockResolvedValueOnce({ rows: [ createStoredToken() ] });

      await repository.create({
        userId: 'user-1',
        tokenHash: 'hash-1',
        expiresAt: new Date('2099-01-01'),
        deviceId: 'device-1',
        userAgent: 'agent-1',
        client: fakeClient as unknown as PoolClient
      });

      expect(fakeClient.query).toHaveBeenCalledOnce();
      expect(fakePool.query).not.toHaveBeenCalled();
    });
  });

  describe('findValidByHashForUpdate', () => {
    it('throws when no client is provided', async () => {
      await expect(repository.findValidByHashForUpdate({ tokenHash: 'hash-1' }))
        .rejects.toThrow('findValidByHashForUpdate requires an active transaction client.');
    });

    it('queries FOR UPDATE using the given client and returns the row', async () => {
      const fakeClient = createFakeClient();
      fakeClient.query.mockResolvedValueOnce({ rows: [ createStoredToken() ] });

      const token = await repository.findValidByHashForUpdate({
        tokenHash: 'hash-1',
        client: fakeClient as unknown as PoolClient
      });

      expect(fakeClient.query).toHaveBeenCalledWith(expect.stringContaining('FOR UPDATE'), [ 'hash-1' ]);
      expect(token?.id).toBe('token-row-id');
    });

    it('returns null when no matching token exists', async () => {
      const fakeClient = createFakeClient();
      fakeClient.query.mockResolvedValueOnce({ rows: [] });

      const token = await repository.findValidByHashForUpdate({
        tokenHash: 'missing',
        client: fakeClient as unknown as PoolClient
      });

      expect(token).toBeNull();
    });
  });

  describe('revokeById', () => {
    it('updates revoked_at using the given client', async () => {
      const fakeClient = createFakeClient();

      await repository.revokeById({ tokenId: 'token-1', client: fakeClient as unknown as PoolClient });

      expect(fakeClient.query).toHaveBeenCalledWith(expect.stringContaining('SET revoked_at = NOW()'), [ 'token-1' ]);
    });
  });

  describe('touchById', () => {
    it('updates last_used_at using the given client', async () => {
      const fakeClient = createFakeClient();

      await repository.touchById({ tokenId: 'token-1', client: fakeClient as unknown as PoolClient });

      expect(fakeClient.query).toHaveBeenCalledWith(expect.stringContaining('SET last_used_at = NOW()'), [ 'token-1' ]);
    });
  });

  describe('revokeAllForUser', () => {
    it('uses the pool when no client is provided', async () => {
      await repository.revokeAllForUser({ userId: 'user-1' });

      expect(fakePool.query).toHaveBeenCalledWith(expect.stringContaining('WHERE user_id = $1'), [ 'user-1' ]);
    });

    it('uses the given client instead of the pool when provided', async () => {
      const fakeClient = createFakeClient();

      await repository.revokeAllForUser({ userId: 'user-1', client: fakeClient as unknown as PoolClient });

      expect(fakeClient.query).toHaveBeenCalledOnce();
      expect(fakePool.query).not.toHaveBeenCalled();
    });
  });

  describe('deleteByHash', () => {
    it('scopes the delete to both the token hash and the owning user, using the pool when no client is provided', async () => {
      await repository.deleteByHash({ tokenHash: 'hash-1', userId: 'user-1' });

      expect(fakePool.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM user_refresh_tokens'),
        [ 'hash-1', 'user-1' ]
      );
    });

    it('uses the given client instead of the pool when provided', async () => {
      const fakeClient = createFakeClient();

      await repository.deleteByHash({ tokenHash: 'hash-1', userId: 'user-1', client: fakeClient as unknown as PoolClient });

      expect(fakeClient.query).toHaveBeenCalledOnce();
      expect(fakePool.query).not.toHaveBeenCalled();
    });
  });

  describe('rotateToken', () => {
    const rotateParams = {
      currentTokenHash: 'current-hash',
      newTokenHash: 'new-hash',
      userId: 'user-1',
      expiresAt: new Date('2099-01-01'),
      deviceId: 'device-1',
      userAgent: 'agent-1'
    };

    let fakeClient: FakeClient;

    beforeEach(() => {
      fakeClient = createFakeClient();
      fakePool.connect.mockResolvedValue(fakeClient);
    });

    it('revokes the old token, creates a new one, and commits on the happy path', async () => {
      fakeClient.query
        .mockResolvedValueOnce(undefined) // BEGIN
        .mockResolvedValueOnce({ rows: [ createStoredToken() ] }) // SELECT ... FOR UPDATE
        .mockResolvedValueOnce(undefined) // touchById UPDATE
        .mockResolvedValueOnce(undefined) // revokeById UPDATE
        .mockResolvedValueOnce({ rows: [ createStoredToken({ token_hash: 'new-hash' }) ] }) // create INSERT
        .mockResolvedValueOnce(undefined); // COMMIT

      await repository.rotateToken(rotateParams);

      expect(fakeClient.query).toHaveBeenCalledWith('BEGIN');
      expect(fakeClient.query).toHaveBeenCalledWith(expect.stringContaining('SET last_used_at = NOW()'), [ 'token-row-id' ]);
      expect(fakeClient.query).toHaveBeenCalledWith('COMMIT');
      expect(fakeClient.query).not.toHaveBeenCalledWith('ROLLBACK');
      expect(fakeClient.release).toHaveBeenCalledOnce();
    });

    it('throws RefreshTokenNotFoundError and rolls back when no token matches the hash', async () => {
      fakeClient.query
        .mockResolvedValueOnce(undefined) // BEGIN
        .mockResolvedValueOnce({ rows: [] }) // SELECT ... FOR UPDATE - nothing found
        .mockResolvedValueOnce(undefined); // ROLLBACK

      await expect(repository.rotateToken(rotateParams)).rejects.toThrow(RefreshTokenNotFoundError);

      expect(fakeClient.query).toHaveBeenCalledWith('ROLLBACK');
      expect(fakeClient.query).toHaveBeenCalledTimes(3);
      expect(fakeClient.release).toHaveBeenCalledOnce();
    });

    it('throws RefreshTokenRevokedError and rolls back when the stored token was already revoked', async () => {
      fakeClient.query
        .mockResolvedValueOnce(undefined) // BEGIN
        .mockResolvedValueOnce({ rows: [ createStoredToken({ revoked_at: new Date('2024-01-01') }) ] })
        .mockResolvedValueOnce(undefined); // ROLLBACK

      await expect(repository.rotateToken(rotateParams)).rejects.toThrow(RefreshTokenRevokedError);

      expect(fakeClient.query).toHaveBeenCalledWith('ROLLBACK');
      expect(fakeClient.query).toHaveBeenCalledTimes(3);
      expect(fakeClient.release).toHaveBeenCalledOnce();
    });

    it('throws RefreshTokenOwnershipError and rolls back when the token belongs to a different user', async () => {
      fakeClient.query
        .mockResolvedValueOnce(undefined) // BEGIN
        .mockResolvedValueOnce({ rows: [ createStoredToken({ user_id: 'someone-else' }) ] })
        .mockResolvedValueOnce(undefined); // ROLLBACK

      await expect(repository.rotateToken(rotateParams)).rejects.toThrow(RefreshTokenOwnershipError);

      expect(fakeClient.query).toHaveBeenCalledWith('ROLLBACK');
      expect(fakeClient.query).toHaveBeenCalledTimes(3);
      expect(fakeClient.release).toHaveBeenCalledOnce();
    });

    it('revokes and commits before throwing RefreshTokenExpiredError, without rolling back', async () => {
      fakeClient.query
        .mockResolvedValueOnce(undefined) // BEGIN
        .mockResolvedValueOnce({ rows: [ createStoredToken({ expires_at: new Date('2000-01-01') }) ] })
        .mockResolvedValueOnce(undefined) // touchById UPDATE
        .mockResolvedValueOnce(undefined) // revokeById UPDATE
        .mockResolvedValueOnce(undefined); // COMMIT

      await expect(repository.rotateToken(rotateParams)).rejects.toThrow(RefreshTokenExpiredError);

      expect(fakeClient.query).toHaveBeenCalledWith('COMMIT');
      expect(fakeClient.query).not.toHaveBeenCalledWith('ROLLBACK');
      expect(fakeClient.release).toHaveBeenCalledOnce();
    });

    it('rolls back and releases the client when an unexpected error occurs mid-transaction', async () => {
      fakeClient.query
        .mockResolvedValueOnce(undefined) // BEGIN
        .mockRejectedValueOnce(new Error('connection lost')) // SELECT ... FOR UPDATE fails
        .mockResolvedValueOnce(undefined); // ROLLBACK

      await expect(repository.rotateToken(rotateParams)).rejects.toThrow('connection lost');

      expect(fakeClient.query).toHaveBeenCalledWith('ROLLBACK');
      expect(fakeClient.release).toHaveBeenCalledOnce();
    });
  });
});
