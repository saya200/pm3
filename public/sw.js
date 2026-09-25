/* Service Worker: كاش بسيط لواجهة التطبيق + استقبال Push وعرضه */
const CACHE = 'shell-v1';
const SCOPE = self.registration.scope;

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

// الشبكة أولًا، والكاش كاحتياط عند انقطاع الاتصال (لملفات الموقع نفسه فقط)
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || !req.url.startsWith(SCOPE)) return;
  event.respondWith(
    (async () => {
      try {
        const res = await fetch(req);
        if (res.ok && res.type === 'basic') {
          const copy = res.clone();
          caches
            .open(CACHE)
            .then((c) => c.put(req, copy))
            .catch(() => {});
        }
        return res;
      } catch (err) {
        const cached = (await caches.match(req)) || (req.mode === 'navigate' ? await caches.match(SCOPE) : undefined);
        if (cached) return cached;
        throw err;
      }
    })(),
  );
});

function parsePush(event) {
  let payload;
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { data: { body: event.data ? event.data.text() : '' } };
  }
  // صيغة FCM: { data: {...}, notification: {...} }
  const data = payload.data || {};
  const n = payload.notification || {};
  return {
    title: data.title || n.title || 'الشعبة الثالثة',
    body: data.body || n.body || '',
    url: data.url || (payload.fcmOptions && payload.fcmOptions.link) || SCOPE,
    tag: data.tag || undefined,
  };
}

self.addEventListener('push', (event) => {
  const msg = parsePush(event);
  event.waitUntil(
    self.registration.showNotification(msg.title, {
      body: msg.body,
      tag: msg.tag,
      icon: new URL('icons/icon-192.png', SCOPE).href,
      badge: new URL('icons/icon-192.png', SCOPE).href,
      dir: 'rtl',
      lang: 'ar',
      data: { url: msg.url },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || SCOPE;
  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const c of all) {
        if (c.url.startsWith(SCOPE)) {
          await c.focus();
          if ('navigate' in c) await c.navigate(target).catch(() => {});
          return;
        }
      }
      await self.clients.openWindow(target);
    })(),
  );
});
