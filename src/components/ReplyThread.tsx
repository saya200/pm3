import { useEffect, useRef, useState } from 'react';
import { ANONYMOUS } from '../constants';
import { addReply, setReplyDeleted, subscribeReplies } from '../data/api';
import { KEYS, readLocal, writeLocal } from '../lib/local';
import type { Reply } from '../lib/model';
import { errorText, settle } from '../lib/settle';
import { timeAgo } from '../lib/time';
import { useApp } from './AppContext';
import { SendIcon } from './Icons';
import { useToast } from './Toasts';

export function ReplyThread({ alertId, now }: { alertId: string; now: number }) {
  const { uid, isAdmin } = useApp();
  const toast = useToast();
  const [replies, setReplies] = useState<Reply[] | null>(null);
  const [error, setError] = useState(false);
  const [text, setText] = useState(() => readLocal(KEYS.replyDraft(alertId), ''));
  const [name, setName] = useState(() => readLocal(KEYS.name, ''));
  const [editingName, setEditingName] = useState(false);
  const [sending, setSending] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(
    () =>
      subscribeReplies(
        alertId,
        (r) => {
          setReplies(r);
          setError(false);
        },
        () => setError(true),
      ),
    [alertId],
  );

  // حفظ المسودة محليًا حتى لا يضيع الرد عند انقطاع الاتصال أو إغلاق الصفحة
  useEffect(() => writeLocal(KEYS.replyDraft(alertId), text || null), [alertId, text]);

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  }, [text]);

  async function send() {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    writeLocal(KEYS.name, name.trim() || null);
    try {
      const { committed } = await addReply(alertId, body, name);
      // الرد يظهر فورًا (محليًا) — ننظف الحقل ونتابع التأكيد
      setText('');
      const res = await settle(committed);
      if (res === 'slow') {
        toast({ text: 'الاتصال بطيء — ردك محفوظ وسيُرسل تلقائيًا عند تحسن الاتصال' });
        committed.catch((e) => {
          setText((t) => t || body);
          toast({ text: `لم يُرسل ردك: ${errorText(e)}. أعدنا النص للحقل`, kind: 'error' });
        });
      }
    } catch (e) {
      setText((t) => t || body);
      toast({ text: `لم يُرسل ردك: ${errorText(e)}`, kind: 'error' });
    } finally {
      setSending(false);
    }
  }

  const visible = (replies ?? []).filter((r) => r.deletedAt === null);

  return (
    <div className="thread">
      {error && <p className="muted small">تعذر تحميل الردود — تحقق من الاتصال</p>}
      {replies === null && !error && <p className="muted small">جارٍ تحميل الردود…</p>}
      {replies !== null && visible.length === 0 && <p className="muted small">لا توجد ردود بعد — كن أول من يعلّق.</p>}
      <ul className="replies">
        {visible.map((r) => (
          <li key={r.id} className={`reply${r.pending ? ' is-pending' : ''}`}>
            <div className="reply-head">
              <b>{r.authorName}</b>
              <span className="muted">{r.pending ? 'بانتظار الإرسال…' : timeAgo(r.createdAt, now)}</span>
              {(r.authorUid === uid || isAdmin) && !r.pending && (
                <button
                  className="link-btn danger"
                  onClick={() =>
                    setReplyDeleted(alertId, r.id, true).then(
                      () =>
                        toast({
                          text: 'حُذف الرد',
                          action: { label: 'تراجع', run: () => void setReplyDeleted(alertId, r.id, false) },
                        }),
                      (e) => toast({ text: `تعذر الحذف: ${errorText(e)}`, kind: 'error' }),
                    )
                  }
                >
                  حذف
                </button>
              )}
            </div>
            <p className="reply-text">{r.text}</p>
          </li>
        ))}
      </ul>

      <div className="reply-as">
        {editingName ? (
          <input
            className="name-inline"
            value={name}
            maxLength={40}
            autoFocus
            placeholder="اسمك (اختياري)"
            onChange={(e) => setName(e.target.value)}
            onBlur={() => {
              setEditingName(false);
              writeLocal(KEYS.name, name.trim() || null);
            }}
            onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          />
        ) : (
          <>
            ترد باسم: <b>{name.trim() || ANONYMOUS}</b>
            <button className="link-btn" onClick={() => setEditingName(true)}>
              تغيير
            </button>
          </>
        )}
      </div>
      <form
        className="reply-box"
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        <textarea
          ref={inputRef}
          rows={1}
          value={text}
          maxLength={4000}
          placeholder="اكتب ردك…"
          aria-label="اكتب ردك"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !('ontouchstart' in window)) {
              e.preventDefault();
              void send();
            }
          }}
        />
        <button className="send-btn" type="submit" disabled={!text.trim() || sending} aria-label="إرسال الرد">
          <SendIcon />
        </button>
      </form>
    </div>
  );
}
