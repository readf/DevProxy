#!/usr/bin/env node
import fs from "node:fs";
import http from "node:http";
import path from "node:path";

const mappingsPath = process.env.MAPPINGS_FILE || "/config/mappings.json";
const stateDir = process.env.PORTLESS_STATE_DIR || "/state";
const routesPath = `${stateDir}/routes.json`;
const caPath = process.env.CA_PATH || "/state/ca.pem";
const dashboardPort = Number(process.env.DASHBOARD_PORT || 9090);
const publicScheme = (process.env.PUBLIC_SCHEME || "https").trim().toLowerCase();
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
    if (!/^[a-z0-9-]+(\.[a-z0-9-]+)*$/.test(key)) {
      throw new Error(`Invalid host key: ${host}`);
    }
    const port = parsePort(target);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      throw new Error(`Invalid port for ${host}: ${port}`);
    }
    const reservedPorts = new Set([80, Number(publicPort), dashboardPort].filter(Number.isFinite));
    if (reservedPorts.has(port)) {
      throw new Error(
        `Port ${port} is reserved by DevProxy (used for the proxy, HTTP redirect, or dashboard). Choose a different port for "${host}".`
      );
    }
    out[key] = port;
  }
  return out;
}

function buildRoutes(mappings) {
  const routes = [];
  for (const [host, target] of Object.entries(mappings)) {
    routes.push({ hostname: `${host}.local`, port: parsePort(target), pid: 0 });
    routes.push({ hostname: `${host}.localhost`, port: parsePort(target), pid: 0 });
  }
  routes.push({ hostname: `${dashboardHost}.local`, port: dashboardPort, pid: 0 });
  routes.push({ hostname: `${dashboardHost}.localhost`, port: dashboardPort, pid: 0 });
  routes.push({ hostname: "local", port: dashboardPort, pid: 0 });
  routes.push({ hostname: "localhost", port: dashboardPort, pid: 0 });
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
    : "Securely route friendly .local hostnames to apps running on localhost ports.";

  const hidePort =
    (publicScheme === "https" && publicPort === "443") ||
    (publicScheme === "http" && publicPort === "80");
  const publicPortSuffix = hidePort ? "" : `:${publicPort}`;

  const hosts = Object.keys(mappings).filter((h) => /^[a-z0-9-]+(\.[a-z0-9-]+)*$/.test(h)).sort();
  const grouped = {};
  for (const h of hosts) {
    const key = h.includes(".") ? h.split(".").pop() : "";
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(h);
  }
  const rows = Object.entries(grouped)
    .sort(([a], [b]) => {
      if (a === "") return 1;
      if (b === "") return -1;
      return a.localeCompare(b);
    })
    .map(([sld, groupHosts]) => {
      const label = sld === "" ? "General" : sld;
      const items = groupHosts
        .map((h) => `<li><a href="${publicScheme}://${h}.local${publicPortSuffix}" target="_blank" rel="noopener noreferrer">${publicScheme}://${h}.local${publicPortSuffix}</a></li>`)
        .join("\n");
      return `<li class="link-group"><strong>${htmlEscape(label)}</strong><ul class="link-list">${items}</ul></li>`;
    })
    .join("\n");

  const hasSubdomains = hosts.some((h) => h.includes("."));
  const subdomainWarning = hasSubdomains
    ? `<p class="warn-soft">⚠️ You have subdomain-style hostnames (e.g. <code>app.project.local</code>). These resolve correctly on macOS and iOS, but Windows and Linux clients typically cannot resolve multi-level <code>.local</code> names via mDNS.</p>`
    : "";
  const mappingGrouped = {};
  for (const h of hosts) {
    const key = h.includes(".") ? h.split(".").pop() : "";
    if (!mappingGrouped[key]) mappingGrouped[key] = [];
    mappingGrouped[key].push(h);
  }
  const mappingRows = Object.entries(mappingGrouped)
    .sort(([a], [b]) => {
      if (a === "") return 1;
      if (b === "") return -1;
      return a.localeCompare(b);
    })
    .map(([sld, groupHosts]) => {
      const label = sld === "" ? "General" : sld;
      const headerRow = `<tr class="group-header-row"><td colspan="3">${htmlEscape(label)}</td></tr>`;
      const dataRows = groupHosts
        .map((h) => `<tr><td><input type="text" value="${h}" data-col="host" spellcheck="false" /></td><td><input type="number" value="${parsePort(mappings[h])}" data-col="port" min="1" max="65535" inputmode="numeric" /></td><td><button type="button" class="remove">Remove</button></td></tr>`)
        .join("\n");
      return headerRow + "\n" + dataRows;
    })
    .join("\n");

  const dashboardUrl = `${publicScheme}://${dashboardHost}.local${publicPortSuffix}`;
  const caUrl = `${dashboardUrl}/ca.pem`;

  return `<!doctype html><html lang="en"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><title>${htmlEscape(title)}</title><style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    :root { color-scheme: light; --primary: #1f2937; --accent: #3b82f6; --accent-light: #dbeafe; --success: #10b981; --warning: #f59e0b; --error: #ef4444; --border: #e5e7eb; --bg-light: #f9fafb; }
    html { scroll-behavior: smooth; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Helvetica Neue', sans-serif; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); min-height: 100vh; padding: 20px; color: var(--primary); }
    main { max-width: 1000px; margin: 0 auto; background: white; border-radius: 20px; box-shadow: 0 20px 60px rgba(0,0,0,0.15); overflow: hidden; }
    header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 30px; color: #f8fbff; }
    header h1 { font-size: 2.2rem; font-weight: 700; margin-bottom: 8px; color: #ffffff; text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2); }
    header p { font-size: 1.05rem; opacity: 0.98; color: #ecf2ff; text-shadow: 0 1px 1px rgba(0, 0, 0, 0.16); }
    .content { padding: 30px; }
    section { margin-bottom: 32px; }
    section:last-child { margin-bottom: 0; }
    h2 { font-size: 1.4rem; font-weight: 600; color: var(--primary); margin-bottom: 16px; display: flex; align-items: center; gap: 10px; }
    h2::before { content: ""; display: inline-block; width: 4px; height: 24px; background: linear-gradient(135deg, #667eea, #764ba2); border-radius: 2px; }
    h3 { font-size: 1.1rem; font-weight: 600; color: var(--primary); margin: 16px 0 8px; }
    p { line-height: 1.6; margin-bottom: 12px; color: #4b5563; }
    a { color: var(--accent); text-decoration: none; font-weight: 500; transition: all 0.3s; }
    a:hover { color: #2563eb; text-decoration: underline; }
    code { background: #eef2ff; border: 1px solid #dbe4ff; padding: 1px 6px; border-radius: 6px; font-family: 'Monaco', 'Courier New', monospace; font-size: 0.86em; color: #2b3553; }
    .warn { background: #fef3c7; border-left: 4px solid var(--warning); padding: 12px 16px; border-radius: 8px; margin-bottom: 20px; }
    .warn strong { color: #92400e; }
    .warn-soft { background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 10px 14px; margin-top: 12px; font-size: 0.9rem; color: #78350f; }
    .info-box { background: var(--bg-light); border: 1px solid var(--border); border-radius: 12px; padding: 16px; margin-bottom: 16px; }
    .info-box strong { color: var(--primary); }
    ul { margin-left: 20px; }
    li { margin-bottom: 8px; line-height: 1.6; }
    ol { margin-left: 20px; }
    ol li { margin-bottom: 10px; }
    .link-list { list-style: none; margin: 0; }
    .link-list li { margin-bottom: 10px; }
    .link-list a { display: inline-flex; align-items: center; gap: 8px; padding: 10px 12px; background: var(--accent-light); border-radius: 8px; transition: background 0.3s; }
    .link-list a:hover { background: var(--accent); color: white; }
    .link-groups { list-style: none; margin: 0; }
    .link-group { margin-bottom: 16px; }
    .link-group > strong { display: block; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.06em; color: #6b7280; margin-bottom: 6px; }
    .link-group .link-list { margin-left: 0; }
    table { width: 100%; border-collapse: collapse; margin: 16px 0; }
    thead { background: var(--bg-light); border-bottom: 2px solid var(--border); }
    th { padding: 14px; text-align: left; font-weight: 600; color: var(--primary); font-size: 0.95rem; }
    td { padding: 14px; border-bottom: 1px solid var(--border); }
    tbody tr { transition: background 0.2s; }
    tbody tr:hover { background: var(--bg-light); }
    input[type="text"], input[type="number"] { width: 100%; height: 40px; padding: 8px 12px; border: 1px solid #cfd8e3; border-radius: 10px; background: #fbfdff; color: #1f2937; font-size: 0.95rem; font-weight: 500; transition: border-color 0.2s ease, box-shadow 0.2s ease, background 0.2s ease; }
    input[type="text"]::placeholder, input[type="number"]::placeholder { color: #94a3b8; }
    input[type="text"]:hover, input[type="number"]:hover { background: #ffffff; border-color: #b7c4d6; }
    input[type="text"]:focus, input[type="number"]:focus { outline: none; background: #ffffff; border-color: #6388ff; box-shadow: 0 0 0 3px rgba(99, 136, 255, 0.18); }
    .row-actions { display: flex; gap: 10px; margin-top: 16px; flex-wrap: wrap; }
    button { padding: 10px 16px; border: none; border-radius: 8px; font-size: 0.95rem; font-weight: 500; cursor: pointer; transition: all 0.3s; display: inline-flex; align-items: center; gap: 6px; }
    button:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
    button:active { transform: translateY(0); }
    #addRow { background: var(--bg-light); color: var(--primary); border: 1px solid var(--border); }
    #addRow:hover { background: var(--accent-light); border-color: var(--accent); }
    #saveRows { background: var(--success); color: white; }
    #saveRows:hover { background: #059669; }
    .remove { background: #fee2e2; color: var(--error); border: none; padding: 6px 12px; font-size: 0.9rem; }
    .remove:hover { background: #fecaca; }
    .group-header-row td { background: var(--bg-light); border-bottom: 2px solid var(--border); padding: 6px 14px; font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.07em; color: #6b7280; }
    .status { min-height: 20px; margin-top: 12px; padding: 8px 12px; border-radius: 6px; font-weight: 500; }
    .status.success { background: #d1fae5; color: #065f46; }
    .status.err { background: #fee2e2; color: #7f1d1d; }
    .trust-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; margin-top: 16px; }
    .trust-card { background: var(--bg-light); border: 1px solid var(--border); border-radius: 12px; padding: 20px; }
    .trust-card h3 { margin-top: 0; color: var(--primary); }
    .trust-why { background: #eef6ff; border: 1px solid #c9dcff; border-radius: 12px; padding: 12px 14px; margin-bottom: 12px; color: #1f355e; }
    .download-link { display: inline-block; margin-bottom: 8px; font-weight: 600; }
    .divider { height: 1px; background: var(--border); margin: 28px 0; }
    @media (max-width: 600px) { header { padding: 30px 20px; } header h1 { font-size: 1.8rem; } .content { padding: 20px; } main { border-radius: 12px; } .trust-grid { grid-template-columns: 1fr; } table { font-size: 0.9rem; } th, td { padding: 10px; } input[type="text"], input[type="number"] { font-size: 16px; } }
  </style></head><body><main>
    <header>
      <h1>${htmlEscape(title)}</h1>
      <p>${htmlEscape(subtitle)}</p>
    </header>
    <div class="content">
      ${isFallback ? `<div class="warn"><strong>Unknown host:</strong> <code>${htmlEscape(requestHost)}</code></div>` : ""}
      <section>
        <h2>Proxy Mappings</h2>
        <p>Create local hostnames and point them to HTTP app ports running on this Mac.</p>
        <p><strong>Host</strong>: the name DevProxy creates (served as <code>&lt;host&gt;.local</code>). <strong>Port</strong>: your local app port on <code>localhost</code>.</p>
        <table id="mapTable"><thead><tr><th>Host name (.local)</th><th>Local app port (localhost)</th><th></th></tr></thead><tbody>${mappingRows}</tbody></table>
        <div class="row-actions"><button type="button" id="addRow">+ Add Mapping</button><button type="button" id="saveRows">💾 Save</button></div>
        <div id="status" class="status"></div>
        ${subdomainWarning}
        ${rows ? `<p><strong>Reachable now:</strong></p><ul class="link-groups">${rows}</ul>` : ""}
      </section>
      <div class="divider"></div>
      <section>
        <h2>Trust Setup Instructions</h2>
        <div class="trust-why"><strong>Why trust this certificate?</strong> DevProxy serves your local sites over HTTPS using a local development certificate authority. Without trusting it, browsers and mobile devices will show certificate warnings and can block secure requests, cookies, and service workers for your <code>*.local</code> sites.</div>
        <div class="trust-grid">
          <div class="trust-card"><h3>macOS</h3><ol><li><a class="download-link" href="${caUrl}" download>Download ca.pem</a></li><li>Open in Keychain Access (double-click or <code>open ca.pem</code>).</li><li>Add to <code>login</code> keychain.</li><li>Set Trust to <code>Always Trust</code>.</li><li>Restart Chrome or Safari.</li></ol></div>
          <div class="trust-card"><h3>Windows</h3><ol><li><a class="download-link" href="${caUrl}" download>Download ca.pem</a> and rename to <code>ca.cer</code>.</li><li>Open <code>certmgr.msc</code>.</li><li>Go to <code>Trusted Root Certification Authorities</code>.</li><li>Run <code>Import</code> and select the certificate.</li><li>Restart Chrome or Edge.</li></ol></div>
          <div class="trust-card"><h3>iPhone / iPad</h3><ol><li><a class="download-link" href="${caUrl}" download>Download ca.pem</a> in Safari.</li><li>Open Settings, then <code>General -> VPN & Device Management</code>.</li><li>Install the downloaded profile.</li><li>Enable trust in <code>General -> About -> Certificate Trust Settings</code>.</li><li>Reopen Safari and retry your local URL.</li></ol></div>
        </div>
      </section>
    </div>
  </main>
  <script>
    const tableBody = document.querySelector("#mapTable tbody");
    const statusEl = document.getElementById("status");
    function rowHtml(host = "", port = "") {
      return '<tr><td><input type="text" value="' + host + '" data-col="host" spellcheck="false" /></td><td><input type="number" value="' + port + '" data-col="port" min="1" max="65535" inputmode="numeric" /></td><td><button type="button" class="remove">Delete</button></td></tr>';
    }
    document.getElementById("addRow").addEventListener("click", () => tableBody.insertAdjacentHTML("beforeend", rowHtml()));
    tableBody.addEventListener("click", (e) => { if (e.target.classList.contains("remove")) e.target.closest("tr").remove(); });
    document.getElementById("saveRows").addEventListener("click", async () => {
      const mappings = {};
      for (const tr of [...tableBody.querySelectorAll("tr")]) {
        const hostInput = tr.querySelector('input[data-col="host"]');
        if (!hostInput) continue;
        const host = hostInput.value.trim().toLowerCase();
        const portRaw = tr.querySelector('input[data-col="port"]').value.trim();
        if (!host && !portRaw) continue;
        mappings[host] = Number(portRaw);
      }
      statusEl.textContent = "Saving...";
      statusEl.className = "status";
      try {
        const res = await fetch("/api/mappings", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ mappings }) });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Save failed");
        statusEl.textContent = "✓ Saved. Routes updated.";
        statusEl.className = "status success";
        setTimeout(() => location.reload(), 800);
      } catch (err) {
        statusEl.textContent = "✗ Error: " + err.message;
        statusEl.className = "status err";
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
  const isFallback = requestHost !== `${dashboardHost}.local` && requestHost !== `${dashboardHost}.localhost`;
  const html = renderPage({ requestHost, isFallback, mappings: readMappings() });
  res.statusCode = isFallback ? 404 : 200;
  res.setHeader("content-type", "text/html; charset=utf-8");
  res.end(html);
});

server.listen(dashboardPort, "127.0.0.1", () => {
  console.log(`Dashboard server listening on 127.0.0.1:${dashboardPort}`);
});
