import type { AlertType } from '../constants';

/** صيغ العدد العربية: [مفرد, مثنى, جمع (٣-١٠), تمييز (١١+)] */
export type PluralForms = { one: string; two: string; few: string; many: string };

export function plural(n: number, f: PluralForms): string {
  if (n === 1) return f.one;
  if (n === 2) return f.two;
  if (n >= 3 && n <= 10) return `${n} ${f.few}`;
  return `${n} ${f.many}`;
}

export const DAYS: PluralForms = { one: 'يوم', two: 'يومين', few: 'أيام', many: 'يومًا' };
export const HOURS: PluralForms = { one: 'ساعة', two: 'ساعتين', few: 'ساعات', many: 'ساعة' };
export const MINUTES: PluralForms = { one: 'دقيقة', two: 'دقيقتين', few: 'دقائق', many: 'دقيقة' };

const TYPE_COUNT: Record<AlertType, PluralForms> = {
  assignment: { one: 'واجب واحد', two: 'واجبان', few: 'واجبات', many: 'واجبًا' },
  exam: { one: 'اختبار واحد', two: 'اختباران', few: 'اختبارات', many: 'اختبارًا' },
  discussion: { one: 'مناقشة واحدة', two: 'مناقشتان', few: 'مناقشات', many: 'مناقشةً' },
  announcement: { one: 'إعلان واحد', two: 'إعلانان', few: 'إعلانات', many: 'إعلانًا' },
};

export function typeCount(type: AlertType, n: number): string {
  return plural(n, TYPE_COUNT[type]);
}

export function replyCountLabel(n: number): string {
  return plural(n, { one: 'رد واحد', two: 'ردّان', few: 'ردود', many: 'ردًا' });
}
