// Manejo de notificaciones push (Web Push/VAPID) -- se inyecta dentro del
// service worker que genera vite-plugin-pwa via workbox.importScripts,
// para no tener que cambiar de estrategia (generateSW) solo por esto.
self.addEventListener('push', (event) => {
  let datos = {};
  try {
    datos = event.data ? event.data.json() : {};
  } catch {
    datos = { title: 'Mr Carnes', body: event.data ? event.data.text() : '' };
  }

  event.waitUntil(
    self.registration.showNotification(datos.title || 'Mr Carnes', {
      body: datos.body || '',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: datos.tag,
      data: { url: datos.url || '/' },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((lista) => {
      for (const cliente of lista) {
        if ('focus' in cliente) return cliente.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});
