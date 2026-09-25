import { useEffect, useRef, useState } from 'react';
import { SUBJECTS, TYPES, TYPE_ORDER, type AlertType } from '../constants';
import { createAlert, updateAlert, type AlertInput } from '../data/api';
import { compressImage, type CompressedImage } from '../lib/image';
import { KEYS, readLocal, writeLocal } from '../lib/local';
import type { Alert } from '../lib/model';
import { errorText, settle } from '../lib/settle';
import { formatClock12, formatDateLabel, fromRiyadhInput, toRiyadhInput } from '../lib/time';
import { useImage } from '../hooks/useImage';
import { ChevronDown, PlusIcon, XIcon } from './Icons';
import { useToast } from './Toasts';

interface Draft {
  type: AlertType;
  subject: string;
  title: string;
  details: string;
  date: string;
  time: string;
  name: string;
  image: CompressedImage | null;
}

const emptyDraft = (): Draft => ({
  type: 'assignment',
  subject: '',
  title: '',
  details: '',
  date: '',
  time: '23:59',
  name: readLocal(KEYS.name, ''),
  image: null,
});

function draftFromAlert(a: Alert): Draft {
  const due = a.dueAt !== null ? toRiyadhInput(a.dueAt) : { date: '', time: '23:59' };
  return {
    type: a.type,
    subject: a.subject,
    title: a.title,
    details: a.details,
    date: due.date,
    time: due.time,
    name: a.authorName === 'مجهول' ? '' : a.authorName,
    image: null,
  };
}

type Errors = Partial<Record<'subject' | 'title' | 'due', string>>;

