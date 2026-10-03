import { useState } from 'react';
import { SUBJECTS } from '../constants';
import { courseFileHref, formatFileSize } from '../data/courses';
import { COURSE_FILES } from '../data/courses.generated';
import { plural } from '../lib/arabic';
import { ChevronDown, FileDownIcon, XIcon } from './Icons';

const FILES_PLURAL = { one: 'ملف واحد', two: 'ملفان', few: 'ملفات', many: 'ملفًا' };

/** قسم «المقررات الدراسية»: قائمة ثابتة بالمواد الثمان، كل مادة بملفاتها أو بإشارة عدم اكتمالها بعد */
export function CoursesSheet({ onClose }: { onClose: () => void }) {
  const [open, setOpen] = useState<Set<string>>(() => new Set());
  const toggle = (id: string) =>
    setOpen((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="courses-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="sheet-head">
          <h2 id="courses-title">المقررات الدراسية</h2>
          <button className="icon-btn round" onClick={onClose} aria-label="إغلاق">
            <XIcon />
          </button>
        </header>

        <div className="sheet-body courses-body">
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
                            <li key={f.file}>
                              <a
                                className="course-file"
                                href={courseFileHref(s.id, f.file)}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <FileDownIcon className="course-file-icon" />
                                <span className="course-file-name">{f.name}</span>
                                <span className="course-file-meta">
                                  {f.ext.toUpperCase()} · {formatFileSize(f.sizeKB)}
                                </span>
                              </a>
                            </li>
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
      </div>
    </div>
  );
}
