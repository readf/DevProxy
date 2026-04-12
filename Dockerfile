FROM node:22-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends avahi-utils avahi-daemon dbus libnss-mdns ca-certificates iputils-ping \
  && sed -i 's/^hosts:.*/hosts: files mdns4_minimal [NOTFOUND=return] dns/' /etc/nsswitch.conf \
  && rm -rf /var/lib/apt/lists/*

RUN npm install -g portless@latest

WORKDIR /app

COPY scripts/docker-entrypoint.sh /app/scripts/docker-entrypoint.sh
COPY scripts/http-redirect.mjs /app/scripts/http-redirect.mjs
COPY scripts/host-forward.mjs /app/scripts/host-forward.mjs
COPY scripts/dashboard-server.mjs /app/scripts/dashboard-server.mjs
COPY scripts/sync-mappings.mjs /app/scripts/sync-mappings.mjs

RUN chmod +x /app/scripts/docker-entrypoint.sh

ENTRYPOINT ["/app/scripts/docker-entrypoint.sh"]
