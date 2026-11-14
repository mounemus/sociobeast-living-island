@echo off
:: SocioBeast — Lance la page en fenêtre standalone (mode app Chrome)
:: Utiliser "Capture de fenêtre" dans TikTok LIVE Studio pour la diffuser.
start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" --app=http://localhost:8420/?kiosk=1 --window-size=1080,1920 --window-position=0,0 --disable-translate --autoplay-policy=no-user-gesture-required
