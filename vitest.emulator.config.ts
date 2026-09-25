import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/emulator/**/*.test.ts'],
    testTimeout: 20000,
    hookTimeout: 20000,
    fileParallelism: false,
  },
});
