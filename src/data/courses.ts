import { SUBJECTS } from '../constants';

export interface CourseFile {
  /** اسم العرض (بدون الامتداد، مسافات مكررة مُزالة) */
  name: string;
  /** اسم الملف الفعلي داخل public/courses/<المادة>/ */
  file: string;
  ext: 'pdf' | 'pptx';
  sizeKB: number;
}

/** حجم مقروء: "850 كيلوبايت" أو "9.9 ميجابايت" */
export function formatFileSize(sizeKB: number): string {
  if (sizeKB < 1024) return `${sizeKB} كيلوبايت`;
  return `${(sizeKB / 1024).toFixed(1)} ميجابايت`;
}

/** رابط الملف تحت مسار الموقع الحالي (يعمل بأي مسار GitHub Pages ومع أي رابط عشوائي) */
export function courseFileHref(subjectId: string, file: string): string {
  const subject = SUBJECTS.find((s) => s.id === subjectId);
  const folder = subject ? subject.name : subjectId;
  return `${import.meta.env.BASE_URL}courses/${encodeURIComponent(folder)}/${encodeURIComponent(file)}`;
}

const MIME: Record<CourseFile['ext'], string> = {
  pdf: 'application/pdf',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
};

/**
 * مشاركة ملف مقرر: يحاول مشاركة الملف نفسه (تنزيله كـBlob ثم كـFile)، وإلا رابطه فقط،
 * وإن لم يدعم المتصفح المشاركة إطلاقًا ينسخ الرابط للحافظة بدلًا من ذلك.
 * المستخدم إن ألغى نافذة المشاركة بنفسه (AbortError) لا نفعل شيئًا إضافيًا.
 */
export async function shareCourseFile(
  subjectId: string,
  f: CourseFile,
  notify: (text: string, kind?: 'success' | 'error') => void,
): Promise<void> {
  const href = courseFileHref(subjectId, f.file);
  const absoluteUrl = new URL(href, location.href).toString();
  const nav = navigator as Navigator & { canShare?: (data?: ShareData) => boolean };

  if (typeof nav.share === 'function') {
    let shareData: ShareData = { title: f.name, url: absoluteUrl };

    if (typeof nav.canShare === 'function') {
      try {
        const res = await fetch(href);
        if (res.ok) {
          const blob = await res.blob();
          const file = new File([blob], f.file, { type: MIME[f.ext] });
          if (nav.canShare({ files: [file] })) shareData = { files: [file], title: f.name };
        }
      } catch {
        /* تعذّر تجهيز الملف نفسه — نشارك الرابط بدلًا منه */
      }
    }

    try {
      await nav.share(shareData);
      return;
    } catch (e) {
      if ((e as DOMException)?.name === 'AbortError') return; // ألغى المستخدم المشاركة بنفسه
      // خطأ غير متوقع: ننتقل لنسخ الرابط كحل أخير
    }
  }

  try {
    await navigator.clipboard.writeText(absoluteUrl);
    notify('تم نسخ الرابط', 'success');
  } catch {
    notify(absoluteUrl);
  }
}
