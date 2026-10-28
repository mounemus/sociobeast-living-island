#!/usr/bin/env bash
# SocioBeast — autonomous live box: render the creature page on this machine and push it 24/7 to one or several
# RTMP destinations at once (TikTok LIVE, YouTube, Facebook…). Needs a machine that can render WebGL: a Raspberry Pi 5,
# a mini-PC, the stream PC or a small VPS (software rendering, 720p) — a Pi 2/3/4 cannot.
#   sudo apt-get install -y chromium ffmpeg xvfb          # VPS / headless box (Debian: package "chromium", Ubuntu snap works too)
#   sudo apt-get install -y chromium ffmpeg xserver-xorg xinit x11-xserver-utils   # Pi 5 with HDMI (run from tty1, not SSH)
# One destination (legacy):  RTMP_URL="rtmp://a.rtmp.youtube.com/live2" STREAM_KEY="xxxx" bash scripts/pi-stream.sh
# Several at once:           DESTS="rtmp://a.rtmp.youtube.com/live2/KEY1 rtmps://live-api-s.facebook.com:443/rtmp/KEY2 rtmp://…tiktok…/KEY3" bash scripts/pi-stream.sh
# Keys: YouTube Studio → Go live → Stream key · Facebook Live Producer → persistent stream key · TikTok LIVE Studio / LIVE Center
# (accounts with LIVE access only). PAGE must be the live page served by the home server (events from TikTok), not the Vercel demo.
# Env: PAGE (default http://127.0.0.1:8420/?kiosk=1) · W×H (1080×1920 portrait; use 1280x720 for YouTube/Facebook landscape)
#      FPS (30) · BITRATE (3500k) · HEADLESS=1 (Xvfb, no screen) · LOOP=1 (restart forever if ffmpeg or Chromium die)
set -e
if [ -z "$DESTS" ]; then : "${RTMP_URL:?set DESTS or RTMP_URL+STREAM_KEY}"; : "${STREAM_KEY:?set STREAM_KEY}"; DESTS="${RTMP_URL%/}/$STREAM_KEY"; fi
PAGE="${PAGE:-http://127.0.0.1:8420/?kiosk=1}"
W=${W:-1080}; H=${H:-1920}; FPS=${FPS:-30}; BITRATE=${BITRATE:-3500k}
export DISPLAY=:0
CHROME=$(command -v chromium || command -v chromium-browser || command -v google-chrome || echo chromium)
FLAGS="--kiosk --window-size=$W,$H --window-position=0,0 --noerrdialogs --disable-infobars --autoplay-policy=no-user-gesture-required --no-first-run --disable-gpu-vsync"
if [ "$HEADLESS" = 1 ]; then Xvfb :0 -screen 0 ${W}x${H}x24 -nolisten tcp & sleep 2; FLAGS="$FLAGS --use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader"
else FLAGS="$FLAGS --enable-gpu-rasterization --ignore-gpu-blocklist"; fi
# hardware H.264 on the Pi 5 (h264_v4l2m2m); libx264 elsewhere
ENC="-c:v h264_v4l2m2m"; ffmpeg -hide_banner -encoders 2>/dev/null | grep -q h264_v4l2m2m || ENC="-c:v libx264 -preset veryfast -tune zerolatency"
# one encode, N outputs (ffmpeg tee); a destination that drops does not stop the others (onfail=ignore)
TEE=""; for d in $DESTS; do TEE="$TEE|[f=flv:onfail=ignore]$d"; done; TEE="${TEE#|}"
run_once() {
  if [ "$HEADLESS" = 1 ]; then "$CHROME" $FLAGS "$PAGE" & else xinit "$CHROME" $FLAGS "$PAGE" -- :0 -nocursor & fi
  CH=$!; sleep 15
  ffmpeg -hide_banner -loglevel warning -f x11grab -framerate $FPS -video_size ${W}x${H} -i :0.0 -f lavfi -i anullsrc=r=44100:cl=stereo \
    $ENC -b:v $BITRATE -maxrate $BITRATE -bufsize 7000k -pix_fmt yuv420p -g $((FPS * 2)) -c:a aac -b:a 96k -shortest -flags +global_header -f tee -map 0:v -map 1:a "$TEE" || true
  kill $CH 2>/dev/null || true; wait $CH 2>/dev/null || true
}
if [ "$LOOP" = 1 ]; then while true; do run_once; echo "stream ended, restarting in 10 s"; sleep 10; done; else run_once; fi
