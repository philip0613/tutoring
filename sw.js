// sw.js - Web Push Notification Service Worker
self.addEventListener('install', function(event) {
    self.skipWaiting();
});

self.addEventListener('activate', function(event) {
    event.waitUntil(self.clients.claim());
});

self.addEventListener('push', function(event) {
    let data = { title: '과외노트 알림', body: '새로운 알림이 도착했습니다.', link: '/' };

    if (event.data) {
        try {
            data = event.data.json();
        } catch (e) {
            data.body = event.data.text();
        }
    }

    const options = {
        body: data.body,
        icon: '/icon.svg',
        badge: '/icon.svg',
        vibrate: [100, 50, 100],
        data: {
            link: data.link || '/'
        }
    };

    event.waitUntil(
        self.registration.showNotification(data.title, options)
    );
});

self.addEventListener('notificationclick', function(event) {
    event.notification.close();
    
    // 항상 서비스 워커 파일(/sw.js)이 아닌 웹 사이트 루트(/)를 기준으로 완전한 URL 조립
    const rawLink = event.notification.data?.link || '/';
    let targetUrl = self.location.origin + '/';

    if (rawLink) {
        if (rawLink.startsWith('http://') || rawLink.startsWith('https://')) {
            targetUrl = rawLink;
        } else if (rawLink.startsWith('/')) {
            targetUrl = self.location.origin + rawLink;
        } else if (rawLink.startsWith('#')) {
            targetUrl = self.location.origin + '/' + rawLink;
        } else {
            targetUrl = self.location.origin + '/' + rawLink;
        }
    }

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
            // 이미 열려 있는 앱 창이 있다면 해당 창으로 이동 및 포커스
            for (let i = 0; i < clientList.length; i++) {
                const client = clientList[i];
                if (client.url.includes(self.location.origin) && 'focus' in client) {
                    if ('navigate' in client) {
                        client.navigate(targetUrl);
                    }
                    return client.focus();
                }
            }
            // 열려 있는 창이 없다면 새 창(앱)으로 열기
            if (clients.openWindow) {
                return clients.openWindow(targetUrl);
            }
        })
    );
});
