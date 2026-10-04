import { useState } from 'react';
import { SUBJECTS } from '../constants';
import { courseFileHref, formatFileSize, shareCourseFile, type CourseFile } from '../data/courses';
import { COURSE_FILES } from '../data/courses.generated';
import { plural } from '../lib/arabic';
import { ChevronDown, DownloadIcon, ExternalLinkIcon, FileDownIcon, ShareIcon } from './Icons';
import { useToast } from './Toasts';

const FILES_PLURAL = { one: 'ملف واحد', two: 'ملفان', few: 'ملفات', many: 'ملفًا' };

function CourseFileRow({ subjectId, f }: { subjectId: string; f: CourseFile }) {
  const toast = useToast();
  const href = courseFileHref(subjectId, f.file);

  return (
    <li className="course-file">
      <div className="course-file-info">
        <FileDownIcon className="course-file-icon" />
        <span className="course-file-name">{f.name}</span>
        <span className="course-file-meta">
          {f.ext.toUpperCase()} · {formatFileSize(f.sizeKB)}
        </span>
      </div>
      <div className="course-file-actions">
        <a
          className="course-file-action"
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`فتح ${f.name} في تبويب جديد`}
        >
          <ExternalLinkIcon size={14} />
          فتح
        </a>
        <button
          type="button"
          className="course-file-action"
          aria-label={`مشاركة ${f.name}`}
          onClick={() => void shareCourseFile(subjectId, f, (text, kind) => toast({ text, kind: kind ?? 'info' }))}
        >
          <ShareIcon size={14} />
          مشاركة
        </button>
        <a className="course-file-action" href={href} download={f.file} aria-label={`تحميل ${f.name}`}>
          <DownloadIcon size={14} />
          تحميل
        </a>
      </div>
    </li>
  );
}

/** تبويب «المقررات الدراسية»: قائمة ثابتة بالمواد الثمان، كل مادة بملفاتها أو بإشارة عدم اكتمالها بعد */
export function CoursesPanel() {
  const [open, setOpen] = useState<Set<string>>(() => new Set());
  const toggle = (id: string) =>
    setOpen((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className="courses-panel">
      <p className="muted small courses-intro">محتوى المحاضرات لكل مادة — اضغط على المادة لعرض ملفاتها.</p>
      <ul className="course-subjects">
        {SUBJECTS.map((s) => {
          const files = COURSE_FILES[s.id] ?? [];
          const isOpen = open.has(s.id);
          return (
            <li key={s.id} className="course-subject">
              <button
                className="course-subject-head"
                aria-expanded={isOpen}
                aria-controls={`course-files-${s.id}`}
                onClick={() => toggle(s.id)}
              >
                <span className="course-subject-name">{s.name}</span>
                <span className="course-subject-meta">
                  {files.length > 0 ? plural(files.length, FILES_PLURAL) : 'لا يوجد محتوى بعد'}
                  <ChevronDown size={15} className={`chev${isOpen ? ' up' : ''}`} />
                </span>
              </button>
              {isOpen && (
                <div id={`course-files-${s.id}`} className="course-files">
                  {files.length === 0 ? (
                    <p className="muted small course-empty">لا يوجد محتوى بعد لهذه المادة.</p>
                  ) : (
                    <ul>
                      {files.map((f) => (
                        <CourseFileRow key={f.file} subjectId={s.id} f={f} />
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
