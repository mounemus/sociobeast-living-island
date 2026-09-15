#!/usr/bin/env bash
# Builds the static Vercel demo: web/dist = web/index.html + mock-api.js + server/assets
set -e
cd "$(dirname "$0")/.."
rm -rf web/dist && mkdir -p web/dist/assets
cp web/index.html web/mock-api.js web/dist/
cp server/assets/*.js server/assets/*.css server/assets/*.glb web/dist/assets/
cp GAME-DESIGN.md web/dist/ 2>/dev/null || true
echo "web/dist ready ($(du -sh web/dist | cut -f1))"
