import { useState } from 'react';
import { activateAdmin, deactivateAdmin } from '../data/api';
import { settle } from '../lib/settle';
import { Modal } from './Modal';

export function AdminDialog({
  isAdmin,
  onChange,
  onClose,
}: {
  isAdmin: boolean;
  onChange: (admin: boolean) => void;
  onClose: () => void;
}) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    if (!code.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      const p = activateAdmin(code);
      if ((await settle(p, 10000)) === 'slow') throw new Error('slow');
      if (await p) {
        onChange(true);
        onClose();
      } else setErr('الكود غير صحيح');
    } catch {
      setErr('تعذر التحقق — تأكد من الاتصال');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="صلاحية الإدمن" onClose={onClose}>
      {isAdmin ? (
        <div className="notify">
          <p className="ok-line">هذا الجهاز مفعّل كإدمن.</p>
          <p className="muted small">يمكنك تعديل/أرشفة/حذف أي تنبيه، ومراجعة المحذوفات والتنبيهات المكررة.</p>
          <button
            className="chip-btn danger"
            onClick={async () => {
              await deactivateAdmin();
              onChange(false);
              onClose();
            }}
          >
            إلغاء صلاحية الإدمن على هذا الجهاز
          </button>
        </div>
      ) : (
        <form
          className="notify"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <label className="field">
            <span className="label">كود الإدمن</span>
            <input
              type="password"
              autoComplete="off"
              value={code}
              onChange={(e) => {
                setCode(e.target.value);
                setErr(null);
              }}
              autoFocus
            />
          </label>
          {err && <p className="err">{err}</p>}
          <button className="primary-btn" disabled={busy || !code.trim()}>
            {busy ? 'جارٍ التحقق…' : 'تفعيل'}
          </button>
        </form>
      )}
    </Modal>
  );
}
