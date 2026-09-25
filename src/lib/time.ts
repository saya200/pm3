import { DAYS, HOURS, MINUTES, plural } from './arabic';

/** السعودية: UTC+3 طوال السنة (لا توقيت صيفي) */
export const RIYADH_OFFSET_MS = 3 * 60 * 60 * 1000;

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

export const WEEKDAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
export const MONTHS = [
  'يناير',
  'فبراير',
  'مارس',
  'أبريل',
  'مايو',
  'يونيو',
  'يوليو',
  'أغسطس',
  'سبتمبر',
  'أكتوبر',
  'نوفمبر',
  'ديسمبر',
];

export function riyadhParts(ms: number) {
  const d = new Date(ms + RIYADH_OFFSET_MS);
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth(),
    day: d.getUTCDate(),
    hour: d.getUTCHours(),
    minute: d.getUTCMinutes(),
    weekday: d.getUTCDay(),
  };
}

const pad = (n: number) => String(n).padStart(2, '0');

/** يحوّل قيم حقلي التاريخ والوقت (بتوقيت السعودية) إلى لحظة زمنية مطلقة */
export function fromRiyadhInput(date: string, time: string): number | null {
  const dm = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const tm = time.match(/^(\d{2}):(\d{2})/);
  if (!dm || !tm) return null;
  return Date.UTC(+dm[1], +dm[2] - 1, +dm[3], +tm[1], +tm[2]) - RIYADH_OFFSET_MS;
}

export function toRiyadhInput(ms: number): { date: string; time: string } {
  const p = riyadhParts(ms);
  return {
    date: `${p.year}-${pad(p.month + 1)}-${pad(p.day)}`,
    time: `${pad(p.hour)}:${pad(p.minute)}`,
  };
}

export function formatClock12(hour: number, minute: number): string {
  const suffix = hour < 12 ? 'ص' : 'م';
  const h = hour % 12 === 0 ? 12 : hour % 12;
  return `${h}:${pad(minute)} ${suffix}`;
}

function dayIndex(ms: number): number {
  return Math.floor((ms + RIYADH_OFFSET_MS) / DAY);
}

/** تاريخ مختصر للموعد: "اليوم 4:00 م"، "غدًا 11:59 م"، "الأحد 4:00 م"، "الثلاثاء 7 أكتوبر 11:59 م" */
export function formatDueShort(ms: number, now: number): string {
  const p = riyadhParts(ms);
  const clock = formatClock12(p.hour, p.minute);
  const diffDays = dayIndex(ms) - dayIndex(now);
  if (diffDays === 0) return `اليوم ${clock}`;
  if (diffDays === 1) return `غدًا ${clock}`;
  if (diffDays === -1) return `أمس ${clock}`;
  if (diffDays > 1 && diffDays < 7) return `${WEEKDAYS[p.weekday]} ${clock}`;
  return `${WEEKDAYS[p.weekday]} ${p.day} ${MONTHS[p.month]} ${clock}`;
}

/** تاريخ كامل: "الثلاثاء 30 سبتمبر 2026 · 11:59 م" */
export function formatDueFull(ms: number): string {
  const p = riyadhParts(ms);
  return `${WEEKDAYS[p.weekday]} ${p.day} ${MONTHS[p.month]} ${p.year} · ${formatClock12(p.hour, p.minute)}`;
}

/** تاريخ لحقل الإدخال: "الثلاثاء 30 سبتمبر" */
export function formatDateLabel(ms: number): string {
  const p = riyadhParts(ms);
  return `${WEEKDAYS[p.weekday]} ${p.day} ${MONTHS[p.month]}`;
}

export type Urgency = 'calm' | 'soon' | 'near' | 'urgent' | 'over';

export interface Countdown {
  /** "باقي يومين" */
  text: string;
  /** "يومين" (للشرائح المختصرة) */
  short: string;
  /** "47:12:08" */
  clock: string;
  urgency: Urgency;
}

export function countdown(dueAt: number, now: number): Countdown {
  const left = dueAt - now;
  if (left <= 0) return { text: 'انتهى الموعد', short: 'انتهى', clock: '00:00:00', urgency: 'over' };

  const totalSec = Math.floor(left / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const clock = `${pad(h)}:${pad(m)}:${pad(s)}`;

  let short: string;
  if (left >= DAY) {
    short = plural(Math.max(1, Math.round(left / DAY)), DAYS);
  } else if (left >= HOUR) {
    const hours = Math.round(left / HOUR);
    short = hours >= 24 ? plural(1, DAYS) : plural(hours, HOURS);
  } else if (left >= 60_000) {
    short = plural(Math.ceil(left / 60_000), MINUTES);
  } else {
    short = 'أقل من دقيقة';
  }

  const urgency: Urgency = left < 2 * HOUR ? 'urgent' : left < 12 * HOUR ? 'near' : left < 2 * DAY ? 'soon' : 'calm';

  return { text: `باقي ${short}`, short, clock, urgency };
}

/** وقت نسبي للردود: "الآن"، "منذ 4 دقائق"، "منذ ساعتين"، "منذ 3 أيام" */
export function timeAgo(ms: number, now: number): string {
  const diff = Math.max(0, now - ms);
  if (diff < 45_000) return 'الآن';
  if (diff < HOUR) return `منذ ${plural(Math.max(1, Math.round(diff / 60_000)), MINUTES)}`;
  if (diff < DAY) return `منذ ${plural(Math.round(diff / HOUR), HOURS)}`;
  if (diff < 30 * DAY) return `منذ ${plural(Math.round(diff / DAY), DAYS)}`;
  const p = riyadhParts(ms);
  return `${p.day} ${MONTHS[p.month]} ${p.year}`;
}
