// تشغيل: node notifier/run.mjs [--dry]
// المتغيرات: FIREBASE_SERVICE_ACCOUNT (JSON لحساب الخدمة) و SECTION_SLUG و SITE_URL
import { cert, initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';
import { loadEnvFiles, getSlug } from '../scripts/env.mjs';
import { runOnce } from './core.mjs';

const env = loadEnvFiles();
const slug = getSlug(env);
const siteUrl = env.SITE_URL;
if (!siteUrl) throw new Error('SITE_URL مطلوب (رابط الشعبة الكامل)');

const sa = env.FIREBASE_SERVICE_ACCOUNT;
initializeApp(sa ? { credential: cert(JSON.parse(sa)) } : { credential: applicationDefault() });

await runOnce({
  db: getFirestore(),
  messaging: getMessaging(),
  slug,
  siteUrl,
  dryRun: process.argv.includes('--dry'),
});
