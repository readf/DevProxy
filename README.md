# DevProxy (Portless-based)

A Dockerized reverse proxy using [Portless](https://github.com/vercel-labs/portless) with:

- LAN mode with host-side `.local` mDNS publishing
- HTTPS exposed on `0.0.0.0:443`
- HTTP exposed on `0.0.0.0:80`, redirecting to `443`
- Dashboard-managed host mappings
- Portless state and CA stored in `./state`
- Automatic forwarding from container `localhost:<port>` to host `localhost:<port>`
- Built-in dashboard at `https://proxy.local`
- Unknown `*.local` hostnames fall back to the dashboard as a 404 page
- Web UI on `proxy.local` to view and edit proxy mappings

## Manage mappings

Use the dashboard at `https://proxy.local` to add, edit, and remove mappings.

Each mapping becomes `<name>.local`.

Example mapping values:

- `localhost:4200`
- `127.0.0.1:3001`
- `5173`

Route names must be a single hostname label (letters, numbers, hyphens only).

Each key is a route name, each value is either:

- `localhost:<port>` / `127.0.0.1:<port>`
- or a numeric port

This example is reachable at:

- `https://sample-client.local`
- `https://api.local`
- `https://admin.local`
- `https://proxy.local` (dashboard)

From the dashboard, clients can download the trust certificate at:

- `https://proxy.local/ca.pem`

## Start

```bash
bash scripts/start-proxy.sh
```

This starts the Docker stack, then publishes each mapped `<name>.local` on your Mac with `dns-sd`.

## Export the root CA certificate

```bash
bash scripts/get-ca.sh ./certs/devproxy-ca.pem
```

That copies `ca.pem` out of the container so you can trust it on your host or another device.

## Trust the certificate on devices

Clients can download the certificate from the dashboard:

- `https://proxy.local/ca.pem`

### macOS

1. Download `ca.pem`.
2. Open it in Keychain Access (double-click or run `open ca.pem`).
3. Add it to the `login` keychain.
4. In Keychain Access, open the certificate details.
5. Set `Trust` -> `When using this certificate` to `Always Trust`.
6. Restart Chrome/Safari after trust changes.

### Windows

1. Download `ca.pem`.
2. Rename it to `ca.cer` if needed.
3. Open `Manage user certificates` (`certmgr.msc`).
4. Go to `Trusted Root Certification Authorities` -> `Certificates`.
5. Right-click -> `All Tasks` -> `Import...`.
6. Import `ca.cer` into `Trusted Root Certification Authorities`.
7. Restart Chrome/Edge.

### iPhone / iPad (iOS / iPadOS)

1. Download `ca.pem` in Safari on the device.
2. Install the profile when prompted.
3. Open `Settings` -> `General` -> `VPN & Device Management` and complete install.
4. Then open `Settings` -> `General` -> `About` -> `Certificate Trust Settings`.
5. Enable full trust for the installed `portless Local CA` certificate.
6. Reopen Safari and retry your `https://<name>.local` URL.

If trust still fails on any platform, remove older `portless Local CA` entries and install only the newest certificate from `https://proxy.local/ca.pem`.

## Stop

```bash
bash scripts/stop-proxy.sh
```

This stops host-side mDNS publisher processes and brings down the Docker stack.

## Notes

- Portless auto-redirect only applies on port `443`, and this project also keeps an explicit HTTP redirect on port `80` to `443`.
- Docker Desktop on macOS may limit mDNS passthrough from containers. This project works around that by publishing mDNS records from the host instead.
