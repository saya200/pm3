import { useEffect, useState } from 'react';

/** ساعة واحدة مشتركة تتحدث كل ثانية على جهاز الطالب (بدون أي طلب للسيرفر) */
export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    let id: number;
    // مزامنة مع بداية الثانية حتى تتغير الأرقام بسلاسة
    const start = window.setTimeout(
      () => {
        setNow(Date.now());
        id = window.setInterval(() => setNow(Date.now()), intervalMs);
      },
      intervalMs - (Date.now() % intervalMs),
    );
    const onVisible = () => document.visibilityState === 'visible' && setNow(Date.now());
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearTimeout(start);
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [intervalMs]);
  return now;
}
