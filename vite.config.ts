import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
// @ts-expect-error — سكربت JS بسيط بدون تعريفات أنواع
import { loadEnvFiles, getSlug, DEV_SLUG } from './scripts/env.mjs';

const env = loadEnvFiles();
const slug: string = getSlug(env);
if (process.env.GITHUB_ACTIONS && process.env.npm_lifecycle_event === 'build' && slug === DEV_SLUG) {
  throw new Error('SECTION_SLUG غير مضبوط في أسرار GitHub (Settings → Secrets and variables → Actions)');
}
const basePath = (env.BASE_PATH || '/').replace(/\/?$/, '/');

// التطبيق يُبنى داخل مسار الشعبة العشوائي: <BASE_PATH>s/<slug>/
export default defineConfig({
  base: `${basePath}s/${slug}/`,
  plugins: [react()],
  define: {
    __SECTION_SLUG__: JSON.stringify(slug),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
  build: {
    outDir: `dist/s/${slug}`,
    emptyOutDir: true,
    chunkSizeWarningLimit: 1200,
  },
  server: { port: 5173, host: '127.0.0.1' },
  preview: { port: 4173, host: '127.0.0.1' },
});
