import { describe, expect, it } from 'vitest';
// @ts-expect-error — وحدة JS
import { plan } from '../../notifier/core.mjs';

const H = 3_600_000;
const now = 1_800_000_000_000;
const base = {
  id: 'x',
  type: 'assignment',
  subject: 'finance',
  title: 'تسليم الواجب',
  archivedAt: null,
  deletedAt: null,
};

describe('جدولة الإشعارات', () => {
  it('يرسل "جديد" عند الإنشاء', () => {
    const r = plan({ ...base, dueAt: now + 72 * H, createdAt: now - 60_000 }, now);
    expect(r.send.title).toBe('📚 واجب جديد في تمويل المشاريع');
    expect(r.patch).toEqual({ created: true });
  });

  it('لا يرسل "جديد" لتنبيه قديم (أول تشغيل أو تأخر كبير)', () => {
    const r = plan({ ...base, dueAt: now + 72 * H, createdAt: now - 10 * H }, now);
    expect(r.send).toBeNull();
    expect(r.patch.created).toBe(true);
  });

  it('تذكير 24 ساعة ثم ساعتين، مرة واحدة لكل موعد', () => {
    const due = now + 23 * H;
    const r1 = plan({ ...base, dueAt: due, createdAt: now - 48 * H, notified: { created: true } }, now);
    expect(r1.send.title).toBe('⏰ باقي يوم على واجب تمويل المشاريع');
    expect(r1.patch).toEqual({ h24: due });

    const again = plan({ ...base, dueAt: due, createdAt: now - 48 * H, notified: { created: true, h24: due } }, now);
    expect(again.send).toBeNull();

    const later = due - 90 * 60_000;
    const r2 = plan({ ...base, dueAt: due, createdAt: now - 48 * H, notified: { created: true, h24: due } }, later);
    expect(r2.send.title).toBe('🚨 باقي ساعتان على واجب تمويل المشاريع');
  });

  it('تغيير الموعد بعد إرسال تذكير يعيد تفعيل التذكيرات للموعد الجديد', () => {
    const oldDue = now + 20 * H;
    const newDue = now + 22 * H;
    const r = plan({ ...base, dueAt: newDue, createdAt: now - 48 * H, notified: { created: true, h24: oldDue } }, now);
    expect(r.send.kind).toBe('h24');
  });

  it('تنبيه أُنشئ قبل الموعد بأقل من ساعتين: إشعار "جديد" فقط', () => {
    const due = now + H;
    const r = plan({ ...base, type: 'exam', dueAt: due, createdAt: now - 60_000 }, now);
    expect(r.send.kind).toBe('new');
    expect(r.patch).toEqual({ created: true, h24: due, h2: due });
  });

  it('لا شيء بعد انتهاء الموعد أو للمؤرشف/المحذوف أو للإعلان بلا موعد', () => {
    expect(plan({ ...base, dueAt: now - 1, createdAt: now - H, notified: { created: true } }, now).send).toBeNull();
    expect(plan({ ...base, dueAt: now + H, createdAt: now, archivedAt: now }, now).send).toBeNull();
    expect(plan({ ...base, dueAt: now + H, createdAt: now, deletedAt: now }, now).send).toBeNull();
    expect(
      plan({ ...base, type: 'announcement', dueAt: null, createdAt: now - H, notified: { created: true } }, now).send,
    ).toBeNull();
  });
});
