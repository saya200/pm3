// قراءة بسيطة لملفات .env (بدون مكتبات) — تُستخدم في السكربتات وملف vite
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export function loadEnvFiles(root = process.cwd()) {
  const out = {};
  for (const name of ['.env', '.env.local']) {
    const p = resolve(root, name);
    if (!existsSync(p)) continue;
    for (const line of readFileSync(p, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  }
  // متغيرات البيئة الحقيقية (GitHub Actions مثلًا) لها الأولوية
  for (const [k, v] of Object.entries(process.env)) if (v !== undefined && v !== '') out[k] = v;
  return out;
}

export const DEV_SLUG = 'dev-section-local';

export function getSlug(env = loadEnvFiles()) {
  const slug = env.SECTION_SLUG || DEV_SLUG;
  if (!/^[a-z0-9][a-z0-9-]{7,63}$/.test(slug)) {
    throw new Error(`SECTION_SLUG غير صالح: "${slug}". استخدم أحرف إنجليزية صغيرة وأرقام (٨ خانات على الأقل).`);
  }
  return slug;
}
