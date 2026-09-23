// 银行理财日报离线缓存（docs/05 二期）
// 策略：network-first —— 数据每日更新，在线取最新并写缓存；断网回退缓存（昨日数据）
var CACHE = 'mmgt-site-v2-2026-09-23-672904';
var FILES = ['./', './index.html', './data.js', './manifest.webmanifest', './icon.svg'];
self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(FILES); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  var url = e.request.url;
  /* 页面壳（./ 与 index.html）：stale-while-revalidate —— 缓存秒开 + 后台更新（docs/08 §4） */
  if (/\/index\.html($|\?)/.test(url) || /\/$/.test(url)) {
    e.respondWith(
      caches.match(e.request, { ignoreSearch: true }).then(function (cached) {
        var refresh = fetch(e.request).then(function (res) {
          if (res && res.ok) e.waitUntil(caches.open(CACHE).then(function (c) { return c.put(e.request, res.clone()); }));
          return res;
        }).catch(function () { return cached; });
        return cached || refresh;
      })
    );
    return;
  }
  /* 数据与其余资源：network-first（保证每日数据最新），断网回退缓存 */
  e.respondWith(
    fetch(e.request).then(function (res) {
      if (res && res.ok) { e.waitUntil(caches.open(CACHE).then(function (c) { return c.put(e.request, res.clone()); })); }
      return res;
    }).catch(function () {
      return caches.match(e.request, { ignoreSearch: true }).then(function (r) { return r || caches.match('./index.html'); });
    })
  );
});
