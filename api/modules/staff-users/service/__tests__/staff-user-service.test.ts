import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockRepository } = vi.hoisted(() => ({
  mockRepository: {
    create: vi.fn(),
    findByEmail: vi.fn(),
    findById: vi.fn()
  }
}));

vi.mock('../../repository/staff-user-repository', () => ({
  default: vi.fn(function StaffUserRepositoryMock() {
    return mockRepository;
  })
}));

import StaffUserService from '../staff-user-service.js';
import { ConflictError, DuplicateEmailError, DuplicatePhoneError } from '../../../../exceptions/exceptions.js';
import type { StaffUserSchema } from '../../../../models/staff-user-model.js';
import type { CreatePayload } from '../../repository/staff-user-repository.js';

const createPayloadFixture = (): CreatePayload => ({
  userId: 'user-public-id-1',
  name: 'Alice',
  contacts: { email: 'alice@example.com', phone: '+15551234567' },
  passwordHash: 'hashed-password',
  birthdate: new Date('1990-01-01')
});

const createUserFixture = (overrides: Partial<StaffUserSchema> = {}): StaffUserSchema => ({
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

describe('StaffUserService', () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let staffUserService: StaffUserService;

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    staffUserService = new StaffUserService();
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

      const result = await staffUserService.createUser({ user: payload });

      expect(mockRepository.create).toHaveBeenCalledWith({ user: payload });
      expect(result).toEqual(createdUser);
    });

    it('throws ConflictError when the repository throws DuplicateEmailError', async () => {
      mockRepository.create.mockRejectedValueOnce(new DuplicateEmailError());

      await expect(staffUserService.createUser({ user: createPayloadFixture() })).rejects.toThrow(ConflictError);
    });

    it('includes the email and EMAIL_ALREADY_REGISTERED code when DuplicateEmailError is thrown', async () => {
      mockRepository.create.mockRejectedValueOnce(new DuplicateEmailError());

      await expect(staffUserService.createUser({ user: createPayloadFixture() })).rejects.toMatchObject({
        code: 'EMAIL_ALREADY_REGISTERED',
        message: 'Email alice@example.com is already registered.'
      });
    });

    it('throws ConflictError when the repository throws DuplicatePhoneError', async () => {
      mockRepository.create.mockRejectedValueOnce(new DuplicatePhoneError());

      await expect(staffUserService.createUser({ user: createPayloadFixture() })).rejects.toThrow(ConflictError);
    });

    it('includes the phone and PHONE_ALREADY_REGISTERED code when DuplicatePhoneError is thrown', async () => {
      mockRepository.create.mockRejectedValueOnce(new DuplicatePhoneError());

      await expect(staffUserService.createUser({ user: createPayloadFixture() })).rejects.toMatchObject({
        code: 'PHONE_ALREADY_REGISTERED',
        message: 'Phone number +15551234567 is already registered.'
      });
    });

    it('logs and throws UnexpectedError when the repository throws an unrecognized error', async () => {
      mockRepository.create.mockRejectedValueOnce(new Error('connection lost'));

      await expect(staffUserService.createUser({ user: createPayloadFixture() })).rejects.toMatchObject({
        code: 'POSTGRES_CREATE_ERROR'
      });

      const output = getLoggedOutput();
      expect(output).toContain('className: [StaffUserService]');
      expect(output).toContain('method: [createUser]');
    });
  });

  describe('findByEmail', () => {
    it('returns the user when found', async () => {
      const user = createUserFixture();
      mockRepository.findByEmail.mockResolvedValueOnce(user);

      const result = await staffUserService.findByEmail({ email: 'alice@example.com' });

      expect(mockRepository.findByEmail).toHaveBeenCalledWith({ email: 'alice@example.com' });
      expect(result).toEqual(user);
    });

    it('returns null when no user is found', async () => {
      mockRepository.findByEmail.mockResolvedValueOnce(null);

      const result = await staffUserService.findByEmail({ email: 'nobody@example.com' });

      expect(result).toBeNull();
    });

    it('logs and throws UnexpectedError when the repository throws', async () => {
      mockRepository.findByEmail.mockRejectedValueOnce(new Error('connection lost'));

      await expect(staffUserService.findByEmail({ email: 'alice@example.com' })).rejects.toMatchObject({
        code: 'GET_USER_ERROR'
      });

      const output = getLoggedOutput();
      expect(output).toContain('className: [StaffUserService]');
      expect(output).toContain('method: [findByEmail]');
    });
  });

  describe('findById', () => {
    it('returns the user when found', async () => {
      const user = createUserFixture();
      mockRepository.findById.mockResolvedValueOnce(user);

      const result = await staffUserService.findById({ userId: 'user-public-id-1' });

      expect(mockRepository.findById).toHaveBeenCalledWith({ userId: 'user-public-id-1' });
      expect(result).toEqual(user);
    });

    it('returns null when no user is found', async () => {
      mockRepository.findById.mockResolvedValueOnce(null);

      const result = await staffUserService.findById({ userId: 'missing-id' });

      expect(result).toBeNull();
    });

    it('logs and throws UnexpectedError when the repository throws', async () => {
      mockRepository.findById.mockRejectedValueOnce(new Error('connection lost'));

      await expect(staffUserService.findById({ userId: 'user-public-id-1' })).rejects.toMatchObject({
        code: 'GET_USER_ERROR'
      });

      const output = getLoggedOutput();
      expect(output).toContain('className: [StaffUserService]');
      expect(output).toContain('method: [findById]');
    });
  });
});
