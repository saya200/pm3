import { ANONYMOUS } from '../constants';
import type { Alert } from '../lib/model';
import { formatDueFull, timeAgo } from '../lib/time';
import { useImage } from '../hooks/useImage';
import { useApp } from './AppContext';
import { ArchiveIcon, CopyIcon, EditIcon, TrashIcon } from './Icons';
import { ReplyThread } from './ReplyThread';
import { useAlertActions } from './useAlertActions';
import { useToast } from './Toasts';

export function AlertDetails({ alert, now }: { alert: Alert; now: number }) {
  const { uid, isAdmin, openEdit, openImage } = useApp();
  const actions = useAlertActions();
  const toast = useToast();
  const image = useImage(alert.imageId);
  const canManage = alert.authorUid === uid || isAdmin;
  const iFlagged = alert.dupBy.includes(uid);
  const manuallyArchived = alert.archivedAt !== null;

  function copyLink() {
    const url = `${location.origin}${location.pathname}#a=${alert.id}`;
    navigator.clipboard?.writeText(url).then(
      () => toast({ text: 'نُسخ رابط التنبيه', kind: 'success' }),
      () => toast({ text: url }),
    );
  }

  return (
    <div className="details" onClick={(e) => e.stopPropagation()}>
      <div className="details-meta">
        {alert.dueAt !== null ? (
          <span>
            الموعد: <b>{formatDueFull(alert.dueAt)}</b>
          </span>
        ) : (
          <span>إعلان بدون موعد انتهاء</span>
        )}
        <span className="muted">
          نُشر {timeAgo(alert.createdAt, now)} بواسطة {alert.authorName || ANONYMOUS}
          {alert.updatedAt - alert.createdAt > 60_000 ? ' · عُدّل' : ''}
        </span>
      </div>

      {alert.details && <div className="details-text">{alert.details}</div>}

      {alert.imageId && (
        <div className="details-image">
          {image.src ? (
            <button className="img-btn" onClick={() => openImage(image.src!)} aria-label="عرض الصورة بحجم كامل">
              <img src={image.src} alt={`صورة مرفقة: ${alert.title}`} />
            </button>
          ) : (
            <div className="img-placeholder">{image.failed ? 'تعذر تحميل الصورة' : 'جارٍ تحميل الصورة…'}</div>
          )}
        </div>
      )}

      <div className="details-actions">
        {canManage && (
          <>
            <button className="chip-btn" onClick={() => openEdit(alert)}>
              <EditIcon /> تعديل
            </button>
            {manuallyArchived ? (
              <button className="chip-btn" onClick={() => actions.unarchive(alert)}>
                <ArchiveIcon /> إلغاء الأرشفة
              </button>
            ) : (
              <button className="chip-btn" onClick={() => actions.archive(alert)}>
                <ArchiveIcon /> أرشفة
              </button>
            )}
            <button
              className="chip-btn danger"
              onClick={() => {
                const msg =
                  alert.replyCount > 0
                    ? `حذف هذا التنبيه؟ عليه ${alert.replyCount} رد وستختفي معه (يمكن التراجع مباشرة بعد الحذف).`
                    : 'حذف هذا التنبيه؟ (يمكن التراجع مباشرة بعد الحذف)';
                if (window.confirm(msg)) void actions.remove(alert);
              }}
            >
              <TrashIcon /> حذف
            </button>
          </>
        )}
        <button
          className={`chip-btn${iFlagged ? ' is-on' : ''}`}
          onClick={() => actions.toggleDup(alert)}
          title="علّم هذا التنبيه كمكرر لتنبيه آخر — الإدمن يراجعه ويحذفه"
        >
          {iFlagged ? 'علّمته كمكرر ✓' : 'مكرر؟'}
          {alert.dupBy.length > 0 && <span className="count">{alert.dupBy.length}</span>}
        </button>
        <button className="chip-btn" onClick={copyLink}>
          <CopyIcon /> نسخ الرابط
        </button>
      </div>

      <ReplyThread alertId={alert.id} now={now} />
    </div>
  );
}
