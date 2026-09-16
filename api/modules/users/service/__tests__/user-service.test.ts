import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockRepository } = vi.hoisted(() => ({
  mockRepository: {
    create: vi.fn(),
    findByEmail: vi.fn(),
    findById: vi.fn()
  }
}));

vi.mock('../../repository/user-repository', () => ({
  default: vi.fn(function UserRepositoryMock() {
    return mockRepository;
  })
}));

import UserService from '../user-service.js';
import { ConflictError, DuplicateEmailError, DuplicatePhoneError } from '../../../../exceptions/exceptions.js';
import type { UserSchema } from '../../../../models/user-model.js';
import type { CreatePayload } from '../../repository/user-repository.js';

const createPayloadFixture = (): CreatePayload => ({
  userId: 'user-public-id-1',
  name: 'Alice',
  contacts: { email: 'alice@example.com', phone: '+15551234567' },
  passwordHash: 'hashed-password',
  birthdate: new Date('1990-01-01')
});

const createUserFixture = (overrides: Partial<UserSchema> = {}): UserSchema => ({
  id: 'internal-id-1',
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

describe('UserService', () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let userService: UserService;

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    userService = new UserService();
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  const getLoggedOutput = (): string =>
    (consoleLogSpy.mock.calls as unknown[][]).map((call) => call.join(' ')).join('\n');

  describe('createUser', () => {
    it('returns the created user on success', async () => {
      const payload = createPayloadFixture();
      const createdUser = createUserFixture();
      mockRepository.create.mockResolvedValueOnce(createdUser);

      const result = await userService.createUser({ user: payload });

      expect(mockRepository.create).toHaveBeenCalledWith({ user: payload });
      expect(result).toEqual(createdUser);
    });

    it('throws ConflictError when the repository throws DuplicateEmailError', async () => {
      mockRepository.create.mockRejectedValueOnce(new DuplicateEmailError());

      await expect(userService.createUser({ user: createPayloadFixture() })).rejects.toThrow(ConflictError);
    });

    it('includes the email and EMAIL_ALREADY_REGISTERED code when DuplicateEmailError is thrown', async () => {
      mockRepository.create.mockRejectedValueOnce(new DuplicateEmailError());

      await expect(userService.createUser({ user: createPayloadFixture() })).rejects.toMatchObject({
        code: 'EMAIL_ALREADY_REGISTERED',
        message: 'Email alice@example.com is already registered.'
      });
    });

    it('throws ConflictError when the repository throws DuplicatePhoneError', async () => {
      mockRepository.create.mockRejectedValueOnce(new DuplicatePhoneError());

      await expect(userService.createUser({ user: createPayloadFixture() })).rejects.toThrow(ConflictError);
    });

    it('includes the phone and PHONE_ALREADY_REGISTERED code when DuplicatePhoneError is thrown', async () => {
      mockRepository.create.mockRejectedValueOnce(new DuplicatePhoneError());

      await expect(userService.createUser({ user: createPayloadFixture() })).rejects.toMatchObject({
        code: 'PHONE_ALREADY_REGISTERED',
        message: 'Phone number +15551234567 is already registered.'
      });
    });

    it('logs and throws UnexpectedError when the repository throws an unrecognized error', async () => {
      mockRepository.create.mockRejectedValueOnce(new Error('connection lost'));

      await expect(userService.createUser({ user: createPayloadFixture() })).rejects.toMatchObject({
        code: 'POSTGRES_CREATE_ERROR'
      });

      const output = getLoggedOutput();
      expect(output).toContain('className: [UserService]');
      expect(output).toContain('method: [createUser]');
    });
  });

  describe('findUserByEmail', () => {
    it('returns the user when found', async () => {
      const user = createUserFixture();
      mockRepository.findByEmail.mockResolvedValueOnce(user);

      const result = await userService.findUserByEmail({ email: 'alice@example.com' });

      expect(mockRepository.findByEmail).toHaveBeenCalledWith({ email: 'alice@example.com' });
      expect(result).toEqual(user);
    });

    it('returns null when no user is found', async () => {
      mockRepository.findByEmail.mockResolvedValueOnce(null);

      const result = await userService.findUserByEmail({ email: 'nobody@example.com' });

      expect(result).toBeNull();
    });

    it('logs and throws UnexpectedError when the repository throws', async () => {
      mockRepository.findByEmail.mockRejectedValueOnce(new Error('connection lost'));

      await expect(userService.findUserByEmail({ email: 'alice@example.com' })).rejects.toMatchObject({
        code: 'GET_USER_ERROR'
      });

      const output = getLoggedOutput();
      expect(output).toContain('className: [UserService]');
      expect(output).toContain('method: [findUserByEmail]');
    });
  });

  describe('findUserById', () => {
    it('returns the user when found', async () => {
      const user = createUserFixture();
      mockRepository.findById.mockResolvedValueOnce(user);

      const result = await userService.findUserById({ userId: 'user-public-id-1' });

      expect(mockRepository.findById).toHaveBeenCalledWith({ userId: 'user-public-id-1' });
      expect(result).toEqual(user);
    });

    it('returns null when no user is found', async () => {
      mockRepository.findById.mockResolvedValueOnce(null);

      const result = await userService.findUserById({ userId: 'missing-id' });

      expect(result).toBeNull();
    });

    it('logs and throws UnexpectedError when the repository throws', async () => {
      mockRepository.findById.mockRejectedValueOnce(new Error('connection lost'));

      await expect(userService.findUserById({ userId: 'user-public-id-1' })).rejects.toMatchObject({
        code: 'GET_USER_ERROR'
      });

      const output = getLoggedOutput();
      expect(output).toContain('className: [UserService]');
      expect(output).toContain('method: [findUserById]');
    });
  });
});
