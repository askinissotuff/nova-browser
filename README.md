# NOVA Browser

NOVA is a responsive, browser-style web workspace with internal tabs, an address/search bar, back and forward navigation, bookmarks, browsing history, quick links, and a mobile-friendly dark interface.

## Run locally

Open `index.html` in a modern browser. No build step, API key, or server process is required.

## Deploy

The project is a static site and can be hosted on Cloudflare Pages:
- Framework preset: None
- Build command: leave empty
- Build output directory: `/`
- Production branch: `main`

Connect `askinissotuff/nova-browser` to Cloudflare Pages to enable automatic production deploys from pushes to `main` and preview deployments from branches or pull requests.

## Important browser limitations

NOVA is a browser-style web application, not a standalone browser engine. It uses an embedded iframe for destinations that permit embedding. Many sites deliberately send browser security headers that prevent iframe display; those sites cannot be made to work inside this app without changing their security settings. NOVA does not include a proxy or a network-restriction bypass.

Bookmarks and browsing history are stored locally in the browser using localStorage. They are not synced between devices.

## Project

- `index.html` — application UI and client-side behavior
- `_headers` — security headers for static hosting
