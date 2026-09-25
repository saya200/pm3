import { describe, expect, it } from 'vitest';
import { applyFilters, partition, summaryLine, type Alert } from '../../src/lib/model';

const now = 1_800_000_000_000;
const H = 3_600_000;
let n = 0;
const mk = (o: Partial<Alert>): Alert => ({
  id: `a${++n}`,
  type: 'assignment',
  subject: 'finance',
  title: 't',
  details: '',
  dueAt: now + H,
  archivedAt: null,
  imageId: null,
  authorName: 'مجهول',
  authorUid: 'u',
  createdAt: now - H,
  updatedAt: now - H,
  deletedAt: null,
  dupBy: [],
  replyCount: 0,
  pending: false,
  ...o,
});

describe('تقسيم النشط/الأرشيف', () => {
  it('ينقل المنتهي للأرشيف ويختار الأقرب ويبقي الإعلان بلا موعد نشطًا', () => {
    const past = mk({ dueAt: now - 1000 });
    const soon = mk({ dueAt: now + 2 * H });
    const sooner = mk({ dueAt: now + H, type: 'exam' });
    const ann = mk({ type: 'announcement', dueAt: null });
    const archivedAnn = mk({ type: 'announcement', dueAt: null, archivedAt: now - 10 });
    const deleted = mk({ deletedAt: now - 5 });
    const p = partition([past, soon, sooner, ann, archivedAnn, deleted], now);
    expect(p.active.map((a) => a.id)).toEqual([sooner.id, soon.id, ann.id]);
    expect(p.archived.map((a) => a.id).sort()).toEqual([past.id, archivedAnn.id].sort());
    expect(p.nearest?.id).toBe(sooner.id);
  });

  it('تنبيه ينتهي أثناء فتح الصفحة يخرج من النشط مع مرور الوقت فقط', () => {
    const a = mk({ dueAt: now + 5000 });
    expect(partition([a], now).active).toHaveLength(1);
    expect(partition([a], now + 5000).archived).toHaveLength(1);
  });

  it('ملخص الأرقام بصيغة عربية صحيحة', () => {
    const list = [
      mk({}),
      mk({}),
      mk({}),
      mk({ type: 'exam' }),
      mk({ type: 'exam' }),
      mk({ type: 'discussion' }),
      mk({ type: 'announcement', dueAt: null }),
    ];
    expect(summaryLine(list)).toBe('3 واجبات · اختباران · مناقشة واحدة · إعلان واحد');
  });

  it('التصفية حسب النوع والمادة', () => {
    const list = [mk({ type: 'exam', subject: 'risk' }), mk({ subject: 'risk' }), mk({})];
    expect(applyFilters(list, { type: 'exam', subject: 'all' })).toHaveLength(1);
    expect(applyFilters(list, { type: 'all', subject: 'risk' })).toHaveLength(2);
  });
});
