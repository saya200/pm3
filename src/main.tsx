import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { ToastProvider } from './components/Toasts';
import { registerServiceWorker } from './data/push';
import './styles.css';

// Service Worker: تثبيت PWA + استقبال Push + فتح الواجهة عند ضعف الاتصال
if (import.meta.env.PROD) registerServiceWorker()?.catch(() => {});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ToastProvider>
      <App />
    </ToastProvider>
  </StrictMode>,
);
