import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import path from 'path';

const { mockDotenvConfig } = vi.hoisted(() => ({
  mockDotenvConfig: vi.fn()
}));

vi.mock('dotenv', () => ({
  default: { config: mockDotenvConfig }
}));

// bootstrap-env.ts runs its side effects immediately at import time (no exported function to
// call), so each test forces a fresh evaluation via resetModules() + a dynamic import, rather
// than relying on the one-time execution a normal top-level `import` would give it.
describe('bootstrap-env', () => {
  let originalApplicationEnvironment: string | undefined;

  beforeEach(() => {
    originalApplicationEnvironment = process.env.APPLICATION_ENVIRONMENT;
    vi.resetModules();
  });

  afterEach(() => {
    if (originalApplicationEnvironment === undefined) {
      delete process.env.APPLICATION_ENVIRONMENT;
    } else {
      process.env.APPLICATION_ENVIRONMENT = originalApplicationEnvironment;
    }
  });

  it('loads the base .env file first, then the environment-specific file with override, in that order', async () => {
    process.env.APPLICATION_ENVIRONMENT = 'testing';

    await import('../bootstrap-env');

    expect(mockDotenvConfig).toHaveBeenCalledTimes(2);

    const firstCallArgs = mockDotenvConfig.mock.calls[0][0] as { path: string; override?: boolean };
    const secondCallArgs = mockDotenvConfig.mock.calls[1][0] as { path: string; override?: boolean };

    expect(path.basename(firstCallArgs.path)).toBe('.env');
    expect(firstCallArgs.override).toBeUndefined();

    expect(path.basename(secondCallArgs.path)).toBe('.env.testing');
    expect(secondCallArgs.override).toBe(true);

    expect(path.dirname(firstCallArgs.path)).toBe(path.dirname(secondCallArgs.path));
  });

  it('defaults APPLICATION_ENVIRONMENT to "default" when it is not set, and loads the matching file', async () => {
    delete process.env.APPLICATION_ENVIRONMENT;

    await import('../bootstrap-env');

    expect(process.env.APPLICATION_ENVIRONMENT).toBe('default');

    const secondCallArgs = mockDotenvConfig.mock.calls[1][0] as { path: string };
    expect(path.basename(secondCallArgs.path)).toBe('.env.default');
  });

  it('preserves an already-set APPLICATION_ENVIRONMENT instead of overwriting it', async () => {
    process.env.APPLICATION_ENVIRONMENT = 'production';

    await import('../bootstrap-env');

    expect(process.env.APPLICATION_ENVIRONMENT).toBe('production');

    const secondCallArgs = mockDotenvConfig.mock.calls[1][0] as { path: string };
    expect(path.basename(secondCallArgs.path)).toBe('.env.production');
  });
});
