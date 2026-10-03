import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SUBJECTS, TYPES, TYPE_ORDER } from './constants';
import { activateAdmin, checkAdmin, loadOlderArchive, subscribeDeleted } from './data/api';
import { detectPushState, refreshPushTokenSilently, type PushState } from './data/push';
import { ensureUid, IS_CONFIGURED } from './firebase';
import { useAlerts } from './hooks/useAlerts';
import { useNow } from './hooks/useNow';
import { useOnline } from './hooks/useOnline';
import { KEYS, readLocal, writeLocal } from './lib/local';
import { applyFilters, partition, summaryLine, type Alert, type Filters } from './lib/model';
import { AdminDialog } from './components/AdminDialog';
import { CoursesPanel } from './components/CoursesPanel';
import { AlertCard } from './components/AlertCard';
import { AlertForm } from './components/AlertForm';
import { AlertTable } from './components/AlertTable';
import { AppContext, type AppCtx } from './components/AppContext';
import { GridView } from './components/GridView';
import { BellIcon, ChevronDown, GridIcon, ListIcon, PlusIcon, XIcon } from './components/Icons';
import { NotifyPanel, pushBannerText } from './components/NotifyPanel';
import { useToast } from './components/Toasts';
import { useAlertActions } from './components/useAlertActions';

type View = 'list' | 'grid';
type Tab = 'alerts' | 'courses';

