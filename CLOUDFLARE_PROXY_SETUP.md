# NOVA Scramjet free deployment

This branch uses Scramjet with a Wisp WebSocket transport. Cloudflare Containers are not required.

## Free hobby deployment with Render

The repository includes a `render.yaml` Blueprint and a Dockerfile. To deploy:

1. Create a free account at https://render.com.
2. Connect the GitHub account that owns `askinissotuff/nova-browser`.
3. Open the repository's feature branch `feat/cloudflare-proxy-foundation` in Render's New Blueprint flow, or create a Web Service from that branch.
4. Select the `render.yaml` Blueprint and keep the service plan set to **Free**.
5. Wait for the first build. Render will provide an `onrender.com` URL.
6. Open that URL and test the Nova shell, then test a simple public website through the browser.

Render supports inbound WebSockets on web services. Free services sleep after 15 minutes without inbound HTTP/WebSocket activity and can take about a minute to wake. Free service outbound bandwidth and build minutes are limited. This is suitable for a hobby test, not a reliable public browser service.

## Important security and testing notes

- Do not publish an unauthenticated proxy as a public service. Add an access gate and edge-level abuse controls before sharing it.
- Wisp is a general-purpose network tunnel. Its destination restrictions must be verified against the exact installed Wisp version; frontend URL checks alone do not prevent SSRF.
- The in-process connection limits are temporary and per-instance, not a replacement for edge rate limits.
- A successful container build and health check do not prove Scramjet's controller, service worker, Libcurl transport, and Wisp versions interoperate in a real browser.
- Test with a staging URL first. Do not change production DNS or the live Nova site until browser-level tests pass.

## Current status

The feature branch contains the Scramjet/Wisp browser integration, Node server, Docker setup, and free Render Blueprint. Deployment and real-browser verification still require connecting the repository to Render and testing the generated service URL. Cloudflare Workers Paid is not needed for this Render path.
