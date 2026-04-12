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

let mappings;
try {
  mappings = JSON.parse(fs.readFileSync(mappingsPath, "utf8"));
} catch (error) {
  fail(`Failed to parse mappings file: ${error.message}`);
}

if (!mappings || typeof mappings !== "object" || Array.isArray(mappings)) {
  fail("Mappings file must be a JSON object.");
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

const uniquePorts = [...new Set(Object.values(mappings).map(resolvePort))].sort((a, b) => a - b);
const servers = [];

for (const port of uniquePorts) {
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

  servers.push(server);
}

const shutdown = () => {
  for (const server of servers) {
    server.close();
  }
  process.exit(process.exitCode ?? 0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