function useMedia(q: string): boolean {
  const [m, setM] = useState(() => window.matchMedia(q).matches);
  useEffect(() => {
    const mq = window.matchMedia(q);
    const on = () => setM(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [q]);
  return m;
}

function hashAlertId(): string | null {
  const m = location.hash.match(/a=([\w-]+)/);
  return m ? m[1] : null;
}

export default function App() {
  const [uid, setUid] = useState<string | null>(null);
  const [bootError, setBootError] = useState(false);

  const boot = useCallback(() => {
    setBootError(false);
    ensureUid().then(setUid, (e) => {
      console.error(e);
      setBootError(true);
    });
  }, []);

  useEffect(() => {
    if (IS_CONFIGURED) boot();
  }, [boot]);

  if (!IS_CONFIGURED) {
    return (
      <div className="center-screen">
        <h1>الموقع غير مهيأ بعد</h1>
        <p className="muted">لم تُضبط إعدادات Firebase. راجع ملف README (خطوة الإعداد).</p>
      </div>
    );
  }
  if (bootError) {
    return (
      <div className="center-screen">
        <h1>تعذر الاتصال</h1>
        <p className="muted">تحقق من اتصالك بالإنترنت ثم حاول مرة أخرى.</p>
        <button className="primary-btn" onClick={boot}>
          إعادة المحاولة
        </button>
      </div>
    );
  }
  if (!uid) {
    return (
      <div className="center-screen">
        <div className="spinner" aria-label="جارٍ التحميل" />
      </div>
    );
  }
  return <Board uid={uid} />;
}

function Board({ uid }: { uid: string }) {
  const now = useNow();
  const online = useOnline();
  const toast = useToast();
  const actions = useAlertActions();
  const isDesktop = useMedia('(min-width: 900px)');
  const { alerts, loading, error, fromCache } = useAlerts(true);

  const [view, setView] = useState<View>(() => readLocal<View>(KEYS.view, 'list'));
  const [filters, setFilters] = useState<Filters>(() =>
    readLocal<Filters>(KEYS.filters, { type: 'all', subject: 'all' }),
  );
  const [expandedId, setExpandedId] = useState<string | null>(hashAlertId);
  const [form, setForm] = useState<{ editing: Alert | null } | null>(null);
  const [showArchive, setShowArchive] = useState(false);
  const [older, setOlder] = useState<Alert[] | null>(null);
  const [olderBusy, setOlderBusy] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  // التنبيهات دائمًا التبويب الافتراضي عند فتح الصفحة
  const [tab, setTab] = useState<Tab>('alerts');
  const [deleted, setDeleted] = useState<Alert[]>([]);
  const [showDeleted, setShowDeleted] = useState(false);
  const [pushState, setPushState] = useState<PushState>('checking');
  const [notifyOpen, setNotifyOpen] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState<string | null>(() => readLocal(KEYS.pushDismissed, null));
  const [viewerSrc, setViewerSrc] = useState<string | null>(null);
  const scrolledTo = useRef<string | null>(null);
  const [typing, setTyping] = useState(false);

  // إخفاء زر الإضافة العائم أثناء الكتابة حتى لا يغطي حقل الرد فوق لوحة المفاتيح
  useEffect(() => {
    const isField = (el: EventTarget | null) =>
      el instanceof HTMLElement &&
      (el.tagName === 'TEXTAREA' || (el.tagName === 'INPUT' && (el as HTMLInputElement).type === 'text'));
    const onIn = (e: FocusEvent) => isField(e.target) && setTyping(true);
    const onOut = () => setTyping(false);
    document.addEventListener('focusin', onIn);
    document.addEventListener('focusout', onOut);
    return () => {
      document.removeEventListener('focusin', onIn);
      document.removeEventListener('focusout', onOut);
    };
  }, []);

  useEffect(() => writeLocal(KEYS.view, view), [view]);
  useEffect(() => writeLocal(KEYS.filters, filters), [filters]);

  // حالة الإشعارات (الـService Worker يُسجَّل في main.tsx)
  useEffect(() => {
    detectPushState().then(setPushState);
    void refreshPushTokenSilently();
  }, []);

  // الإدمن: ?admin=CODE في الرابط، أو تحقق من تفعيل سابق على هذا الجهاز
  useEffect(() => {
    const url = new URL(location.href);
    const code = url.searchParams.get('admin');
    if (code) {
      url.searchParams.delete('admin');
      history.replaceState(null, '', url.toString());
      activateAdmin(code).then(
        (ok) => {
          setIsAdmin(ok);
          toast(
            ok
              ? { text: 'تم تفعيل صلاحية الإدمن على هذا الجهاز', kind: 'success' }
              : { text: 'كود الإدمن غير صحيح', kind: 'error' },
          );
        },
        () => toast({ text: 'تعذر التحقق من كود الإدمن', kind: 'error' }),
      );
    } else {
      checkAdmin().then(setIsAdmin);
    }
  }, [toast]);

  // عند إغلاق النموذج أو طي بطاقة يختفي الحقل المركّز دون حدث focusout — نعيد الفحص
  useEffect(() => {
    const t = window.setTimeout(() => {
      const el = document.activeElement;
      setTyping(el instanceof HTMLTextAreaElement || (el instanceof HTMLInputElement && el.type === 'text'));
    }, 50);
    return () => window.clearTimeout(t);
  }, [form, expandedId]);

  useEffect(() => {
    if (!isAdmin) return;
    return subscribeDeleted(setDeleted, () => {});
  }, [isAdmin]);

  // رابط مباشر لتنبيه (#a=ID) — من الإشعارات أو "نسخ الرابط"
  useEffect(() => {
    const onHash = () => {
      const id = hashAlertId();
      if (id) {
        setView('list');
        setExpandedId(id);
        scrolledTo.current = null;
      }
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const all = useMemo(() => {
    if (!older) return alerts;
    const ids = new Set(alerts.map((a) => a.id));
    return [...alerts, ...older.filter((a) => !ids.has(a.id))];
  }, [alerts, older]);

  const { active, archived, nearest } = useMemo(() => partition(all, now), [all, now]);
  const shownActive = useMemo(() => applyFilters(active, filters), [active, filters]);
  const shownArchived = useMemo(() => applyFilters(archived, filters), [archived, filters]);
  const shownNearest = nearest && shownActive.includes(nearest) ? nearest : null;
  const filtered = filters.type !== 'all' || filters.subject !== 'all';

  useEffect(() => {
    if (!expandedId || scrolledTo.current === expandedId || loading) return;
    if (archived.some((a) => a.id === expandedId)) setShowArchive(true);
    const t = window.setTimeout(() => {
      const el = document.getElementById(`alert-${expandedId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        scrolledTo.current = expandedId;
      }
    }, 150);
    return () => window.clearTimeout(t);
  }, [expandedId, loading, archived, view]);

  const ctx: AppCtx = useMemo(
    () => ({
      uid,
      isAdmin,
      expandedId,
      toggleExpanded: (id: string) => {
        scrolledTo.current = id;
        setExpandedId((cur) => (cur === id ? null : id));
      },
      openEdit: (a: Alert) => setForm({ editing: a }),
      openImage: setViewerSrc,
    }),
    [uid, isAdmin, expandedId],
  );

  const banner = pushBannerText(pushState);
  const showBanner = banner && bannerDismissed !== pushState;

  const renderList = (list: Alert[], opts: { ended?: boolean; nearestId?: string | null } = {}) =>
    isDesktop ? (
      <AlertTable alerts={list} now={now} nearestId={opts.nearestId ?? null} ended={opts.ended} />
    ) : (
      <div className="cards">
        {list.map((a) => (
          <AlertCard key={a.id} alert={a} now={now} ended={opts.ended} />
        ))}
      </div>
    );

  return (
    <AppContext.Provider value={ctx}>
      <div className="app">
        <header className="top">
          <div className="brand">
            <div className="logo">
              <img src={`${import.meta.env.BASE_URL}logo-mark.png`} alt="جامعة الحدود الشمالية" />
            </div>
            <div className="brand-text">
              <span className="brand-sub">دبلوم عالي إدارة المشاريع</span>
              <h1>الشعبة الثالثة</h1>
            </div>
          </div>
          <div className="top-tools">
            {tab === 'alerts' && (
              <div className="seg" role="group" aria-label="طريقة العرض">
                <button
                  className={view === 'list' ? 'on' : ''}
                  onClick={() => setView('list')}
                  aria-pressed={view === 'list'}
                  aria-label="عرض القائمة"
                >
                  <ListIcon />
                </button>
                <button
                  className={view === 'grid' ? 'on' : ''}
                  onClick={() => setView('grid')}
                  aria-pressed={view === 'grid'}
                  aria-label="عرض الصور"
                >
                  <GridIcon />
                </button>
              </div>
            )}
            <button
              className={`icon-btn round bell${pushState === 'enabled' ? ' on' : ''}`}
              onClick={() => setNotifyOpen(true)}
              aria-label="الإشعارات"
            >
              <BellIcon />
              {pushState !== 'enabled' && pushState !== 'checking' && pushState !== 'not-configured' && (
                <span className="dot" />
              )}
            </button>
            {isDesktop && tab === 'alerts' && (
              <button className="primary-btn add-desktop" onClick={() => setForm({ editing: null })}>
                <PlusIcon /> إضافة تنبيه
              </button>
            )}
          </div>
        </header>

        <nav className="main-tabs" role="tablist" aria-label="أقسام الصفحة">
          <button
            role="tab"
            aria-selected={tab === 'alerts'}
            className={tab === 'alerts' ? 'on' : ''}
            onClick={() => setTab('alerts')}
          >
            التنبيهات
          </button>
          <button
            role="tab"
            aria-selected={tab === 'courses'}
            className={tab === 'courses' ? 'on' : ''}
            onClick={() => setTab('courses')}
          >
            المقررات الدراسية
          </button>
        </nav>

        {tab === 'courses' && (
          <main>
            <CoursesPanel />
          </main>
        )}

        {tab === 'alerts' && (
          <>
            <p className="summary" aria-live="polite">
              {loading ? 'جارٍ التحميل…' : active.length ? summaryLine(active) : 'لا توجد تنبيهات نشطة'}
            </p>

            {!online && (
              <div className="notice warn">
                لا يوجد اتصال بالإنترنت — تعرض آخر نسخة محفوظة، وستتحدث تلقائيًا عند عودة الاتصال.
              </div>
            )}
            {online && error && <div className="notice warn">تعذر تحديث التنبيهات من الخادم. سنحاول تلقائيًا…</div>}
            {online && !error && !loading && fromCache && alerts.length === 0 && (
              <div className="notice">جارٍ الاتصال بالخادم…</div>
            )}

            {showBanner && (
              <div className="push-banner">
                <BellIcon size={16} />
                <span>{banner.text}</span>
                <button className="link-btn strong" onClick={() => setNotifyOpen(true)}>
                  {banner.cta}
                </button>
                <button
                  className="icon-btn"
                  aria-label="إخفاء"
                  onClick={() => {
                    setBannerDismissed(pushState);
                    writeLocal(KEYS.pushDismissed, pushState);
                  }}
                >
                  <XIcon size={14} />
                </button>
              </div>
            )}

            {(active.length > 2 || filtered) && (
              <div className="filters" role="toolbar" aria-label="تصفية">
                <div className="chips">
                  <button
                    className={`fchip${filters.type === 'all' ? ' on' : ''}`}
                    onClick={() => setFilters((f) => ({ ...f, type: 'all' }))}
                  >
                    الكل
                  </button>
                  {TYPE_ORDER.map((t) => (
                    <button
                      key={t}
                      className={`fchip${filters.type === t ? ' on' : ''}`}
                      style={
                        filters.type === t
                          ? { background: TYPES[t].bg, color: TYPES[t].fg, borderColor: TYPES[t].fg }
                          : undefined
                      }
                      onClick={() => setFilters((f) => ({ ...f, type: f.type === t ? 'all' : t }))}
                    >
                      {TYPES[t].label}
                    </button>
                  ))}
                  <span className="select-wrap small">
                    <select
                      value={filters.subject}
                      onChange={(e) => setFilters((f) => ({ ...f, subject: e.target.value }))}
                      aria-label="المادة"
                    >
                      <option value="all">كل المواد</option>
                      {SUBJECTS.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                    <ChevronDown size={14} className="select-chev" />
                  </span>
                </div>
              </div>
            )}

            <main>
              {view === 'grid' ? (
                <>
                  <h2 className="section-title">التنبيهات المرفق فيها صور</h2>
                  <GridView
                    alerts={shownActive}
                    now={now}
                    onOpen={(id) => {
                      setView('list');
                      setExpandedId(id);
                      scrolledTo.current = null;
                    }}
                  />
                </>
              ) : loading ? (
                <div className="cards">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="card skeleton" />
                  ))}
                </div>
              ) : shownActive.length === 0 ? (
                <div className="empty">
                  {filtered ? (
                    <>
                      <p className="empty-title">لا توجد تنبيهات نشطة بهذا التصفية</p>
                      <button className="link-btn strong" onClick={() => setFilters({ type: 'all', subject: 'all' })}>
                        عرض الكل
                      </button>
                    </>
                  ) : (
                    <>
                      <p className="empty-title">لا توجد تنبيهات نشطة حاليًا</p>
                      <p className="muted">أي واجب أو اختبار أو إعلان جديد سيظهر هنا فورًا لكل الشعبة.</p>
                      <button className="chip-btn" onClick={() => setForm({ editing: null })}>
                        <PlusIcon size={15} /> أضف أول تنبيه
                      </button>
                    </>
                  )}
                </div>
              ) : isDesktop ? (
                <AlertTable alerts={shownActive} now={now} nearestId={shownNearest?.id ?? null} />
              ) : (
                <>
                  {shownNearest && <AlertCard alert={shownNearest} now={now} nearest />}
                  {shownActive.length > (shownNearest ? 1 : 0) && (
                    <>
                      <h2 className="section-title">التنبيهات النشطة</h2>
                      <div className="cards">
                        {shownActive
                          .filter((a) => a !== shownNearest)
                          .map((a) => (
                            <AlertCard key={a.id} alert={a} now={now} />
                          ))}
                      </div>
                    </>
                  )}
                </>
              )}

              {view === 'list' && !loading && (
                <section className="archive">
                  <button
                    className="section-toggle"
                    onClick={() => setShowArchive((s) => !s)}
                    aria-expanded={showArchive}
                  >
                    <span>المنتهية والأرشيف ({shownArchived.length})</span>
                    <ChevronDown className={`chev${showArchive ? ' up' : ''}`} size={16} />
                  </button>
                  {showArchive && (
                    <>
                      {shownArchived.length === 0 ? (
                        <p className="muted small pad">لا يوجد شيء في الأرشيف بعد.</p>
                      ) : (
                        renderList(shownArchived, { ended: true })
                      )}
                      {older === null && (
                        <button
                          className="link-btn pad"
                          disabled={olderBusy}
                          onClick={() => {
                            setOlderBusy(true);
                            loadOlderArchive()
                              .then(setOlder, () => toast({ text: 'تعذر تحميل الأرشيف الأقدم', kind: 'error' }))
                              .finally(() => setOlderBusy(false));
                          }}
                        >
                          {olderBusy ? 'جارٍ التحميل…' : 'تحميل الأرشيف الأقدم (أكثر من 30 يومًا)'}
                        </button>
                      )}
                    </>
                  )}
                </section>
              )}

              {isAdmin && view === 'list' && (
                <section className="archive admin-zone">
                  <button
                    className="section-toggle"
                    onClick={() => setShowDeleted((s) => !s)}
                    aria-expanded={showDeleted}
                  >
                    <span>المحذوفة — للإدمن فقط ({deleted.length})</span>
                    <ChevronDown className={`chev${showDeleted ? ' up' : ''}`} size={16} />
                  </button>
                  {showDeleted && (
                    <div className="deleted-list">
                      {deleted.length === 0 && <p className="muted small pad">لا توجد محذوفات.</p>}
                      {deleted.map((a) => (
                        <div key={a.id} className="deleted-row">
                          <div>
                            <b>{a.title}</b>
                            <span className="muted small">
                              {' '}
                              · {TYPES[a.type].label} · بواسطة {a.authorName}
                              {a.replyCount ? ` · ${a.replyCount} رد` : ''}
                            </span>
                          </div>
                          <div className="row-actions">
                            <button className="chip-btn" onClick={() => actions.restore(a)}>
                              استعادة
                            </button>
                            <button
                              className="chip-btn danger"
                              onClick={() =>
                                window.confirm('حذف نهائي بدون تراجع (مع الردود والصورة)؟') && actions.purge(a)
                              }
                            >
                              حذف نهائي
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              )}
            </main>
          </>
        )}

        <footer className="foot">
          <button className="link-btn" onClick={() => setNotifyOpen(true)}>
            الإشعارات
          </button>
          <span aria-hidden="true">·</span>
          <button className="link-btn" onClick={() => setAdminOpen(true)}>
            {isAdmin ? 'الإدمن مفعّل' : 'الإدمن'}
          </button>
        </footer>

        {!isDesktop && !typing && tab === 'alerts' && (
          <div className="fab-wrap">
            <button className="primary-btn fab" onClick={() => setForm({ editing: null })}>
              <PlusIcon /> إضافة تنبيه
            </button>
          </div>
        )}

        {form && (
          <AlertForm
            editing={form.editing}
            onClose={() => setForm(null)}
            onPublished={(id) => {
              setForm(null);
              setView('list');
              scrolledTo.current = null;
              setExpandedId(id);
            }}
          />
        )}
        {notifyOpen && <NotifyPanel state={pushState} setState={setPushState} onClose={() => setNotifyOpen(false)} />}
        {adminOpen && <AdminDialog isAdmin={isAdmin} onChange={setIsAdmin} onClose={() => setAdminOpen(false)} />}
        {viewerSrc && (
          <div className="viewer" onClick={() => setViewerSrc(null)} role="dialog" aria-label="عرض الصورة">
            <img src={viewerSrc} alt="" />
            <button className="icon-btn round viewer-close" aria-label="إغلاق">
              <XIcon />
            </button>
          </div>
        )}
      </div>
    </AppContext.Provider>
  );
}
