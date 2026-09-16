import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: [ 'api/**/*.test.ts' ],
    setupFiles: [ './vitest.setup.ts' ],
    clearMocks: true,
    restoreMocks: true,
    unstubEnvs: true,
    coverage: {
      provider: 'v8',
      reporter: [ 'text', 'html', 'json-summary' ],
      include: [ 'api/**/*.ts' ],
      // api/models/audit-model.ts: excluded because the audit-logging feature it belongs to
      // isn't implemented yet (Logger.writeLog's `if (this.config.log[type].audit)` is a no-op
      // and Mongo is never connected) - remove this line once that feature actually ships.
      exclude: [ 'api/**/*.test.ts', 'api/server.ts', 'api/types/**', 'api/models/audit-model.ts' ]
    }
  }
});
