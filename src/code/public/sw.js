self.addEventListener('push', event => {
  let payload = {};
  try { payload = event.data?.json() ?? {}; } catch { /* A malformed payload must not crash the worker. */ }
  if (!payload || typeof payload !== 'object') payload = {};
  const title = typeof payload.title === 'string' && payload.title ? payload.title.slice(0,100) : 'BuscAG';
  const options = {
    body: typeof payload.body === 'string' ? payload.body.slice(0,500) : 'Tienes una nueva notificación.',
    data: { url: typeof payload.url === 'string' ? payload.url : '/' }
  };
  // Webhooks/providers can redeliver. Replace the visible notification for the
  // same persisted notice instead of showing several copies of it.
  try {
    const destination = new URL(options.data.url, self.location.origin);
    const id = destination.searchParams.get('notification');
    if (destination.origin === self.location.origin && id && /^[a-zA-Z0-9-]{1,128}$/.test(id)) {
      options.tag = 'buscag-notice-' + id;
      options.renotify = false;
    }
  } catch { /* Invalid links keep the safe default notification behavior. */ }
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  let url = self.location.origin;
  try {
    const target = new URL(event.notification.data?.url || '/', self.location.origin);
    if (target.origin === self.location.origin) url = target.href;
  } catch { /* Keep navigation on this application's origin. */ }
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
    const existing = clients.find(client => new URL(client.url).origin === self.location.origin);
    if (existing) return existing.focus().then(() => existing.navigate(url));
    return self.clients.openWindow(url);
  }));
});

// Only the public fallback and its language script; no API, image, app shell or private response caching.
const OFFLINE_CACHE='buscag-offline-v3';
self.addEventListener('install',event=>{
  event.waitUntil(caches.open(OFFLINE_CACHE).then(cache=>cache.addAll(['/offline.html','/offline.js'])));
});
self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('buscag-offline-')&&key!==OFFLINE_CACHE).map(key=>caches.delete(key)))));
});
self.addEventListener('fetch',event=>{
  if(event.request.method==='GET'&&event.request.url===new URL('/offline.js',self.location.origin).href){
    event.respondWith(caches.open(OFFLINE_CACHE).then(cache=>cache.match('/offline.js')).then(response=>response||fetch(event.request)));
    return;
  }
  if(event.request.method!=='GET'||event.request.mode!=='navigate'||new URL(event.request.url).origin!==self.location.origin)return;
  // Do not preserve callback tokens, paths or requests in a cache.
  event.respondWith(fetch(event.request).catch(()=>caches.open(OFFLINE_CACHE).then(cache=>cache.match('/offline.html'))));
});
