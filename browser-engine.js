/* NOVA browser engine: Scramjet 2.x over Wisp. */
(() => {
  "use strict";
  let ready;
  const managed = new WeakMap();

  const loadScript = (src) => new Promise((resolve, reject) => {
    const url = new URL(src, location.href).href;
    const old = [...document.scripts].find((s) => s.src === url);
    if (old?.dataset.ready === "1") return resolve();
    const script = old || Object.assign(document.createElement("script"), { src: url });
    script.onload = () => { script.dataset.ready = "1"; resolve(); };
    script.onerror = () => reject(new Error("Unable to load " + src));
    if (!old) document.head.append(script);
  });

  async function initialize() {
    if (ready) return ready;
    ready = (async () => {
      if (!("serviceWorker" in navigator) || !/^https?:$/.test(location.protocol))
        throw new Error("Proxy browsing requires HTTPS.");
      const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });
      await navigator.serviceWorker.ready;
      if (!navigator.serviceWorker.controller) {
        await new Promise((resolve, reject) => {
          const timer = setTimeout(() => reject(new Error("Reload NOVA to activate its proxy service worker.")), 12000);
          navigator.serviceWorker.addEventListener("controllerchange", () => { clearTimeout(timer); resolve(); }, { once: true });
        });
      }
      const serviceworker = navigator.serviceWorker.controller || registration.active;
      await loadScript("/scram/scramjet.js");
      await loadScript("/controller/controller.api.js");
      await loadScript("/utils/scramjet-utils.js");
      const api = window.$scramjetController;
      if (!api?.Controller) throw new Error("Scramjet controller API failed to initialize.");
      const { default: LibcurlClient } = await import("/libcurl/index.mjs");
      const scheme = location.protocol === "https:" ? "wss:" : "ws:";
      const transport = new LibcurlClient({ wisp: scheme + "//" + location.host + "/wisp/" });
      const controller = new api.Controller({
        serviceworker,
        transport,
        config: {
          prefix: "/~/sj/",
          scramjetPath: "/scram/scramjet.js",
          wasmPath: "/scram/scramjet.wasm",
          injectPath: "/controller/controller.inject.js"
        }
      });
      await controller.wait();
      setInterval(() => navigator.serviceWorker.controller?.postMessage("keepalive"), 15000);
      return controller;
    })().catch((error) => { ready = null; throw error; });
    return ready;
  }

  function isWebUrl(value) {
    try {
      const u = new URL(String(value), location.href);
      if (!["http:", "https:"].includes(u.protocol)) return false;
      const h = u.hostname.toLowerCase();
      return !(h === "localhost" || h.endsWith(".localhost") || h.endsWith(".local") ||
        h === "127.0.0.1" || h === "::1" || h.startsWith("10.") || h.startsWith("192.168.") ||
        /^172\.(1[6-9]|2\d|3[01])\./.test(h) || h.startsWith("169.254."));
    } catch { return false; }
  }

  function createFrame(tabId, onLoad) {
    const el = document.createElement("iframe");
    el.className = "frame";
    el.dataset.tab = String(tabId);
    el.title = "NOVA proxied website";
    el.referrerPolicy = "no-referrer";
    el.setAttribute("allow", "fullscreen; autoplay");
    if (typeof onLoad === "function") el.addEventListener("load", onLoad);
    return el;
  }

  async function navigate(element, destination) {
    if (!(element instanceof HTMLIFrameElement) || !isWebUrl(destination)) return false;
    const controller = await initialize();
    let frame = managed.get(element);
    if (!frame) {
      const utils = window.$scramjetUtils;
      const eventHandler = new utils.EventHandlerPlugin();
      // utils 0.0.3 requires events to be enabled explicitly.
      eventHandler.addEventToCapture("click");
      eventHandler.addEventToCapture("auxclick");
      eventHandler.addEventToCapture("contextmenu");
      frame = controller.createFrame(element, {
        plugins: [
          eventHandler,
          new utils.LinkHandlerPlugin((url) => frame.go(url instanceof URL ? url.href : String(url)))
        ]
      });
      managed.set(element, frame);
    }
    frame.go(new URL(destination).href);
    return true;
  }

  async function reload(element) {
    const frame = managed.get(element);
    if (!frame) return false;
    frame.reload();
    return true;
  }

  window.NOVABrowserEngine = Object.freeze({
    name: "NOVA Scramjet Engine",
    mode: "scramjet-wisp",
    initialize,
    isWebUrl,
    createFrame,
    navigate,
    reload
  });
})();
