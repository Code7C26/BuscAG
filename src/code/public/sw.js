self.addEventListener('push', event => {
  const payload = event.data.json();
  const title = payload.title || 'BuscAG';
  const options = {
    body: payload.body || 'Tienes una nueva notificación.',
    data: { url: payload.url || '/' }
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const target = new URL(event.notification.data.url || '/', self.location.origin);
  const url = target.origin === self.location.origin ? target.href : self.location.origin;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
      const existing = clients.find(client => client.url.startsWith(self.location.origin));
      if (existing) {
        return existing.focus().then(() => existing.navigate(url));
      }
      return self.clients.openWindow(url);
    })
  );
});
