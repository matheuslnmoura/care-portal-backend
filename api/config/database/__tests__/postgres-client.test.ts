import { describe, expect, it } from 'vitest';
import type { Pool } from 'pg';
import { getPostgresPool, setPostgresPool } from '../postgres-client';

// postgresPool is module-level state with no reset between tests in this file, so order matters:
// the "not initialized" case must run before any test calls setPostgresPool.
describe('postgres-client', () => {
  it('throws when getPostgresPool is called before any pool has been set', () => {
    expect(() => getPostgresPool()).toThrow('PostgreSQL pool has not been initialized.');
  });

  it('returns the pool passed to setPostgresPool', () => {
    const fakePool = { query: () => {} } as unknown as Pool;

    setPostgresPool(fakePool);

    expect(getPostgresPool()).toBe(fakePool);
  });
});
