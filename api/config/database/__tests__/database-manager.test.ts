import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockMongooseConnect, mockMongooseConnection } = vi.hoisted(() => ({
  mockMongooseConnect: vi.fn(),
  mockMongooseConnection: { id: 'fake-mongoose-connection' }
}));

vi.mock('mongoose', () => ({
  default: {
    connect: mockMongooseConnect,
    connection: mockMongooseConnection
  }
}));

const { mockRedisClient, mockCreateClient } = vi.hoisted(() => {
  const client = { connect: vi.fn() };
  return {
    mockRedisClient: client,
    mockCreateClient: vi.fn(() => client)
  };
});

vi.mock('redis', () => ({
  createClient: mockCreateClient
}));

const { mockPgPool, MockPoolCtor } = vi.hoisted(() => {
  const pool = { connect: vi.fn() };
  return {
    mockPgPool: pool,
    MockPoolCtor: vi.fn(function PoolMock() {
      return pool;
    })
  };
});

vi.mock('pg', () => ({
  Pool: MockPoolCtor
}));

import DatabaseManager from '../database-manager';
import { getPostgresPool } from '../postgres-client';
import type { MongoDBConfig, PostgresConfig, RedisConfig } from '../../environment-config/config.types';

const mongoConfigFixture: MongoDBConfig = {
  url: 'mongodb://localhost:27017/test',
  options: { minPoolSize: 10, connectTimeoutMS: 30000 }
};

const redisConfigFixture: RedisConfig = {
  host: 'localhost',
  port: 6379,
  ttl: 86400,
  maxRetriesPerRequest: 1
};

const postgresConfigFixture: PostgresConfig = {
  host: 'localhost',
  port: 5432,
  user: 'test-user',
  password: 'test-password',
  database: 'test-db',
  max: 10,
  idleTimeoutMillis: 30000
};

interface ManagerOverrides {
  mongoConfig?: Partial<MongoDBConfig>;
  redisConfig?: Partial<RedisConfig>;
  postgresConfig?: Partial<PostgresConfig>;
}

const createManager = (overrides: ManagerOverrides = {}): DatabaseManager => new DatabaseManager({
  mongoConfig: { ...mongoConfigFixture, ...overrides.mongoConfig },
  redisConfig: { ...redisConfigFixture, ...overrides.redisConfig },
  postgresConfig: { ...postgresConfigFixture, ...overrides.postgresConfig }
});

