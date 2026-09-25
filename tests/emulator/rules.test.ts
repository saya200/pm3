import { readFileSync } from 'node:fs';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  Timestamp,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  collection,
  increment,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
  type Firestore,
} from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
// @ts-expect-error — وحدة JS
import { getSlug } from '../../scripts/env.mjs';

const SLUG: string = getSlug();
const S = `sections/${SLUG}`;
const FAR = Timestamp.fromMillis(Date.UTC(3000, 0, 1));
let env: RulesTestEnvironment;

const due = () => Timestamp.fromMillis(Date.now() + 86_400_000);
const alertData = (uid: string, over: Record<string, unknown> = {}) => {
  const d = (over.dueAt as Timestamp | null | undefined) === undefined ? due() : (over.dueAt as Timestamp | null);
  return {
    type: 'assignment',
    subject: 'finance',
    title: 'واجب',
    details: '',
    dueAt: d,
    activeUntil: d ?? FAR,
    archivedAt: null,
    imageId: null,
    authorName: '',
    authorUid: uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    deletedAt: null,
    dupBy: [],
    replyCount: 0,
    ...over,
  };
};

const db = (uid: string | null): Firestore =>
  (uid ? env.authenticatedContext(uid) : env.unauthenticatedContext()).firestore() as unknown as Firestore;

async function seedAlert(id: string, uid = 'owner', over: Record<string, unknown> = {}) {
  await assertSucceeds(setDoc(doc(db(uid), `${S}/alerts/${id}`), alertData(uid, over)));
}

async function makeAdmin(uid: string, code = 'correct-code-1') {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), `${S}/adminConfig/main`), { code });
  });
  await assertSucceeds(setDoc(doc(db(uid), `${S}/admins/${uid}`), { code, createdAt: serverTimestamp() }));
}

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-rules',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
  });
});
beforeEach(() => env.clearFirestore());
afterAll(() => env.cleanup());

describe('الوصول العام', () => {
  it('بدون هوية مجهولة: لا قراءة', async () => {
    await assertFails(getDocs(collection(db(null), `${S}/alerts`)));
  });
  it('مسار شعبة آخر (رابط خاطئ) مرفوض', async () => {
    await assertFails(getDocs(collection(db('u1'), 'sections/some-other-slug/alerts')));
    await assertFails(setDoc(doc(db('u1'), 'sections/some-other-slug/alerts/a'), alertData('u1')));
  });
  it('لا يمكن سرد الشعب الموجودة', async () => {
    await assertFails(getDocs(collection(db('u1'), 'sections')));
  });
});

describe('إنشاء التنبيهات', () => {
  it('تنبيه صالح ينجح ويُقرأ من جهاز آخر', async () => {
    await seedAlert('a1', 'u1');
    await assertSucceeds(getDoc(doc(db('u2'), `${S}/alerts/a1`)));
  });
  it('إعلان بدون موعد مسموح، وواجب بدون موعد مرفوض', async () => {
    await assertSucceeds(
      setDoc(doc(db('u1'), `${S}/alerts/a2`), alertData('u1', { type: 'announcement', dueAt: null })),
    );
    await assertFails(setDoc(doc(db('u1'), `${S}/alerts/a3`), alertData('u1', { dueAt: null })));
  });
  it('مادة أو نوع خارج القائمة مرفوض', async () => {
    await assertFails(setDoc(doc(db('u1'), `${S}/alerts/a`), alertData('u1', { subject: 'math' })));
    await assertFails(setDoc(doc(db('u1'), `${S}/alerts/a`), alertData('u1', { type: 'quiz' })));
  });
  it('انتحال authorUid أو حقول الإشعارات مرفوض', async () => {
    await assertFails(setDoc(doc(db('u1'), `${S}/alerts/a`), alertData('someone-else')));
    await assertFails(setDoc(doc(db('u1'), `${S}/alerts/a`), { ...alertData('u1'), notified: { created: true } }));
  });
  it('activeUntil يجب أن يطابق الموعد (لا يمكن إخفاء تنبيه من القائمة)', async () => {
    await assertFails(setDoc(doc(db('u1'), `${S}/alerts/a`), alertData('u1', { activeUntil: FAR })));
  });
  it('عنوان أطول من 300 حرف مرفوض', async () => {
    await assertFails(setDoc(doc(db('u1'), `${S}/alerts/a`), alertData('u1', { title: 'x'.repeat(301) })));
  });
});

