#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const mappingsPath = process.env.MAPPINGS_FILE || "/config/mappings.json";
const stateDir = process.env.PORTLESS_STATE_DIR || "/state";
const routesPath = `${stateDir}/routes.json`;
const publicScheme = (process.env.PUBLIC_SCHEME || "https").trim().toLowerCase();
const publicPort = (process.env.PUBLIC_PORT || process.env.PROXY_PORT || "443").trim();
const dashboardPort = Number(process.env.DASHBOARD_PORT || 9090);
const dashboardHost = (process.env.DASHBOARD_HOST || "proxy").trim().toLowerCase();

function fail(message) {
  console.error(message);
  process.exit(1);
}

if (!fs.existsSync(mappingsPath)) {
  fs.mkdirSync(path.dirname(mappingsPath), { recursive: true });
  fs.writeFileSync(mappingsPath, "{}\n", "utf8");
}

let raw;
try {
  raw = fs.readFileSync(mappingsPath, "utf8");
} catch (error) {
  fail(`Failed to read mappings file: ${error.message}`);
}

let mappings;
try {
  mappings = JSON.parse(raw);
} catch (error) {
  fail(`Invalid JSON in mappings file: ${error.message}`);
}

if (!mappings || typeof mappings !== "object" || Array.isArray(mappings)) {
  fail("Mappings file must be a JSON object: { \"host\": \"localhost:4200\" }");
}

fs.mkdirSync(stateDir, { recursive: true });

const routes = [];

for (const [host, target] of Object.entries(mappings)) {
  if (!/^[a-z0-9-]+$/i.test(host)) {
    fail(
      `Invalid host key \"${host}\". Use a single hostname label with letters, numbers, and hyphens only.`
    );
  }

  let port;
  if (typeof target === "number") {
    port = target;
  } else if (typeof target === "string") {
    const match = target.match(/^(?:localhost|127\.0\.0\.1):(\d{1,5})$/i);
    if (!match) {
      fail(
        `Invalid target for ${host}: \"${target}\". Use localhost:<port> or 127.0.0.1:<port>.`
      );
    }
    port = Number(match[1]);
  } else {
    fail(`Invalid target type for ${host}. Use a port number or localhost:<port>.`);
  }

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    fail(`Invalid port for ${host}: ${port}`);
  }

  routes.push({ hostname: `${host}.local`, port, pid: 0 });
  routes.push({ hostname: `${host}.localhost`, port, pid: 0 });
}

if (!/^[a-z0-9-]+$/.test(dashboardHost)) {
  fail(`Invalid DASHBOARD_HOST \"${dashboardHost}\". Use letters, numbers, and hyphens only.`);
}

if (!Number.isInteger(dashboardPort) || dashboardPort < 1 || dashboardPort > 65535) {
  fail(`Invalid DASHBOARD_PORT: ${dashboardPort}`);
}

routes.push({ hostname: `${dashboardHost}.local`, port: dashboardPort, pid: 0 });
routes.push({ hostname: `${dashboardHost}.localhost`, port: dashboardPort, pid: 0 });
// Wildcard fallback for unknown *.local and *.localhost hosts when --wildcard is enabled.
routes.push({ hostname: "local", port: dashboardPort, pid: 0 });
routes.push({ hostname: "localhost", port: dashboardPort, pid: 0 });

try {
  fs.writeFileSync(routesPath, JSON.stringify(routes, null, 2) + "\n", "utf8");
} catch (error) {
  fail(`Failed to write ${routesPath}: ${error.message}`);
}

console.log(`Synced ${routes.length} host mapping(s) from ${mappingsPath} to ${routesPath}`);
if (routes.length > 0) {
  const hidePort =
    (publicScheme === "https" && publicPort === "443") ||
    (publicScheme === "http" && publicPort === "80");
  const publicPortSuffix = hidePort ? "" : `:${publicPort}`;

  console.log("Reachable URLs:");
  for (const route of routes) {
    if (route.hostname === "local" || route.hostname === "localhost") {
      continue;
    }
    console.log(`  ${publicScheme}://${route.hostname}${publicPortSuffix}`);
  }
}
