#!/usr/bin/env node
import fs from "node:fs";
import http from "node:http";
import path from "node:path";

const mappingsPath = process.env.MAPPINGS_FILE || "/config/mappings.json";
const stateDir = process.env.PORTLESS_STATE_DIR || "/state";
const routesPath = `${stateDir}/routes.json`;
const caPath = process.env.CA_PATH || "/state/ca.pem";
const dashboardPort = Number(process.env.DASHBOARD_PORT || 9090);
const publicPort = String(process.env.PUBLIC_PORT || process.env.PROXY_PORT || 443);
const dashboardHost = (process.env.DASHBOARD_HOST || "proxy").toLowerCase();

function readMappings() {
  if (!fs.existsSync(mappingsPath)) {
    return {};
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(mappingsPath, "utf8"));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }
    return parsed;
  } catch {
    return {};
  }
}

function parsePort(target) {
  if (typeof target === "number") {
    return target;
  }
  if (typeof target === "string") {
    const m = target.match(/^(?:localhost|127\.0\.0\.1):(\d{1,5})$/i);
    if (m) {
      return Number(m[1]);
    }
  }
  throw new Error(`Invalid target: ${target}`);
}

function normalizeMappings(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("Mappings must be a JSON object.");
  }
  const out = {};
  for (const [host, target] of Object.entries(input)) {
    const key = String(host).toLowerCase().trim();
    if (!/^[a-z0-9-]+$/.test(key)) {
      throw new Error(`Invalid host key: ${host}`);
    }
    const port = parsePort(target);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      throw new Error(`Invalid port for ${host}: ${port}`);
    }
    out[key] = port;
  }
  return out;
}

function buildRoutes(mappings) {
  const routes = [];
  for (const [host, target] of Object.entries(mappings)) {
    routes.push({ hostname: `${host}.local`, port: parsePort(target), pid: 0 });
  }
  routes.push({ hostname: `${dashboardHost}.local`, port: dashboardPort, pid: 0 });
  routes.push({ hostname: "local", port: dashboardPort, pid: 0 });
  return routes;
}

function persistMappingsAndRoutes(mappings) {
  fs.mkdirSync(path.dirname(mappingsPath), { recursive: true });
  fs.writeFileSync(mappingsPath, JSON.stringify(mappings, null, 2) + "\n", "utf8");
  fs.mkdirSync(stateDir, { recursive: true });
  fs.writeFileSync(routesPath, JSON.stringify(buildRoutes(mappings), null, 2) + "\n", "utf8");
}