describe('التعديل والحذف', () => {
  it('صاحب التنبيه يعدّل الموعد، وغيره لا يستطيع', async () => {
    await seedAlert('a', 'owner');
    const d2 = Timestamp.fromMillis(Date.now() + 2 * 86_400_000);
    await assertSucceeds(
      updateDoc(doc(db('owner'), `${S}/alerts/a`), { dueAt: d2, activeUntil: d2, updatedAt: serverTimestamp() }),
    );
    await assertFails(
      updateDoc(doc(db('stranger'), `${S}/alerts/a`), { title: 'تخريب', updatedAt: serverTimestamp() }),
    );
  });
  it('لا يمكن تغيير صاحب التنبيه', async () => {
    await seedAlert('a', 'owner');
    await assertFails(updateDoc(doc(db('owner'), `${S}/alerts/a`), { authorUid: 'x', updatedAt: serverTimestamp() }));
  });
  it('حذف ناعم من صاحبه، والحذف النهائي للإدمن فقط', async () => {
    await seedAlert('a', 'owner');
    await assertSucceeds(
      updateDoc(doc(db('owner'), `${S}/alerts/a`), { deletedAt: serverTimestamp(), updatedAt: serverTimestamp() }),
    );
    await assertFails(deleteDoc(doc(db('owner'), `${S}/alerts/a`)));
    await makeAdmin('boss');
    await assertSucceeds(deleteDoc(doc(db('boss'), `${S}/alerts/a`)));
  });
  it('أرشفة يدوية لإعلان', async () => {
    await assertSucceeds(
      setDoc(doc(db('owner'), `${S}/alerts/ann`), alertData('owner', { type: 'announcement', dueAt: null })),
    );
    await assertSucceeds(
      updateDoc(doc(db('owner'), `${S}/alerts/ann`), {
        archivedAt: serverTimestamp(),
        activeUntil: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    );
  });
  it('الإدمن يعدّل تنبيه غيره', async () => {
    await seedAlert('a', 'owner');
    await makeAdmin('boss');
    await assertSucceeds(updateDoc(doc(db('boss'), `${S}/alerts/a`), { title: 'مصحح', updatedAt: serverTimestamp() }));
  });
});

describe('المكرر وعداد الردود', () => {
  it('كل طالب يعلّم باسمه فقط', async () => {
    await seedAlert('a');
    await assertSucceeds(updateDoc(doc(db('u1'), `${S}/alerts/a`), { dupBy: ['u1'] }));
    await assertFails(updateDoc(doc(db('u2'), `${S}/alerts/a`), { dupBy: ['u1', 'fake'] }));
    await assertSucceeds(updateDoc(doc(db('u2'), `${S}/alerts/a`), { dupBy: ['u1', 'u2'] }));
    await assertFails(updateDoc(doc(db('u2'), `${S}/alerts/a`), { dupBy: ['u2'] })); // حذف علامة غيره
  });
  it('رد + زيادة العداد بمقدار واحد', async () => {
    await seedAlert('a');
    const f = db('u1');
    const b = writeBatch(f);
    b.set(doc(f, `${S}/alerts/a/replies/r1`), {
      text: 'تمام',
      authorName: '',
      authorUid: 'u1',
      createdAt: serverTimestamp(),
      deletedAt: null,
    });
    b.update(doc(f, `${S}/alerts/a`), { replyCount: increment(1) });
    await assertSucceeds(b.commit());
    await assertFails(updateDoc(doc(db('u1'), `${S}/alerts/a`), { replyCount: 50 }));
  });
  it('رد لا يُحذف إلا من صاحبه أو الإدمن', async () => {
    await seedAlert('a');
    await assertSucceeds(
      setDoc(doc(db('u1'), `${S}/alerts/a/replies/r1`), {
        text: 'x',
        authorName: '',
        authorUid: 'u1',
        createdAt: serverTimestamp(),
        deletedAt: null,
      }),
    );
    await assertFails(updateDoc(doc(db('u2'), `${S}/alerts/a/replies/r1`), { deletedAt: serverTimestamp() }));
    await assertSucceeds(updateDoc(doc(db('u1'), `${S}/alerts/a/replies/r1`), { deletedAt: serverTimestamp() }));
  });
});

describe('الصور', () => {
  const img = (alertId: string, uid: string, size = 1000) => ({
    alertId,
    authorUid: uid,
    dataUrl: 'data:image/jpeg;base64,' + 'A'.repeat(size),
    width: 10,
    height: 10,
    createdAt: serverTimestamp(),
  });
  it('الصورة تُنشأ مع التنبيه في عملية واحدة', async () => {
    const f = db('u1');
    const b = writeBatch(f);
    b.set(doc(f, `${S}/alerts/a`), alertData('u1', { imageId: 'img1' }));
    b.set(doc(f, `${S}/images/img1`), img('a', 'u1'));
    await assertSucceeds(b.commit());
  });
  it('صورة غير مرتبطة بتنبيه، أو على تنبيه غيرك، أو كبيرة جدًا: مرفوضة', async () => {
    await assertFails(setDoc(doc(db('u1'), `${S}/images/x`), img('none', 'u1')));
    await seedAlert('a', 'owner', { imageId: 'img2' });
    await assertFails(setDoc(doc(db('u1'), `${S}/images/img2`), img('a', 'u1')));
    const f = db('u1');
    const b = writeBatch(f);
    b.set(doc(f, `${S}/alerts/b`), alertData('u1', { imageId: 'big' }));
    b.set(doc(f, `${S}/images/big`), img('b', 'u1', 900_001));
    await assertFails(b.commit());
  });
});

describe('الإدمن', () => {
  it('كود خاطئ مرفوض، والكود الصحيح يفعّل الصلاحية', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), `${S}/adminConfig/main`), { code: 'correct-code-1' });
    });
    await assertFails(setDoc(doc(db('u1'), `${S}/admins/u1`), { code: 'wrong', createdAt: serverTimestamp() }));
    await assertSucceeds(
      setDoc(doc(db('u1'), `${S}/admins/u1`), { code: 'correct-code-1', createdAt: serverTimestamp() }),
    );
    await assertSucceeds(getDoc(doc(db('u1'), `${S}/admins/u1`)));
  });
  it('كود الإدمن نفسه لا يُقرأ من المتصفح', async () => {
    await makeAdmin('boss');
    await assertFails(getDoc(doc(db('boss'), `${S}/adminConfig/main`)));
    await assertFails(getDoc(doc(db('u1'), `${S}/admins/boss`)));
  });
  it('تغيير الكود يلغي صلاحية الأجهزة القديمة فورًا', async () => {
    await seedAlert('a', 'owner');
    await makeAdmin('boss', 'old-code-123');
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), `${S}/adminConfig/main`), { code: 'new-code-456' });
    });
    await assertFails(deleteDoc(doc(db('boss'), `${S}/alerts/a`)));
    await assertFails(getDoc(doc(db('boss'), `${S}/admins/boss`)));
  });
  it('لا يمكن تسجيل جهاز آخر كإدمن', async () => {
    await makeAdmin('boss');
    await assertFails(
      setDoc(doc(db('boss'), `${S}/admins/victim`), { code: 'correct-code-1', createdAt: serverTimestamp() }),
    );
  });
});

describe('رموز Push', () => {
  const tok = (uid: string) => ({ token: 'tok', uid, platform: 'android', updatedAt: serverTimestamp() });
  it('كل جهاز يسجّل رمزه، ولا أحد يقرأ الرموز', async () => {
    await assertSucceeds(setDoc(doc(db('u1'), `${S}/pushTokens/t1`), tok('u1')));
    await assertFails(getDoc(doc(db('u1'), `${S}/pushTokens/t1`)));
    await assertFails(getDocs(collection(db('u1'), `${S}/pushTokens`)));
    await assertFails(setDoc(doc(db('u2'), `${S}/pushTokens/t1`), tok('u2')));
    await assertFails(deleteDoc(doc(db('u2'), `${S}/pushTokens/t1`)));
    await assertSucceeds(deleteDoc(doc(db('u1'), `${S}/pushTokens/t1`)));
  });
});
