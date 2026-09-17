import { describe, expect, it, vi } from 'vitest';
import type { NextFunction, Request, Response } from 'express';
import requestLoggerMiddleware from '../../request-logger-middleware.js';
import type { Logger } from '../../../../config/logger/logger.js';

const createMockLogger = (): { info: ReturnType<typeof vi.fn> } => ({
  info: vi.fn()
});

const createMockRequest = (overrides: Record<string, unknown> = {}): Request => ({
  method: 'GET',
  originalUrl: '/api/resource',
  ...overrides
} as unknown as Request);

describe('requestLoggerMiddleware', () => {
  it('logs the incoming request with the method and URL', () => {
    const logger = createMockLogger();
    const middleware = requestLoggerMiddleware(logger as unknown as Logger);
    const req = createMockRequest({ method: 'POST', originalUrl: '/api/auth/login' });
    const next = vi.fn();

    middleware(req, {} as unknown as Response, next as unknown as NextFunction);

    expect(logger.info).toHaveBeenCalledOnce();
    expect(logger.info).toHaveBeenCalledWith({
      actor: 'unknown',
      className: 'Middleware',
      method: 'requestLoggerMiddleware',
      logMessage: 'Incoming request: POST /api/auth/login',
      req
    });
  });

  it('calls next exactly once', () => {
    const logger = createMockLogger();
    const middleware = requestLoggerMiddleware(logger as unknown as Logger);
    const req = createMockRequest();
    const next = vi.fn();

    middleware(req, {} as unknown as Response, next as unknown as NextFunction);

    expect(next).toHaveBeenCalledOnce();
  });
});