describe('DatabaseManager', () => {
  let processExitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    processExitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
  });

  describe('connectMongoDB', () => {
    it('skips connecting when no url is configured', async () => {
      const manager = createManager({ mongoConfig: { url: '' } });

      await manager.connectMongoDB();

      expect(mockMongooseConnect).not.toHaveBeenCalled();
      expect(manager.getMongoConnection()).toBeNull();
    });

    it('sets the mongo connection on success', async () => {
      mockMongooseConnect.mockResolvedValueOnce(undefined);
      const manager = createManager();

      await manager.connectMongoDB();

      expect(mockMongooseConnect).toHaveBeenCalledWith(mongoConfigFixture.url, mongoConfigFixture.options);
      expect(manager.getMongoConnection()).toBe(mockMongooseConnection);
    });

    it('exits the process on failure', async () => {
      mockMongooseConnect.mockRejectedValueOnce(new Error('connection refused'));
      const manager = createManager();

      await manager.connectMongoDB();

      expect(manager.getMongoConnection()).toBeNull();
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });
  });

  describe('connectRedis', () => {
    it('skips connecting when no host is configured', async () => {
      const manager = createManager({ redisConfig: { host: '' } });

      await manager.connectRedis();

      expect(mockCreateClient).not.toHaveBeenCalled();
      expect(manager.getRedisClient()).toBeNull();
    });

    it('sets the redis client on success', async () => {
      mockRedisClient.connect.mockResolvedValueOnce(undefined);
      const manager = createManager();

      await manager.connectRedis();

      expect(mockCreateClient).toHaveBeenCalledWith({ socket: { host: 'localhost', port: 6379 } });
      expect(manager.getRedisClient()).toBe(mockRedisClient);
    });

    it('does not exit the process on failure, just logs it', async () => {
      mockRedisClient.connect.mockRejectedValueOnce(new Error('connection refused'));
      const manager = createManager();

      await manager.connectRedis();

      expect(manager.getRedisClient()).toBe(mockRedisClient);
      expect(processExitSpy).not.toHaveBeenCalled();
    });
  });

  describe('connectPostgres', () => {
    it('skips connecting when no host is configured', async () => {
      const manager = createManager({ postgresConfig: { host: '' } });

      await manager.connectPostgres();

      expect(MockPoolCtor).not.toHaveBeenCalled();
      expect(manager.getPostgresPool()).toBeNull();
    });

    it('connects, verifies with a test query, and registers the pool on success', async () => {
      const mockPoolClient = { query: vi.fn(), release: vi.fn() };
      mockPgPool.connect.mockResolvedValueOnce(mockPoolClient);
      mockPoolClient.query.mockResolvedValueOnce({ rows: [ { '?column?': 1 } ] });
      const manager = createManager();

      await manager.connectPostgres();

      expect(MockPoolCtor).toHaveBeenCalledWith({
        host: 'localhost',
        port: 5432,
        database: 'test-db',
        user: 'test-user',
        password: 'test-password',
        max: 10,
        idleTimeoutMillis: 30000
      });
      expect(mockPoolClient.query).toHaveBeenCalledWith('SELECT 1');
      expect(mockPoolClient.release).toHaveBeenCalledOnce();
      expect(manager.getPostgresPool()).toBe(mockPgPool);
      expect(getPostgresPool()).toBe(mockPgPool);
    });

    it('exits the process when the test query fails', async () => {
      const mockPoolClient = { query: vi.fn(), release: vi.fn() };
      mockPgPool.connect.mockResolvedValueOnce(mockPoolClient);
      mockPoolClient.query.mockRejectedValueOnce(new Error('syntax error'));
      const manager = createManager();

      await manager.connectPostgres();

      expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    it('exits the process when the initial connection fails', async () => {
      mockPgPool.connect.mockRejectedValueOnce(new Error('connection refused'));
      const manager = createManager();

      await manager.connectPostgres();

      expect(processExitSpy).toHaveBeenCalledWith(1);
    });
  });

  describe('connectAll', () => {
    it('connects to mongo, redis, and postgres', async () => {
      mockMongooseConnect.mockResolvedValueOnce(undefined);
      mockRedisClient.connect.mockResolvedValueOnce(undefined);
      const mockPoolClient = { query: vi.fn(), release: vi.fn() };
      mockPgPool.connect.mockResolvedValueOnce(mockPoolClient);
      mockPoolClient.query.mockResolvedValueOnce({ rows: [] });
      const manager = createManager();

      await manager.connectAll();

      expect(manager.getMongoConnection()).toBe(mockMongooseConnection);
      expect(manager.getRedisClient()).toBe(mockRedisClient);
      expect(manager.getPostgresPool()).toBe(mockPgPool);
    });

    it('still connects postgres even if mongo and redis are not configured', async () => {
      const mockPoolClient = { query: vi.fn(), release: vi.fn() };
      mockPgPool.connect.mockResolvedValueOnce(mockPoolClient);
      mockPoolClient.query.mockResolvedValueOnce({ rows: [] });
      const manager = createManager({ mongoConfig: { url: '' }, redisConfig: { host: '' } });

      await manager.connectAll();

      expect(manager.getMongoConnection()).toBeNull();
      expect(manager.getRedisClient()).toBeNull();
      expect(manager.getPostgresPool()).toBe(mockPgPool);
      expect(processExitSpy).not.toHaveBeenCalled();
    });
  });
});
