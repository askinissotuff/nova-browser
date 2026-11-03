// Scramjet's worker must be imported before registering shell handlers.
importScripts("/controller/controller.sw.js");

const CACHE = "nova-shell-v5";
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
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith("nova-shell-") && key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (url.origin !== self.location.origin || request.method !== "GET") return;

  // Scramjet owns proxied requests; route them before shell-cache handling.
  if (self.$scramjetController?.shouldRoute(event)) {
    event.respondWith(self.$scramjetController.route(event));
    return;
  }

  // Runtime files and the Wisp tunnel must always reach the network.
  if (
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
