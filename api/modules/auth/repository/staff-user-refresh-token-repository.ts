import { getPostgresPool } from '../../../config/database/postgres-client.js';
import BaseClass from '../../../base/base-class/base-class.js';
import type { PoolClient } from 'pg';
import { RefreshTokenExpiredError, RefreshTokenNotFoundError, RefreshTokenOwnershipError, RefreshTokenRevokedError } from '../../../exceptions/exceptions.js';

export interface CreateRefreshTokenParams {
  userId: string;
  tenantId: string;
  tokenHash: string;
  expiresAt: Date;
  deviceId: string;
  userAgent: string;
  client?: PoolClient;
}

export interface FindTokenParams {
  tokenHash: string;
  client?: PoolClient;
}

export interface DeleteTokenParams {
  tokenHash: string;
  userId: string;
  client?: PoolClient;
}

// client is required (not optional like the other params interfaces here) because revokeById/
// touchById are only ever called from within rotateToken's existing transaction, never standalone.
export interface RevokeTokenParams {
  tokenId: string;
  client: PoolClient;
}

export interface RevokeAllParams {
  userId: string;
  client?: PoolClient;
}

export interface RotateRefreshTokenParams {
  currentTokenHash: string;
  newTokenHash: string;
  userId: string;
  tenantId: string;
  expiresAt: Date;
  deviceId: string;
  userAgent: string;
}

export interface RefreshTokenSchema {
  id: string;
  user_id: string;
  tenant_id: string;
  token_hash: string;
  issued_at: Date;
  expires_at: Date;
  last_used_at: Date | null;
  device_id: string;
  user_agent: string;
  revoked_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

const REFRESH_TOKEN_COLUMNS = 'id, user_id, tenant_id, token_hash, issued_at, expires_at, last_used_at, device_id, user_agent, revoked_at, created_at, updated_at';

class StaffUserRefreshTokenRepository extends BaseClass {
  async create({
    userId,
    tenantId,
    tokenHash,
    expiresAt,
    deviceId,
    userAgent,
    client
  }: CreateRefreshTokenParams): Promise<RefreshTokenSchema> {
    const runner = client ?? getPostgresPool();

    const result = await runner.query<RefreshTokenSchema>(
      `INSERT INTO staff_user_refresh_tokens (
        user_id,
        tenant_id,
        token_hash,
        expires_at,
        device_id,
        user_agent
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING ${REFRESH_TOKEN_COLUMNS}`,
      [ userId, tenantId, tokenHash, expiresAt, deviceId, userAgent ]
    );

    return result.rows[0];
  }

  async findValidByHashForUpdate({ tokenHash, client }: FindTokenParams): Promise<RefreshTokenSchema | null> {
    if (client === undefined) {
      throw new Error('findValidByHashForUpdate requires an active transaction client.');
    }

    const result = await client.query<RefreshTokenSchema>(
      `SELECT ${REFRESH_TOKEN_COLUMNS}
        FROM staff_user_refresh_tokens
        WHERE token_hash = $1
        FOR UPDATE`,
      [ tokenHash ]
    );

    return result.rows[0] ?? null;
  }

  private async touchTimestampColumn({
    tokenId,
    client,
    column
  }: RevokeTokenParams & { column: 'revoked_at' | 'last_used_at' }): Promise<void> {
    await client.query(
      `UPDATE staff_user_refresh_tokens
          SET ${column} = NOW(),
              updated_at = NOW()
        WHERE id = $1`,
      [ tokenId ]
    );
  }

  async revokeById({ tokenId, client }: RevokeTokenParams): Promise<void> {
    await this.touchTimestampColumn({ tokenId, client, column: 'revoked_at' });
  }

  async touchById({ tokenId, client }: RevokeTokenParams): Promise<void> {
    await this.touchTimestampColumn({ tokenId, client, column: 'last_used_at' });
  }

  async revokeAllForUser({ userId, client }: RevokeAllParams): Promise<void> {
    const runner = client ?? getPostgresPool();
    await runner.query(
      `UPDATE staff_user_refresh_tokens
          SET revoked_at = NOW(),
              updated_at = NOW()
        WHERE user_id = $1
          AND revoked_at IS NULL`,
      [ userId ]
    );
  }

  // Scoped to userId so a caller can never delete a token belonging to someone else by
  // supplying/guessing another user's token hash - deleting 0 rows is a silent no-op either way.
  async deleteByHash({ tokenHash, userId, client }: DeleteTokenParams): Promise<void> {
    const runner = client ?? getPostgresPool();
    await runner.query('DELETE FROM staff_user_refresh_tokens WHERE token_hash = $1 AND user_id = $2', [ tokenHash, userId ]);
  }

  async rotateToken({
    currentTokenHash,
    newTokenHash,
    userId,
    tenantId,
    expiresAt,
    deviceId,
    userAgent
  }: RotateRefreshTokenParams): Promise<void> {
    const client = await getPostgresPool().connect();
    let committed = false;

    try {
      await client.query('BEGIN');

      const storedToken = await this.findValidByHashForUpdate({ tokenHash: currentTokenHash, client });

      if (storedToken === null) {
        this.logger.error({
          actor: userId,
          className: 'StaffUserRefreshTokenRepository',
          method: 'rotateToken',
          logMessage: 'Invalid refresh token'
        });
        throw new RefreshTokenNotFoundError();
      }

      if (storedToken.revoked_at !== null) {
        this.logger.info({
          actor: userId,
          className: 'StaffUserRefreshTokenRepository',
          method: 'rotateToken',
          logMessage: 'Refresh token revoked'
        });
        throw new RefreshTokenRevokedError();
      }

      if (storedToken.user_id !== userId) {
        this.logger.error({
          actor: userId,
          className: 'StaffUserRefreshTokenRepository',
          method: 'rotateToken',
          logMessage: 'Refresh token does not belong to user'
        });
        throw new RefreshTokenOwnershipError();
      }

      // Records that the token was legitimately presented at this moment, independent of
      // whether it then turns out to be expired or goes on to be successfully rotated below.
      await this.touchById({ tokenId: storedToken.id, client });

      if (storedToken.expires_at.getTime() < Date.now()) {
        await this.revokeById({ tokenId: storedToken.id, client });
        await client.query('COMMIT');
        committed = true;
        this.logger.info({
          actor: userId,
          className: 'StaffUserRefreshTokenRepository',
          method: 'rotateToken',
          logMessage: 'Refresh token expired'
        });
        throw new RefreshTokenExpiredError();
      }

      await this.revokeById({ tokenId: storedToken.id, client });

      await this.create({
        userId,
        tenantId,
        tokenHash: newTokenHash,
        expiresAt,
        deviceId,
        userAgent,
        client
      });

      await client.query('COMMIT');
      committed = true;
    } catch (error) {
      if (committed === false) {
        await client.query('ROLLBACK');
      }
      throw error;
    } finally {
      client.release();
    }
  }
}

export default StaffUserRefreshTokenRepository;

