// 最小 service worker:满足 PWA 安装条件;数据始终走网络,不缓存接口
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {});
