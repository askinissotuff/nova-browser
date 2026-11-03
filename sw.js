const CACHE = "nova-shell-v4";
const SHELL = ["/", "/index.html", "/manifest.webmanifest", "/icon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (url.origin !== self.location.origin || request.method !== "GET") return;

  // Never cache proxied destinations, proxy transport, or executable engine assets.
  // Caching these can replay stale third-party HTML/JS after a deployment.
  if (
    url.pathname.startsWith("/~/sj/") ||
    url.pathname.startsWith("/wisp/") ||
    url.pathname.startsWith("/scram/") ||
    url.pathname.startsWith("/controller/") ||
    url.pathname.startsWith("/utils/") ||
    url.pathname.startsWith("/libcurl/") ||
    url.pathname === "/browser-engine.js"
  ) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try {
      const response = await fetch(request);
      if (response.ok && (request.mode === "navigate" || SHELL.includes(url.pathname))) {
        await cache.put(request, response.clone());
      }
      return response;
    } catch {
      const cached = await cache.match(request);
      if (cached) return cached;
      if (request.mode === "navigate") return (await cache.match("/index.html")) || Response.error();
      return Response.error();
    }
  })());
});
