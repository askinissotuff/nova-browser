import http from "node:http";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import express from "express";
import { isIP } from "node:net";
import { scramjetPath } from "@mercuryworkshop/scramjet/path";
import { server as wisp } from "@mercuryworkshop/wisp-js/server";

const require = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));
const resolveDir = (id) => path.dirname(require.resolve(id));
const app = express();
app.disable("x-powered-by");

// Wisp is a raw TCP tunnel, so enforce destination restrictions at the
// transport layer rather than relying on the browser-side URL validator.
Object.assign(wisp.options, {
  allow_private_ips: false,
  allow_loopback_ips: false,
  allow_direct_ip: false,
  allow_udp_streams: false,
  allow_tcp_streams: true,
  stream_limit_total: 64,
  stream_limit_per_host: -1,
  port_whitelist: [80, 443],
  hostname_blacklist: [/^(?:localhost|metadata|metadata\.google\.internal|instance-data)(?:\.|$)/i, /(?:^|\.)(?:localhost|local|internal)$/i],
  parse_real_ip: true
});

app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=(), usb=()");
  res.setHeader("Content-Security-Policy", "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval' https: blob:; style-src 'self' 'unsafe-inline' https:; img-src 'self' data: https: blob:; media-src 'self' data: https: blob:; font-src 'self' data: https:; connect-src 'self' https: ws: wss:; frame-src 'self' https: blob:; worker-src 'self' blob: https:; object-src 'none'; base-uri 'self'; form-action 'self' https:; frame-ancestors 'none'");
  next();
});

app.get("/health", (_req, res) => res.json({ ok: true, service: "nova-proxy" }));
app.use("/scram/", express.static(scramjetPath, { fallthrough: false }));
app.use("/utils/", express.static(resolveDir("@mercuryworkshop/scramjet-utils"), { fallthrough: false }));
app.use("/controller/", express.static(resolveDir("@mercuryworkshop/scramjet-controller"), { fallthrough: false }));
app.use("/libcurl/", express.static(resolveDir("@mercuryworkshop/libcurl-transport"), { fallthrough: false }));
app.use(express.static(path.join(here, "public"), { index: "index.html" }));

const server = http.createServer(app);
const connectionCounts = new Map();
const connectionWindows = new Map();
const WINDOW_MS = 60_000;
const MAX_CONNECTIONS_PER_IP = 16;
const MAX_NEW_CONNECTIONS_PER_WINDOW = 80;
const MAX_TOTAL_CONNECTIONS = 250;
let totalConnections = 0;

function rejectUpgrade(socket, status = "403 Forbidden") {
  socket.write(`HTTP/1.1 ${status}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`);
  socket.destroy();
}

server.on("upgrade", (req, socket, head) => {
  let origin;
  try {
    origin = new URL(req.headers.origin ?? "");
  } catch {
    rejectUpgrade(socket);
    return;
  }

  // Only accept browser WebSocket upgrades originating from this app origin.
  let expectedProtocol = req.socket.encrypted ? "https:" : "http:";
  // Render and Cloudflare terminate TLS at the edge before forwarding HTTP.
  const forwardedProto = String(req.headers["x-forwarded-proto"] ?? "").split(",")[0].trim();
  if (forwardedProto === "https" || forwardedProto === "http") expectedProtocol = forwardedProto + ":";
  try {
    const edgeInfo = JSON.parse(String(req.headers["cf-visitor"] ?? "{}"));
    if (edgeInfo.scheme === "https" || edgeInfo.scheme === "http") expectedProtocol = edgeInfo.scheme + ":";
  } catch { /* local/non-edge request: use the socket or forwarded scheme */ }
  let pathname;
  try {
    pathname = new URL(req.url ?? "/", "http://localhost").pathname;
  } catch {
    rejectUpgrade(socket);
    return;
  }
  if (
    origin.host !== req.headers.host ||
    origin.protocol !== expectedProtocol ||
    origin.username ||
    origin.password ||
    pathname !== "/wisp/"
  ) {
    rejectUpgrade(socket);
    return;
  }

  // Prefer Cloudflare's edge-provided client address. Render deployments
  // without Cloudflare use the first valid address in Render's forwarded chain.
  // Validate both headers as IP literals before using them as rate-limit keys.
  const cfIp = req.headers["cf-connecting-ip"];
  const forwarded = req.headers["x-forwarded-for"];
  const forwardedIp = typeof cfIp === "string" && isIP(cfIp.trim())
    ? cfIp.trim()
    : typeof forwarded === "string"
      ? forwarded.split(",").map((value) => value.trim()).find((value) => isIP(value))
      : undefined;
  const ip = forwardedIp || req.socket.remoteAddress || "unknown";
  const now = Date.now();

  for (const [key, window] of connectionWindows) {
    if (now - window.startedAt >= WINDOW_MS) connectionWindows.delete(key);
  }
  if (connectionWindows.size > 10_000) {
    rejectUpgrade(socket, "503 Service Unavailable");
    return;
  }

  const window = connectionWindows.get(ip) ?? { startedAt: now, count: 0 };
  if (now - window.startedAt >= WINDOW_MS) {
    window.startedAt = now;
    window.count = 0;
  }
  window.count += 1;
  connectionWindows.set(ip, window);

  const active = connectionCounts.get(ip) ?? 0;
  if (
    window.count > MAX_NEW_CONNECTIONS_PER_WINDOW ||
    active >= MAX_CONNECTIONS_PER_IP ||
    totalConnections >= MAX_TOTAL_CONNECTIONS
  ) {
    rejectUpgrade(socket, "429 Too Many Requests");
    return;
  }

  connectionCounts.set(ip, active + 1);
  totalConnections += 1;
  socket.once("close", () => {
    totalConnections = Math.max(0, totalConnections - 1);
    const remaining = (connectionCounts.get(ip) ?? 1) - 1;
    if (remaining > 0) connectionCounts.set(ip, remaining);
    else connectionCounts.delete(ip);
  });

  try {
    // Wisp expects the normalized endpoint path, not the full client URL.
    req.url = "/wisp/";
    wisp.routeRequest(req, socket, head);
  } catch {
    socket.destroy();
  }
});

const port = Number(process.env.PORT || 8080);
server.listen(port, "0.0.0.0", () => console.log(`NOVA proxy listening on ${port}`));
