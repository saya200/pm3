import { initializeApp, type FirebaseApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, onAuthStateChanged, signInAnonymously, type Auth } from 'firebase/auth';
import {
  connectFirestoreEmulator,
  initializeFirestore,
  memoryLocalCache,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from 'firebase/firestore';

const env = import.meta.env;
export const USE_EMULATORS = env.VITE_USE_EMULATORS === '1';

const config = USE_EMULATORS
  ? { apiKey: 'demo-key', projectId: 'demo-section3', appId: 'demo-app', authDomain: 'localhost' }
  : {
      apiKey: env.VITE_FIREBASE_API_KEY,
      authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
      projectId: env.VITE_FIREBASE_PROJECT_ID,
      appId: env.VITE_FIREBASE_APP_ID,
      messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    };

export const IS_CONFIGURED = USE_EMULATORS || Boolean(config.apiKey && config.projectId);
export const VAPID_KEY = env.VITE_FIREBASE_VAPID_KEY || '';

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;

export function getApp(): FirebaseApp {
  if (!app) app = initializeApp(config);
  return app;
}

export function getDb(): Firestore {
  if (db) return db;
  let cache;
  try {
    // كاش دائم: فتح أسرع، قراءة بدون اتصال، وحفظ الكتابات المعلّقة حتى عودة الشبكة
    cache = persistentLocalCache({ tabManager: persistentMultipleTabManager() });
  } catch {
    cache = memoryLocalCache();
  }
  db = initializeFirestore(getApp(), { localCache: cache, ignoreUndefinedProperties: true });
  if (USE_EMULATORS) connectFirestoreEmulator(db, '127.0.0.1', 8080);
  return db;
}

function getAuthInstance(): Auth {
  if (auth) return auth;
  auth = getAuth(getApp());
  if (USE_EMULATORS) connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  return auth;
}

let uidPromise: Promise<string> | null = null;

/** هوية مجهولة للجهاز (بدون تسجيل) — تستخدم فقط لمعرفة صاحب التنبيه/الرد */
export function ensureUid(): Promise<string> {
  if (uidPromise) return uidPromise;
  const a = getAuthInstance();
  uidPromise = new Promise<string>((resolve, reject) => {
    const unsub = onAuthStateChanged(a, (user) => {
      if (user) {
        unsub();
        resolve(user.uid);
      }
    });
    a.authStateReady()
      .then(() => {
        if (!a.currentUser) return signInAnonymously(a);
      })
      .catch((e) => {
        unsub();
        uidPromise = null;
        reject(e);
      });
  });
  return uidPromise;
}

export function currentUid(): string | null {
  return auth?.currentUser?.uid ?? null;
}
