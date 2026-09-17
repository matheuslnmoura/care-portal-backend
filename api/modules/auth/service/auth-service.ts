import BaseClass from '../../../base/base-class/base-class.js';
import type { StaffUserSchema } from '../../../models/staff-user-model.js';
import PasswordManager from '../../../utils/password-manager/password-manager.js';
import StaffUserService from '../../staff-users/service/staff-user-service.js';
import StaffUserRefreshTokenRepository from '../repository/staff-user-refresh-token-repository.js';
import crypto from 'crypto';
import type { TokensInterface } from '../../../utils/token-manager/token-manager.js';
import { TokenManager } from '../../../utils/token-manager/token-manager.js';
import type { AuthCredential, CredentialProvider } from '../credential.js';
import {
  RefreshTokenNotFoundError,
  RefreshTokenOwnershipError,
  RefreshTokenRevokedError,
  RefreshTokenExpiredError,
  UnauthorizedError
} from '../../../exceptions/exceptions.js';

export interface UserPayload  {
  name: StaffUserSchema['name'];
  phone: StaffUserSchema['contacts']['phone'];
  email: StaffUserSchema['contacts']['email'];
  password: string;
  birthdate: StaffUserSchema['birthdate'];
  tenantId: StaffUserSchema['tenantId'];
};

interface AuthenticateUserParamsInterface extends Pick<UserPayload, 'email' | 'password'> {
  userAgent?: string;
};

interface AuthenticateUserResponseInterface {
  accessToken: string,
  refreshToken: string,
  userId: Pick<StaffUserSchema, 'userId'>['userId']
}

interface LogoutParamsInterface {
  refreshToken?: Pick<TokensInterface, 'refreshToken'>['refreshToken']
  userId: Pick<StaffUserSchema, 'userId'>['userId']
}

class AuthService extends BaseClass {
  private readonly staffUserService: StaffUserService;
  private readonly credentialProvider: CredentialProvider<AuthCredential>;
  private readonly refreshTokenRepository: StaffUserRefreshTokenRepository;
  private readonly passwordManager: PasswordManager;
  private readonly tokenManager: TokenManager;
  constructor() {
    super();
    this.staffUserService = new StaffUserService();
    // Same instance as staffUserService, referenced through the narrower contract - everything
    // below that only needs to look up a credential (not create one) depends on this interface,
    // not on StaffUserService concretely, so a second principal type can plug in later without
    // touching this login/refresh/logout logic.
    this.credentialProvider = this.staffUserService;
    this.refreshTokenRepository = new StaffUserRefreshTokenRepository();
    this.passwordManager = new PasswordManager();
    this.tokenManager = new TokenManager();
  }

  async createUser({ name, phone, email, password, birthdate, tenantId }: UserPayload): Promise<StaffUserSchema> {
    const user = {
      userId: crypto.randomUUID(),
      tenantId,
      name,
      contacts: {
        phone,
        email
      },
      passwordHash: await this.passwordManager.createPasswordHash({ password }),
      birthdate
    };

    return await this.staffUserService.createUser({ user });
  }

  async authenticateUser({ email, password, userAgent }: AuthenticateUserParamsInterface): Promise<AuthenticateUserResponseInterface> {
    const user = await this.credentialProvider.findByEmail({ email });
    if (user === null) throw new UnauthorizedError({ message: 'Invalid email or password', code: 'INVALID_CREDENTIALS' });
    const isValidPassword = await this.passwordManager.verifyPasswordHash({ password, passwordHash: user.passwordHash });
    if (!isValidPassword) throw new UnauthorizedError({ message: 'Invalid email or password', code: 'INVALID_CREDENTIALS' });

    const payload = { userId: user.userId };
    const accessToken = this.tokenManager.generateAccessToken({ payload });
    const refreshToken = this.tokenManager.generateRefreshToken({ payload });
    const refreshTokenHash = this.tokenManager.generateRefreshTokenHash({ refreshToken });

    await this.refreshTokenRepository.create({
      userId: user.id,
      tenantId: user.tenantId,
      tokenHash: refreshTokenHash,
      expiresAt: this.tokenManager.getRefreshTokenExpiryDate(),
      // No client-side device identifier exists yet (would need a dedicated header/mechanism),
      // so deviceId stays a placeholder - userAgent is real, sourced from the request headers.
      deviceId: 'unknown',
      userAgent: userAgent ?? 'unknown'
    });

    return { accessToken, refreshToken, userId: user.userId };
  }

