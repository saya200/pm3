import { defineConfig } from '@playwright/test';

export const E2E_SLUG = 'e2e-section-test';
const PORT = 5174;

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 240_000,
  expect: { timeout: 15_000 },
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: `http://127.0.0.1:${PORT}/s/${E2E_SLUG}/`,
    locale: 'ar-SA',
    timezoneId: 'Asia/Riyadh',
    ignoreHTTPSErrors: true,
    launchOptions: process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : undefined,
  },
  webServer: {
    command: `npx vite --port ${PORT} --strictPort`,
    url: `http://127.0.0.1:${PORT}/s/${E2E_SLUG}/`,
    reuseExistingServer: false,
    env: { SECTION_SLUG: E2E_SLUG, VITE_USE_EMULATORS: '1', BASE_PATH: '/' },
    timeout: 60_000,
  },
});
