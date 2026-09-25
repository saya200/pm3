// منطق إرسال الإشعارات — يعمل بصلاحيات Admin SDK (خارج المتصفح)
// الجدول الافتراضي: عند الإنشاء، قبل الموعد بـ24 ساعة، وقبل الموعد بساعتين.
// لتغييره: عدّل REMINDERS بالأسفل.

export const HOUR = 3_600_000;

/** كم يُعتبر التنبيه "جديدًا" (حماية من إرسال قديم إن تأخر التشغيل أو عند أول تشغيل) */
export const NEW_WINDOW = 6 * HOUR;

export const REMINDERS = [
  { key: 'h24', before: 24 * HOUR, icon: '⏰', phrase: 'باقي يوم على' },
  { key: 'h2', before: 2 * HOUR, icon: '🚨', phrase: 'باقي ساعتان على' },
];

export const TYPE_LABEL = { assignment: 'واجب', exam: 'اختبار', discussion: 'مناقشة', announcement: 'إعلان' };
const NEW_TEXT = {
  assignment: '📚 واجب جديد في',
  exam: '📝 اختبار جديد في',
  discussion: '💬 مناقشة جديدة في',
  announcement: '📢 إعلان جديد في',
};

export const SUBJECT_NAME = {
  'e-pm': 'الإدارة الإلكترونية للمشاريع',
  feasibility: 'الجدوى الاقتصادية للمشاريع',
  finance: 'تمويل المشاريع',
  supply: 'إدارة الإمداد والتموين',
  quality: 'إدارة الجودة في المشاريع',
  risk: 'إدارة المخاطر في المشاريع',
  cost: 'محاسبة التكاليف',
  capstone: 'مشروع تطبيقي',
};

/**
 * يقرر ما يجب إرساله الآن. كل تذكير مرتبط بقيمة الموعد وقت إرساله،
 * فإذا تغيّر الموعد لاحقًا يُعاد تفعيل التذكيرات للموعد الجديد تلقائيًا.
 * @param {{id:string,type:string,subject:string,title:string,dueAt:number|null,createdAt:number,archivedAt:number|null,deletedAt:number|null,notified?:object}} a
 * @returns {{ send: null | {kind:string,title:string,body:string,ttlSec:number}, patch: object }}
 */
export function plan(a, now) {
  const n = a.notified ?? {};
  const patch = {};
  if (a.deletedAt || a.archivedAt) return { send: null, patch };
  const subject = SUBJECT_NAME[a.subject] ?? a.subject;
  const label = TYPE_LABEL[a.type] ?? '';
  const due = a.dueAt;
  const left = due === null ? Infinity : due - now;
  if (left <= 0) return { send: null, patch };

  // التذكيرات التي حلّ وقتها ولم تُرسل لهذا الموعد
  const dueReminders = REMINDERS.filter((r) => due !== null && left <= r.before && n[r.key] !== due);

  if (!n.created) {
    patch.created = true;
    // إشعار "جديد" يغني عن أي تذكير حلّ وقته بالفعل
    for (const r of dueReminders) patch[r.key] = due;
    if (now - a.createdAt <= NEW_WINDOW) {
      return {
        send: {
          kind: 'new',
          title: `${NEW_TEXT[a.type] ?? 'تنبيه جديد في'} ${subject}`,
          body: a.title,
          ttlSec: 24 * 3600,
        },
        patch,
      };
    }
    return { send: null, patch };
  }

  if (dueReminders.length === 0) return { send: null, patch };
  // أقرب تذكير فقط (مثلًا لو فات تذكير 24 ساعة ووصلنا لساعتين: نرسل تذكير الساعتين فقط)
  const r = dueReminders.reduce((a1, b1) => (b1.before < a1.before ? b1 : a1));
  for (const x of dueReminders) patch[x.key] = due;
  return {
    send: {
      kind: r.key,
      title: `${r.icon} ${r.phrase} ${label} ${subject}`,
      body: a.title,
      ttlSec: Math.max(60, Math.floor(left / 1000)),
    },
    patch,
  };
}

const BAD_TOKEN = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
  'messaging/invalid-argument',
]);

/**
 * تشغيل واحد: يقرأ التنبيهات، يرسل المطلوب، ويحدّث حالة الإرسال.
 * @param {{ db: import('firebase-admin/firestore').Firestore, messaging: {sendEachForMulticast: Function}, slug: string, siteUrl: string, now?: number, dryRun?: boolean, log?: Function }} o
 */
export async function runOnce({ db, messaging, slug, siteUrl, now = Date.now(), dryRun = false, log = console.log }) {
  const sec = db.doc(`sections/${slug}`);
  const snap = await sec
    .collection('alerts')
    .where('deletedAt', '==', null)
    .where('activeUntil', '>', new Date(now - HOUR))
    .get();

  const toMs = (v) => (v && typeof v.toMillis === 'function' ? v.toMillis() : null);
  const jobs = [];
  for (const doc of snap.docs) {
    const d = doc.data();
    const a = {
      id: doc.id,
      type: d.type,
      subject: d.subject,
      title: d.title,
      dueAt: toMs(d.dueAt),
      createdAt: toMs(d.createdAt) ?? now,
      archivedAt: toMs(d.archivedAt),
      deletedAt: toMs(d.deletedAt),
      notified: d.notified,
    };
    const p = plan(a, now);
    if (p.send || Object.keys(p.patch).length) jobs.push({ doc, a, ...p });
  }

  const sending = jobs.filter((j) => j.send);
  let tokens = [];
  if (sending.length) {
    const tsnap = await sec.collection('pushTokens').get();
    tokens = tsnap.docs.map((t) => ({ ref: t.ref, token: t.get('token') })).filter((t) => t.token);
  }
  log(`[notify] alerts=${snap.size} toSend=${sending.length} tokens=${tokens.length}${dryRun ? ' (dry-run)' : ''}`);

  const base = siteUrl.replace(/\/?$/, '/');
  const dead = new Set();
  let delivered = 0;
  for (const j of jobs) {
    if (j.send && tokens.length) {
      log(`[notify] ${j.send.kind} → "${j.send.title}" (${j.a.id})`);
      if (!dryRun) {
        for (let i = 0; i < tokens.length; i += 500) {
          const chunk = tokens.slice(i, i + 500);
          const res = await messaging.sendEachForMulticast({
            tokens: chunk.map((t) => t.token),
            webpush: {
              headers: { Urgency: 'high', TTL: String(j.send.ttlSec) },
              data: {
                title: j.send.title,
                body: j.send.body,
                url: `${base}#a=${j.a.id}`,
                tag: `${j.a.id}-${j.send.kind}`,
              },
            },
          });
          delivered += res.successCount;
          res.responses.forEach((r, k) => {
            if (!r.success && BAD_TOKEN.has(r.error?.code)) dead.add(chunk[k].ref.path);
          });
        }
      }
    }
    if (!dryRun && Object.keys(j.patch).length) {
      const upd = {};
      for (const [k, v] of Object.entries(j.patch)) upd[`notified.${k}`] = v;
      upd['notified.at'] = new Date();
      await j.doc.ref.update(upd);
    }
  }
  if (!dryRun) {
    for (const t of tokens) if (dead.has(t.ref.path)) await t.ref.delete().catch(() => {});
  }
  log(`[notify] delivered=${delivered} removedTokens=${dead.size}`);
  return { sent: sending.length, delivered, removedTokens: dead.size, jobs };
}
