# TikTok Live Bridge

```
cd bridge
npm install
cp .env.example .env    # fill TIKTOK_USERNAME, SOCIOBEAST_URL, BRIDGE_SECRET
npm start               # real TikTok LIVE
npm run demo            # simulated audience (no TikTok needed)
```

`BRIDGE_SECRET` must match `bridge_secret` in `web/api/config.local.php`.

## OBS
Browser source on `https://your-host/index.php` at **1080×1920** (TikTok portrait). `?voice=1` adds text-to-speech.

## Keep it running (VPS)
```
pm2 start tiktok-bridge.js --name sociobeast-bridge
pm2 save
```
