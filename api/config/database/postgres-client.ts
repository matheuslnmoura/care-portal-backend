import type { Pool } from 'pg';

let postgresPool: Pool | null = null;

export const setPostgresPool = (pool: Pool): void => {
  postgresPool = pool;
};

export const getPostgresPool = (): Pool => {
  if (postgresPool === null) {
    throw new Error('PostgreSQL pool has not been initialized.');
  }

  return postgresPool;
};

