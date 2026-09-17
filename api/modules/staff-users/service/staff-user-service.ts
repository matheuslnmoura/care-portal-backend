import { ConflictError, DuplicateEmailError, DuplicatePhoneError, NotFoundError, TenantNotFoundError, UnexpectedError } from '../../../exceptions/exceptions.js';
import BaseClass from '../../../base/base-class/base-class.js';
import type { StaffUserSchema } from '../../../models/staff-user-model.js';
import StaffUserRepository from '../repository/staff-user-repository.js';
import type { CreatePayload } from '../repository/staff-user-repository.js';
import type { CredentialProvider } from '../../auth/credential.js';

class StaffUserService extends BaseClass implements CredentialProvider<StaffUserSchema> {
  private readonly repository: StaffUserRepository;

  constructor() {
    super();
    this.repository = new StaffUserRepository();
  }

  async createUser({ user }: { user: CreatePayload }): Promise<StaffUserSchema> {
    try {
      return await this.repository.create({ user });
    } catch (error) {
      if (error instanceof DuplicateEmailError) {
        throw new ConflictError({
          message: `Email ${user.contacts.email} is already registered.`,
          code: 'EMAIL_ALREADY_REGISTERED'
        });
      }

      if (error instanceof DuplicatePhoneError) {
        throw new ConflictError({
          message: `Phone number ${user.contacts.phone} is already registered.`,
          code: 'PHONE_ALREADY_REGISTERED'
        });
      }

      if (error instanceof TenantNotFoundError) {
        throw new NotFoundError({
          message: 'Tenant not found.',
          code: 'TENANT_NOT_FOUND'
        });
      }

      this.logger.error({
        actor: user.contacts.email,
        className: 'StaffUserService',
        method: 'createUser',
        logMessage: 'Unexpected Error when trying to create user',
        metadata: { error }
      });

      throw new UnexpectedError({
        message: 'An unexpected error occurred while creating user.',
        code: 'POSTGRES_CREATE_ERROR'
      });
    }
  }

  async findByEmail({ email }: Pick<StaffUserSchema['contacts'], 'email'>): Promise<StaffUserSchema | null> {
    try {
      return await this.repository.findByEmail({ email });
    } catch (error) {
      this.logger.error({
        actor: email,
        className: 'StaffUserService',
        method: 'findByEmail',
        logMessage: 'Unexpected Error when trying to get user by email',
        metadata: { error }
      });
      throw new UnexpectedError({
        message: 'An error occurred while getting user information.',
        code: 'GET_USER_ERROR'
      });
    }
  }

  async findById({ userId }: Pick<StaffUserSchema, 'userId'>): Promise<StaffUserSchema | null> {
    try {
      return await this.repository.findById({ userId });
    } catch (error) {
      this.logger.error({
        actor: userId,
        className: 'StaffUserService',
        method: 'findById',
        logMessage: 'Unexpected Error when trying to get user by id',
        metadata: { error }
      });
      throw new UnexpectedError({
        message: 'An error occurred while getting user information.',
        code: 'GET_USER_ERROR'
      });
    }
  }
}

export default StaffUserService;
