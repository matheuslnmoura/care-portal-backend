export interface MongoDBConfig {
  url: string;
  options: {
    minPoolSize: number;
    connectTimeoutMS: number;
    replicaSet?: string;
  };
}

export interface RedisConfig {
  host: string;
  port: number;
  ttl: number; // in seconds
  maxRetriesPerRequest: number;
}

export interface PostgresConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  max: number;
  idleTimeoutMillis: number;
}

export interface ConfigType {
  app: {
    name: string;
    baseRoute: string;
    port: number;
  };
  application: {
    passwordManager: {
      saltRounds: number
    },
    publicRoutes: string[]
  }
  db: {
    mongodb: MongoDBConfig;
    redis: RedisConfig;
    postgres: PostgresConfig;
  };
  log: {
    info: {
      console: boolean,
      audit: boolean
    }
    warn: {
      console: boolean,
      audit: boolean
    }
    error: {
      console: boolean,
      audit: boolean
    }
    success: {
      console: boolean,
      audit: boolean
    }
    fatal: {
      console: boolean,
      audit: boolean
    }
  };
}