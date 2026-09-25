import { deleteToken, getMessaging, getToken, isSupported } from 'firebase/messaging';
import { getApp, USE_EMULATORS, VAPID_KEY } from '../firebase';
import { KEYS, readLocal, writeLocal } from '../lib/local';
import { removePushToken, savePushToken } from './api';

export type PushState =
  | 'checking'
  | 'unsupported' // المتصفح لا يدعم الإشعارات إطلاقًا
  | 'ios-install' // iPhone/iPad: يجب تثبيت الموقع على الشاشة الرئيسية أولًا
  | 'not-configured' // لم يُضبط مفتاح VAPID بعد
  | 'prompt' // لم يُطلب الإذن بعد
  | 'denied' // المستخدم رفض الإذن
  | 'enabled' // مفعّلة على هذا الجهاز
  | 'error';

export function isIOS(): boolean {
  const ua = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) || (ua.includes('Macintosh') && navigator.maxTouchPoints > 1);
}

export function isStandalone(): boolean {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function baseSupport(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

export async function detectPushState(): Promise<PushState> {
  if (isIOS() && !isStandalone()) return 'ios-install';
  if (!baseSupport()) return 'unsupported';
  if (!(await isSupported().catch(() => false))) return 'unsupported';
  if (!VAPID_KEY || USE_EMULATORS) return 'not-configured';
  if (Notification.permission === 'denied') return 'denied';
  if (Notification.permission === 'granted' && readLocal<string | null>(KEYS.pushToken, null)) return 'enabled';
  return 'prompt';
}

let swReg: Promise<ServiceWorkerRegistration> | null = null;

export function registerServiceWorker(): Promise<ServiceWorkerRegistration> | null {
  if (!('serviceWorker' in navigator)) return null;
  if (!swReg) {
    swReg = navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL })
      .then(() => navigator.serviceWorker.ready);
    swReg.catch(() => (swReg = null));
  }
  return swReg;
}

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function platformLabel(): string {
  return `${isIOS() ? 'ios' : /Android/i.test(navigator.userAgent) ? 'android' : 'desktop'}${
    isStandalone() ? '-pwa' : ''
  }`;
}

async function obtainAndSaveToken(): Promise<void> {
  const reg = await registerServiceWorker();
  if (!reg) throw new Error('no-sw');
  const token = await getToken(getMessaging(getApp()), {
    vapidKey: VAPID_KEY,
    serviceWorkerRegistration: reg,
  });
  if (!token) throw new Error('no-token');
  const id = await sha256(token);
  const prev = readLocal<{ id: string } | null>(KEYS.pushToken, null);
  await savePushToken(id, token, platformLabel());
  if (prev && prev.id !== id) await removePushToken(prev.id).catch(() => {});
  writeLocal(KEYS.pushToken, { id });
}

/** يجب استدعاؤها من ضغطة زر (متطلب iOS/Safari لطلب الإذن) */
export async function enablePush(): Promise<PushState> {
  const permission = await Notification.requestPermission();
  if (permission === 'denied') return 'denied';
  if (permission !== 'granted') return 'prompt';
  await obtainAndSaveToken();
  return 'enabled';
}

export async function disablePush(): Promise<void> {
  const prev = readLocal<{ id: string } | null>(KEYS.pushToken, null);
  try {
    await deleteToken(getMessaging(getApp()));
  } catch {
    /* قد لا يوجد رمز */
  }
  if (prev) await removePushToken(prev.id).catch(() => {});
  writeLocal(KEYS.pushToken, null);
}

/** عند كل فتح: تجديد الرمز بهدوء (الرموز تتغير أحيانًا) */
export async function refreshPushTokenSilently(): Promise<void> {
  if ((await detectPushState()) !== 'enabled') return;
  await obtainAndSaveToken().catch(() => {});
}
