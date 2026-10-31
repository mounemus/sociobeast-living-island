#!/usr/bin/env bash
# SocioBeast — VPS setup: server + headless 24/7 stream on a single machine (Ubuntu/Debian, ARM or x86).
#   ssh root@your-vps
#   apt-get update && apt-get install -y git
#   git clone https://github.com/mounemus/sociobeast-living-island.git ~/sociobeast
#   bash ~/sociobeast/scripts/vps-install.sh
# Creates two systemd services:
#   sociobeast          Node server (port 8420, TikTok bridge, admin panel)
#   sociobeast-stream   Headless Chromium + ffmpeg → RTMP (720p 15fps, software rendering)
# After install: edit /etc/sociobeast/stream.env with your RTMP destination(s), then:
#   sudo systemctl start sociobeast-stream
set -e
APP="$(cd "$(dirname "$0")/.." && pwd)"

echo "=== SocioBeast VPS installer ==="

# ── 1. Node 20 ──
NODE_V=20.18.0
need_node() { ! command -v node >/dev/null 2>&1 || [ "$(node -v | sed 's/v//' | cut -d. -f1)" -lt 18 ]; }
if need_node; then
  ARCH="$(uname -m)"
  if [ "$ARCH" = "armv7l" ] || [ "$ARCH" = "armv6l" ]; then
    echo "[1/5] Installing Node $NODE_V ($ARCH tarball)…"
    curl -fsSL "https://nodejs.org/dist/v$NODE_V/node-v$NODE_V-linux-$ARCH.tar.xz" -o /tmp/node.tar.xz
    sudo tar -xJf /tmp/node.tar.xz -C /usr/local --strip-components=1 && rm /tmp/node.tar.xz
  else
    echo "[1/5] Installing Node 20 (NodeSource)…"
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
  fi
else
  echo "[1/5] Node $(node -v) already installed, skipping."
fi

# ── 2. Chromium + ffmpeg + Xvfb ──
echo "[2/5] Installing Chromium, ffmpeg, Xvfb…"
sudo apt-get update -qq
sudo apt-get install -y --no-install-recommends \
  chromium chromium-driver ffmpeg xvfb fonts-liberation fonts-noto-color-emoji \
  2>/dev/null || \
sudo apt-get install -y --no-install-recommends \
  chromium-browser ffmpeg xvfb fonts-liberation fonts-noto-color-emoji

# ── 3. Server dependencies ──
echo "[3/5] Installing server dependencies…"
cd "$APP/server" && npm install --omit=dev --no-audit --no-fund

# ── 4. Config ──
echo "[4/5] Configuring…"
if [ ! -f "$APP/server/config.json" ]; then
  sed 's/"tiktokUsername": ""/"tiktokUsername": "sociobeast"/' "$APP/server/config.example.json" > "$APP/server/config.json"
  echo "  config.json created (tiktokUsername=sociobeast, password=beast — change it in /admin)"
else
  echo "  config.json already exists, keeping it."
fi

sudo mkdir -p /etc/sociobeast
if [ ! -f /etc/sociobeast/stream.env ]; then
  cat <<'ENVEOF' | sudo tee /etc/sociobeast/stream.env >/dev/null
# RTMP destinations (space-separated). Get keys from:
#   TikTok:   LIVE Center → Stream key (requires ~1000 followers + LIVE access)
#   YouTube:  Studio → Go live → Stream key
#   Facebook: Live Producer → persistent stream key
# Example: DESTS="rtmp://push.tiktok.com/live/YOUR_KEY rtmp://a.rtmp.youtube.com/live2/YOUR_KEY"
DESTS=""
ENVEOF
  echo "  /etc/sociobeast/stream.env created — edit it with your RTMP key(s)"
else
  echo "  /etc/sociobeast/stream.env already exists, keeping it."
fi

# ── 5. Systemd services ──
echo "[5/5] Creating systemd services…"

RUNNER="$([ "$(id -u)" -eq 0 ] && echo root || echo "$USER")"

sudo tee /etc/systemd/system/sociobeast.service >/dev/null <<EOF
[Unit]
Description=SocioBeast server
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=$RUNNER
WorkingDirectory=$APP/server
ExecStart=$(command -v node) $APP/server/server.js
Restart=always
RestartSec=5
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF

sudo tee /etc/systemd/system/sociobeast-stream.service >/dev/null <<EOF
[Unit]
Description=SocioBeast 24/7 RTMP stream (headless)
After=sociobeast.service
Requires=sociobeast.service

[Service]
Type=simple
User=$RUNNER
WorkingDirectory=$APP
EnvironmentFile=/etc/sociobeast/stream.env
Environment=HEADLESS=1 LOOP=1 W=1280 H=720 FPS=15 BITRATE=2000k
ExecStart=/bin/bash $APP/scripts/pi-stream.sh
Restart=always
RestartSec=15

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable --now sociobeast
echo "  sociobeast.service: started"
echo "  sociobeast-stream.service: enabled but NOT started (set DESTS first)"

sleep 2
IP=$(hostname -I | awk '{print $1}')
echo
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  SocioBeast VPS — ready                                    ║"
echo "╠══════════════════════════════════════════════════════════════╣"
echo "║  Server   : http://$IP:8420/"
echo "║  Admin    : http://$IP:8420/admin  (password: beast)"
echo "║  Logs     : journalctl -u sociobeast -f"
echo "║  Stream   : journalctl -u sociobeast-stream -f"
echo "╠══════════════════════════════════════════════════════════════╣"
echo "║  Next steps:                                               ║"
echo "║  1. Open /admin → change the password                     ║"
echo "║  2. Edit /etc/sociobeast/stream.env → add RTMP key(s)    ║"
echo "║  3. sudo systemctl start sociobeast-stream                ║"
echo "║  4. Watch: journalctl -u sociobeast-stream -f             ║"
echo "╚══════════════════════════════════════════════════════════════╝"
