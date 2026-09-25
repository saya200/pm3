// تخزين محلي آمن (قد يكون محجوبًا في التصفح الخاص) — لتفضيلات الجهاز فقط
export function readLocal<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

export function writeLocal(key: string, value: unknown): void {
  try {
    if (value === undefined || value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* التخزين غير متاح — نتجاهل بهدوء لأنها تفضيلات فقط */
  }
}

export const KEYS = {
  name: 's3.name',
  view: 's3.view',
  filters: 's3.filters',
  draft: 's3.draft',
  pushToken: 's3.pushToken',
  pushDismissed: 's3.pushDismissed',
  replyDraft: (id: string) => `s3.reply.${id}`,
};
