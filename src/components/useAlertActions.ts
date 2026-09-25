import { useCallback } from 'react';
import { hardDelete, setArchived, setDeleted, toggleDuplicate } from '../data/api';
import type { Alert } from '../lib/model';
import { errorText } from '../lib/settle';
import { useToast } from './Toasts';

export function useAlertActions() {
  const toast = useToast();

  const run = useCallback(
    async (p: Promise<unknown>, ok?: string) => {
      try {
        await p;
        if (ok) toast({ text: ok, kind: 'success' });
        return true;
      } catch (e) {
        console.error(e);
        toast({ text: `تعذر تنفيذ العملية: ${errorText(e)}`, kind: 'error' });
        return false;
      }
    },
    [toast],
  );

  return {
    archive: (a: Alert) =>
      run(setArchived(a, true)).then(
        (ok) =>
          ok &&
          toast({
            text: 'نُقل التنبيه إلى المنتهية',
            action: { label: 'تراجع', run: () => void run(setArchived(a, false)) },
          }),
      ),
    unarchive: (a: Alert) => run(setArchived(a, false), 'أُعيد التنبيه إلى النشطة'),
    remove: (a: Alert) =>
      run(setDeleted(a, true)).then(
        (ok) =>
          ok &&
          toast({
            text: 'حُذف التنبيه',
            ms: 7000,
            action: { label: 'تراجع', run: () => void run(setDeleted(a, false), 'تمت استعادة التنبيه') },
          }),
      ),
    restore: (a: Alert) => run(setDeleted(a, false), 'تمت استعادة التنبيه'),
    purge: (a: Alert) => run(hardDelete(a), 'حُذف التنبيه نهائيًا'),
    toggleDup: (a: Alert) => run(toggleDuplicate(a)),
  };
}
