import { afterAll, beforeAll } from 'vitest';

// Env vars must be set before any app module is imported, since config.ts reads process.env once
// at import time. A dynamic import() below (not a static import, which ESM hoists above this)
// keeps the ordering correct - the same pattern used by config.test.ts/bootstrap-env.test.ts.
process.env.APPLICATION_ENVIRONMENT = 'testing';
process.env.JWT_ACCESS_SECRET = 'integration-test-access-secret';
process.env.JWT_REFRESH_SECRET = 'integration-test-refresh-secret';
process.env.REFRESH_TOKEN_HASH_SECRET = 'integration-test-refresh-hash-secret';
process.env.JWT_ACCESS_EXPIRY = '15m';
process.env.JWT_REFRESH_EXPIRY = '7d';
process.env.PASSWORD_SALT_ROUNDS = '1';
// Unconditional, not a fallback default: this suite truncates tables between tests, so it must
// never depend on whatever POSTGRES_* happens to already be set in the shell.
process.env.POSTGRES_HOST = 'localhost';
process.env.POSTGRES_PORT = '5432';
process.env.POSTGRES_DB = 'care-portal-test';
process.env.POSTGRES_USER = 'postgres';
process.env.POSTGRES_PASS = 'postgres';

const { default: DatabaseManager } = await import('./api/config/database/database-manager.js');
const { default: config } = await import('./api/config/environment-config/config.js');
const { getPostgresPool } = await import('./api/config/database/postgres-client.js');

const databaseManager = new DatabaseManager({
  mongoConfig: config.db.mongodb,
  redisConfig: config.db.redis,
  postgresConfig: config.db.postgres
});

beforeAll(async () => {
  await databaseManager.connectPostgres();
});

afterAll(async () => {
  await getPostgresPool().end();
});
