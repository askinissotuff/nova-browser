/* NOVA in-page browser engine.
 * This module intentionally supports ordinary HTTP(S) iframe navigation only.
 * It does not proxy, rewrite, or fetch third-party website traffic.
 */
(function () {
  'use strict';

  function isWebUrl(value) {
    try {
      const url = new URL(String(value), window.location.href);
      return (url.protocol === 'http:' || url.protocol === 'https:') &&
        !['localhost', '127.0.0.1', '::1'].includes(url.hostname);
    } catch {
      return false;
    }
  }

  function createFrame(tabId, onLoad) {
    const frame = document.createElement('iframe');
    frame.className = 'frame';
    frame.dataset.tab = String(tabId);
    frame.title = 'NOVA embedded website';
    frame.referrerPolicy = 'no-referrer';
    frame.setAttribute('sandbox', 'allow-forms allow-scripts');
    frame.setAttribute('allow', '');
    if (typeof onLoad === 'function') frame.addEventListener('load', onLoad);
    return frame;
  }

  function navigate(frame, destination) {
    if (!(frame instanceof HTMLIFrameElement) || !isWebUrl(destination)) {
      return false;
    }
    frame.src = new URL(destination, window.location.href).href;
    return true;
  }

  window.NOVABrowserEngine = Object.freeze({
    name: 'NOVA Embedded Engine',
    mode: 'direct-iframe',
    isWebUrl,
    createFrame,
    navigate
  });
})();
