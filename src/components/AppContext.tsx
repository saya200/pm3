import { createContext, useContext } from 'react';
import type { Alert } from '../lib/model';

export interface AppCtx {
  uid: string;
  isAdmin: boolean;
  expandedId: string | null;
  toggleExpanded: (id: string) => void;
  openEdit: (alert: Alert) => void;
  openImage: (src: string) => void;
}

export const AppContext = createContext<AppCtx>({
  uid: '',
  isAdmin: false,
  expandedId: null,
  toggleExpanded: () => {},
  openEdit: () => {},
  openImage: () => {},
});

export const useApp = () => useContext(AppContext);
