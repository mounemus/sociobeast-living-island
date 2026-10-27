#!/usr/bin/env bash
# Update SocioBeast on the Pi: pull the latest code, refresh dependencies, restart the service.
set -e
APP="$(cd "$(dirname "$0")/.." && pwd)"
cd "$APP" && git pull --ff-only
cd "$APP/server" && npm install --omit=dev --no-audit --no-fund
sudo systemctl restart sociobeast
sleep 2 && systemctl --no-pager --lines=5 status sociobeast
