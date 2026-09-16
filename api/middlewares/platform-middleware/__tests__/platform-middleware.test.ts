import { describe, expect, it, vi } from 'vitest';
import type { NextFunction, Request, Response } from 'express';
import PlatformMiddleware from '../platform-middleware.js';

const ANDROID_UA = 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Mobile Safari/537.36';
const IOS_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1';
const WINDOWS_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36';
const MACOS_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Safari/605.1.15';
const LINUX_UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36';
const CURL_UA = 'curl/8.4.0';

const createMockRequest = (overrides: Record<string, unknown> = {}): Request => ({
  headers: {},
  ...overrides
} as unknown as Request);

const invokeMiddleware = (
  middleware: (req: Request, res: Response, next: NextFunction) => void,
  req: Request
): void => {
  const next = vi.fn();
  middleware(req, {} as unknown as Response, next as unknown as NextFunction);
};

describe('PlatformMiddleware', () => {
  describe('middleware', () => {
    it('defaults to web/unknown when there is no user-agent header', () => {
      const middleware = new PlatformMiddleware().middleware();
      const req = createMockRequest();

      invokeMiddleware(middleware, req);

      expect(req.platformType).toBe('web');
      expect(req.platform).toBe('unknown');
    });

    it('defaults to web/unknown for a user-agent that matches no known platform', () => {
      const middleware = new PlatformMiddleware().middleware();
      const req = createMockRequest({ headers: { 'user-agent': CURL_UA } });

      invokeMiddleware(middleware, req);

      expect(req.platformType).toBe('web');
      expect(req.platform).toBe('unknown');
    });

    it('identifies an Android user-agent as mobile/android', () => {
      const middleware = new PlatformMiddleware().middleware();
      const req = createMockRequest({ headers: { 'user-agent': ANDROID_UA } });

      invokeMiddleware(middleware, req);

      expect(req.platformType).toBe('mobile');
      expect(req.platform).toBe('android');
    });

    it('identifies an iPhone user-agent as mobile/ios', () => {
      const middleware = new PlatformMiddleware().middleware();
      const req = createMockRequest({ headers: { 'user-agent': IOS_UA } });

      invokeMiddleware(middleware, req);

      expect(req.platformType).toBe('mobile');
      expect(req.platform).toBe('ios');
    });

    it('identifies a Windows user-agent as web/windows', () => {
      const middleware = new PlatformMiddleware().middleware();
      const req = createMockRequest({ headers: { 'user-agent': WINDOWS_UA } });

      invokeMiddleware(middleware, req);

      expect(req.platformType).toBe('web');
      expect(req.platform).toBe('windows');
    });

    it('identifies a macOS user-agent as web/macos', () => {
      const middleware = new PlatformMiddleware().middleware();
      const req = createMockRequest({ headers: { 'user-agent': MACOS_UA } });

      invokeMiddleware(middleware, req);

      expect(req.platformType).toBe('web');
      expect(req.platform).toBe('macos');
    });

    it('identifies a Linux desktop user-agent as web/linux', () => {
      const middleware = new PlatformMiddleware().middleware();
      const req = createMockRequest({ headers: { 'user-agent': LINUX_UA } });

      invokeMiddleware(middleware, req);

      expect(req.platformType).toBe('web');
      expect(req.platform).toBe('linux');
    });

    it('calls next exactly once', () => {
      const middleware = new PlatformMiddleware().middleware();
      const req = createMockRequest();
      const next = vi.fn();

      middleware(req, {} as unknown as Response, next as unknown as NextFunction);

      expect(next).toHaveBeenCalledOnce();
    });

    it('does not leak platform state from a previous request through the same middleware instance', () => {
      const middleware = new PlatformMiddleware().middleware();

      const androidReq = createMockRequest({ headers: { 'user-agent': ANDROID_UA } });
      invokeMiddleware(middleware, androidReq);
      expect(androidReq.platformType).toBe('mobile');
      expect(androidReq.platform).toBe('android');

      const noUaReq = createMockRequest();
      invokeMiddleware(middleware, noUaReq);

      expect(noUaReq.platformType).toBe('web');
      expect(noUaReq.platform).toBe('unknown');
    });
  });
});
