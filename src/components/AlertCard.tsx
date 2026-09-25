import { TYPES, subjectName } from '../constants';
import type { Alert } from '../lib/model';
import { replyCountLabel } from '../lib/arabic';
import { AlertDetails } from './AlertDetails';
import { useApp } from './AppContext';
import { Countdown } from './Countdown';
import { ChevronDown, ImageIcon, ReplyIcon } from './Icons';
import { TypeBadge } from './TypeBadge';

export function AlertMetaBits({ alert }: { alert: Alert }) {
  return (
    <>
      {alert.imageId && (
        <span className="meta-bit" title="فيه صورة مرفقة">
          <ImageIcon size={13} />
        </span>
      )}
      {alert.replyCount > 0 && (
        <span className="meta-bit">
          <ReplyIcon size={12} /> {replyCountLabel(alert.replyCount)}
        </span>
      )}
      {alert.dupBy.length > 0 && <span className="meta-bit dup">مكرر محتمل</span>}
      {alert.pending && <span className="meta-bit pending">بانتظار الإرسال…</span>}
    </>
  );
}

export function AlertCard({
  alert,
  now,
  nearest = false,
  ended = false,
}: {
  alert: Alert;
  now: number;
  nearest?: boolean;
  ended?: boolean;
}) {
  const { expandedId, toggleExpanded } = useApp();
  const open = expandedId === alert.id;
  const t = TYPES[alert.type];
  return (
    <article
      id={`alert-${alert.id}`}
      className={`card${open ? ' is-open' : ''}${nearest ? ' is-nearest' : ''}${ended ? ' is-ended' : ''}`}
      style={nearest ? { background: t.bg } : undefined}
    >
      <div
        className="card-head"
        role="button"
        tabIndex={0}
        aria-expanded={open}
        aria-controls={`details-${alert.id}`}
        onClick={() => toggleExpanded(alert.id)}
        onKeyDown={(e) => {
          if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            toggleExpanded(alert.id);
          }
        }}
      >
        <div className="card-main">
          <div className="card-top">
            <TypeBadge type={alert.type} solid={nearest} />
            <span className="subject">{subjectName(alert.subject)}</span>
          </div>
          <h3 className="card-title">{alert.title}</h3>
          <div className="card-by">
            <span style={nearest ? { color: t.fg } : undefined}>بواسطة {alert.authorName}</span>
            <AlertMetaBits alert={alert} />
          </div>
        </div>
        <div className="card-side">
          <Countdown alert={alert} now={now} label={nearest ? 'الأقرب' : undefined} />
          <ChevronDown className={`chev${open ? ' up' : ''}`} size={16} />
        </div>
      </div>
      {open && (
        <div id={`details-${alert.id}`}>
          <AlertDetails alert={alert} now={now} />
        </div>
      )}
    </article>
  );
}
