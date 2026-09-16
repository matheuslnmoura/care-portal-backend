import type { ConfigType } from './config.types.js';

const toInt = (value: string | undefined, fallback: number): number => {
  const parsed = Number(value);
  return value !== undefined && !Number.isNaN(parsed) ? parsed : fallback;
};

const toBool = (value: string | undefined, fallback: boolean): boolean =>
  value !== undefined ? value === 'true' : fallback;

const config: ConfigType = {
  app: {
    name: 'care-portal-backend',
    baseRoute: process.env.BASE_ROUTE ?? '/api',
    port: toInt(process.env.PORT, 8090)
  },
  application: {
    passwordManager: {
      saltRounds: toInt(process.env.PASSWORD_SALT_ROUNDS, 10)
    },
    publicRoutes: [
      '/api/auth/signup',
      '/api/auth/login',
      '/api/auth/refresh'
    ]
  },
  db: {
    mongodb: {
      url: process.env.MONGODB_URL ?? '',
      options: {
        minPoolSize: toInt(process.env.MONGODB_MIN_POOL_SIZE, 10),
        connectTimeoutMS: toInt(process.env.MONGODB_CONNECT_TIMEOUT_MS, 30000)
      }
    },
    redis: {
      host: process.env.REDIS_HOST ?? '',
      port: toInt(process.env.REDIS_PORT, 6379),
      ttl: toInt(process.env.REDIS_TTL, 86400),
      maxRetriesPerRequest: toInt(process.env.REDIS_MAX_RETRIES_PER_REQUEST, 1)
    },
    postgres: {
      host: process.env.POSTGRES_HOST ?? 'localhost',
      port: toInt(process.env.POSTGRES_PORT, 5432),
      database: process.env.POSTGRES_DB ?? 'care-portal-local',
      user: process.env.POSTGRES_USER ?? '',
      password: process.env.POSTGRES_PASS ?? '',
      max: toInt(process.env.POSTGRES_POOL_MAX, 10),
      idleTimeoutMillis: toInt(process.env.POSTGRES_IDLE_TIMEOUT_MS, 30000)
    }
  },
  log: {
    info: {
      console: true,
      audit: toBool(process.env.LOG_AUDIT_INFO, false)
    },
    warn: {
      console: true,
      audit: toBool(process.env.LOG_AUDIT_WARN, false)
    },
    error: {
      console: true,
      audit: toBool(process.env.LOG_AUDIT_ERROR, true)
    },
    success: {
      console: true,
      audit: toBool(process.env.LOG_AUDIT_SUCCESS, true)
    },
    fatal: {
      console: true,
      audit: toBool(process.env.LOG_AUDIT_FATAL, true)
    }
  }
};

export default config;
