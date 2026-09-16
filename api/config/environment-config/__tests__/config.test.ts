import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ConfigType } from '../config.types';

// config.ts computes everything from process.env at module-load time, so each test forces a
// fresh evaluation via resetModules() + a dynamic import, the same pattern used for
// bootstrap-env.ts.
describe('environment config', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('uses the documented fallback defaults when no optional env vars are set', async () => {
    const originalSaltRounds = process.env.PASSWORD_SALT_ROUNDS;
    delete process.env.PASSWORD_SALT_ROUNDS;

    try {
      const { default: config } = await import('../config') as { default: ConfigType };

      expect(config.app.baseRoute).toBe('/api');
      expect(config.app.port).toBe(8090);
      expect(config.application.passwordManager.saltRounds).toBe(10);
      expect(config.db.mongodb.url).toBe('');
      expect(config.db.mongodb.options.minPoolSize).toBe(10);
      expect(config.db.mongodb.options.connectTimeoutMS).toBe(30000);
      expect(config.db.redis.host).toBe('');
      expect(config.db.redis.port).toBe(6379);
      expect(config.db.redis.ttl).toBe(86400);
      expect(config.db.redis.maxRetriesPerRequest).toBe(1);
      expect(config.db.postgres.host).toBe('localhost');
      expect(config.db.postgres.port).toBe(5432);
      expect(config.db.postgres.database).toBe('care-portal-local');
      expect(config.db.postgres.user).toBe('');
      expect(config.db.postgres.password).toBe('');
      expect(config.db.postgres.max).toBe(10);
      expect(config.db.postgres.idleTimeoutMillis).toBe(30000);
      expect(config.log.info.audit).toBe(false);
      expect(config.log.warn.audit).toBe(false);
      expect(config.log.error.audit).toBe(true);
      expect(config.log.success.audit).toBe(true);
      expect(config.log.fatal.audit).toBe(true);
    } finally {
      if (originalSaltRounds === undefined) {
        delete process.env.PASSWORD_SALT_ROUNDS;
      } else {
        process.env.PASSWORD_SALT_ROUNDS = originalSaltRounds;
      }
    }
  });

  describe('with every optional env var overridden', () => {
    beforeEach(() => {
      vi.stubEnv('BASE_ROUTE', '/v2');
      vi.stubEnv('PORT', '4000');
      vi.stubEnv('PASSWORD_SALT_ROUNDS', '12');
      vi.stubEnv('MONGODB_URL', 'mongodb://mongo-host:27017/care-portal-local');
      vi.stubEnv('MONGODB_MIN_POOL_SIZE', '5');
      vi.stubEnv('MONGODB_CONNECT_TIMEOUT_MS', '15000');
      vi.stubEnv('REDIS_HOST', 'redis-host');
      vi.stubEnv('REDIS_PORT', '6380');
      vi.stubEnv('REDIS_TTL', '3600');
      vi.stubEnv('REDIS_MAX_RETRIES_PER_REQUEST', '3');
      vi.stubEnv('POSTGRES_HOST', 'postgres-host');
      vi.stubEnv('POSTGRES_PORT', '5433');
      vi.stubEnv('POSTGRES_DB', 'care-portal-override');
      vi.stubEnv('POSTGRES_USER', 'override-user');
      vi.stubEnv('POSTGRES_PASS', 'override-pass');
      vi.stubEnv('POSTGRES_POOL_MAX', '20');
      vi.stubEnv('POSTGRES_IDLE_TIMEOUT_MS', '60000');
      vi.stubEnv('LOG_AUDIT_INFO', 'true');
      vi.stubEnv('LOG_AUDIT_WARN', 'true');
      vi.stubEnv('LOG_AUDIT_ERROR', 'false');
      vi.stubEnv('LOG_AUDIT_SUCCESS', 'false');
      vi.stubEnv('LOG_AUDIT_FATAL', 'false');
    });

    it('reads every value from its corresponding env var', async () => {
      const { default: config } = await import('../config') as { default: ConfigType };

      expect(config.app.baseRoute).toBe('/v2');
      expect(config.app.port).toBe(4000);
      expect(config.application.passwordManager.saltRounds).toBe(12);
      expect(config.db.mongodb.url).toBe('mongodb://mongo-host:27017/care-portal-local');
      expect(config.db.mongodb.options.minPoolSize).toBe(5);
      expect(config.db.mongodb.options.connectTimeoutMS).toBe(15000);
      expect(config.db.redis.host).toBe('redis-host');
      expect(config.db.redis.port).toBe(6380);
      expect(config.db.redis.ttl).toBe(3600);
      expect(config.db.redis.maxRetriesPerRequest).toBe(3);
      expect(config.db.postgres.host).toBe('postgres-host');
      expect(config.db.postgres.port).toBe(5433);
      expect(config.db.postgres.database).toBe('care-portal-override');
      expect(config.db.postgres.user).toBe('override-user');
      expect(config.db.postgres.password).toBe('override-pass');
      expect(config.db.postgres.max).toBe(20);
      expect(config.db.postgres.idleTimeoutMillis).toBe(60000);
      expect(config.log.info.audit).toBe(true);
      expect(config.log.warn.audit).toBe(true);
      expect(config.log.error.audit).toBe(false);
      expect(config.log.success.audit).toBe(false);
      expect(config.log.fatal.audit).toBe(false);
    });
  });

  it('falls back to the default when a numeric env var is not a valid number', async () => {
    vi.stubEnv('PORT', 'not-a-number');

    const { default: config } = await import('../config') as { default: ConfigType };

    expect(config.app.port).toBe(8090);
  });

  it('publicRoutes is a fixed list, not env-driven', async () => {
    const { default: config } = await import('../config') as { default: ConfigType };

    expect(config.application.publicRoutes).toEqual([
      '/api/auth/signup',
      '/api/auth/login',
      '/api/auth/refresh'
    ]);
  });
});
