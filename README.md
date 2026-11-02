# NOVA Browser

NOVA is a responsive web workspace with internal tabs, in-page navigation, search, bookmarks, history, theme settings, and an offline app shell.

## Features
- Responsive desktop and mobile layout
- Internal tabs with close and new-tab controls
- Address bar, search, back, forward, reload, and home
- Local bookmarks and browsing history
- Dark and light appearance modes
- Keyboard shortcuts: Ctrl/Cmd+L, Ctrl/Cmd+T, Ctrl/Cmd+W
- Installable web-app manifest and offline shell caching
- Embedded pages run in a sandbox that does not grant pop-ups or top-level navigation

## Architecture

NOVA is deployed as a static web application on Cloudflare. Its browser experience is split into three practical layers:

1. **Frontend (index.html)** — owns tab state, the address bar, history, bookmarks, and the visible interface.
2. **In-page browser engine (browser-engine.js)** — validates standard HTTP(S) destinations, creates sandboxed iframes, and handles in-page navigation.
3. **Cloudflare edge delivery** — serves the frontend, engine module, manifest, icon, and offline service-worker shell.

This replaces the proposed Node.js/Express proxy server for the current deployment. The browser engine uses direct iframe loading; it does not rewrite URLs, proxy remote requests, strip remote security headers, or bypass network access controls. A destination that disallows embedding may still show a blank frame or an in-app compatibility notice.

## Run locally
Open `index.html` in a modern browser. Use a local HTTP server to enable service-worker and install features.

## Deploy
Static Cloudflare Pages project:
- Framework preset: None
- Build command: empty
- Build output directory: `/`
- Production branch: `main`

## Browser limitations
NOVA is a web app, not a standalone browser engine. External sites are displayed in a sandboxed iframe. Some sites prohibit iframe embedding or require browser-level capabilities that an embedded page cannot provide. NOVA keeps navigation within its own page and displays an in-page explanation when an embedded destination cannot be displayed.

The app does not alter the access permissions of the network or destination websites.

Bookmarks, history, appearance, and open tabs are saved in the current browser's local storage and do not sync between devices.

## Files
- `index.html` — app interface and tab behavior
- `browser-engine.js` — safe in-page iframe navigation adapter
- `manifest.webmanifest` — install metadata
- `sw.js` — offline shell caching
- `icon.svg` — app icon
- `_headers` — security response headers
