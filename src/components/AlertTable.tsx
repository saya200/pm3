import { Fragment } from 'react';
import { TYPES, subjectName } from '../constants';
import type { Alert } from '../lib/model';
import { formatDueShort } from '../lib/time';
import { AlertDetails } from './AlertDetails';
import { AlertMetaBits } from './AlertCard';
import { useApp } from './AppContext';
import { Countdown } from './Countdown';
import { ChevronDown } from './Icons';
import { TypeBadge } from './TypeBadge';

/** عرض الكمبيوتر: جدول — الصف الأقرب مميز بخلفية فاتحة بلون نوعه */
export function AlertTable({
  alerts,
  now,
  nearestId,
  ended = false,
}: {
  alerts: Alert[];
  now: number;
  nearestId: string | null;
  ended?: boolean;
}) {
  const { expandedId, toggleExpanded } = useApp();
  return (
    <table className={`table${ended ? ' is-ended' : ''}`}>
      <thead>
        <tr>
          <th>المادة</th>
          <th>النوع</th>
          <th>العنوان</th>
          <th>الموعد</th>
          <th>الوقت المتبقي</th>
          <th aria-label="توسيع" />
        </tr>
      </thead>
      <tbody>
        {alerts.map((a) => {
          const nearest = a.id === nearestId;
          const open = expandedId === a.id;
          const t = TYPES[a.type];
          return (
            <Fragment key={a.id}>
              <tr
                id={`alert-${a.id}`}
                className={`row${open ? ' is-open' : ''}`}
                style={nearest ? { background: t.bg } : undefined}
                onClick={() => toggleExpanded(a.id)}
                tabIndex={0}
                aria-expanded={open}
                onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), toggleExpanded(a.id))}
              >
                <td className="td-subject">{subjectName(a.subject)}</td>
                <td>
                  <TypeBadge type={a.type} solid={nearest} />
                </td>
                <td className="td-title">
                  <div className="t-title">
                    {a.title}
                    {nearest && <span className="t-nearest"> · الأقرب</span>}
                  </div>
                  <div className="t-by" style={nearest ? { color: t.fg } : undefined}>
                    بواسطة {a.authorName} <AlertMetaBits alert={a} />
                  </div>
                </td>
                <td className="td-due">
                  {a.dueAt === null ? <span className="muted">بدون موعد</span> : formatDueShort(a.dueAt, now)}
                </td>
                <td className="td-left">
                  {a.dueAt === null ? <span className="muted">—</span> : <Countdown alert={a} now={now} />}
                </td>
                <td className="td-chev">
                  <ChevronDown className={`chev${open ? ' up' : ''}`} size={16} />
                </td>
              </tr>
              {open && (
                <tr className="row-details">
                  <td colSpan={6}>
                    <AlertDetails alert={a} now={now} />
                  </td>
                </tr>
              )}
            </Fragment>
          );
        })}
      </tbody>
    </table>
  );
}
