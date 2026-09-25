import { countdown, formatDueShort } from '../lib/time';
import type { Alert } from '../lib/model';

/** سطران: نص مفهوم + عداد حي HH:MM:SS */
export function Countdown({ alert, now, label }: { alert: Alert; now: number; label?: string }) {
  if (alert.dueAt === null) {
    return (
      <div className="cd">
        {label && <span className="cd-label">{label}</span>}
        <span className="cd-none">بدون موعد</span>
      </div>
    );
  }
  if (alert.archivedAt !== null || alert.dueAt <= now) {
    return (
      <div className="cd cd-over">
        <span className="cd-text">{alert.archivedAt !== null && alert.dueAt > now ? 'مؤرشف' : 'انتهى'}</span>
        <span className="cd-clock">{formatDueShort(alert.dueAt, now)}</span>
      </div>
    );
  }
  const c = countdown(alert.dueAt, now);
  return (
    <div className={`cd u-${c.urgency}`} aria-label={c.text}>
      {label && <span className="cd-label">{label}</span>}
      <span className="cd-text">{c.text}</span>
      <span className="cd-clock" dir="ltr">
        {c.clock}
      </span>
    </div>
  );
}
