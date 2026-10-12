#!/usr/bin/env bash
set -euo pipefail
: "${API_HOST:=monad-api.opencash.in}"

if [ ! -f /swapfile ]; then
  fallocate -l 1G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

apt-get update
apt-get install -y curl ca-certificates rsync
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt-get install -y nodejs
corepack enable
corepack prepare pnpm@9.15.4 --activate

id opencash >/dev/null 2>&1 || useradd --system --home /opt/opencash-monad --shell /usr/sbin/nologin opencash
mkdir -p /opt/opencash-monad/backend/data /var/backups/opencash-monad
chown -R opencash:opencash /opt/opencash-monad

if [ ! -f /etc/opencash-monad.env ]; then
  cat > /etc/opencash-monad.env <<'ENV'
PORT=8787
BOT_RUNNER=1
BOT_KEY_SECRET=
NANSEN_API_KEY=
AURORA_INTENTS_KEY=
ONECLICK_API_KEY=
NETWORK=mainnet
INTENTS_ALLOW_LIVE=1
CORS_ORIGIN=https://monad.opencash.in
ENV
  chmod 600 /etc/opencash-monad.env
fi
if grep -q '^BOT_KEY_SECRET=$' /etc/opencash-monad.env; then
  sed -i "s/^BOT_KEY_SECRET=$/BOT_KEY_SECRET=$(openssl rand -hex 32)/" /etc/opencash-monad.env
fi

cd /opt/opencash-monad
sudo -u opencash pnpm install --frozen-lockfile --filter backend...

install -m 644 deploy/opencash-monad.service /etc/systemd/system/
install -m 644 deploy/opencash-monad-backup.service /etc/systemd/system/
install -m 644 deploy/opencash-monad-backup.timer /etc/systemd/system/
chmod +x deploy/backup.sh

if ! command -v cloudflared >/dev/null; then
  curl -fsSL -o /tmp/cloudflared.deb "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-$(dpkg --print-architecture).deb"
  dpkg -i /tmp/cloudflared.deb
fi
mkdir -p /etc/cloudflared
if [ -n "${TUNNEL_ID:-}" ]; then
  cat > /etc/cloudflared/config.yml <<CF
tunnel: ${TUNNEL_ID}
credentials-file: /etc/cloudflared/${TUNNEL_ID}.json
ingress:
  - hostname: ${API_HOST}
    service: http://localhost:8787
  - service: http_status:404
CF
fi

systemctl daemon-reload
systemctl enable --now opencash-monad-backup.timer
echo "Fill /etc/opencash-monad.env, then: systemctl enable --now opencash-monad"
