# TikTok Live Bridge

```
cd bridge
npm install
cp .env.example .env    # fill TIKTOK_USERNAME, SOCIOBEAST_URL, BRIDGE_SECRET
npm start               # real TikTok LIVE
npm run demo            # simulated audience (no TikTok needed)
```

`BRIDGE_SECRET` must match the *TikTok bridge secret* in `/admin/config.php`.

## OBS
Browser source → `https://your-site/live/?hud=1` at **1080×1920** (TikTok portrait).
The HUD is designed for vertical; `?hud=0` hides it for a "cinema" shot.

## Keep it running (VPS)
```
pm2 start tiktok-bridge.js --name sociobeast-bridge
pm2 save
```
