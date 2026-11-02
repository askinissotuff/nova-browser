# NOVA Cloudflare proxy deployment

This branch adds a first deployment scaffold using a Cloudflare Worker and Cloudflare Container.

## Architecture
- The Worker routes requests to one named Container instance.
- The Container runs the Node.js web server, Scramjet assets, and Wisp WebSocket endpoint.
- The app shell and proxy share one origin so the proxy service worker can use root scope.

## Before deployment
1. Confirm Cloudflare Containers and Container-enabled Durable Objects are available on your account.
2. Install Node.js 22 and Docker locally.
3. Run `npm install` at the repository root.
4. Run `npx wrangler login`, then `npx wrangler deploy`.
5. After the image provisions, test `/health`, the app shell, Scramjet assets, and the `/wisp/` WebSocket upgrade.
6. Only then attach the production hostname. This Worker serves the app shell and proxy together; switch the Pages route only when ready.

## Security and launch checklist
The proxy can act as an open web gateway. Before public launch, implement per-session and per-IP rate limits, connection caps, timeouts, monitoring, and an acceptable-use policy. Do not log full URLs, cookies, authorization headers, or page contents. Validate target URLs and block private, loopback, link-local, and metadata-service destinations to prevent SSRF.

## Important
A static Pages site alone cannot host this Node.js/WebSocket proxy. This scaffold is not yet a finished browser integration: Nova's current direct-iframe engine still needs to be wired to Scramjet's client/controller API, and package/API compatibility plus production security must be verified with a local build and smoke tests before deployment.
