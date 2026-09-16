import { describe, expect, it } from 'vitest';
import type { Application } from 'express';
import AuthRoutes from '../route.js';
import testingConfig from '../../../config/environment-config/config.js';

interface RegisteredRoute {
  method: string;
  path: string;
  handlerCount: number;
}

const createFakeApp = (registered: RegisteredRoute[]): Application => {
  const record = (method: string) => (path: string, ...handlers: unknown[]): void => {
    registered.push({ method, path, handlerCount: handlers.length });
  };

  return {
    post: record('POST'),
    get: record('GET')
  } as unknown as Application;
};

describe('AuthRoutes', () => {
  it('registers all auth routes with the expected method, path, and middleware chain length', () => {
    const registered: RegisteredRoute[] = [];
    const app = createFakeApp(registered);
    const basePath = `${testingConfig.app.baseRoute}/auth`;

    new AuthRoutes().authRoutes(app);

    expect(registered).toEqual([
      { method: 'POST', path: `${basePath}/signup`, handlerCount: 2 },
      { method: 'POST', path: `${basePath}/login`, handlerCount: 2 },
      { method: 'POST', path: `${basePath}/refresh`, handlerCount: 1 },
      { method: 'POST', path: `${basePath}/logout`, handlerCount: 1 },
      { method: 'POST', path: `${basePath}/logout-all`, handlerCount: 1 }
    ]);
  });
});
