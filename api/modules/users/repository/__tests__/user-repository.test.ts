import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Pool } from 'pg';
import UserRepository from '../user-repository.js';
import { setPostgresPool } from '../../../../config/database/postgres-client.js';
import type { UserDatabaseSchema } from '../../../../models/user-model.js';
import { BadRequestError, DuplicateEmailError, DuplicatePhoneError, NotFoundError } from '../../../../exceptions/exceptions.js';

interface FakePool {
  query: ReturnType<typeof vi.fn>;
}

const createFakeRow = (overrides: Partial<UserDatabaseSchema> = {}): UserDatabaseSchema => ({
  id: 'internal-id-1',
  public_id: 'user-public-id-1',
  name: 'Alice',
  email: 'alice@example.com',
  phone: '+15551234567',
  password_hash: 'hashed-password',
  birthdate: new Date('1990-01-01'),
  status: 'active',
  profile_picture_url: null,
  created_at: new Date('2024-01-01T00:00:00Z'),
  updated_at: new Date('2024-01-02T00:00:00Z'),
  deleted_at: null,
  ...overrides
});

describe('UserRepository', () => {
  let fakePool: FakePool;
  let userRepository: UserRepository;

  beforeEach(() => {
    fakePool = { query: vi.fn() };
    setPostgresPool(fakePool as unknown as Pool);
    userRepository = new UserRepository();
  });

  describe('mapRowToUser', () => {
    it('maps a database row to the domain user shape', () => {
      const row = createFakeRow();

      const user = userRepository.mapRowToUser(row);

      expect(user).toEqual({
        id: 'internal-id-1',
        userId: 'user-public-id-1',
        name: 'Alice',
        contacts: { email: 'alice@example.com', phone: '+15551234567' },
        passwordHash: 'hashed-password',
        birthdate: row.birthdate,
        status: 'active',
        profilePictureUrl: null,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        deletedAt: null
      });
    });
  });

  describe('findByEmail', () => {
    it('returns null when no user matches the email', async () => {
      fakePool.query.mockResolvedValueOnce({ rows: [] });

      const user = await userRepository.findByEmail({ email: 'nobody@example.com' });

      expect(user).toBeNull();
      expect(fakePool.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE email = $1'),
        [ 'nobody@example.com' ]
      );
    });

    it('returns the mapped user when a row is found', async () => {
      fakePool.query.mockResolvedValueOnce({ rows: [ createFakeRow() ] });

      const user = await userRepository.findByEmail({ email: 'alice@example.com' });

      expect(user?.userId).toBe('user-public-id-1');
    });
  });

  describe('findById', () => {
    it('returns null when no user matches the public id', async () => {
      fakePool.query.mockResolvedValueOnce({ rows: [] });

      const user = await userRepository.findById({ userId: 'missing-id' });

      expect(user).toBeNull();
      expect(fakePool.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE public_id = $1'),
        [ 'missing-id' ]
      );
    });

    it('returns the mapped user when a row is found', async () => {
      fakePool.query.mockResolvedValueOnce({ rows: [ createFakeRow({ public_id: 'user-public-id-2' }) ] });

      const user = await userRepository.findById({ userId: 'user-public-id-2' });

      expect(user?.userId).toBe('user-public-id-2');
    });
  });

  describe('create', () => {
    const createPayload = {
      userId: 'user-public-id-1',
      name: 'Alice',
      contacts: { email: 'alice@example.com', phone: '+15551234567' },
      passwordHash: 'hashed-password',
      birthdate: new Date('1990-01-01')
    };

    it('inserts the user and returns the mapped row', async () => {
      fakePool.query.mockResolvedValueOnce({ rows: [ createFakeRow() ] });

      const user = await userRepository.create({ user: createPayload });

      expect(fakePool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO users'),
        [ 'user-public-id-1', 'Alice', 'alice@example.com', '+15551234567', 'hashed-password', new Date('1990-01-01') ]
      );
      expect(user.userId).toBe('user-public-id-1');
    });

    it('throws DuplicateEmailError when the email unique constraint is violated', async () => {
      const pgError = Object.assign(new Error('duplicate key value'), { code: '23505', constraint: 'users_email_key' });
      fakePool.query.mockRejectedValueOnce(pgError);

      await expect(userRepository.create({ user: createPayload })).rejects.toThrow(DuplicateEmailError);
    });

    it('throws DuplicatePhoneError when the phone unique constraint is violated', async () => {
      const pgError = Object.assign(new Error('duplicate key value'), { code: '23505', constraint: 'users_phone_key' });
      fakePool.query.mockRejectedValueOnce(pgError);

      await expect(userRepository.create({ user: createPayload })).rejects.toThrow(DuplicatePhoneError);
    });

    it('rethrows the original error when it is not a recognized unique constraint violation', async () => {
      const connectionError = new Error('connection terminated unexpectedly');
      fakePool.query.mockRejectedValueOnce(connectionError);

      await expect(userRepository.create({ user: createPayload })).rejects.toThrow(connectionError);
    });
  });

  describe('findByIdAndUpdate', () => {
    it('throws a BadRequestError when no updatable fields are provided', async () => {
      await expect(userRepository.findByIdAndUpdate({ userId: 'user-1', updateData: {} }))
        .rejects.toThrow(BadRequestError);
      await expect(userRepository.findByIdAndUpdate({ userId: 'user-1', updateData: {} }))
        .rejects.toThrow('No valid fields provided for update.');

      expect(fakePool.query).not.toHaveBeenCalled();
    });

    it('throws a NotFoundError when no row matches the given userId', async () => {
      fakePool.query.mockResolvedValueOnce({ rows: [] });
      fakePool.query.mockResolvedValueOnce({ rows: [] });

      await expect(userRepository.findByIdAndUpdate({ userId: 'missing-id', updateData: { name: 'New Name' } }))
        .rejects.toThrow(NotFoundError);
      await expect(userRepository.findByIdAndUpdate({ userId: 'missing-id', updateData: { name: 'New Name' } }))
        .rejects.toThrow('User with id missing-id not found');
    });

    it('builds a single-field update with correctly indexed placeholders', async () => {
      fakePool.query.mockResolvedValueOnce({ rows: [ createFakeRow({ name: 'New Name' }) ] });

      await userRepository.findByIdAndUpdate({ userId: 'user-1', updateData: { name: 'New Name' } });

      expect(fakePool.query).toHaveBeenCalledWith(
        expect.stringMatching(/name = \$1.*WHERE public_id = \$2/s),
        [ 'New Name', 'user-1' ]
      );
    });

    it('builds a multi-field update with correctly indexed placeholders in declaration order', async () => {
      fakePool.query.mockResolvedValueOnce({ rows: [ createFakeRow() ] });

      await userRepository.findByIdAndUpdate({
        userId: 'user-1',
        updateData: {
          name: 'New Name',
          passwordHash: 'new-hash',
          contacts: { email: 'new@example.com', phone: '+15559999999' }
        }
      });

      expect(fakePool.query).toHaveBeenCalledWith(
        expect.stringMatching(/name = \$1.*password_hash = \$2.*email = \$3.*phone = \$4.*WHERE public_id = \$5/s),
        [ 'New Name', 'new-hash', 'new@example.com', '+15559999999', 'user-1' ]
      );
    });
  });
});
