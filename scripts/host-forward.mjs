#!/usr/bin/env node
import fs from "node:fs";
import net from "node:net";

const mappingsPath = process.env.MAPPINGS_FILE || "/config/mappings.json";
const targetHost = process.env.HOST_GATEWAY_NAME || "host.docker.internal";

function fail(message) {
  console.error(message);
  process.exit(1);
}

if (!fs.existsSync(mappingsPath)) {
  fail(`Mappings file not found: ${mappingsPath}`);
}

function resolvePort(target) {
  if (typeof target === "number") {
    return target;
  }

  if (typeof target === "string") {
    const match = target.match(/^(?:localhost|127\.0\.0\.1):(\d{1,5})$/i);
    if (match) {
      return Number(match[1]);
    }
  }

  throw new Error(`Unsupported mapping target: ${target}`);
}

function readMappings() {
  try {
    const mappings = JSON.parse(fs.readFileSync(mappingsPath, "utf8"));
    if (!mappings || typeof mappings !== "object" || Array.isArray(mappings)) {
      return {};
    }
    return mappings;
  } catch {
    return {};
  }
}

const servers = new Map();

function startServer(port) {
  if (servers.has(port)) {
    return;
  }

  const server = net.createServer((clientSocket) => {
    const upstreamSocket = net.connect({ host: targetHost, port }, () => {
      clientSocket.pipe(upstreamSocket);
      upstreamSocket.pipe(clientSocket);
    });

    const closeBoth = () => {
      clientSocket.destroy();
      upstreamSocket.destroy();
    };

    upstreamSocket.on("error", closeBoth);
    clientSocket.on("error", closeBoth);
    upstreamSocket.on("close", () => clientSocket.end());
    clientSocket.on("close", () => upstreamSocket.end());
  });

  server.listen(port, "127.0.0.1", () => {
    console.log(`Forwarding 127.0.0.1:${port} -> ${targetHost}:${port}`);
  });

  server.on("error", (error) => {
    console.error(`Failed to bind forwarder on 127.0.0.1:${port}: ${error.message}`);
    process.exitCode = 1;
  });

  servers.set(port, server);
}

function stopServer(port) {
  const server = servers.get(port);
  if (!server) {
    return;
  }
  server.close();
  servers.delete(port);
  console.log(`Stopped forwarding 127.0.0.1:${port}`);
}

function reconcile() {
  const mappings = readMappings();
  const wanted = new Set();
  for (const target of Object.values(mappings)) {
    try {
      wanted.add(resolvePort(target));
    } catch {
      // Ignore invalid entries until corrected.
    }
  }

  for (const port of [...servers.keys()]) {
    if (!wanted.has(port)) {
      stopServer(port);
    }
  }

  for (const port of [...wanted].sort((a, b) => a - b)) {
    startServer(port);
  }
}

reconcile();
fs.watchFile(mappingsPath, { interval: 1000 }, reconcile);

const shutdown = () => {
  fs.unwatchFile(mappingsPath, reconcile);
  for (const server of servers.values()) {
    server.close();
  }
  process.exit(process.exitCode ?? 0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
