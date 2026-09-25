import { useState } from 'react';
import { disablePush, enablePush, type PushState } from '../data/push';
import { Modal } from './Modal';
import { ShareIcon } from './Icons';

const WHEN = (
  <ul className="bullets">
    <li>عند نشر تنبيه جديد</li>
    <li>قبل الموعد بـ24 ساعة</li>
    <li>قبل الموعد بساعتين</li>
  </ul>
);

export function NotifyPanel({
  state,
  setState,
  onClose,
}: {
  state: PushState;
  setState: (s: PushState) => void;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function enable() {
    setBusy(true);
    setErr(null);
    try {
      setState(await enablePush());
    } catch (e) {
      console.error(e);
      setErr('تعذر تفعيل الإشعارات على هذا الجهاز. تأكد من الاتصال وحاول مرة أخرى.');
      setState('error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="الإشعارات" onClose={onClose}>
      <div className="notify">
        {state === 'enabled' && (
          <>
            <p className="ok-line">الإشعارات مفعّلة على هذا الجهاز.</p>
            <p>تصلك إشعارات:</p>
            {WHEN}
            <p className="muted small">
              قد يتأخر وصول الإشعار بضع دقائق. الموقع يبقى المرجع الأساسي — افتحه للتأكد من التفاصيل.
            </p>
            <button
              className="chip-btn"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                await disablePush();
                setBusy(false);
                setState('prompt');
              }}
            >
              إيقاف الإشعارات على هذا الجهاز
            </button>
          </>
        )}

        {(state === 'prompt' || state === 'error') && (
          <>
            <p>فعّل الإشعارات ليصلك تنبيه على جوالك:</p>
            {WHEN}
            {err && <p className="err">{err}</p>}
            <button className="primary-btn" onClick={enable} disabled={busy}>
              {busy ? 'جارٍ التفعيل…' : 'تفعيل الإشعارات'}
            </button>
            <p className="muted small">سيطلب المتصفح إذنك — اختر «سماح».</p>
          </>
        )}

        {state === 'ios-install' && (
          <>
            <p>
              على iPhone وiPad لا تعمل الإشعارات إلا بعد <b>تثبيت الموقع على الشاشة الرئيسية</b> (قيد من Apple، يتطلب
              iOS 16.4 أو أحدث):
            </p>
            <ol className="steps">
              <li>
                افتح الموقع في <b>Safari</b>.
              </li>
              <li>
                اضغط زر المشاركة <ShareIcon size={15} className="inline-icon" /> أسفل الشاشة.
              </li>
              <li>
                اختر <b>«إضافة إلى الشاشة الرئيسية»</b> ثم «إضافة».
              </li>
              <li>افتح الموقع من الأيقونة الجديدة، ثم اضغط زر الجرس وفعّل الإشعارات.</li>
            </ol>
            <p className="muted small">بدون التثبيت يعمل الموقع طبيعيًا، لكن بدون إشعارات.</p>
          </>
        )}

        {state === 'denied' && (
          <>
            <p className="warn-line">الإشعارات محظورة لهذا الموقع على هذا الجهاز.</p>
            <p>لتفعيلها من جديد:</p>
            <ul className="bullets">
              <li>
                <b>Android / Chrome:</b> اضغط رمز القفل بجانب الرابط ← الأذونات ← الإشعارات ← سماح، ثم أعد فتح الموقع.
              </li>
              <li>
                <b>iPhone (بعد التثبيت):</b> الإعدادات ← الإشعارات ← الشعبة الثالثة ← السماح بالإشعارات.
              </li>
              <li>
                <b>الكمبيوتر:</b> رمز القفل بجانب الرابط ← الإشعارات ← سماح.
              </li>
            </ul>
          </>
        )}

        {state === 'unsupported' && (
          <>
            <p className="warn-line">متصفحك الحالي لا يدعم الإشعارات.</p>
            <p>
              جرّب Chrome على Android أو الكمبيوتر، أو Safari على iPhone بعد تثبيت الموقع على الشاشة الرئيسية. يمكنك
              دائمًا متابعة كل التنبيهات من الموقع مباشرة.
            </p>
          </>
        )}

        {state === 'not-configured' && (
          <p>الإشعارات لم تُهيّأ بعد من قبل مسؤول الموقع. تابع التنبيهات من الموقع مباشرة حاليًا.</p>
        )}

        {state === 'checking' && <p className="muted">جارٍ التحقق…</p>}
      </div>
    </Modal>
  );
}

export function pushBannerText(state: PushState): { text: string; cta: string } | null {
  switch (state) {
    case 'prompt':
    case 'error':
      return { text: 'فعّل الإشعارات لتصلك التنبيهات قبل مواعيدها', cta: 'تفعيل' };
    case 'ios-install':
      return { text: 'لتصلك الإشعارات على iPhone: ثبّت الموقع على الشاشة الرئيسية', cta: 'كيف؟' };
    case 'denied':
      return { text: 'الإشعارات محظورة على هذا الجهاز', cta: 'كيف أفعّلها؟' };
    case 'unsupported':
      return { text: 'متصفحك لا يدعم الإشعارات — تابع التنبيهات من الموقع', cta: 'تفاصيل' };
    default:
      return null;
  }
}
