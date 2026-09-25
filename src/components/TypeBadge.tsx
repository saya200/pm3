import { TYPES, type AlertType } from '../constants';

export function TypeBadge({ type, solid = false }: { type: AlertType; solid?: boolean }) {
  const t = TYPES[type];
  return (
    <span className="badge" style={solid ? { background: t.fg, color: '#fff' } : { background: t.bg, color: t.fg }}>
      {t.label}
    </span>
  );
}
