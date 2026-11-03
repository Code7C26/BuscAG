self.addEventListener('push', event => {
  let payload = {};
  try { payload = event.data?.json() ?? {}; } catch { /* A malformed payload must not crash the worker. */ }
  if (!payload || typeof payload !== 'object') payload = {};
  const title = typeof payload.title === 'string' && payload.title ? payload.title.slice(0,100) : 'BuscAG';
  const options = {
    body: typeof payload.body === 'string' ? payload.body.slice(0,500) : 'Tienes una nueva notificación.',
    data: { url: typeof payload.url === 'string' ? payload.url : '/' }
  };
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
