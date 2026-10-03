// 银行理财日报离线缓存（docs/05 二期）
// 策略：network-first —— 数据每日更新，在线取最新并写缓存；断网回退缓存（昨日数据）
var CACHE = 'mmgt-site-v2-2026-10-03-292943';
var FILES = ['./', './index.html', './daily.html', './data.js', './manifest.webmanifest', './icon.svg'];
function offline() { return new Response('offline', { status: 504, statusText: 'Gateway Timeout' }); }
self.addEventListener('install', function (e) {
  /* 2026-10-01 修复 P1-9②：逐个 add 并各自 catch —— 原先 addAll 只要一个资源 404
     整个 install 就失败，SW 永远停在旧壳。后台刷新同样不再嵌套 waitUntil（已收进 refresh）。 */
  e.waitUntil(caches.open(CACHE).then(function (c) {
    return Promise.all(FILES.map(function (u) { return c.add(u).catch(function () { return null; }); }));
  }).then(function () { return self.skipWaiting(); }));
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
          if (!res || !res.ok) return res;
          return caches.open(CACHE).then(function (c) { return c.put(e.request, res.clone()); })
            .then(function () { return res; }, function () { return res; });
        });
        /* 2026-10-01 修复 P1-9①：waitUntil 必须在 respondWith 结算**之前**注册 ——
           原先在 fetch.then 里才调用，respondWith 已 settle → 规范抛 InvalidStateError 并被
           .catch 吞掉，后台刷新从未生效（注释与实现不符）。 */
        e.waitUntil(refresh.then(function () {}, function () {}));
        return cached || refresh.catch(function () { return offline(); });
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
      /* 2026-10-01 修复 P1-8②：只有导航请求才允许拿 index.html 兜底；其余资源（尤其
         data.js）离线且无缓存时返回 504，绝不拿 HTML 冒充 js（会 DATA undefined → 白屏）。 */
      return caches.match(e.request, { ignoreSearch: true }).then(function (r) {
        if (r) return r;
        if (e.request.mode === 'navigate') return caches.match('./index.html').then(function (h) { return h || offline(); });
        return offline();
      });
    })
  );
});
