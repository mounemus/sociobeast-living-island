#!/usr/bin/env bash
# SocioBeast — autonomous live box: render the creature page on this machine and push it to TikTok over RTMP.
# Needs a Raspberry Pi 5 (or a small PC) with the desktop packages, Chromium and ffmpeg; a Pi 2/3/4 cannot render it.
#   sudo apt-get install -y chromium-browser ffmpeg xserver-xorg xinit x11-xserver-utils
#   RTMP_URL="rtmp://…tiktokcdn…/live/"  STREAM_KEY="…"  bash scripts/pi-stream.sh
# TikTok gives RTMP_URL + STREAM_KEY to accounts allowed to go LIVE from third-party software (LIVE → "Go LIVE from a computer").
# Run it from a console (tty1), not over SSH, so X can start on the HDMI output. Stop with Ctrl-C.
set -e
: "${RTMP_URL:?set RTMP_URL}" ; : "${STREAM_KEY:?set STREAM_KEY}"
PAGE="${PAGE:-http://127.0.0.1:8420/?kiosk=1}"
W=${W:-1080}; H=${H:-1920}; FPS=${FPS:-30}; BITRATE=${BITRATE:-3500k}
export DISPLAY=:0
xinit /usr/bin/chromium-browser --kiosk --window-size=$W,$H --window-position=0,0 --noerrdialogs --disable-infobars --autoplay-policy=no-user-gesture-required --enable-gpu-rasterization --ignore-gpu-blocklist "$PAGE" -- :0 -nocursor &
sleep 12
# hardware H.264 on the Pi 5 (h264_v4l2m2m); fall back to libx264 on a PC
ENC="-c:v h264_v4l2m2m"; ffmpeg -hide_banner -encoders 2>/dev/null | grep -q h264_v4l2m2m || ENC="-c:v libx264 -preset veryfast -tune zerolatency"
exec ffmpeg -hide_banner -loglevel warning -f x11grab -framerate $FPS -video_size ${W}x${H} -i :0.0 -f lavfi -i anullsrc=r=44100:cl=stereo \
  $ENC -b:v $BITRATE -maxrate $BITRATE -bufsize 7000k -pix_fmt yuv420p -g $((FPS * 2)) -c:a aac -b:a 96k -shortest -f flv "${RTMP_URL%/}/$STREAM_KEY"
