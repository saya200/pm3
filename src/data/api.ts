import {
  Timestamp,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocFromCache,
  getDocs,
  increment,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
  writeBatch,
  type DocumentData,
  type DocumentSnapshot,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { ANONYMOUS, SECTION_SLUG, type AlertType } from '../constants';
import { ensureUid, getDb } from '../firebase';
import type { CompressedImage } from '../lib/image';
import type { Alert, Reply } from '../lib/model';

const FAR_FUTURE = Timestamp.fromMillis(Date.UTC(3000, 0, 1));
/** نافذة الاستماع الحي: النشط + ما انتهى خلال آخر ٣٠ يومًا. الأقدم يُحمّل عند الطلب */
export const LIVE_ARCHIVE_DAYS = 30;

const base = () => `sections/${SECTION_SLUG}`;
const alertsCol = () => collection(getDb(), `${base()}/alerts`);
const alertRef = (id: string) => doc(getDb(), `${base()}/alerts/${id}`);
const repliesCol = (alertId: string) => collection(getDb(), `${base()}/alerts/${alertId}/replies`);
const imageRef = (id: string) => doc(getDb(), `${base()}/images/${id}`);

const ms = (v: unknown): number | null => (v instanceof Timestamp ? v.toMillis() : null);

function toAlert(snap: QueryDocumentSnapshot<DocumentData> | DocumentSnapshot<DocumentData>): Alert {
  const d = snap.data({ serverTimestamps: 'estimate' }) ?? {};
  return {
    id: snap.id,
    type: d.type,
    subject: d.subject,
    title: d.title ?? '',
    details: d.details ?? '',
    dueAt: ms(d.dueAt),
    archivedAt: ms(d.archivedAt),
    imageId: d.imageId ?? null,
    authorName: d.authorName || ANONYMOUS,
    authorUid: d.authorUid ?? '',
    createdAt: ms(d.createdAt) ?? Date.now(),
    updatedAt: ms(d.updatedAt) ?? Date.now(),
    deletedAt: ms(d.deletedAt),
    dupBy: Array.isArray(d.dupBy) ? d.dupBy : [],
    replyCount: typeof d.replyCount === 'number' ? d.replyCount : 0,
    pending: snap.metadata.hasPendingWrites,
  };
}

function activeUntil(dueAt: Timestamp | null, archivedAt: unknown) {
  if (archivedAt) return archivedAt;
  return dueAt ?? FAR_FUTURE;
}

// ───────── القراءة ─────────

export function subscribeAlerts(
  onData: (alerts: Alert[], fromCache: boolean) => void,
  onError: (e: Error) => void,
): () => void {
  const since = Timestamp.fromMillis(Date.now() - LIVE_ARCHIVE_DAYS * 86_400_000);
  // استعلام بحقل واحد (لا يحتاج فهرسًا مركبًا) — المحذوف يُستبعد في المتصفح
  const q = query(alertsCol(), where('activeUntil', '>', since));
  return onSnapshot(
    q,
    { includeMetadataChanges: true },
    (snap) =>
      onData(
        snap.docs.map(toAlert).filter((a) => a.deletedAt === null),
        snap.metadata.fromCache,
      ),
    onError,
  );
}

/** الأرشيف الأقدم من نافذة الاستماع الحي (تحميل لمرة واحدة) */
export async function loadOlderArchive(): Promise<Alert[]> {
  const until = Timestamp.fromMillis(Date.now() - LIVE_ARCHIVE_DAYS * 86_400_000);
  const q = query(alertsCol(), where('activeUntil', '<=', until), orderBy('activeUntil', 'desc'), limit(100));
  const snap = await getDocs(q);
  return snap.docs.map(toAlert).filter((a) => a.deletedAt === null);
}

/** للإدمن: التنبيهات المحذوفة حذفًا ناعمًا */
export function subscribeDeleted(onData: (alerts: Alert[]) => void, onError: (e: Error) => void) {
  const q = query(alertsCol(), where('deletedAt', '!=', null), orderBy('deletedAt', 'desc'), limit(50));
  return onSnapshot(q, (snap) => onData(snap.docs.map(toAlert)), onError);
}

export function subscribeReplies(
  alertId: string,
  onData: (replies: Reply[]) => void,
  onError: (e: Error) => void,
): () => void {
  const q = query(repliesCol(alertId), orderBy('createdAt', 'asc'), limit(500));
  return onSnapshot(
    q,
    { includeMetadataChanges: true },
    (snap) =>
      onData(
        snap.docs.map((s) => {
          const d = s.data({ serverTimestamps: 'estimate' });
          return {
            id: s.id,
            text: d.text ?? '',
            authorName: d.authorName || ANONYMOUS,
            authorUid: d.authorUid ?? '',
            createdAt: ms(d.createdAt) ?? Date.now(),
            deletedAt: ms(d.deletedAt),
            pending: s.metadata.hasPendingWrites,
          };
        }),
      ),
    onError,
  );
}

const imageCache = new Map<string, Promise<string | null>>();

/** الصور لا تتغير بعد إنشائها (استبدال الصورة = معرّف جديد) لذلك نقرأ الكاش أولًا */
export function getImage(imageId: string): Promise<string | null> {
  let p = imageCache.get(imageId);
  if (!p) {
    p = (async () => {
      const ref = imageRef(imageId);
      try {
        const cached = await getDocFromCache(ref);
        if (cached.exists()) return cached.data().dataUrl as string;
      } catch {
        /* غير موجود بالكاش */
      }
      const snap = await getDoc(ref);
      return snap.exists() ? (snap.data().dataUrl as string) : null;
    })();
    p.catch(() => imageCache.delete(imageId));
    imageCache.set(imageId, p);
  }
  return p;
}

// ───────── الكتابة ─────────

export interface AlertInput {
  type: AlertType;
  subject: string;
  title: string;
  details: string;
  dueAt: number | null;
  authorName: string;
}

function cleanInput(input: AlertInput) {
  const dueAt = input.dueAt === null ? null : Timestamp.fromMillis(input.dueAt);
  return {
    type: input.type,
    subject: input.subject,
    title: input.title.trim().slice(0, 300),
    details: input.details.trim().slice(0, 20000),
    dueAt,
    authorName: input.authorName.trim().slice(0, 40),
  };
}

function newId(): string {
  return doc(alertsCol()).id;
}

/**
 * ينشر التنبيه (والصورة إن وجدت) في عملية واحدة ذرّية:
 * إما أن ينجح الاثنان أو يفشلان معًا — فلا يظهر تنبيه بصورة مفقودة.
 * يرجع معرّف التنبيه + وعد تأكيد السيرفر.
 */
export async function createAlert(input: AlertInput, image: CompressedImage | null) {
  const uid = await ensureUid();
  const id = newId();
  const imageId = image ? newId() : null;
  const c = cleanInput(input);
  const batch = writeBatch(getDb());
  batch.set(alertRef(id), {
    ...c,
    activeUntil: activeUntil(c.dueAt, null),
    archivedAt: null,
    imageId,
    authorUid: uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    deletedAt: null,
    dupBy: [],
    replyCount: 0,
  });
  if (image && imageId) {
    batch.set(imageRef(imageId), {
      alertId: id,
      authorUid: uid,
      dataUrl: image.dataUrl,
      width: image.width,
      height: image.height,
      createdAt: serverTimestamp(),
    });
  }
  return { id, committed: batch.commit() };
}

/**
 * تعديل تنبيه. image: undefined = بدون تغيير، null = إزالة الصورة، قيمة = صورة جديدة.
 */
export async function updateAlert(alert: Alert, input: AlertInput, image: CompressedImage | null | undefined) {
  const uid = await ensureUid();
  const c = cleanInput(input);
  const batch = writeBatch(getDb());
  let imageId = alert.imageId;
  if (image !== undefined) {
    imageId = image ? newId() : null;
    if (image && imageId) {
      batch.set(imageRef(imageId), {
        alertId: alert.id,
        authorUid: uid,
        dataUrl: image.dataUrl,
        width: image.width,
        height: image.height,
        createdAt: serverTimestamp(),
      });
    }
  }
  batch.update(alertRef(alert.id), {
    ...c,
    imageId,
    // المؤرشف يدويًا يبقى activeUntil = archivedAt كما هو
    ...(alert.archivedAt === null ? { activeUntil: activeUntil(c.dueAt, null) } : {}),
    updatedAt: serverTimestamp(),
  });
  const committed = batch.commit().then(async () => {
    // حذف الصورة القديمة بعد نجاح الاستبدال (أفضلية فقط — تجاهل الفشل)
    if (image !== undefined && alert.imageId && alert.imageId !== imageId) {
      await deleteDoc(imageRef(alert.imageId)).catch(() => {});
    }
  });
  return { id: alert.id, committed };
}

export function setArchived(alert: Alert, archived: boolean): Promise<void> {
  const dueAt = alert.dueAt === null ? null : Timestamp.fromMillis(alert.dueAt);
  const b = writeBatch(getDb());
  b.update(alertRef(alert.id), {
    archivedAt: archived ? serverTimestamp() : null,
    activeUntil: archived ? serverTimestamp() : activeUntil(dueAt, null),
    updatedAt: serverTimestamp(),
  });
  return b.commit();
}

export function setDeleted(alert: Alert, deleted: boolean): Promise<void> {
  const b = writeBatch(getDb());
  b.update(alertRef(alert.id), {
    deletedAt: deleted ? serverTimestamp() : null,
    updatedAt: serverTimestamp(),
  });
  return b.commit();
}

/** حذف نهائي (إدمن فقط): الردود + الصورة + التنبيه */
export async function hardDelete(alert: Alert): Promise<void> {
  const replies = await getDocs(repliesCol(alert.id));
  const b = writeBatch(getDb());
  replies.forEach((r) => b.delete(r.ref));
  if (alert.imageId) b.delete(imageRef(alert.imageId));
  b.delete(alertRef(alert.id));
  await b.commit();
}

export async function toggleDuplicate(alert: Alert): Promise<void> {
  const uid = await ensureUid();
  const set = new Set(alert.dupBy);
  if (set.has(uid)) set.delete(uid);
  else set.add(uid);
  const b = writeBatch(getDb());
  b.update(alertRef(alert.id), { dupBy: [...set] });
  await b.commit();
}

export async function addReply(alertId: string, text: string, authorName: string) {
  const uid = await ensureUid();
  const b = writeBatch(getDb());
  b.set(doc(repliesCol(alertId)), {
    text: text.trim().slice(0, 4000),
    authorName: authorName.trim().slice(0, 40),
    authorUid: uid,
    createdAt: serverTimestamp(),
    deletedAt: null,
  });
  b.update(alertRef(alertId), { replyCount: increment(1) });
  return { committed: b.commit() };
}

export function setReplyDeleted(alertId: string, replyId: string, deleted: boolean): Promise<void> {
  const b = writeBatch(getDb());
  b.update(doc(repliesCol(alertId), replyId), { deletedAt: deleted ? serverTimestamp() : null });
  b.update(alertRef(alertId), { replyCount: increment(deleted ? -1 : 1) });
  return b.commit();
}

// ───────── الإدمن ─────────

const adminRef = (uid: string) => doc(getDb(), `${base()}/admins/${uid}`);

/** يسجّل هذا الجهاز كإدمن. القواعد ترفض الكتابة إذا كان الكود خاطئًا */
export async function activateAdmin(code: string): Promise<boolean> {
  const uid = await ensureUid();
  try {
    await setDoc(adminRef(uid), { code: code.trim(), createdAt: serverTimestamp() });
    return true;
  } catch (e) {
    if ((e as { code?: string }).code === 'permission-denied') return false;
    throw e;
  }
}

/** صالح فقط إذا كان الكود المسجّل على الجهاز يطابق الكود الحالي */
export async function checkAdmin(): Promise<boolean> {
  const uid = await ensureUid();
  try {
    const snap = await getDoc(adminRef(uid));
    return snap.exists();
  } catch {
    return false;
  }
}

export async function deactivateAdmin(): Promise<void> {
  const uid = await ensureUid();
  await deleteDoc(adminRef(uid)).catch(() => {});
}

// ───────── Push ─────────

export async function savePushToken(tokenId: string, token: string, platform: string) {
  const uid = await ensureUid();
  await setDoc(doc(getDb(), `${base()}/pushTokens/${tokenId}`), {
    token,
    uid,
    platform: platform.slice(0, 200),
    updatedAt: serverTimestamp(),
  });
}

export async function removePushToken(tokenId: string) {
  await deleteDoc(doc(getDb(), `${base()}/pushTokens/${tokenId}`));
}
