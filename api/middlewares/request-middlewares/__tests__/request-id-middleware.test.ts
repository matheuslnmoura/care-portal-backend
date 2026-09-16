import { describe, expect, it, vi } from 'vitest';
import type { NextFunction, Request, Response } from 'express';
import requestIdMiddleware from '../request-id-middleware';
import { getRequestId } from '../../../utils/request-context/request-context';

describe('requestIdMiddleware', () => {
  it('assigns a non-empty requestId to the request', () => {
    const middleware = requestIdMiddleware();
    const req = {} as unknown as Request;
    const next = vi.fn();

    middleware(req, {} as unknown as Response, next as unknown as NextFunction);

    expect(typeof req.requestId).toBe('string');
    expect(req.requestId.length).toBeGreaterThan(0);
  });

  it('calls next exactly once', () => {
    const middleware = requestIdMiddleware();
    const req = {} as unknown as Request;
    const next = vi.fn();

    middleware(req, {} as unknown as Response, next as unknown as NextFunction);

    expect(next).toHaveBeenCalledOnce();
  });

  it('generates a different requestId for each request', () => {
    const middleware = requestIdMiddleware();
    const next = vi.fn();

    const firstReq = {} as unknown as Request;
    const secondReq = {} as unknown as Request;

    middleware(firstReq, {} as unknown as Response, next as unknown as NextFunction);
    middleware(secondReq, {} as unknown as Response, next as unknown as NextFunction);

    expect(firstReq.requestId).not.toBe(secondReq.requestId);
  });

  it('makes the requestId available via getRequestId() while next() runs', () => {
    const middleware = requestIdMiddleware();
    const req = {} as unknown as Request;
    let requestIdSeenByNext: string | undefined;
    const next = vi.fn(() => {
      requestIdSeenByNext = getRequestId();
    });

    middleware(req, {} as unknown as Response, next as unknown as NextFunction);

    expect(requestIdSeenByNext).toBe(req.requestId);
  });

  it('does not leak the requestId outside of the request', () => {
    const middleware = requestIdMiddleware();
    const req = {} as unknown as Request;
    const next = vi.fn();

    middleware(req, {} as unknown as Response, next as unknown as NextFunction);

    expect(getRequestId()).toBeUndefined();
  });

  it('keeps each request\'s id isolated even when their async work interleaves', async () => {
    const middleware = requestIdMiddleware();
    const idsSeen: string[] = [];

    const runRequest = (delayMs: number): Promise<void> => new Promise((resolve) => {
      const req = {} as unknown as Request;
      const next = (): void => {
        setTimeout(() => {
          idsSeen.push(getRequestId() as string);
          resolve();
        }, delayMs);
      };

      middleware(req, {} as unknown as Response, next as unknown as NextFunction);
    });

    await Promise.all([ runRequest(10), runRequest(0) ]);

    expect(idsSeen[0]).not.toBe(idsSeen[1]);
  });
});
