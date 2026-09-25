import { useEffect, useState } from 'react';
import { subscribeAlerts } from '../data/api';
import type { Alert } from '../lib/model';

export interface AlertsState {
  alerts: Alert[];
  loading: boolean;
  fromCache: boolean;
  error: string | null;
}

export function useAlerts(enabled: boolean): AlertsState {
  const [state, setState] = useState<AlertsState>({ alerts: [], loading: true, fromCache: true, error: null });
  useEffect(() => {
    if (!enabled) return;
    return subscribeAlerts(
      (alerts, fromCache) => setState({ alerts, loading: false, fromCache, error: null }),
      (e) => {
        console.error(e);
        setState((s) => ({ ...s, loading: false, error: e.message }));
      },
    );
  }, [enabled]);
  return state;
}
