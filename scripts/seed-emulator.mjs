// بيانات تجريبية للمحاكي المحلي فقط (Firebase Emulator) — لا تعمل على المشروع الحقيقي
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, Timestamp, FieldValue } from 'firebase-admin/firestore';
import { getSlug } from './env.mjs';

if (!process.env.FIRESTORE_EMULATOR_HOST) process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
initializeApp({ projectId: 'demo-section3' });
const db = getFirestore();
const slug = getSlug();
const sec = db.doc(`sections/${slug}`);
const H = 3_600_000;
const now = Date.now();
const FAR = Timestamp.fromMillis(Date.UTC(3000, 0, 1));

const items = [
  ['exam', 'risk', 'الاختبار النهائي', 'سالم', now + 5.8 * H, 'الاختبار يشمل الفصول من ١ إلى ٦. مدته ساعتان.'],
  [
    'assignment',
    'finance',
    'تسليم دراسة حالة الفصل الثالث',
    'نورة',
    now + 47.2 * H,
    'يا شباب ترى في تعديل بسيط على الواجب الأصلي.\nالمطلوب إضافة صفحة تحليل SWOT بعد الجدول المالي.',
  ],
  ['discussion', 'feasibility', 'نقاش تحليل التعادل', '', now + 71.7 * H, ''],
  ['assignment', 'cost', 'حل تمارين الوحدة الرابعة', '', now + 119.9 * H, ''],
  ['announcement', 'quality', 'تم تأجيل المحاضرة القادمة', '', null, 'المحاضرة تأجلت للأسبوع القادم بنفس الوقت.'],
];

if (process.argv.includes('--clear')) {
  await db.recursiveDelete(sec);
}
await sec.collection('adminConfig').doc('main').set({ code: 'test-admin-code-123' });
for (const [type, subject, title, authorName, due, details] of items) {
  await sec.collection('alerts').add({
    type,
    subject,
    title,
    details,
    authorName,
    authorUid: 'seed',
    dueAt: due ? Timestamp.fromMillis(due) : null,
    activeUntil: due ? Timestamp.fromMillis(due) : FAR,
    archivedAt: null,
    imageId: null,
    deletedAt: null,
    dupBy: [],
    replyCount: 0,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
}
console.log(`seeded ${items.length} alerts into sections/${slug}`);
