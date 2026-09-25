import { deleteApp, initializeApp } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
// @ts-expect-error — وحدة JS
import { runOnce } from '../../notifier/core.mjs';

process.env.FIRESTORE_EMULATOR_HOST ||= '127.0.0.1:8080';
const app = initializeApp({ projectId: 'demo-notifier' }, 'notifier-test');
const db = getFirestore(app);
const slug = 'notifier-test-slug';
const S = db.doc(`sections/${slug}`);
const H = 3_600_000;

type Msg = { tokens: string[]; webpush: { data: Record<string, string> } };
function fakeMessaging() {
  const sent: Msg[] = [];
  return {
    sent,
    async sendEachForMulticast(m: Msg) {
      sent.push(m);
      return {
        successCount: m.tokens.filter((t) => t !== 'dead').length,
        responses: m.tokens.map((t) =>
          t === 'dead'
            ? { success: false, error: { code: 'messaging/registration-token-not-registered' } }
            : { success: true },
        ),
      };
    },
  };
}

beforeAll(async () => {
  await db.recursiveDelete(S);
  const now = Date.now();
  const due = Timestamp.fromMillis(now + 23 * H);
  await S.collection('alerts')
    .doc('a1')
    .set({
      type: 'assignment',
      subject: 'finance',
      title: 'واجب الفصل',
      dueAt: due,
      activeUntil: due,
      archivedAt: null,
      deletedAt: null,
      createdAt: Timestamp.fromMillis(now - 60_000),
    });
  await S.collection('pushTokens').doc('good').set({ token: 'good-token', uid: 'u' });
  await S.collection('pushTokens').doc('dead').set({ token: 'dead', uid: 'v' });
});
afterAll(async () => {
  await db.recursiveDelete(S);
  await deleteApp(app);
});

describe('سكربت الإشعارات (مع المحاكي)', () => {
  it('يرسل "جديد" مرة واحدة، ثم تذكير 24 ساعة، ويحذف الرموز الميتة', async () => {
    const m = fakeMessaging();
    const siteUrl = 'https://example.github.io/pm3/s/x/';
    await runOnce({ db, messaging: m, slug, siteUrl, log: () => {} });
    expect(m.sent).toHaveLength(1);
    expect(m.sent[0].webpush.data.title).toBe('📚 واجب جديد في تمويل المشاريع');
    expect(m.sent[0].webpush.data.url).toBe(`${siteUrl}#a=a1`);
    expect((await S.collection('pushTokens').doc('dead').get()).exists).toBe(false);

    // تشغيل ثانٍ فورًا: لا تكرار (الإنشاء قبل الموعد بأقل من 24 ساعة => التذكير مُعلَّم كمرسل)
    await runOnce({ db, messaging: m, slug, siteUrl, log: () => {} });
    expect(m.sent).toHaveLength(1);

    // تغيير الموعد => التذكيرات تعود للموعد الجديد
    const newDue = Timestamp.fromMillis(Date.now() + 20 * H);
    await S.collection('alerts').doc('a1').update({ dueAt: newDue, activeUntil: newDue });
    await runOnce({ db, messaging: m, slug, siteUrl, log: () => {} });
    expect(m.sent).toHaveLength(2);
    expect(m.sent[1].webpush.data.title).toBe('⏰ باقي يوم على واجب تمويل المشاريع');

    // قبل الموعد بساعة ونصف => تذكير الساعتين
    await runOnce({ db, messaging: m, slug, siteUrl, now: newDue.toMillis() - 1.5 * H, log: () => {} });
    expect(m.sent).toHaveLength(3);
    expect(m.sent[2].webpush.data.title).toBe('🚨 باقي ساعتان على واجب تمويل المشاريع');
  });
});
