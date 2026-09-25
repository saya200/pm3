import { useEffect } from 'react';
import { XIcon } from './Icons';

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div
        className="sheet sheet-small"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="sheet-head">
          <h2>{title}</h2>
          <button className="icon-btn round" onClick={onClose} aria-label="إغلاق">
            <XIcon />
          </button>
        </header>
        <div className="sheet-body">{children}</div>
      </div>
    </div>
  );
}
