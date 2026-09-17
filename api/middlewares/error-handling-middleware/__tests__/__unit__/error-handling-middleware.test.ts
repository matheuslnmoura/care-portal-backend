import { describe, expect, it, vi } from 'vitest';
import type { NextFunction, Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import ErrorHandlingMiddleware from '../../error-handling-middleware.js';
import { CustomRequestError, NotFoundError } from '../../../../exceptions/exceptions.js';

interface MockResponse {
  errorDetails?: unknown;
  status: ReturnType<typeof vi.fn>;
  send: ReturnType<typeof vi.fn>;
}

const createMockResponse = (): MockResponse => {
  const res: MockResponse = { status: vi.fn(), send: vi.fn() };
  res.status.mockReturnValue(res);
  return res;
};

describe('ErrorHandlingMiddleware', () => {
  describe('handle', () => {
    const middleware = new ErrorHandlingMiddleware().handle();
    const req = {} as Request;
    const next = vi.fn() as NextFunction;

    it('sets res.errorDetails to the raw error', () => {
      const res = createMockResponse();
      const error = new Error('boom');

      middleware(error, req, res as unknown as Response, next);

      expect(res.errorDetails).toBe(error);
    });

    it('responds with a generic 500 for a non-CustomRequestError', () => {
      const res = createMockResponse();

      middleware(new Error('boom'), req, res as unknown as Response, next);

      expect(res.status).toHaveBeenCalledWith(StatusCodes.INTERNAL_SERVER_ERROR);
      expect(res.send).toHaveBeenCalledWith({ message: 'An unexpected error occurred.', code: 'INTERNAL_SERVER_ERROR' });
    });

    it('responds with a generic 500 for a thrown non-Error value', () => {
      const res = createMockResponse();

      middleware('just a string', req, res as unknown as Response, next);

      expect(res.status).toHaveBeenCalledWith(StatusCodes.INTERNAL_SERVER_ERROR);
      expect(res.send).toHaveBeenCalledWith({ message: 'An unexpected error occurred.', code: 'INTERNAL_SERVER_ERROR' });
    });

    it('uses the statusCode, message and code from a CustomRequestError', () => {
      const res = createMockResponse();
      const error = new NotFoundError({ message: 'User not found', code: 'USER_NOT_FOUND' });

      middleware(error, req, res as unknown as Response, next);

      expect(res.status).toHaveBeenCalledWith(StatusCodes.NOT_FOUND);
      expect(res.send).toHaveBeenCalledWith({ message: 'User not found', code: 'USER_NOT_FOUND' });
    });

    it('sends an undefined code when the CustomRequestError was constructed without one', () => {
      const res = createMockResponse();
      const error = new CustomRequestError({ message: 'Something failed', statusCode: StatusCodes.BAD_GATEWAY });

      middleware(error, req, res as unknown as Response, next);

      expect(res.status).toHaveBeenCalledWith(StatusCodes.BAD_GATEWAY);
      expect(res.send).toHaveBeenCalledWith({ message: 'Something failed', code: undefined });
    });

    it('never calls next - this is the terminal error handler', () => {
      const res = createMockResponse();

      middleware(new Error('boom'), req, res as unknown as Response, next);

      expect(next).not.toHaveBeenCalled();
    });
  });
});
