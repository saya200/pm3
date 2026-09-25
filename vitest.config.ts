import { defineConfig } from 'vitest/config';

export default defineConfig({
  define: { __SECTION_SLUG__: JSON.stringify('test-section-slug'), __BUILD_TIME__: '""' },
  test: { include: ['tests/unit/**/*.test.ts'] },
});
