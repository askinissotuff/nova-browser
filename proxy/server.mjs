import http from "node:http";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import express from "express";
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
  stream_limit_total: 24,
  stream_limit_per_host: 6,
  port_whitelist: [80, 443],
  hostname_blacklist: [/^(?:localhost|metadata|metadata\.google\.internal|instance-data)(?:\.|$)/i, /(?:^|\.)(?:localhost|local|internal)$/i],
  parse_real_ip: false
});

app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer");
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
const MAX_CONNECTIONS_PER_IP = 6;
const MAX_NEW_CONNECTIONS_PER_WINDOW = 20;
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
  // The Worker terminates TLS before forwarding HTTP to the container.
  try {
    const edgeInfo = JSON.parse(String(req.headers["cf-visitor"] ?? "{}"));
    if (edgeInfo.scheme === "https" || edgeInfo.scheme === "http") expectedProtocol = edgeInfo.scheme + ":";
  } catch { /* local/non-Cloudflare request: use the socket scheme */ }
  if (
    origin.host !== req.headers.host ||
    origin.protocol !== expectedProtocol ||
    origin.username ||
    origin.password ||
    new URL(req.url ?? "/", "http://localhost").pathname !== "/wisp/"
  ) {
    rejectUpgrade(socket);
    return;
  }

  // Cloudflare supplies CF-Connecting-IP at the edge. Fall back to the
  // immediate peer for local development; never trust X-Forwarded-For here.
  const forwardedIp = req.headers["cf-connecting-ip"];
  const ip = (typeof forwardedIp === "string" && forwardedIp.length <= 64
    ? forwardedIp
    : req.socket.remoteAddress) || "unknown";
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
    const remaining = (connectionCounts.get(ip) ?? 1) - 1;
    if (remaining > 0) connectionCounts.set(ip, remaining);
    else connectionCounts.delete(ip);
  });

  try {
    wisp.routeRequest(req, socket, head);
  } catch {
    socket.destroy();
  }
});

const port = Number(process.env.PORT || 8080);
server.listen(port, "0.0.0.0", () => console.log(`NOVA proxy listening on ${port}`));
