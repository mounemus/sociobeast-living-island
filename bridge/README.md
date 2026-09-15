# TikTok Live Bridge

```
cd bridge
npm install
cp .env.example .env    # remplir TIKTOK_USERNAME, SOCIOBEAST_URL, BRIDGE_SECRET
npm start               # live réel
npm run demo            # public simulé (tests sans TikTok)
```

Le secret doit être identique à celui de `/admin/config.php` → TikTok bridge secret.

## OBS
Source navigateur → `https://votre-site/live/?hud=1` en **1080×1920** (portrait TikTok).
Le HUD est pensé pour le vertical ; `?hud=0` masque le HUD pour un plan "cinéma".

## Déploiement permanent (VPS)
```
pm2 start tiktok-bridge.js --name sociobeast-bridge
pm2 save
```