function htmlEscape(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderPage({ requestHost, isFallback, mappings }) {
  const title = isFallback ? "Unknown host" : "Dev Proxy";
  const subtitle = isFallback
    ? `No direct mapping found for ${requestHost}.`
    : "Reachable addresses";

  const hosts = Object.keys(mappings).filter((h) => /^[a-z0-9-]+$/.test(h)).sort();
  const rows = hosts
    .map((h) => `<li><a href="https://${h}.local:${publicPort}">https://${h}.local:${publicPort}</a></li>`)
    .join("\n");

  const mappingRows = hosts
    .map((h) => `<tr><td><input value="${h}" data-col="host" /></td><td><input value="${parsePort(mappings[h])}" data-col="port" /></td><td><button type="button" class="remove">Remove</button></td></tr>`)
    .join("\n");

  const dashboardUrl = `https://${dashboardHost}.local:${publicPort}`;
  const caUrl = `${dashboardUrl}/ca.pem`;

  return `<!doctype html><html lang="en"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><title>${htmlEscape(title)}</title><style>
    :root { color-scheme: light; }
    body { margin: 0; font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif; background: radial-gradient(circle at 20% 10%, #f2f6ff, #eef7f3 45%, #f9f5ef); color: #122; }
    main { max-width: 980px; margin: 38px auto; background: rgba(255,255,255,0.9); border: 1px solid #d8e0e8; border-radius: 16px; padding: 24px 28px; box-shadow: 0 18px 45px rgba(0,0,0,0.08); }
    h1 { margin: 0 0 8px; font-size: 2rem; } p { margin: 0 0 14px; } .warn { background: #fff6e8; border: 1px solid #f5d18f; border-radius: 10px; padding: 10px 12px; margin-bottom: 16px; }
    ul { margin: 0; padding-left: 20px; } li { margin: 8px 0; } a { color: #0d5f9f; text-decoration: none; } a:hover { text-decoration: underline; }
    code { background: #edf2f7; border-radius: 6px; padding: 2px 6px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
    h2 { margin: 24px 0 8px; font-size: 1.15rem; } h3 { margin: 16px 0 6px; font-size: 1rem; } ol { margin: 0 0 12px; padding-left: 20px; }
    .card { margin-top: 18px; padding: 14px; border: 1px solid #d8e0e8; border-radius: 10px; background: rgba(255,255,255,0.75); }
    table { width: 100%; border-collapse: collapse; } th, td { text-align: left; padding: 8px; border-bottom: 1px solid #e8edf2; }
    input { width: 100%; box-sizing: border-box; padding: 7px; } .row-actions { margin-top: 10px; display: flex; gap: 8px; }
    button { border: 1px solid #bfd0df; background: #f4f8fb; border-radius: 8px; padding: 8px 12px; cursor: pointer; }
    .save { background: #e8f5ed; border-color: #98d3ab; } .status { min-height: 20px; margin-top: 8px; color: #0b5c2b; } .status.err { color: #9b1d1d; }
  </style></head><body><main>
    <h1>${htmlEscape(title)}</h1><p>${htmlEscape(subtitle)}</p>
    ${isFallback ? `<div class="warn">Requested host: <code>${htmlEscape(requestHost)}</code></div>` : ""}
    <p>Dashboard: <a href="${dashboardUrl}">${dashboardUrl}</a></p>
    <p>Trust certificate: <a href="${caUrl}">${caUrl}</a></p>
    <ul>${rows || "<li>No mappings found.</li>"}</ul>
    <h2>Proxy Mappings</h2>
    <div class="card"><table id="mapTable"><thead><tr><th>Host</th><th>Port</th><th></th></tr></thead><tbody>${mappingRows}</tbody></table>
      <div class="row-actions"><button type="button" id="addRow">Add Mapping</button><button type="button" class="save" id="saveRows">Save</button></div>
      <div id="status" class="status"></div>
    </div>
    <h2>Trust Setup Instructions</h2>
    <div class="card"><h3>macOS</h3><ol><li>Download <code>ca.pem</code> from <a href="${caUrl}">${caUrl}</a>.</li><li>Open the file in Keychain Access (double-click or run <code>open ca.pem</code>).</li><li>Add it to the <code>login</code> keychain.</li><li>Open certificate details and set Trust to <code>Always Trust</code>.</li><li>Restart Chrome/Safari.</li></ol></div>
    <div class="card"><h3>Windows</h3><ol><li>Download <code>ca.pem</code> (rename to <code>ca.cer</code> if needed).</li><li>Open <code>certmgr.msc</code>.</li><li>Go to <code>Trusted Root Certification Authorities -> Certificates</code>.</li><li>Choose <code>All Tasks -> Import</code> and import the file.</li><li>Restart Chrome/Edge.</li></ol></div>
    <div class="card"><h3>iPhone / iPad</h3><ol><li>Download <code>ca.pem</code> in Safari.</li><li>Install the profile from <code>Settings -> General -> VPN & Device Management</code>.</li><li>Enable trust in <code>Settings -> General -> About -> Certificate Trust Settings</code>.</li><li>Reopen Safari and retry your <code>https://&lt;name&gt;.local</code> URL.</li></ol></div>
  </main>
  <script>
    const tableBody = document.querySelector("#mapTable tbody");
    const statusEl = document.getElementById("status");
    function rowHtml(host = "", port = "") {
      return '<tr><td><input value="' + host + '" data-col="host" /></td><td><input value="' + port + '" data-col="port" /></td><td><button type="button" class="remove">Remove</button></td></tr>';
    }
    document.getElementById("addRow").addEventListener("click", () => tableBody.insertAdjacentHTML("beforeend", rowHtml()));
    tableBody.addEventListener("click", (e) => { if (e.target.classList.contains("remove")) e.target.closest("tr").remove(); });
    document.getElementById("saveRows").addEventListener("click", async () => {
      const mappings = {};
      for (const tr of [...tableBody.querySelectorAll("tr")]) {
        const host = tr.querySelector('input[data-col="host"]').value.trim().toLowerCase();
        const portRaw = tr.querySelector('input[data-col="port"]').value.trim();
        if (!host && !portRaw) continue;
        mappings[host] = Number(portRaw);
      }
      statusEl.textContent = "Saving...";
      statusEl.classList.remove("err");
      try {
        const res = await fetch("/api/mappings", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ mappings }) });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Save failed");
        statusEl.textContent = "Saved. Routes updated.";
        setTimeout(() => location.reload(), 500);
      } catch (err) {
        statusEl.textContent = err.message;
        statusEl.classList.add("err");
      }
    });
  </script>
</body></html>`;
}

function sendJson(res, code, payload) {
  res.statusCode = code;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

const server = http.createServer((req, res) => {
  const path = (req.url || "").split("?")[0];

  if (path === "/ca.pem") {
    if (!fs.existsSync(caPath)) {
      res.statusCode = 404;
      res.setHeader("content-type", "text/plain; charset=utf-8");
      res.end("CA certificate not found\n");
      return;
    }
    res.statusCode = 200;
    res.setHeader("content-type", "application/x-pem-file");
    res.setHeader("content-disposition", "attachment; filename=devproxy-ca.pem");
    fs.createReadStream(caPath).pipe(res);
    return;
  }

  if (path === "/api/mappings" && req.method === "GET") {
    sendJson(res, 200, { mappings: readMappings() });
    return;
  }

  if (path === "/api/mappings" && req.method === "POST") {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) req.destroy();
    });
    req.on("end", () => {
      try {
        const payload = JSON.parse(body || "{}");
        const mappings = normalizeMappings(payload.mappings || {});
        persistMappingsAndRoutes(mappings);
        sendJson(res, 200, { ok: true, mappings });
      } catch (error) {
        sendJson(res, 400, { ok: false, error: error.message || "Invalid request" });
      }
    });
    return;
  }

  const hostHeader = req.headers["x-forwarded-host"] || req.headers["x-original-host"] || req.headers.host || "";
  const requestHost = hostHeader.split(":")[0].toLowerCase();
  const dashboardFqdn = `${dashboardHost}.local`;
  const isFallback = requestHost !== dashboardFqdn;
  const html = renderPage({ requestHost, isFallback, mappings: readMappings() });
  res.statusCode = isFallback ? 404 : 200;
  res.setHeader("content-type", "text/html; charset=utf-8");
  res.end(html);
});

server.listen(dashboardPort, "127.0.0.1", () => {
  console.log(`Dashboard server listening on 127.0.0.1:${dashboardPort}`);
});