  async refreshToken({ refreshToken, userAgent }: { refreshToken: string; userAgent?: string }): Promise<AuthenticateUserResponseInterface> {
    const verificationPayload = this.tokenManager.verifyRefreshToken({ refreshToken });
    const userId = verificationPayload?.userId;
    if (userId === undefined || userId === null) {
      throw new UnauthorizedError({ message: 'Invalid refresh token', code: 'INVALID_REFRESH_TOKEN' });
    }

    const refreshTokenHash = this.tokenManager.generateRefreshTokenHash({ refreshToken });

    const user = await this.credentialProvider.findById({ userId });
    if (user === null) {
      throw new UnauthorizedError({ message: 'No user related to refresh token', code: 'INVALID_REFRESH_TOKEN' });
    }

    const newAccessToken = this.tokenManager.generateAccessToken({ payload: { userId } });
    const newRefreshToken = this.tokenManager.generateRefreshToken({ payload: { userId } });
    const newRefreshTokenHash = this.tokenManager.generateRefreshTokenHash({ refreshToken: newRefreshToken });

    try {
      await this.refreshTokenRepository.rotateToken({
        currentTokenHash: refreshTokenHash,
        newTokenHash: newRefreshTokenHash,
        userId: user.id,
        tenantId: user.tenantId,
        expiresAt: this.tokenManager.getRefreshTokenExpiryDate(),
        deviceId: 'unknown',
        userAgent: userAgent ?? 'unknown'
      });
    } catch (error) {
      if (
        error instanceof RefreshTokenNotFoundError ||
        error instanceof RefreshTokenOwnershipError ||
        error instanceof RefreshTokenRevokedError
      ) {
        throw new UnauthorizedError({ message: 'Invalid refresh token', code: 'INVALID_REFRESH_TOKEN' });
      }

      if (error instanceof RefreshTokenExpiredError) {
        throw new UnauthorizedError({ message: 'Expired refresh token', code: 'EXPIRED_REFRESH_TOKEN' });
      }

      throw error;
    }

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      userId: user.userId
    };
  }

  async logout({ userId, refreshToken }: LogoutParamsInterface): Promise<void> {
    // A present-but-empty refresh token is still "absent" here.
    if (refreshToken === undefined || refreshToken === '') {
      this.logger.info({
        actor: userId,
        className: 'AuthService',
        method: 'logout',
        logMessage: 'No refresh token found. User cannot generate new accessToken.'
      });
      return;
    }

    const user = await this.credentialProvider.findById({ userId });
    if (user === null) {
      this.logger.info({
        actor: userId,
        className: 'AuthService',
        method: 'logout',
        logMessage: 'No user matches userId'
      });
      return;
    }

    const refreshTokenHash = this.tokenManager.generateRefreshTokenHash({ refreshToken });
    await this.refreshTokenRepository.deleteByHash({ tokenHash: refreshTokenHash, userId: user.id });
  }

  async logoutFromAllDevices({ userId }: Pick<StaffUserSchema, 'userId'>): Promise<void> {
    const user = await this.credentialProvider.findById({ userId });
    if (user === null) {
      this.logger.info({
        actor: userId,
        className: 'AuthService',
        method: 'logoutFromAllDevices',
        logMessage: 'No user matches userId'
      });
      return;
    }

    await this.refreshTokenRepository.revokeAllForUser({ userId: user.id });
  }
}

export default AuthService;
