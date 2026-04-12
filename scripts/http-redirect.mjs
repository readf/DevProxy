#!/usr/bin/env node
import http from "node:http";

const redirectPort = Number(process.env.PUBLIC_PORT || process.env.PROXY_PORT || 8443);

const server = http.createServer((req, res) => {
  const host = req.headers.host || "localhost";
  const normalizedHost = host.replace(/:\d+$/, "");
  const location = `https://${normalizedHost}:${redirectPort}${req.url || "/"}`;

  res.statusCode = 308;
  res.setHeader("Location", location);
  res.end(`Redirecting to ${location}\n`);
});

server.listen(80, "0.0.0.0", () => {
  console.log(`HTTP redirect listening on port 80 -> HTTPS ${redirectPort}`);
});
