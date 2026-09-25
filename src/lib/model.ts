import type { AlertType } from '../constants';
import { TYPE_ORDER } from '../constants';
import { typeCount } from './arabic';

export interface Alert {
  id: string;
  type: AlertType;
  subject: string;
  title: string;
  details: string;
  dueAt: number | null;
  archivedAt: number | null;
  imageId: string | null;
  authorName: string;
  authorUid: string;
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
  dupBy: string[];
  replyCount: number;
  /** لم يؤكده السيرفر بعد (كتابة معلّقة بسبب الاتصال) */
  pending: boolean;
}

export interface Reply {
  id: string;
  text: string;
  authorName: string;
  authorUid: string;
  createdAt: number;
  deletedAt: number | null;
  pending: boolean;
}

/** نشط = غير محذوف، غير مؤرشف يدويًا، وموعده لم ينتهِ (أو إعلان بلا موعد) */
export function isActive(a: Alert, now: number): boolean {
  return a.deletedAt === null && a.archivedAt === null && (a.dueAt === null || a.dueAt > now);
}

export function compareActive(a: Alert, b: Alert): number {
  if (a.dueAt !== null && b.dueAt !== null) return a.dueAt - b.dueAt;
  if (a.dueAt !== null) return -1;
  if (b.dueAt !== null) return 1;
  return b.createdAt - a.createdAt;
}

export function endedAt(a: Alert): number {
  return a.archivedAt ?? a.dueAt ?? a.updatedAt;
}

export interface Partition {
  active: Alert[];
  archived: Alert[];
  nearest: Alert | null;
}

export function partition(alerts: Alert[], now: number): Partition {
  const active: Alert[] = [];
  const archived: Alert[] = [];
  for (const a of alerts) {
    if (a.deletedAt !== null) continue;
    (isActive(a, now) ? active : archived).push(a);
  }
  active.sort(compareActive);
  archived.sort((a, b) => endedAt(b) - endedAt(a));
  const nearest = active.find((a) => a.dueAt !== null) ?? null;
  return { active, archived, nearest };
}

/** "3 واجبات · اختباران · مناقشة واحدة" */
export function summaryLine(active: Alert[]): string {
  const counts = new Map<string, number>();
  for (const a of active) counts.set(a.type, (counts.get(a.type) ?? 0) + 1);
  return TYPE_ORDER.filter((t) => counts.get(t))
    .map((t) => typeCount(t, counts.get(t)!))
    .join(' · ');
}

export interface Filters {
  type: AlertType | 'all';
  subject: string | 'all';
}

export function applyFilters(list: Alert[], f: Filters): Alert[] {
  return list.filter(
    (a) => (f.type === 'all' || a.type === f.type) && (f.subject === 'all' || a.subject === f.subject),
  );
}
