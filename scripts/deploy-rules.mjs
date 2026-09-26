// ينشر قواعد Firestore عبر Firebase Admin SDK (يكفيه حساب الخدمة الافتراضي، بدون صلاحيات إضافية)
// الاستخدام: FIREBASE_SERVICE_ACCOUNT='{...}' SECTION_SLUG=... node scripts/deploy-rules.mjs
import { readFileSync } from 'node:fs';
import { cert, initializeApp } from 'firebase-admin/app';
import { getSecurityRules } from 'firebase-admin/security-rules';
import { loadEnvFiles } from './env.mjs';

const env = loadEnvFiles();
if (!env.FIREBASE_SERVICE_ACCOUNT) throw new Error('FIREBASE_SERVICE_ACCOUNT مطلوب');
initializeApp({ credential: cert(JSON.parse(env.FIREBASE_SERVICE_ACCOUNT)) });

const source = readFileSync('firestore.rules', 'utf8'); // يُولَّد أولًا عبر npm run rules
const ruleset = await getSecurityRules().releaseFirestoreRulesetFromSource(source);
console.log(`[rules] نُشرت قواعد Firestore: ${ruleset.name}`);
