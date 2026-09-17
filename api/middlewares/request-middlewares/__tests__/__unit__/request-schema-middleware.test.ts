import { describe, expect, it, vi } from 'vitest';
import type { NextFunction, Request, Response } from 'express';
import Joi from 'joi';
import { StatusCodes } from 'http-status-codes';
import RequestSchemaMiddleware from '../../request-schema-middleware.js';

const createMockRequest = (overrides: Record<string, unknown> = {}): Request => ({
  headers: {},
  body: {},
  ...overrides
} as unknown as Request);

const createMockResponse = (): { status: ReturnType<typeof vi.fn>; send: ReturnType<typeof vi.fn> } => {
  const res = { status: vi.fn(), send: vi.fn() };
  res.status.mockReturnValue(res);
  return res;
};

describe('RequestSchemaMiddleware', () => {
  describe('validate', () => {
    it('calls next when no schemas are configured', () => {
      const middleware = new RequestSchemaMiddleware({}).validate();
      const req = createMockRequest({ body: { anything: 'goes' } });
      const res = createMockResponse();
      const next = vi.fn();

      middleware(req, res as unknown as Response, next as unknown as NextFunction);

      expect(next).toHaveBeenCalledOnce();
      expect(res.status).not.toHaveBeenCalled();
    });

    describe('bodySchema', () => {
      const bodySchema = Joi.object({ email: Joi.string().email().required() });

      it('calls next when the body matches the schema', () => {
        const middleware = new RequestSchemaMiddleware({ bodySchema }).validate();
        const req = createMockRequest({ body: { email: 'user@example.com' } });
        const res = createMockResponse();
        const next = vi.fn();

        middleware(req, res as unknown as Response, next as unknown as NextFunction);

        expect(next).toHaveBeenCalledOnce();
        expect(res.status).not.toHaveBeenCalled();
      });

      it('returns 400 when the body does not match the schema', () => {
        const middleware = new RequestSchemaMiddleware({ bodySchema }).validate();
        const req = createMockRequest({ body: { email: 'not-an-email' } });
        const res = createMockResponse();
        const next = vi.fn();

        middleware(req, res as unknown as Response, next as unknown as NextFunction);

        expect(res.status).toHaveBeenCalledWith(StatusCodes.BAD_REQUEST);
        expect(res.send).toHaveBeenCalledWith({ message: expect.any(String) as string, code: 'BAD_REQUEST' });
        expect(next).not.toHaveBeenCalled();
      });
    });

    describe('headerSchema', () => {
      const headerSchema = Joi.object({ 'x-api-key': Joi.string().required() });

      it('calls next when the headers match the schema', () => {
        const middleware = new RequestSchemaMiddleware({ headerSchema }).validate();
        const req = createMockRequest({ headers: { 'x-api-key': 'a-valid-key' } });
        const res = createMockResponse();
        const next = vi.fn();

        middleware(req, res as unknown as Response, next as unknown as NextFunction);

        expect(next).toHaveBeenCalledOnce();
        expect(res.status).not.toHaveBeenCalled();
      });

      it('returns 400 when the headers do not match the schema', () => {
        const middleware = new RequestSchemaMiddleware({ headerSchema }).validate();
        const req = createMockRequest({ headers: {} });
        const res = createMockResponse();
        const next = vi.fn();

        middleware(req, res as unknown as Response, next as unknown as NextFunction);

        expect(res.status).toHaveBeenCalledWith(StatusCodes.BAD_REQUEST);
        expect(res.send).toHaveBeenCalledWith({ message: expect.any(String) as string, code: 'BAD_REQUEST' });
        expect(next).not.toHaveBeenCalled();
      });

      it('checks headers before the body, short-circuiting on the first failure', () => {
        const bodySchema = Joi.object({ email: Joi.string().email().required() });
        const middleware = new RequestSchemaMiddleware({ bodySchema, headerSchema }).validate();
        const req = createMockRequest({ headers: {}, body: { email: 'also-not-an-email' } });
        const res = createMockResponse();
        const next = vi.fn();

        middleware(req, res as unknown as Response, next as unknown as NextFunction);

        expect(res.status).toHaveBeenCalledOnce();
        expect(res.status).toHaveBeenCalledWith(StatusCodes.BAD_REQUEST);
        expect(res.send).toHaveBeenCalledWith({ message: expect.stringContaining('x-api-key') as string, code: 'BAD_REQUEST' });
        expect(next).not.toHaveBeenCalled();
      });
    });

    it('returns 500 when schema validation itself throws unexpectedly', () => {
      const bodySchema = Joi.object({ email: Joi.string().email().required() });
      vi.spyOn(bodySchema, 'validate').mockImplementation(() => {
        throw new Error('unexpected validator failure');
      });

      const middleware = new RequestSchemaMiddleware({ bodySchema }).validate();
      const req = createMockRequest({ body: { email: 'user@example.com' } });
      const res = createMockResponse();
      const next = vi.fn();

      middleware(req, res as unknown as Response, next as unknown as NextFunction);

      expect(res.status).toHaveBeenCalledWith(StatusCodes.INTERNAL_SERVER_ERROR);
      expect(res.send).toHaveBeenCalledWith({ message: 'An unexpected error occurred.', code: 'INTERNAL_SERVER_ERROR' });
      expect(next).not.toHaveBeenCalled();
    });
  });
});
