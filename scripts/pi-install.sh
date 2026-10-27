#!/usr/bin/env bash
# SocioBeast on a Raspberry Pi (target: Pi 2 B, Raspberry Pi OS Lite 32-bit; also fine on Pi 3/4/5 and any Debian box).
#   sudo apt-get install -y git
#   git clone https://github.com/mounemus/sociobeast-living-island.git ~/sociobeast
#   bash ~/sociobeast/scripts/pi-install.sh
# Installs Node 20 if missing (official armv7l tarball on the Pi 2, NodeSource elsewhere), the server dependencies,
# avahi (so http://sociobeast.local works) and a systemd service that starts at boot and restarts on failure.
set -e
APP="$(cd "$(dirname "$0")/.." && pwd)"
NODE_V=20.18.0
need_node() { ! command -v node >/dev/null 2>&1 || [ "$(node -v | sed 's/v//' | cut -d. -f1)" -lt 18 ]; }
if need_node; then
  ARCH="$(uname -m)"
  if [ "$ARCH" = "armv7l" ] || [ "$ARCH" = "armv6l" ]; then
    echo "Installing Node $NODE_V (official $ARCH build)…"
    curl -fsSL "https://nodejs.org/dist/v$NODE_V/node-v$NODE_V-linux-$ARCH.tar.xz" -o /tmp/node.tar.xz
    sudo tar -xJf /tmp/node.tar.xz -C /usr/local --strip-components=1 && rm /tmp/node.tar.xz
  else
    echo "Installing Node 20 (NodeSource)…"
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt-get install -y nodejs
  fi
fi
echo "Node $(node -v)"
echo "Installing server dependencies…"
cd "$APP/server" && npm install --omit=dev --no-audit --no-fund
[ -f config.json ] || cp config.example.json config.json
sudo apt-get install -y avahi-daemon >/dev/null 2>&1 || true
echo "Creating the systemd service…"
sudo tee /etc/systemd/system/sociobeast.service >/dev/null <<EOF
[Unit]
Description=SocioBeast home server
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$APP/server
ExecStart=$(command -v node) $APP/server/server.js
Restart=always
RestartSec=5
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF
sudo systemctl daemon-reload
sudo systemctl enable --now sociobeast
sleep 2
IP=$(hostname -I | awk '{print $1}')
echo
echo "SocioBeast is running."
echo "  display : http://$IP:8420/        (OBS browser source, 1080x1920, on the streaming PC)"
echo "  admin   : http://$IP:8420/admin   (password: beast — change it there)"
echo "  also    : http://sociobeast.local:8420/"
echo "  logs    : journalctl -u sociobeast -f"
