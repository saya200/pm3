import { describe, expect, it } from 'vitest';
import { countdown, formatDueFull, formatDueShort, fromRiyadhInput, timeAgo, toRiyadhInput } from '../../src/lib/time';

const H = 3_600_000;

describe('توقيت السعودية', () => {
  it('يحوّل مدخلات التاريخ/الوقت بتوقيت الرياض (UTC+3) بغض النظر عن توقيت الجهاز', () => {
    const ms = fromRiyadhInput('2026-09-30', '23:59')!;
    expect(new Date(ms).toISOString()).toBe('2026-09-30T20:59:00.000Z');
    expect(toRiyadhInput(ms)).toEqual({ date: '2026-09-30', time: '23:59' });
  });
  it('يرفض المدخلات غير الصالحة', () => {
    expect(fromRiyadhInput('', '10:00')).toBeNull();
  });
  it('يعرض الموعد بصيغة عربية', () => {
    const ms = fromRiyadhInput('2026-09-29', '23:59')!;
    expect(formatDueFull(ms)).toBe('الثلاثاء 29 سبتمبر 2026 · 11:59 م');
    const now = fromRiyadhInput('2026-09-29', '08:00')!;
    expect(formatDueShort(ms, now)).toBe('اليوم 11:59 م');
    expect(formatDueShort(ms, now - 24 * H)).toBe('غدًا 11:59 م');
    expect(formatDueShort(fromRiyadhInput('2026-09-29', '00:05')!, now - 3 * 24 * H)).toBe('الثلاثاء 12:05 ص');
  });
});

describe('العد التنازلي', () => {
  const now = 1_800_000_000_000;
  it('يطابق أمثلة التصميم', () => {
    expect(countdown(now + 47 * H + 12 * 60_000 + 8000, now)).toMatchObject({ text: 'باقي يومين', clock: '47:12:08' });
    expect(countdown(now + 71 * H + 40 * 60_000 + 15000, now)).toMatchObject({
      text: 'باقي 3 أيام',
      clock: '71:40:15',
    });
    expect(countdown(now + 5 * H + 47 * 60_000 + 33000, now)).toMatchObject({
      text: 'باقي 6 ساعات',
      clock: '05:47:33',
    });
    expect(countdown(now + 191 * H + 30 * 60_000, now).text).toBe('باقي 8 أيام');
  });
  it('صيغ المفرد والمثنى والدقائق', () => {
    expect(countdown(now + 25 * H, now).text).toBe('باقي يوم');
    expect(countdown(now + 1 * H + 10 * 60_000, now).text).toBe('باقي ساعة');
    expect(countdown(now + 2 * H, now).text).toBe('باقي ساعتين');
    expect(countdown(now + 37 * 60_000, now).text).toBe('باقي 37 دقيقة');
    expect(countdown(now + 5 * 60_000, now).text).toBe('باقي 5 دقائق');
    expect(countdown(now + 20_000, now).text).toBe('باقي أقل من دقيقة');
    expect(countdown(now + 12 * 24 * H, now).text).toBe('باقي 12 يومًا');
  });
  it('مستوى الإلحاح يتدرج مع اقتراب الموعد', () => {
    expect(countdown(now + 5 * 24 * H, now).urgency).toBe('calm');
    expect(countdown(now + 30 * H, now).urgency).toBe('soon');
    expect(countdown(now + 6 * H, now).urgency).toBe('near');
    expect(countdown(now + 30 * 60_000, now).urgency).toBe('urgent');
    expect(countdown(now - 1, now).urgency).toBe('over');
  });
  it('الوقت النسبي للردود', () => {
    expect(timeAgo(now - 10_000, now)).toBe('الآن');
    expect(timeAgo(now - 4 * 60_000, now)).toBe('منذ 4 دقائق');
    expect(timeAgo(now - 2 * H, now)).toBe('منذ ساعتين');
  });
});
