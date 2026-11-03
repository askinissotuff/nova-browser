// Scramjet's worker must be imported before registering shell handlers.
importScripts("/controller/controller.sw.js");

const CACHE = "nova-shell-v8";
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

  if (url.origin !== self.location.origin) return;

  const scramjet = self.$scramjetController;

  // Route registered Scramjet frames immediately.
  if (scramjet?.shouldRoute(event)) {
    event.respondWith(scramjet.route(event));
    return;
  }

  // A restarted service worker can briefly lose its in-memory frame table.
  // Keep this fetch event alive while the controller sends its revive message
  // and re-registers the existing frame prefix, rather than letting Express
  // return "Cannot GET /~/sj/...".
  if (url.pathname.startsWith("/~/sj/")) {
    event.respondWith((async () => {
      const deadline = Date.now() + 8000;
      while (Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 100));
        if (scramjet?.shouldRoute(event)) return scramjet.route(event);
      }
      return new Response(
        "NOVA could not restore this proxy tab. Reload the NOVA tab and retry.",
        {
          status: 503,
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Cache-Control": "no-store"
          }
        }
      );
    })());
    return;
  }

  // The shell cache only handles same-origin GET requests.
  if (request.method !== "GET") return;

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
