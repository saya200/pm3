import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';

export interface Toast {
  id: number;
  text: string;
  kind?: 'info' | 'error' | 'success';
  action?: { label: string; run: () => void };
  ms?: number;
}

type Push = (t: Omit<Toast, 'id'>) => void;
const Ctx = createContext<Push>(() => {});

export function useToast(): Push {
  return useContext(Ctx);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const seq = useRef(0);
  const dismiss = useCallback((id: number) => setToasts((l) => l.filter((t) => t.id !== id)), []);
  const push = useCallback<Push>(
    (t) => {
      const id = ++seq.current;
      setToasts((l) => [...l.slice(-2), { ...t, id }]);
      window.setTimeout(() => dismiss(id), t.ms ?? (t.kind === 'error' ? 8000 : 4500));
    },
    [dismiss],
  );
  const value = useMemo(() => push, [push]);
  return (
    <Ctx.Provider value={value}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.kind ?? 'info'}`}>
            <span>{t.text}</span>
            {t.action && (
              <button
                className="toast-action"
                onClick={() => {
                  t.action!.run();
                  dismiss(t.id);
                }}
              >
                {t.action.label}
              </button>
            )}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
