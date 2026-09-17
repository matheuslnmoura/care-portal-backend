import BaseClass from '../../../base/base-class/base-class.js';
import { getPostgresPool } from '../../../config/database/postgres-client.js';
import type { StaffUserSchema, StaffUserDatabaseSchema } from '../../../models/staff-user-model.js';
import { BadRequestError, DuplicateEmailError, DuplicatePhoneError, NotFoundError, TenantNotFoundError } from '../../../exceptions/exceptions.js';

export interface FindByIdAndUpdateParams {
  userId: Pick<StaffUserSchema, 'userId'>['userId'];
  updateData: Partial<StaffUserSchema>;
}

export interface CreatePayload extends Pick<StaffUserSchema, 'userId' | 'tenantId' | 'name' | 'contacts' | 'passwordHash' | 'birthdate'> {}

const STAFF_USER_COLUMNS = 'id, public_id, tenant_id, name, email, phone, password_hash, birthdate, status, profile_picture_url, created_at, updated_at, deleted_at';

class StaffUserRepository extends BaseClass {
  mapRowToUser(row: StaffUserDatabaseSchema): StaffUserSchema {
    return {
      id: row.id,
      userId: row.public_id,
      tenantId: row.tenant_id,
      name: row.name,
      contacts: {
        email: row.email,
        phone: row.phone
      },
      passwordHash: row.password_hash,
      birthdate: row.birthdate,
      status: row.status,
      profilePictureUrl: row.profile_picture_url,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      deletedAt: row.deleted_at
    };
  }

  async findByEmail({ email }: { email: string }): Promise<StaffUserSchema | null> {
    const result = await getPostgresPool().query<StaffUserDatabaseSchema>(
      `SELECT ${STAFF_USER_COLUMNS}
         FROM staff_users
        WHERE email = $1`,
      [ email ]
    );

    const row = result.rows[0];
    if (row === undefined) return null;

    return this.mapRowToUser(row);
  }

  async findById({ userId }: Pick<StaffUserSchema, 'userId'>): Promise<StaffUserSchema | null> {
    const result = await getPostgresPool().query<StaffUserDatabaseSchema>(
      `SELECT ${STAFF_USER_COLUMNS}
         FROM staff_users
        WHERE public_id = $1`,
      [ userId ]
    );

    const row = result.rows[0];
    if (row === undefined) return null;

    return this.mapRowToUser(row);
  }

  async create({ user }: { user: CreatePayload }): Promise<StaffUserSchema> {
    try {
      const result = await getPostgresPool().query<StaffUserDatabaseSchema>(
        `INSERT INTO staff_users (public_id, tenant_id, name, email, phone, password_hash, birthdate)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING ${STAFF_USER_COLUMNS}`,
        [
          user.userId,
          user.tenantId,
          user.name,
          user.contacts.email,
          user.contacts.phone,
          user.passwordHash,
          user.birthdate
        ]
      );

      return this.mapRowToUser(result.rows[0]);
    } catch (error) {
      if (isUniqueConstraintViolation(error) && error.constraint === 'staff_users_email_key') {
        throw new DuplicateEmailError();
      }

      if (isUniqueConstraintViolation(error) && error.constraint === 'staff_users_phone_key') {
        throw new DuplicatePhoneError();
      }

      if (isForeignKeyViolation(error) && error.constraint === 'staff_users_tenant_id_fkey') {
        throw new TenantNotFoundError();
      }

      throw error;
    }
  }

  async findByIdAndUpdate({ userId, updateData }: FindByIdAndUpdateParams): Promise<StaffUserSchema> {
    const updatableColumns: Array<{ column: string; value: unknown }> = [
      { column: 'name', value: updateData.name },
      { column: 'password_hash', value: updateData.passwordHash },
      { column: 'email', value: updateData.contacts?.email },
      { column: 'phone', value: updateData.contacts?.phone }
    ];

    const fieldsToUpdate = updatableColumns.filter((field) => field.value !== undefined);

    if (fieldsToUpdate.length === 0) {
      throw new BadRequestError({ message: 'No valid fields provided for update.', code: 'NO_UPDATE_FIELDS' });
    }

    const setClauses = fieldsToUpdate.map((field, i) => `${field.column} = $${i + 1}`);
    const values = fieldsToUpdate.map((field) => field.value);

    setClauses.push('updated_at = NOW()');

    values.push(userId);

    const result = await getPostgresPool().query<StaffUserDatabaseSchema>(
      `UPDATE staff_users
          SET ${setClauses.join(', ')}
        WHERE public_id = $${values.length}
        RETURNING ${STAFF_USER_COLUMNS}`,
      values
    );

    if (result.rows.length === 0) {
      throw new NotFoundError({ message: `User with id ${userId} not found`, code: 'USER_NOT_FOUND' });
    }

    return this.mapRowToUser(result.rows[0]);
  }

}
export default StaffUserRepository;

interface PostgresUniqueViolation {
  code: '23505';
  constraint?: string;
}

const isUniqueConstraintViolation = (error: unknown): error is PostgresUniqueViolation => {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === '23505';
};

interface PostgresForeignKeyViolation {
  code: '23503';
  constraint?: string;
}

const isForeignKeyViolation = (error: unknown): error is PostgresForeignKeyViolation => {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === '23503';
};
