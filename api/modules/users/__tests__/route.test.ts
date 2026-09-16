import { describe, expect, it } from 'vitest';
import type { Application } from 'express';
import UserRoutes from '../route.js';
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
    get: record('GET')
  } as unknown as Application;
};

describe('UserRoutes', () => {
  it('registers the user-info route with the expected method and path', () => {
    const registered: RegisteredRoute[] = [];
    const app = createFakeApp(registered);

    new UserRoutes().userRoutes(app);

    expect(registered).toEqual([
      { method: 'GET', path: `${testingConfig.app.baseRoute}/users/user-info`, handlerCount: 1 }
    ]);
  });
});
