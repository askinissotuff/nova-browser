# NOVA Cloudflare proxy deployment

This branch adds a first deployment scaffold using a Cloudflare Worker and Cloudflare Container.

## Architecture
- The Worker routes requests to one named Container instance.
- The Container runs the Node.js web server, Scramjet assets, and Wisp WebSocket endpoint.
- The app shell and proxy share one origin so the proxy service worker can use root scope.

## Before deployment
1. **Cloudflare Workers Paid is required for Containers.** The connected Cloudflare account currently returns an authorization error stating that Containers require the Workers Paid plan. Upgrade the account and reconnect/reauthorize Cloudflare before attempting a deployment. Do not deploy this Worker to the production account until a separate staging target is configured.
2. Install Node.js 22 and Docker locally.
3. Run `npm install` at the repository root.
4. Run `npx wrangler login`, then `npx wrangler deploy`.
5. After the image provisions, test `/health`, the app shell, Scramjet assets, and the `/wisp/` WebSocket upgrade.
6. Only then attach the production hostname. This Worker serves the app shell and proxy together; switch the Pages route only when ready.

## Security and launch checklist
The proxy can act as an open web gateway. Before public launch, put the proxy behind Cloudflare Access or an equivalent authenticated session gate; the current same-origin check is not authentication. Add edge-level WAF rate limits (the in-process limits are per-container-instance and reset on restarts), connection caps, timeouts, monitoring, and an acceptable-use policy. Do not log full URLs, cookies, authorization headers, or page contents. Validate target URLs and block private, loopback, link-local, and metadata-service destinations to prevent SSRF.

## Current validation status
The feature branch CI validates the Wrangler Worker bundle, browser/server JavaScript syntax, Docker image build, container health endpoint, required Scramjet static assets, and rejection of a cross-origin Wisp WebSocket upgrade. These checks do not yet prove a real browser can navigate websites through Scramjet/Wisp. A staging deployment and browser-level end-to-end test are still required. The current Cloudflare account cannot provision Containers until its Workers Paid plan requirement is met.

## Important
A static Pages site alone cannot host this Node.js/WebSocket proxy. This scaffold is not yet a finished browser integration: Nova's current direct-iframe engine still needs to be wired to Scramjet's client/controller API, and package/API compatibility plus production security must be verified with a local build and smoke tests before deployment.
