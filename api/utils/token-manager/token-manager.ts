import type { JwtPayload, SignOptions } from 'jsonwebtoken';
import ms, { type StringValue } from 'ms';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import BaseClass from '../../base/base-class/base-class';
import { UnexpectedError } from '../../exceptions/exceptions';
import { type UserSchema } from '../../models/user-model';

export interface GenerateTokenInterface {
  payload: VerifyTokenResponseInterface
}

export interface VerifyTokenResponseInterface {
  userId: Pick<UserSchema, 'userId'>['userId']
}

export interface TokensInterface {
  accessToken: string;
  refreshToken: string
}

export class TokenManager extends BaseClass {
  private readonly accessSecret = process.env.JWT_ACCESS_SECRET;
  private readonly refreshSecret = process.env.JWT_REFRESH_SECRET;
  private readonly refreshHashSecret = process.env.REFRESH_TOKEN_HASH_SECRET;
  private readonly accessExpiry = process.env.JWT_ACCESS_EXPIRY ?? '60s';
  private readonly refreshExpiry = process.env.JWT_REFRESH_EXPIRY ?? '120s';

  private sanitizeAccessSecret(): string {
    if (this.accessSecret === undefined) throw new UnexpectedError({ message: 'Access secret is not set', code: 'NO_ACCESS_SECRET' });
    return this.accessSecret;
  }

  private sanitizeRefreshSecret(): string {
    if (this.refreshSecret === undefined) throw new UnexpectedError({ message: 'Refresh secret is not set', code: 'NO_REFRESH_SECRET' });
    return this.refreshSecret;
  }

  private sanitizeRefreshHashSecret(): string {
    if (this.refreshHashSecret === undefined) {
      throw new UnexpectedError({ message: 'Refresh hash secret is not set', code: 'NO_REFRESH_HASH_SECRET' });
    }

    return this.refreshHashSecret;
  }

  public generateAccessToken({ payload }: GenerateTokenInterface): Pick<TokensInterface, 'accessToken'>['accessToken'] {
    const sanitizedAccessSecret = this.sanitizeAccessSecret();
    const options: SignOptions = { algorithm: 'HS256', expiresIn: this.accessExpiry as StringValue };
    return jwt.sign(payload, sanitizedAccessSecret, options);
  }

  public generateRefreshToken({ payload }: GenerateTokenInterface): Pick<TokensInterface, 'refreshToken'>['refreshToken'] {
    const sanitizedRefreshSecret = this.sanitizeRefreshSecret();
    const options: SignOptions = { algorithm: 'HS256', expiresIn: this.refreshExpiry as StringValue };
    return jwt.sign(payload, sanitizedRefreshSecret, options);
  }

  public generateRefreshTokenHash({ refreshToken }: Pick<TokensInterface, 'refreshToken'>): string {
    const sanitizedRefreshSecret = this.sanitizeRefreshHashSecret();
    return crypto
      .createHmac('sha256', sanitizedRefreshSecret)
      .update(refreshToken)
      .digest('hex');
  }

  public getRefreshTokenExpiryDate(): Date {
    const duration = ms(this.refreshExpiry as StringValue);

    return new Date(Date.now() + duration);
  }

  public verifyAccessToken({ accessToken }: Pick<TokensInterface, 'accessToken'>): JwtPayload | null {
    try {
      const sanitizedAccessSecret = this.sanitizeAccessSecret();
      return jwt.verify(accessToken, sanitizedAccessSecret) as JwtPayload;

    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'name' in error &&
        error.name === 'TokenExpiredError'
      ) {
        return null;
      }
      throw error;
    }
  }

  public verifyRefreshToken({ refreshToken }: Pick<TokensInterface, 'refreshToken'>): VerifyTokenResponseInterface | null {
    try {
      const sanitizedRefreshSecret = this.sanitizeRefreshSecret();
      return jwt.verify(refreshToken, sanitizedRefreshSecret) as VerifyTokenResponseInterface;
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'name' in error &&
        error.name === 'TokenExpiredError'
      ) {
        return null;
      }
      throw error;
    }
  }
}
