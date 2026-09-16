import { ConflictError, DuplicateEmailError, DuplicatePhoneError, UnexpectedError } from '../../../exceptions/exceptions.js';
import BaseClass from '../../../base/base-class/base-class.js';
import type { UserSchema } from '../../../models/user-model.js';
import UserRepository from '../repository/user-repository.js';
import type { CreatePayload } from '../repository/user-repository.js';

class UserService extends BaseClass {
  private readonly repository: UserRepository;

  constructor() {
    super();
    this.repository = new UserRepository();
  }

  async createUser({ user }: { user: CreatePayload }): Promise<UserSchema> {
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

      this.logger.error({
        actor: user.contacts.email,
        className: 'UserService',
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

  async findUserByEmail({ email }: Pick<UserSchema['contacts'], 'email'>): Promise<UserSchema | null> {
    try {
      return await this.repository.findByEmail({ email });
    } catch (error) {
      this.logger.error({
        actor: email,
        className: 'UserService',
        method: 'findUserByEmail',
        logMessage: 'Unexpected Error when trying to get user by email',
        metadata: { error }
      });
      throw new UnexpectedError({
        message: 'An error occurred while getting user information.',
        code: 'GET_USER_ERROR'
      });
    }
  }

  async findUserById({ userId }: Pick<UserSchema, 'userId'>): Promise<UserSchema | null> {
    try {
      return await this.repository.findById({ userId });
    } catch (error) {
      this.logger.error({
        actor: userId,
        className: 'UserService',
        method: 'findUserById',
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

export default UserService;
