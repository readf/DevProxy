#!/usr/bin/env node
import fs from "node:fs";
import http from "node:http";

const mappingsPath = process.env.MAPPINGS_FILE || "/config/mappings.json";
const caPath = process.env.CA_PATH || "/state/ca.pem";
const dashboardPort = Number(process.env.DASHBOARD_PORT || 9090);
const publicPort = String(process.env.PUBLIC_PORT || process.env.PROXY_PORT || 443);
const dashboardHost = (process.env.DASHBOARD_HOST || "proxy").toLowerCase();

function readMappings() {
  if (!fs.existsSync(mappingsPath)) {
    return {};
  }

  try {
    const raw = fs.readFileSync(mappingsPath, "utf8");
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }
    return parsed;
  } catch {
    return {};
  }
}

function listHosts(mappings) {
  return Object.keys(mappings)
    .filter((k) => /^[a-z0-9-]+$/i.test(k))
    .map((k) => k.toLowerCase())
    .sort();
}

function htmlEscape(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderPage({ requestHost, isFallback, hosts }) {
  const title = isFallback ? "Unknown host" : "Dev Proxy";
  const subtitle = isFallback
    ? `No direct mapping found for ${requestHost}.`
    : "Reachable addresses";

  const rows = hosts
    .map((h) => {
      const url = `https://${h}.local:${publicPort}`;
      return `<li><a href="${url}">${url}</a></li>`;
    })
    .join("\n");

  const dashboardUrl = `https://${dashboardHost}.local:${publicPort}`;
  const caUrl = `${dashboardUrl}/ca.pem`;

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${htmlEscape(title)}</title>
  <style>
    :root { color-scheme: light; }
    body {
      margin: 0;
      font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
      background: radial-gradient(circle at 20% 10%, #f2f6ff, #eef7f3 45%, #f9f5ef);
      color: #122;
    }
    main {
      max-width: 860px;
      margin: 48px auto;
      background: rgba(255,255,255,0.86);
      border: 1px solid #d8e0e8;
      border-radius: 16px;
      padding: 24px 28px;
      box-shadow: 0 18px 45px rgba(0,0,0,0.08);
    }
    h1 { margin: 0 0 8px; font-size: 2rem; }
    p { margin: 0 0 14px; }
    .warn {
      background: #fff6e8;
      border: 1px solid #f5d18f;
      border-radius: 10px;
      padding: 10px 12px;
      margin-bottom: 16px;
    }
    ul { margin: 0; padding-left: 20px; }
    li { margin: 8px 0; }
    a { color: #0d5f9f; text-decoration: none; }
    a:hover { text-decoration: underline; }
    code {
      background: #edf2f7;
      border-radius: 6px;
      padding: 2px 6px;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    }
    h2 {
      margin: 24px 0 8px;
      font-size: 1.15rem;
    }
    h3 {
      margin: 16px 0 6px;
      font-size: 1rem;
    }
    ol {
      margin: 0 0 12px;
      padding-left: 20px;
    }
    .card {
      margin-top: 18px;
      padding: 14px;
      border: 1px solid #d8e0e8;
      border-radius: 10px;
      background: rgba(255,255,255,0.75);
    }
  </style>
</head>
<body>
  <main>
    <h1>${htmlEscape(title)}</h1>
    <p>${htmlEscape(subtitle)}</p>
    ${isFallback ? `<div class="warn">Requested host: <code>${htmlEscape(requestHost)}</code></div>` : ""}
    <p>Dashboard: <a href="${dashboardUrl}">${dashboardUrl}</a></p>
    <p>Trust certificate: <a href="${caUrl}">${caUrl}</a></p>
    <ul>
      ${rows || "<li>No mappings found.</li>"}
    </ul>

    <h2>Trust Setup Instructions</h2>
    <div class="card">
      <h3>macOS</h3>
      <ol>
        <li>Download <code>ca.pem</code> from <a href="${caUrl}">${caUrl}</a>.</li>
        <li>Open the file in Keychain Access (double-click or run <code>open ca.pem</code>).</li>
        <li>Add it to the <code>login</code> keychain.</li>
        <li>Open certificate details and set Trust to <code>Always Trust</code>.</li>
        <li>Restart Chrome/Safari.</li>
      </ol>
    </div>

    <div class="card">
      <h3>Windows</h3>
      <ol>
        <li>Download <code>ca.pem</code> (rename to <code>ca.cer</code> if needed).</li>
        <li>Open <code>certmgr.msc</code>.</li>
        <li>Go to <code>Trusted Root Certification Authorities -> Certificates</code>.</li>
        <li>Choose <code>All Tasks -> Import</code> and import the file.</li>
        <li>Restart Chrome/Edge.</li>
      </ol>
    </div>

    <div class="card">
      <h3>iPhone / iPad</h3>
      <ol>
        <li>Download <code>ca.pem</code> in Safari.</li>
        <li>Install the profile from <code>Settings -> General -> VPN & Device Management</code>.</li>
        <li>Enable trust in <code>Settings -> General -> About -> Certificate Trust Settings</code>.</li>
        <li>Reopen Safari and retry your <code>https://&lt;name&gt;.local:${publicPort}</code> URL.</li>
      </ol>
    </div>
  </main>
</body>
</html>`;
}

const server = http.createServer((req, res) => {
  if ((req.url || "").split("?")[0] === "/ca.pem") {
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

  const hostHeader =
    req.headers["x-forwarded-host"] || req.headers["x-original-host"] || req.headers.host || "";
  const requestHost = hostHeader.split(":")[0].toLowerCase();
  const dashboardFqdn = `${dashboardHost}.local`;
  const isFallback = requestHost !== dashboardFqdn;

  const mappings = readMappings();
  const hosts = listHosts(mappings);

  const html = renderPage({ requestHost, isFallback, hosts });
  res.statusCode = isFallback ? 404 : 200;
  res.setHeader("content-type", "text/html; charset=utf-8");
  res.end(html);
});

server.listen(dashboardPort, "127.0.0.1", () => {
  console.log(`Dashboard server listening on 127.0.0.1:${dashboardPort}`);
});
