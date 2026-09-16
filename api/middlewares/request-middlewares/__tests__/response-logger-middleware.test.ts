import { describe, expect, it, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import type { NextFunction, Request, Response } from 'express';
import responseLoggerMiddleware from '../response-logger-middleware';
import type { Logger } from '../../../config/logger/logger';
import { BadRequestError } from '../../../exceptions/exceptions';
import { requestContextStorage, setRequestContext } from '../../../utils/request-context/request-context';

interface MockResponse extends EventEmitter {
  statusCode: number;
  errorDetails?: unknown;
  getHeaders: () => Record<string, string>;
}

const createMockLogger = (): { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> } => ({
  success: vi.fn(),
  error: vi.fn()
});

const createMockResponse = (overrides: { statusCode?: number; errorDetails?: unknown } = {}): MockResponse => {
  const res = new EventEmitter() as MockResponse;
  res.statusCode = overrides.statusCode ?? 200;
  res.errorDetails = overrides.errorDetails;
  res.getHeaders = vi.fn().mockReturnValue({ 'content-type': 'application/json' });
  return res;
};

const createMockRequest = (overrides: Record<string, unknown> = {}): Request => ({
  method: 'GET',
  originalUrl: '/api/resource',
  ...overrides
} as unknown as Request);

describe('responseLoggerMiddleware', () => {
  it('calls next exactly once', () => {
    const logger = createMockLogger();
    const middleware = responseLoggerMiddleware(logger as unknown as Logger);
    const req = createMockRequest();
    const res = createMockResponse();
    const next = vi.fn();

    middleware(req, res as unknown as Response, next as unknown as NextFunction);

    expect(next).toHaveBeenCalledOnce();
  });

  it('does not log before the response has finished', () => {
    const logger = createMockLogger();
    const middleware = responseLoggerMiddleware(logger as unknown as Logger);
    const req = createMockRequest();
    const res = createMockResponse();
    const next = vi.fn();

    middleware(req, res as unknown as Response, next as unknown as NextFunction);

    expect(logger.success).not.toHaveBeenCalled();
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('logs a success entry with default actor/class/method once the response finishes', () => {
    const logger = createMockLogger();
    const middleware = responseLoggerMiddleware(logger as unknown as Logger);
    const req = createMockRequest({ method: 'POST', originalUrl: '/api/auth/login' });
    const res = createMockResponse({ statusCode: 201 });
    const next = vi.fn();

    middleware(req, res as unknown as Response, next as unknown as NextFunction);
    res.emit('finish');

    expect(logger.success).toHaveBeenCalledOnce();
    expect(logger.success).toHaveBeenCalledWith({
      actor: 'unknown',
      className: 'Middleware',
      method: 'responseLoggerMiddleware',
      logMessage: 'Outgoing response: 201 for POST /api/auth/login',
      res,
      metadata: {
        statusCode: 201,
        headers: { 'content-type': 'application/json' }
      }
    });
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('uses req.user and the request context for the actor/class/method when present', () => {
    const logger = createMockLogger();
    const middleware = responseLoggerMiddleware(logger as unknown as Logger);
    const req = createMockRequest({ user: 'user-123' });
    const res = createMockResponse();
    const next = vi.fn();

    requestContextStorage.run({ requestId: 'req-1' }, () => {
      setRequestContext({ className: 'AuthController', methodName: 'login' });
      middleware(req, res as unknown as Response, next as unknown as NextFunction);
      res.emit('finish');
    });

    expect(logger.success).toHaveBeenCalledWith(expect.objectContaining({
      actor: 'user-123',
      className: 'AuthController',
      method: 'login'
    }));
  });

  it('logs an error entry with a plain Error, without touching success', () => {
    const logger = createMockLogger();
    const middleware = responseLoggerMiddleware(logger as unknown as Logger);
    const req = createMockRequest();
    const res = createMockResponse({ statusCode: 500, errorDetails: new Error('boom') });
    const next = vi.fn();

    middleware(req, res as unknown as Response, next as unknown as NextFunction);
    res.emit('finish');

    expect(logger.success).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledOnce();
    expect(logger.error).toHaveBeenCalledWith(expect.objectContaining({
      metadata: {
        error: {
          customRequestError: false,
          message: 'boom',
          name: 'Error'
        }
      }
    }));
  });

  it('includes statusCode/code and marks customRequestError for a CustomRequestError', () => {
    const logger = createMockLogger();
    const middleware = responseLoggerMiddleware(logger as unknown as Logger);
    const req = createMockRequest();
    const badRequestError = new BadRequestError({ message: 'Invalid payload', code: 'BAD_REQUEST' });
    const res = createMockResponse({ statusCode: 400, errorDetails: badRequestError });
    const next = vi.fn();

    middleware(req, res as unknown as Response, next as unknown as NextFunction);
    res.emit('finish');

    expect(logger.error).toHaveBeenCalledWith(expect.objectContaining({
      metadata: {
        error: {
          customRequestError: true,
          message: 'Invalid payload',
          name: 'Error',
          statusCode: 400,
          code: 'BAD_REQUEST'
        }
      }
    }));
  });

  it('logs a non-Error errorDetails value as-is', () => {
    const logger = createMockLogger();
    const middleware = responseLoggerMiddleware(logger as unknown as Logger);
    const req = createMockRequest();
    const res = createMockResponse({ statusCode: 500, errorDetails: { reason: 'unexpected' } });
    const next = vi.fn();

    middleware(req, res as unknown as Response, next as unknown as NextFunction);
    res.emit('finish');

    expect(logger.error).toHaveBeenCalledWith(expect.objectContaining({
      metadata: { error: { reason: 'unexpected' } }
    }));
  });
});
