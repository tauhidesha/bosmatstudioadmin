self.addEventListener('push', function (event) {
  if (event.data) {
    try {
      const data = event.data.json();
      
      const title = data.title || 'Pesan Baru';
      const options = {
        body: data.body || 'Anda mendapat pesan baru',
        icon: data.icon || '/icon.png',
        badge: data.badge || '/badge.png',
        data: {
          url: data.url || '/conversations'
        }
      };
      
      event.waitUntil(self.registration.showNotification(title, options));
    } catch (e) {
      event.waitUntil(
        self.registration.showNotification('Pesan Baru', {
          body: event.data.text(),
          icon: '/icon.png',
          badge: '/badge.png'
        })
      );
    }
  }
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
      const urlToOpen = event.notification.data?.url || '/conversations';
      
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if (client.url.includes('/conversations') && 'focus' in client) {
          return client.focus();
        }
      }
      
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
