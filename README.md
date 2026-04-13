# DevProxy

A Dockerized reverse proxy using [Portless](https://github.com/vercel-labs/portless) for local development. Easily route `.local` domains to backend services running on your Mac.

## Features

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

## Requirements

- macOS (10.13+) — uses `dns-sd` for LAN mDNS publishing
- Docker Desktop running
- No special ports required at startup (runs on ports 80/443)

## Installation

### Via Homebrew (recommended for macOS)

```bash
brew tap readf/DevProxy https://github.com/readf/DevProxy
brew install devproxy
devproxy start
```

Then visit `https://proxy.local` to get started.

### Manual setup

```bash
git clone https://github.com/readf/DevProxy.git
cd devproxy
bash scripts/start-proxy.sh
```

Visit `https://proxy.local` in your browser.

## Quick start

1. Run `devproxy start` (or `bash scripts/start-proxy.sh` if manual setup).
2. Visit `https://proxy.local` in your browser.
3. Add a mapping:
   - Host: `myapp`
   - Port: `3000`
4. Click **Save**.
5. Visit `https://myapp.local` — traffic now routes to `localhost:3000`.

Mappings persist in `config/mappings.json` and update in real time.

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

Or with Homebrew:

```bash
devproxy stop
```

This stops host-side mDNS publisher processes and brings down the Docker stack.

## Troubleshooting

### Docker is installed but not reachable

If `devproxy start`, `devproxy stop`, or `devproxy logs` prints:

`Docker is installed but not reachable. Start Docker Desktop (or ensure the daemon is running) and try again.`

- Start Docker Desktop and wait for it to finish launching.
- Verify Docker is reachable: `docker info`.
- Retry the command.

If Docker is not installed, install Docker Desktop first.

### `https://proxy.local` shows certificate warning

Your browser doesn't trust the dev CA yet. Download and install the certificate:

1. Go to `https://proxy.local/ca.pem` and save the file.
2. Follow the trust instructions in the dashboard (or see the **Trust the certificate** section above).
3. Restart your browser.

### Mappings don't appear to work

- Confirm DevProxy is running: `docker compose ps` (in the project root).
- Check that your backend service is actually listening on the specified port.
- If just added, give the dashboard a few seconds to update routes and republish mDNS.

### Cannot find `proxy.local` on my network

- Restart your browser or device.
- Confirm you're on the same LAN as the Mac running DevProxy.
- On iPhone, make sure WiFi is connected to the same network (not cellular).

## Notes

- Portless auto-redirect only applies on port `443`, and this project also keeps an explicit HTTP redirect on port `80` to `443`.
- Docker Desktop on macOS may limit mDNS passthrough from containers. This project works around that by publishing mDNS records from the host instead.
- DevProxy requires elevated privileges to bind ports 80/443. Use `sudo` if needed.

## License

MIT — See [LICENSE](LICENSE) for details.

## Contributing

Contributions welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.
