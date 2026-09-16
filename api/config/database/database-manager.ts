import mongoose from 'mongoose';
import { createClient, type RedisClientType } from 'redis';
import BaseClass from '../../base/base-class/base-class';
import { Pool, type PoolClient } from 'pg';
import type { MongoDBConfig, RedisConfig, PostgresConfig } from '../environment-config/config.types';
import { setPostgresPool } from './postgres-client';

interface DatabaseManagerParams {
  mongoConfig: MongoDBConfig;
  redisConfig: RedisConfig;
  postgresConfig: PostgresConfig;
}

class DatabaseManager extends BaseClass {
  private mongoConnection: mongoose.Connection | null = null;
  private redisClient: RedisClientType | null = null;
  private postgresPool: Pool | null = null;
  private readonly mongoConfig: MongoDBConfig;
  private readonly redisConfig: RedisConfig;
  private readonly postgresConfig: PostgresConfig;

  constructor({ mongoConfig, redisConfig, postgresConfig }: DatabaseManagerParams) {
    super();
    this.mongoConfig = mongoConfig;
    this.redisConfig = redisConfig;
    this.postgresConfig = postgresConfig;
  }

  public async connectMongoDB(): Promise<void> {
    if (!this.mongoConfig?.url) {
      this.logger.info({
        actor: 'system',
        role: 'database',
        className: 'DatabaseManager',
        method: 'connectMongoDb',
        logMessage: 'MongoDB credentials not provided, skipping connection.'
      });
      return;
    }
    try {
      const { url, options } = this.mongoConfig;

      await mongoose.connect(url, options);
      this.mongoConnection = mongoose.connection;

      this.logger.success({
        actor: 'system',
        role: 'database',
        className: 'DatabaseManager',
        method: 'connectMongoDB',
        logMessage: 'MongoDB connected successfully.'
      });
    } catch (error: unknown) {
      this.logger.error({
        actor: 'system',
        role: 'database',
        className: 'DatabaseManager',
        method: 'connectMongoDB',
        logMessage: 'Failed to connect to MongoDB',
        metadata: { error }
      });
      process.exit(1);    }
  }

  public async connectRedis(): Promise<void> {
    if (!this.redisConfig?.host) {
      this.logger.info({
        actor: 'system',
        role: 'database',
        className: 'DatabaseManager',
        method: 'connectRedis',
        logMessage: 'Redis credentials not provided, skipping connection.'
      });
      return;
    }
    try {
      this.redisClient = createClient({
        socket: {
          host: this.redisConfig.host,
          port: this.redisConfig.port
        }
      });
      await this.redisClient.connect();

      this.logger.success({
        actor: 'system',
        role: 'database',
        className: 'DatabaseManager',
        method: 'connectRedis',
        logMessage: 'Redis connected successfully.'
      });
    } catch (error: unknown) {
      this.logger.error({
        actor: 'system',
        role: 'database',
        className: 'DatabaseManager',
        method: 'connectRedis',
        logMessage: 'Failed to connect to Redis',
        metadata: { error }
      });
    }
  }

  public async connectPostgres(): Promise<void> {
    if (!this.postgresConfig?.host) {
      this.logger.info({
        actor: 'system',
        role: 'database',
        className: 'DatabaseManager',
        method: 'connectPostgres',
        logMessage: 'PostgreSQL credentials not provided, skipping connection.'
      });
      return;
    }
    try {
      this.postgresPool = new Pool({
        host: this.postgresConfig.host,
        port: this.postgresConfig.port,
        database: this.postgresConfig.database,
        user: this.postgresConfig.user,
        password: this.postgresConfig.password,
        max: this.postgresConfig.max,
        idleTimeoutMillis: this.postgresConfig.idleTimeoutMillis
      });

      // Test connection
      const client: PoolClient = await this.postgresPool.connect();
      await client.query('SELECT 1');
      client.release();

      setPostgresPool(this.postgresPool);

      this.logger.success({
        actor: 'system',
        role: 'database',
        className: 'DatabaseManager',
        method: 'connectPostgres',
        logMessage: 'PostgreSQL connected successfully.'
      });
    } catch (error: unknown) {
      this.logger.error({
        actor: 'system',
        role: 'database',
        className: 'DatabaseManager',
        method: 'connectPostgres',
        logMessage: 'Failed to connect to PostgreSQL',
        metadata: { error }
      });
      process.exit(1);
    }
  }

  public async connectAll(): Promise<void> {
    await Promise.all([
      this.connectMongoDB(),
      this.connectRedis(),
      this.connectPostgres()
    ]);
  }

  public getRedisClient(): RedisClientType | null {
    return this.redisClient;
  }

  public getMongoConnection(): mongoose.Connection | null {
    return this.mongoConnection;
  }

  public getPostgresPool(): Pool | null {
    return this.postgresPool;
  }
}

export default DatabaseManager;
