import type { ConfigType } from './config.types.js';

// dotenv parses `KEY= # comment` (nothing before the `#`) as an empty string, not as "unset" -
// which is exactly what .env.example's "defaults to X" comment convention produces if a value is
// left blank. Treating '' the same as undefined here means that footgun can't silently defeat
// these fallbacks.
const readEnv = (value: string | undefined): string | undefined =>
  value === undefined || value === '' ? undefined : value;

const toStr = (value: string | undefined, fallback: string): string =>
  readEnv(value) ?? fallback;

const toInt = (value: string | undefined, fallback: number): number => {
  const raw = readEnv(value);
  if (raw === undefined) return fallback;
  const parsed = Number(raw);
  return Number.isNaN(parsed) ? fallback : parsed;
};

const toBool = (value: string | undefined, fallback: boolean): boolean => {
  const raw = readEnv(value);
  return raw === undefined ? fallback : raw === 'true';
};

const config: ConfigType = {
  app: {
    name: 'care-portal-backend',
    baseRoute: toStr(process.env.BASE_ROUTE, '/api'),
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
      url: toStr(process.env.MONGODB_URL, ''),
      options: {
        minPoolSize: toInt(process.env.MONGODB_MIN_POOL_SIZE, 10),
        connectTimeoutMS: toInt(process.env.MONGODB_CONNECT_TIMEOUT_MS, 30000)
      }
    },
    redis: {
      host: toStr(process.env.REDIS_HOST, ''),
      port: toInt(process.env.REDIS_PORT, 6379),
      ttl: toInt(process.env.REDIS_TTL, 86400),
      maxRetriesPerRequest: toInt(process.env.REDIS_MAX_RETRIES_PER_REQUEST, 1)
    },
    postgres: {
      host: toStr(process.env.POSTGRES_HOST, 'localhost'),
      port: toInt(process.env.POSTGRES_PORT, 5432),
      database: toStr(process.env.POSTGRES_DB, 'care-portal-local'),
      user: toStr(process.env.POSTGRES_USER, ''),
      password: toStr(process.env.POSTGRES_PASS, ''),
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
