import { describe, expect, it, vi } from 'vitest';
import type { Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import BaseController from '../base-controller';
import { CustomRequestError, NotFoundError } from '../../../exceptions/exceptions';

// handleError is protected - this test-only subclass exposes it as-is, with no extra logic,
// purely so the tests below can observe BaseController's own behavior.
class TestableBaseController extends BaseController {
  public callHandleError(error: unknown, res: Response): void {
    this.handleError(error, res);
  }
}

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

describe('BaseController', () => {
  describe('handleError', () => {
    const controller = new TestableBaseController();

    it('sets res.errorDetails to the raw error', () => {
      const res = createMockResponse();
      const error = new Error('boom');

      controller.callHandleError(error, res as unknown as Response);

      expect(res.errorDetails).toBe(error);
    });

    it('responds with a generic 500 for a non-CustomRequestError', () => {
      const res = createMockResponse();

      controller.callHandleError(new Error('boom'), res as unknown as Response);

      expect(res.status).toHaveBeenCalledWith(StatusCodes.INTERNAL_SERVER_ERROR);
      expect(res.send).toHaveBeenCalledWith({ message: 'An unexpected error occurred.', code: 'INTERNAL_SERVER_ERROR' });
    });

    it('responds with a generic 500 for a thrown non-Error value', () => {
      const res = createMockResponse();

      controller.callHandleError('just a string', res as unknown as Response);

      expect(res.status).toHaveBeenCalledWith(StatusCodes.INTERNAL_SERVER_ERROR);
      expect(res.send).toHaveBeenCalledWith({ message: 'An unexpected error occurred.', code: 'INTERNAL_SERVER_ERROR' });
    });

    it('uses the statusCode, message and code from a CustomRequestError', () => {
      const res = createMockResponse();
      const error = new NotFoundError({ message: 'User not found', code: 'USER_NOT_FOUND' });

      controller.callHandleError(error, res as unknown as Response);

      expect(res.status).toHaveBeenCalledWith(StatusCodes.NOT_FOUND);
      expect(res.send).toHaveBeenCalledWith({ message: 'User not found', code: 'USER_NOT_FOUND' });
    });

    it('sends an undefined code when the CustomRequestError was constructed without one', () => {
      const res = createMockResponse();
      const error = new CustomRequestError({ message: 'Something failed', statusCode: StatusCodes.BAD_GATEWAY });

      controller.callHandleError(error, res as unknown as Response);

      expect(res.status).toHaveBeenCalledWith(StatusCodes.BAD_GATEWAY);
      expect(res.send).toHaveBeenCalledWith({ message: 'Something failed', code: undefined });
    });
  });
});