export function AlertForm({
  editing,
  onClose,
  onPublished,
}: {
  editing: Alert | null;
  onClose: () => void;
  onPublished: (id: string) => void;
}) {
  const toast = useToast();
  const [d, setD] = useState<Draft>(() =>
    editing ? draftFromAlert(editing) : { ...emptyDraft(), ...readLocal<Partial<Draft>>(KEYS.draft, {}) },
  );
  // في التعديل: هل غيّر المستخدم الصورة (استبدال أو إزالة)؟
  const [imageChanged, setImageChanged] = useState(false);
  const existingImage = useImage(editing && !imageChanged ? editing.imageId : null);
  const [errors, setErrors] = useState<Errors>({});
  const [imageBusy, setImageBusy] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const dateRef = useRef<HTMLInputElement>(null);
  const timeRef = useRef<HTMLInputElement>(null);

  // حفظ المسودة باستمرار (للإضافة فقط) حتى لا يضيع شيء عند إغلاق الصفحة أو فشل النشر
  useEffect(() => {
    // الصورة لا تُحفظ في المسودة (حجمها يبطئ الكتابة) — تبقى بالذاكرة طالما النموذج مفتوح
    if (!editing) writeLocal(KEYS.draft, { ...d, image: null });
  }, [d, editing]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !submitting && onClose();
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose, submitting]);

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => {
    setD((prev) => ({ ...prev, [k]: v }));
    setErrors((e) => ({ ...e, [k === 'date' || k === 'time' ? 'due' : k]: undefined }));
    setSubmitError(null);
  };

  const isAnnouncement = d.type === 'announcement';
  const dueMs = d.date ? fromRiyadhInput(d.date, d.time || '23:59') : null;

  async function pickImage(file: File | undefined) {
    if (!file) return;
    setImageError(null);
    setImageBusy(true);
    try {
      const img = await compressImage(file);
      setD((prev) => ({ ...prev, image: img }));
      setImageChanged(true);
    } catch (e) {
      const msg = (e as Error).message;
      setImageError(
        msg === 'too-large'
          ? 'الصورة كبيرة جدًا حتى بعد الضغط — جرّب صورة أخرى أو لقطة شاشة'
          : 'تعذر قراءة الصورة — جرّب صورة بصيغة JPG أو PNG',
      );
    } finally {
      setImageBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  function validate(): Errors {
    const e: Errors = {};
    if (!d.subject) e.subject = 'اختر المادة';
    if (!d.title.trim()) e.title = 'اكتب عنوانًا مختصرًا';
    if (!isAnnouncement && !d.date) e.due = 'حدد تاريخ الانتهاء';
    if (d.date && dueMs === null) e.due = 'التاريخ أو الوقت غير صالح';
    if (!editing && dueMs !== null && dueMs <= Date.now()) e.due = 'هذا الموعد مضى وقته — اختر موعدًا قادمًا';
    return e;
  }

  async function submit(withoutImage = false) {
    if (submitting) return;
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length) return;
    if (!navigator.onLine) {
      setSubmitError('لا يوجد اتصال بالإنترنت الآن. بياناتك محفوظة في هذا النموذج — أعد المحاولة عند عودة الاتصال.');
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    writeLocal(KEYS.name, d.name.trim() || null);
    const input: AlertInput = {
      type: d.type,
      subject: d.subject,
      title: d.title,
      details: d.details,
      dueAt: dueMs,
      authorName: d.name,
    };
    const image = withoutImage ? null : d.image;
    try {
      const { id, committed } = editing
        ? await updateAlert(editing, input, imageChanged || withoutImage ? image : undefined)
        : await createAlert(input, image);
      const res = await settle(committed, 12000);
      if (!editing) writeLocal(KEYS.draft, null);
      if (res === 'slow') {
        toast({
          text: 'الاتصال بطيء: التنبيه محفوظ على جهازك وسيُنشر تلقائيًا فور تحسن الاتصال (يظهر بعلامة «بانتظار الإرسال»).',
          ms: 9000,
        });
        committed.catch((err) =>
          toast({ text: `فشل نشر التنبيه: ${errorText(err)}. أعد إضافته من فضلك.`, kind: 'error', ms: 15000 }),
        );
      } else {
        toast({ text: editing ? 'حُفظت التعديلات' : 'نُشر التنبيه لكل الشعبة', kind: 'success' });
      }
      onPublished(id);
    } catch (err) {
      console.error(err);
      setSubmitError(
        `تعذر ${editing ? 'حفظ التعديل' : 'النشر'}: ${errorText(err)}. لم يُفقد شيء — بياناتك ما زالت في النموذج.`,
      );
    } finally {
      setSubmitting(false);
    }
  }

  const previewSrc = d.image?.dataUrl ?? existingImage.src;
  const hasImage = Boolean(d.image) || (!!editing?.imageId && !imageChanged);

  return (
    <div className="sheet-backdrop" onClick={() => !submitting && onClose()}>
      <div
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="form-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="sheet-head">
          <h2 id="form-title">{editing ? 'تعديل التنبيه' : 'إضافة تنبيه'}</h2>
          <button className="icon-btn round" onClick={onClose} disabled={submitting} aria-label="إغلاق">
            <XIcon />
          </button>
        </header>

        <form
          className="sheet-body"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
          noValidate
        >
          <fieldset className="field">
            <legend className="label">النوع</legend>
            <div className="type-picker">
              {TYPE_ORDER.map((t) => {
                const on = d.type === t;
                return (
                  <button
                    type="button"
                    key={t}
                    className={`type-opt${on ? ' on' : ''}`}
                    style={on ? { background: TYPES[t].fg, color: '#fff' } : undefined}
                    aria-pressed={on}
                    onClick={() => set('type', t)}
                  >
                    {TYPES[t].label}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <label className="field">
            <span className="label">المادة</span>
            <span className="select-wrap">
              <select
                value={d.subject}
                onChange={(e) => set('subject', e.target.value)}
                aria-invalid={!!errors.subject}
                className={d.subject ? '' : 'placeholder'}
              >
                <option value="" disabled>
                  اختر المادة
                </option>
                {SUBJECTS.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <ChevronDown size={16} className="select-chev" />
            </span>
            {errors.subject && <span className="err">{errors.subject}</span>}
          </label>

          <label className="field">
            <span className="label">عنوان مختصر</span>
            <input
              type="text"
              value={d.title}
              maxLength={300}
              placeholder="مثال: تسليم دراسة حالة الفصل الثالث"
              onChange={(e) => set('title', e.target.value)}
              aria-invalid={!!errors.title}
            />
            {errors.title && <span className="err">{errors.title}</span>}
          </label>

          <label className="field">
            <span className="label">
              تفاصيل إضافية <span className="opt">(اختياري)</span>
            </span>
            <textarea
              value={d.details}
              rows={4}
              maxLength={20000}
              placeholder="أي تفاصيل أو ملاحظات تفيد الشعبة…"
              onChange={(e) => set('details', e.target.value)}
            />
          </label>

          <div className="field">
            <span className="label">موعد الانتهاء {isAnnouncement && <span className="opt">(اختياري)</span>}</span>
            <div className="due-row">
              <label className="fake-input date">
                <span className={d.date ? '' : 'placeholder'}>
                  {d.date && dueMs !== null ? formatDateLabel(dueMs) : 'اختر التاريخ'}
                </span>
                <input
                  ref={dateRef}
                  type="date"
                  aria-label="تاريخ الانتهاء"
                  value={d.date}
                  onChange={(e) => set('date', e.target.value)}
                  onClick={() => {
                    try {
                      dateRef.current?.showPicker?.();
                    } catch {
                      /* غير مدعوم */
                    }
                  }}
                />
              </label>
              <label className="fake-input time">
                <span>{d.time ? formatClock12(+d.time.slice(0, 2), +d.time.slice(3, 5)) : 'الوقت'}</span>
                <input
                  ref={timeRef}
                  type="time"
                  aria-label="وقت الانتهاء"
                  value={d.time}
                  onChange={(e) => set('time', e.target.value || '23:59')}
                  onClick={() => {
                    try {
                      timeRef.current?.showPicker?.();
                    } catch {
                      /* غير مدعوم */
                    }
                  }}
                />
              </label>
            </div>
            <span className="hint">
              غير مطلوب لنوع «إعلان» · بتوقيت السعودية
              {isAnnouncement && d.date && (
                <button type="button" className="link-btn" onClick={() => set('date', '')}>
                  إزالة الموعد
                </button>
              )}
            </span>
            {errors.due && <span className="err">{errors.due}</span>}
          </div>

          <div className="field">
            <span className="label">
              صورة <span className="opt">(اختياري)</span>
            </span>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => void pickImage(e.target.files?.[0])}
              data-testid="image-input"
            />
            {hasImage ? (
              <div className="img-preview">
                {previewSrc ? <img src={previewSrc} alt="معاينة الصورة" /> : <div className="img-placeholder">…</div>}
                <div className="img-preview-actions">
                  <button type="button" className="chip-btn" onClick={() => fileRef.current?.click()}>
                    تغيير
                  </button>
                  <button
                    type="button"
                    className="chip-btn danger"
                    onClick={() => {
                      setD((p) => ({ ...p, image: null }));
                      setImageChanged(true);
                    }}
                  >
                    إزالة
                  </button>
                </div>
              </div>
            ) : (
              <button type="button" className="img-pick" onClick={() => fileRef.current?.click()} disabled={imageBusy}>
                <PlusIcon /> {imageBusy ? 'جارٍ تجهيز الصورة…' : 'إضافة صورة من الجهاز'}
              </button>
            )}
            {imageError && <span className="err">{imageError}</span>}
          </div>

          <label className="field">
            <span className="label">
              اسمك <span className="opt">(اختياري)</span>
            </span>
            <input
              type="text"
              value={d.name}
              maxLength={40}
              placeholder="مثال: سالم — اتركه فارغًا ليظهر «مجهول»"
              onChange={(e) => set('name', e.target.value)}
            />
          </label>

          {submitError && (
            <div className="form-error" role="alert">
              <p>{submitError}</p>
              <div className="form-error-actions">
                <button type="submit" className="chip-btn">
                  إعادة المحاولة
                </button>
                {d.image && (
                  <button type="button" className="chip-btn" onClick={() => void submit(true)}>
                    النشر بدون الصورة
                  </button>
                )}
              </div>
            </div>
          )}

          <div className="sheet-foot">
            <button type="submit" className="primary-btn" disabled={submitting || imageBusy}>
              {submitting ? (editing ? 'جارٍ الحفظ…' : 'جارٍ النشر…') : editing ? 'حفظ التعديلات' : 'نشر التنبيه'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
