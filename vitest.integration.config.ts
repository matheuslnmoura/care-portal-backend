import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: [ 'api/**/__integration__/**/*.test.ts' ],
    setupFiles: [ './vitest.integration.setup.ts' ],
    // All integration tests share one real database - running files concurrently would let
    // truncation/seeding in one file race against assertions in another.
    fileParallelism: false
  }
});
