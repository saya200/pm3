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
