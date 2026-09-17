import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';
import { Logger } from '../../logger.js';
import { requestContextStorage } from '../../../../utils/request-context/request-context.js';
import testingConfig from '../../../environment-config/config.js';

describe('Logger', () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  const getLoggedOutput = (): string =>
    (consoleLogSpy.mock.calls as unknown[][]).map((call) => call.join(' ')).join('\n');

  describe('actor', () => {
    it('uses the explicitly provided actor when given', () => {
      const logger = new Logger({ env: 'testing', config: testingConfig });

      logger.info({ actor: 'explicit-actor', className: 'Test', method: 'case', logMessage: 'hello' });

      expect(getLoggedOutput()).toContain('actor: [explicit-actor]');
    });

    it('defaults actor to the context userId when no actor is provided', () => {
      const logger = new Logger({ env: 'testing', config: testingConfig });

      requestContextStorage.run({ requestId: 'req-1', userId: 'user-42' }, () => {
        logger.info({ className: 'Test', method: 'case', logMessage: 'hello' });
      });

      expect(getLoggedOutput()).toContain('actor: [user-42]');
    });

    it('defaults actor to "unknown" when neither an explicit actor nor a context userId is available', () => {
      const logger = new Logger({ env: 'testing', config: testingConfig });

      logger.info({ className: 'Test', method: 'case', logMessage: 'hello' });

      expect(getLoggedOutput()).toContain('actor: [unknown]');
    });

    it('prefers an explicitly provided actor over the context userId', () => {
      const logger = new Logger({ env: 'testing', config: testingConfig });

      requestContextStorage.run({ requestId: 'req-1', userId: 'user-42' }, () => {
        logger.info({ actor: 'explicit-actor', className: 'Test', method: 'case', logMessage: 'hello' });
      });

      expect(getLoggedOutput()).toContain('actor: [explicit-actor]');
    });
  });

  describe('role', () => {
    it('defaults role to "user" when not provided', () => {
      const logger = new Logger({ env: 'testing', config: testingConfig });

      logger.info({ actor: 'someone', className: 'Test', method: 'case', logMessage: 'hello' });

      expect(getLoggedOutput()).toContain('role: [user]');
    });

    it('uses the explicitly provided role when given', () => {
      const logger = new Logger({ env: 'testing', config: testingConfig });

      logger.info({ actor: 'someone', role: 'admin', className: 'Test', method: 'case', logMessage: 'hello' });

      expect(getLoggedOutput()).toContain('role: [admin]');
    });
  });

  describe('env', () => {
    it('includes the env passed to the constructor in the log line', () => {
      const logger = new Logger({ env: 'development', config: testingConfig });

      logger.info({ actor: 'someone', className: 'Test', method: 'case', logMessage: 'hello' });

      expect(getLoggedOutput()).toContain('env: [development]');
    });
  });

  describe('requestId', () => {
    it('includes the requestId from context in the log line when available', () => {
      const logger = new Logger({ env: 'testing', config: testingConfig });

      requestContextStorage.run({ requestId: 'req-99' }, () => {
        logger.info({ actor: 'someone', className: 'Test', method: 'case', logMessage: 'hello' });
      });

      expect(getLoggedOutput()).toContain('requestId: [req-99]');
    });

    it('omits the requestId segment when there is no active context', () => {
      const logger = new Logger({ env: 'testing', config: testingConfig });

      logger.info({ actor: 'someone', className: 'Test', method: 'case', logMessage: 'hello' });

      expect(getLoggedOutput()).not.toContain('requestId:');
    });
  });

  describe('console/audit config gating', () => {
    it('does not log to console when the configured log type has console logging disabled', () => {
      const consoleDisabledConfig = {
        ...testingConfig,
        log: {
          ...testingConfig.log,
          info: { console: false, audit: false }
        }
      };
      const logger = new Logger({ env: 'testing', config: consoleDisabledConfig });

      logger.info({ actor: 'someone', className: 'Test', method: 'case', logMessage: 'hello' });

      expect(consoleLogSpy).not.toHaveBeenCalled();
    });
  });

  describe('log level methods', () => {
    it.each([
      [ 'warn', 'WARN' ],
      [ 'error', 'ERROR' ],
      [ 'success', 'SUCCESS' ],
      [ 'fatal', 'FATAL' ]
    ] as const)('%s logs with the %s label', (method, label) => {
      const logger = new Logger({ env: 'testing', config: testingConfig });

      logger[method]({ actor: 'someone', className: 'Test', method: 'case', logMessage: 'hello' });

      expect(getLoggedOutput()).toContain(`${label} =>`);
    });
  });

  describe('request info', () => {
    it('includes request info when req is provided', () => {
      const logger = new Logger({ env: 'testing', config: testingConfig });
      const req = {
        method: 'POST',
        originalUrl: '/api/auth/signup',
        url: '/auth/signup',
        headers: { 'content-type': 'application/json' },
        body: { email: 'user@example.com' },
        params: {},
        query: {}
      } as unknown as Request;

      logger.info({ actor: 'someone', className: 'Test', method: 'case', logMessage: 'hello', req });

      const output = getLoggedOutput();
      expect(output).toContain('Request Info =>');
      expect(output).toContain('"method":"POST"');
      expect(output).toContain('"url":"/api/auth/signup"');
    });

    it('does not include request info when req is not provided', () => {
      const logger = new Logger({ env: 'testing', config: testingConfig });

      logger.info({ actor: 'someone', className: 'Test', method: 'case', logMessage: 'hello' });

      expect(getLoggedOutput()).not.toContain('Request Info =>');
    });

    it('prefers originalUrl over url', () => {
      const logger = new Logger({ env: 'testing', config: testingConfig });
      const req = { method: 'GET', originalUrl: '/original', url: '/fallback', headers: {} } as unknown as Request;

      logger.info({ actor: 'someone', className: 'Test', method: 'case', logMessage: 'hello', req });

      expect(getLoggedOutput()).toContain('"url":"/original"');
    });

    it('falls back to url when originalUrl is empty', () => {
      const logger = new Logger({ env: 'testing', config: testingConfig });
      const req = { method: 'GET', originalUrl: '', url: '/fallback', headers: {} } as unknown as Request;

      logger.info({ actor: 'someone', className: 'Test', method: 'case', logMessage: 'hello', req });

      expect(getLoggedOutput()).toContain('"url":"/fallback"');
    });

    it('redacts password and passwordHash fields in the request body', () => {
      const logger = new Logger({ env: 'testing', config: testingConfig });
      const req = {
        method: 'POST',
        originalUrl: '/api/auth/signup',
        headers: {},
        body: { password: 'plain-text-password', passwordHash: 'a-hash-value', email: 'user@example.com' }
      } as unknown as Request;

      logger.info({ actor: 'someone', className: 'Test', method: 'case', logMessage: 'hello', req });

      const output = getLoggedOutput();
      expect(output).not.toContain('plain-text-password');
      expect(output).not.toContain('a-hash-value');
      expect(output).toContain('"password":"redacted"');
      expect(output).toContain('"passwordHash":"redacted"');
      expect(output).toContain('user@example.com');
    });

    it('leaves non-password body fields untouched', () => {
      const logger = new Logger({ env: 'testing', config: testingConfig });
      const req = { method: 'POST', originalUrl: '/x', headers: {}, body: { name: 'Alice' } } as unknown as Request;

      logger.info({ actor: 'someone', className: 'Test', method: 'case', logMessage: 'hello', req });

      expect(getLoggedOutput()).toContain('"name":"Alice"');
    });

    it('omits the body field entirely when the request has no body', () => {
      const logger = new Logger({ env: 'testing', config: testingConfig });
      const req = { method: 'GET', originalUrl: '/x', headers: {}, body: undefined } as unknown as Request;

      logger.info({ actor: 'someone', className: 'Test', method: 'case', logMessage: 'hello', req });

      expect(getLoggedOutput()).not.toContain('"body"');
    });

    it('omits the body field entirely when the request body is null', () => {
      const logger = new Logger({ env: 'testing', config: testingConfig });
      const req = { method: 'GET', originalUrl: '/x', headers: {}, body: null } as unknown as Request;

      logger.info({ actor: 'someone', className: 'Test', method: 'case', logMessage: 'hello', req });

      expect(getLoggedOutput()).not.toContain('"body"');
    });
  });

  describe('response info', () => {
    it('includes response info when res is provided', () => {
      const logger = new Logger({ env: 'testing', config: testingConfig });
      const res = {
        statusCode: 200,
        statusMessage: 'OK',
        getHeaders: () => ({ 'content-type': 'application/json' })
      } as unknown as Response;

      logger.success({ actor: 'someone', className: 'Test', method: 'case', logMessage: 'hello', res });

      const output = getLoggedOutput();
      expect(output).toContain('Response Info =>');
      expect(output).toContain('"statusCode":200');
    });

    it('does not include response info when res is not provided', () => {
      const logger = new Logger({ env: 'testing', config: testingConfig });

      logger.info({ actor: 'someone', className: 'Test', method: 'case', logMessage: 'hello' });

      expect(getLoggedOutput()).not.toContain('Response Info =>');
    });
  });

  describe('metadata', () => {
    it('includes metadata when provided', () => {
      const logger = new Logger({ env: 'testing', config: testingConfig });

      logger.info({ actor: 'someone', className: 'Test', method: 'case', logMessage: 'hello', metadata: { foo: 'bar' } });

      expect(getLoggedOutput()).toContain('Metadata =>');
    });

    it('omits the metadata block when not provided', () => {
      const logger = new Logger({ env: 'testing', config: testingConfig });

      logger.info({ actor: 'someone', className: 'Test', method: 'case', logMessage: 'hello' });

      expect(getLoggedOutput()).not.toContain('Metadata =>');
    });
  });
});
