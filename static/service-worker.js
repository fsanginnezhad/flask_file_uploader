// این برنامه کوچیکه و نیاز به کش/کارکرد آفلاین نداره.
// این service worker فقط برای قابل‌نصب‌شدن (installable) بودن PWA لازمه.

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  self.clients.claim();
});

// pass-through ساده — هیچ کشی انجام نمی‌شه
self.addEventListener("fetch", (event) => {
  event.respondWith(fetch(event.request));
});
