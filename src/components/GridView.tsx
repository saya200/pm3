import { TYPES, subjectShort } from '../constants';
import { useImage } from '../hooks/useImage';
import type { Alert } from '../lib/model';
import { countdown } from '../lib/time';
import { ChevronDown } from './Icons';
import { TypeBadge } from './TypeBadge';

function Tile({ alert, now, onOpen }: { alert: Alert; now: number; onOpen: () => void }) {
  const { src } = useImage(alert.imageId);
  const t = TYPES[alert.type];
  const short = alert.dueAt === null ? 'بدون موعد' : countdown(alert.dueAt, now).short;
  return (
    <button
      className="tile"
      onClick={onOpen}
      style={{
        backgroundColor: t.bg,
        backgroundImage: src ? `url("${src}")` : undefined,
      }}
      aria-label={`${t.label}: ${alert.title}`}
    >
      <span className="tile-badge">
        <TypeBadge type={alert.type} solid />
      </span>
      <span className="tile-shade" />
      <span className="tile-body">
        <span className="tile-title">{alert.title}</span>
        <span className="tile-row">
          <span className="tile-subject">{subjectShort(alert.subject)}</span>
          <span className="tile-pill">
            {short} <ChevronDown size={11} className="tile-chev" />
          </span>
        </span>
      </span>
    </button>
  );
}

/** عرض شبكي: التنبيهات التي فيها صور فقط */
export function GridView({ alerts, now, onOpen }: { alerts: Alert[]; now: number; onOpen: (id: string) => void }) {
  const withImages = alerts.filter((a) => a.imageId);
  if (withImages.length === 0) {
    return (
      <div className="empty">
        <p className="empty-title">لا توجد تنبيهات نشطة فيها صور</p>
        <p className="muted">التنبيهات بدون صور تظهر في عرض القائمة فقط.</p>
      </div>
    );
  }
  return (
    <div className="grid">
      {withImages.map((a) => (
        <Tile key={a.id} alert={a} now={now} onOpen={() => onOpen(a.id)} />
      ))}
    </div>
  );
}
