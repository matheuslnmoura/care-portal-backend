import { describe, expect, it, vi } from 'vitest';
import BaseClass from '../base-class';
import { Logger } from '../../../config/logger/logger';
import type { ConfigType } from '../../../config/environment-config/config.types';
import type { RequestContextFields } from '../../../utils/request-context/request-context';
import config from '../../../config/environment-config/config';

// BaseClass only exposes protected members - this test-only subclass exposes them as-is,
// with no extra logic, purely so the tests below can observe BaseClass's own behavior.
class TestableBaseClass extends BaseClass {
  public getEnv(): string {
    return this.env;
  }

  public getConfig(): ConfigType {
    return this.config;
  }

  public getContext(): RequestContextFields {
    return this.context;
  }

  public getLogger(): Logger {
    return this.logger;
  }
}

describe('BaseClass', () => {
  it.each([
    'development',
    'production',
    'staging',
    'testing',
    'not-a-real-environment'
  ])('always uses the single shared config object, regardless of APPLICATION_ENVIRONMENT ("%s")', (env) => {
    vi.stubEnv('APPLICATION_ENVIRONMENT', env);

    const instance = new TestableBaseClass();

    expect(instance.getEnv()).toBe(env);
    expect(instance.getConfig()).toBe(config);
  });

  it('defaults env to "default" when APPLICATION_ENVIRONMENT is not set', () => {
    const originalEnv = process.env.APPLICATION_ENVIRONMENT;
    delete process.env.APPLICATION_ENVIRONMENT;

    try {
      const instance = new TestableBaseClass();

      expect(instance.getEnv()).toBe('default');
      expect(instance.getConfig()).toBe(config);
    } finally {
      process.env.APPLICATION_ENVIRONMENT = originalEnv;
    }
  });

  it('creates a Logger instance', () => {
    vi.stubEnv('APPLICATION_ENVIRONMENT', 'testing');

    const instance = new TestableBaseClass();

    expect(instance.getLogger()).toBeInstanceOf(Logger);
  });

  it('creates a separate Logger instance for each BaseClass instance', () => {
    vi.stubEnv('APPLICATION_ENVIRONMENT', 'testing');

    const first = new TestableBaseClass();
    const second = new TestableBaseClass();

    expect(first.getLogger()).not.toBe(second.getLogger());
  });

  it('defaults context to an empty object', () => {
    vi.stubEnv('APPLICATION_ENVIRONMENT', 'testing');

    const instance = new TestableBaseClass();

    expect(instance.getContext()).toEqual({});
  });
});
