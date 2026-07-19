const CACHE = "gerenciador-interclasses-1.1-counter-menu-fix-v5";
const FILES = [
  "./",
  "./index.html",
  "./style.css?v=contador-v4",
  "./app.js?v=contador-v4",
  "./manifest.json",
  "./icon.svg"
];

self.addEventListener("install", event => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES)));
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const request = event.request;
  const url = new URL(request.url);

  // Firestore, CDNs, POST e outras APIs nunca devem passar pelo cache do PWA.
  if(request.method !== "GET" || url.origin !== self.location.origin){
    return;
  }

  event.respondWith(
    fetch(request)
      .then(response => {
        if(response && response.ok){
          const copy=response.clone();
          caches.open(CACHE).then(cache => cache.put(request,copy));
        }
        return response;
      })
      .catch(() => caches.match(request).then(cached => cached || caches.match("./index.html")))
  );
});
