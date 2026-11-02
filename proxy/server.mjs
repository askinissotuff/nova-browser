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

app.get("/health", (_req, res) => res.json({ ok: true, service: "nova-proxy" }));
app.use("/scram/", express.static(scramjetPath, { fallthrough: false }));
app.use("/utils/", express.static(resolveDir("@mercuryworkshop/scramjet-utils"), { fallthrough: false }));
app.use("/controller/", express.static(resolveDir("@mercuryworkshop/scramjet-controller"), { fallthrough: false }));
app.use("/libcurl/", express.static(resolveDir("@mercuryworkshop/libcurl-transport"), { fallthrough: false }));
app.use(express.static(path.join(here, "public"), { index: "index.html" }));

const server = http.createServer(app);
server.on("upgrade", (req, socket, head) => {
  if (new URL(req.url ?? "/", "http://localhost").pathname === "/wisp/") {
    wisp.routeRequest(req, socket, head);
  } else socket.destroy();
});
const port = Number(process.env.PORT || 8080);
server.listen(port, "0.0.0.0", () => console.log(`NOVA proxy listening on ${port}`));
