export type AlertType = 'assignment' | 'exam' | 'discussion' | 'announcement';

export const TYPES: Record<AlertType, { label: string; fg: string; bg: string }> = {
  assignment: { label: 'واجب', fg: '#1E40AF', bg: '#EFF6FF' },
  exam: { label: 'اختبار', fg: '#C2410C', bg: '#FFF4ED' },
  discussion: { label: 'مناقشة', fg: '#0F766E', bg: '#F0FDFA' },
  announcement: { label: 'إعلان', fg: '#44403C', bg: '#F5F5F4' },
};

export const TYPE_ORDER: AlertType[] = ['assignment', 'exam', 'discussion', 'announcement'];

// المعرّفات ثابتة (مستخدمة في قواعد Firestore) — الأسماء يمكن تعديلها بحرية
export const SUBJECTS = [
  { id: 'e-pm', name: 'الإدارة الإلكترونية للمشاريع', short: 'الإدارة الإلكترونية' },
  { id: 'feasibility', name: 'الجدوى الاقتصادية للمشاريع', short: 'الجدوى الاقتصادية' },
  { id: 'finance', name: 'تمويل المشاريع', short: 'تمويل المشاريع' },
  { id: 'supply', name: 'إدارة الإمداد والتموين', short: 'الإمداد والتموين' },
  { id: 'quality', name: 'إدارة الجودة في المشاريع', short: 'إدارة الجودة' },
  { id: 'risk', name: 'إدارة المخاطر في المشاريع', short: 'إدارة المخاطر' },
  { id: 'cost', name: 'محاسبة التكاليف', short: 'محاسبة التكاليف' },
  { id: 'capstone', name: 'مشروع تطبيقي', short: 'مشروع تطبيقي' },
] as const;

export type SubjectId = (typeof SUBJECTS)[number]['id'];

export function subjectName(id: string): string {
  return SUBJECTS.find((s) => s.id === id)?.name ?? id;
}
export function subjectShort(id: string): string {
  return SUBJECTS.find((s) => s.id === id)?.short ?? id;
}

export const SECTION_SLUG = __SECTION_SLUG__;
export const ANONYMOUS = 'مجهول';
