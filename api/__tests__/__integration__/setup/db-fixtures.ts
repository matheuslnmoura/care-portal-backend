import { nanoid } from 'nanoid';
import { getPostgresPool } from '../../../config/database/postgres-client.js';
import PasswordManager from '../../../utils/password-manager/password-manager.js';

const passwordManager = new PasswordManager();

export const truncateAll = async (): Promise<void> => {
  await getPostgresPool().query('TRUNCATE staff_user_refresh_tokens, staff_users, tenants RESTART IDENTITY CASCADE');
};

export interface SeededTenant {
  id: string;
}

export const seedTenant = async (overrides: { name?: string } = {}): Promise<SeededTenant> => {
  const result = await getPostgresPool().query<{ id: string }>(
    'INSERT INTO tenants (name) VALUES ($1) RETURNING id',
    [ overrides.name ?? 'Test Clinic' ]
  );

  return result.rows[0];
};

export interface SeedStaffUserOverrides {
  tenantId?: string;
  email?: string;
  phone?: string;
  password?: string;
  name?: string;
}

export interface SeededStaffUser {
  id: string;
  publicId: string;
  email: string;
  password: string;
}

// Inserts a staff user directly, bypassing POST /api/auth/signup - useful for tests that need an
// already-existing staff user without exercising (and being coupled to) the signup flow itself.
export const seedStaffUser = async (overrides: SeedStaffUserOverrides = {}): Promise<SeededStaffUser> => {
  const tenantId = overrides.tenantId ?? (await seedTenant()).id;
  const publicId = nanoid();
  const email = overrides.email ?? `staff-${nanoid(8)}@example.com`;
  const phone = overrides.phone ?? `+1555${String(Math.floor(1000000 + Math.random() * 8999999))}`;
  const password = overrides.password ?? 'super-secret-password';
  const passwordHash = await passwordManager.createPasswordHash({ password });

  const result = await getPostgresPool().query<{ id: string }>(
    `INSERT INTO staff_users (public_id, tenant_id, name, email, phone, password_hash, birthdate)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id`,
    [ publicId, tenantId, overrides.name ?? 'Test Staffer', email, phone, passwordHash, new Date('1990-01-01') ]
  );

  return { id: result.rows[0].id, publicId, email, password };
};
