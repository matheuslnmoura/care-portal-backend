import { describe, expect, it } from 'vitest';
import BaseRoute from '../base-route';
import testingConfig from '../../../config/environment-config/config';

describe('BaseRoute', () => {
  describe('getBasePath', () => {
    const baseRoute = new BaseRoute();

    it('prefixes the given sub-path with the configured app.baseRoute', () => {
      const basePath = baseRoute.getBasePath('/auth');

      expect(basePath).toBe(`${testingConfig.app.baseRoute}/auth`);
    });

    it('works for a different sub-path', () => {
      const basePath = baseRoute.getBasePath('/users');

      expect(basePath).toBe(`${testingConfig.app.baseRoute}/users`);
    });

    it('returns just the configured baseRoute when given an empty sub-path', () => {
      const basePath = baseRoute.getBasePath('');

      expect(basePath).toBe(testingConfig.app.baseRoute);
    });
  });
});
