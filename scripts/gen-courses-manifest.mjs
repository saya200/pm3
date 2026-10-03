// يُولَّد منه src/data/courses.generated.ts تلقائيًا — لا تعدّل الملف الناتج يدويًا.
//
// لإضافة محتوى مادة لاحقًا:
//   1) ضع ملفات PDF/PPTX داخل public/courses/<اسم المادة بالضبط كما في SUBJECTS>/
//   2) شغّل: npm run courses:manifest
//   3) تأكد أن src/data/courses.generated.ts تغيّر، ثم commit + push
import { readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

// نفس قائمة src/constants.ts (منسوخة هنا لأن هذا سكربت Node عادي خارج Vite)
const SUBJECT_IDS = [
  ['e-pm', 'الإدارة الإلكترونية للمشاريع'],
  ['feasibility', 'الجدوى الاقتصادية للمشاريع'],
  ['finance', 'تمويل المشاريع'],
  ['supply', 'إدارة الإمداد والتموين'],
  ['quality', 'إدارة الجودة في المشاريع'],
  ['risk', 'إدارة المخاطر في المشاريع'],
  ['cost', 'محاسبة التكاليف'],
  ['capstone', 'مشروع تطبيقي'],
];

const COURSES_DIR = 'public/courses';

function listFiles(folderName) {
  let entries;
  try {
    entries = readdirSync(join(COURSES_DIR, folderName), { withFileTypes: true });
  } catch {
    return [];
  }
  return entries
    .filter((e) => e.isFile() && /\.(pdf|pptx)$/i.test(e.name))
    .map((e) => {
      const full = join(COURSES_DIR, folderName, e.name);
      const sizeKB = Math.max(1, Math.round(statSync(full).size / 1024));
      const ext = e.name.toLowerCase().endsWith('.pptx') ? 'pptx' : 'pdf';
      const name = e.name
        .replace(/\.(pdf|pptx)$/i, '')
        .replace(/\s+/g, ' ')
        .trim();
      return { name, file: e.name, ext, sizeKB };
    })
    .sort((a, b) => a.file.localeCompare(b.file, 'ar', { numeric: true }));
}

const manifest = {};
let total = 0;
for (const [id, folderName] of SUBJECT_IDS) {
  const files = listFiles(folderName);
  manifest[id] = files;
  total += files.length;
}

const out = `// يُولَّد تلقائيًا عبر: npm run courses:manifest — لا تعدّله يدويًا.
// المصدر: public/courses/<اسم المادة>/ — راجع scripts/gen-courses-manifest.mjs
import type { CourseFile } from './courses';

export const COURSE_FILES: Record<string, CourseFile[]> = ${JSON.stringify(manifest, null, 2)};
`;
writeFileSync('src/data/courses.generated.ts', out);
console.log(`[courses] ${total} ملفًا عبر ${SUBJECT_IDS.length} مواد`);
