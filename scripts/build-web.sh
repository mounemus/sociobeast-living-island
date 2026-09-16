#!/usr/bin/env bash
# Builds the static Vercel demo: web/dist = web/ without the PHP api (the demo simulates its audience in the browser)
set -e
cd "$(dirname "$0")/.."
rm -rf web/dist && mkdir -p web/dist
cp -r web/index.html web/assets web/dist/
echo "web/dist ready ($(du -sh web/dist | cut -f1))"
