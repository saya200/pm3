// ضبط/تغيير كود الإدمن: node notifier/set-admin-code.mjs "الكود-الجديد"
// تغيير الكود يلغي صلاحية كل الأجهزة المفعّلة سابقًا فورًا.
import { cert, initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { loadEnvFiles, getSlug } from '../scripts/env.mjs';

const code = process.argv[2];
if (!code || code.length < 8) {
  console.error('استخدم كودًا من ٨ خانات أو أكثر (كلما طال كان أصعب في التخمين).');
  process.exit(1);
}
const env = loadEnvFiles();
const sa = env.FIREBASE_SERVICE_ACCOUNT;
initializeApp(sa ? { credential: cert(JSON.parse(sa)) } : { credential: applicationDefault() });
const slug = getSlug(env);
await getFirestore().doc(`sections/${slug}/adminConfig/main`).set({ code });
console.log(`تم ضبط كود الإدمن للشعبة ${slug}.`);
