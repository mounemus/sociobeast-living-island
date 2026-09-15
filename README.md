# 🌌 SocioBeast — The Living Island

> A cosmic floating island where **every TikTok Live viewer becomes a guardian spirit**.
> 1000+ AI creatures, 4 rival clans, a shared island-energy bar, chaos & fractures,
> council votes that rewrite the lore, quests and persistent seasons.
> Three.js + PHP/SQLite + a Node TikTok bridge. By [UbMaker](https://virlabdesign.com).

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/YOUR_GITHUB_USER/sociobeast-living-island)

📖 Full concept: [GAME-DESIGN.md](GAME-DESIGN.md)

---

## Two ways to run it

| | **Browser demo** (`web/`) | **Full TikTok Live stack** (`server/` + `bridge/`) |
|---|---|---|
| Hosting | **Vercel** (static, free) | Any PHP 8 + SQLite host (VPS, shared hosting) |
| Backend | `mock-api.js` — the game engine runs in the browser, saved in `localStorage` | `includes/game_engine.php` — persistent SQLite, AI speech (OpenAI / Anthropic) |
| Audience | Simulated (`?demo=1`) | Real TikTok LIVE via `bridge/tiktok-bridge.js` |
| Purpose | Showcase, portfolio, playtesting the rules | Actual streaming |

Vercel's serverless filesystem is read-only, so the persistent PHP/SQLite backend cannot run there — that's why the repo ships both.

---

## 🎮 Play it now
Live single-file demo (no server): **https://claude.ai/artifact/HRPHSYaWeRc6SD1q1mnn3y** — `bash scripts/build-standalone.sh` rebuilds it (`web/dist/sociobeast-standalone.html`, ~1 MB, model inlined).

## 🚀 Deploy the demo on Vercel

```bash
npm i -g vercel
vercel            # first deploy — keep the defaults
vercel --prod     # production
```
Or import the GitHub repo in the Vercel dashboard — `vercel.json` already defines the build
(`scripts/build-web.sh` → `web/dist`). Open `https://<project>.vercel.app/?demo=1`.

Keys: **H** hide HUD · **G** send a test Galaxy gift · **T** thought · **S/C** shy/curious · drag / scroll to navigate.
Console: `SocioMock.reset()` wipes the local save, `SocioMock.endSeason()` closes a season.

---

## 📡 Run the real thing (TikTok Live)

1. Upload `server/` to your PHP host (e.g. `/live/`). Make `server/data/` writable.
2. Open `/admin/` (initial password `admin123`) → set an AI key, generate the **Bridge Secret**.
3. Bridge:
   ```bash
   cd bridge && npm install && cp .env.example .env   # fill TIKTOK_USERNAME, SOCIOBEAST_URL, BRIDGE_SECRET
   npm start          # real live   |   npm run demo → simulated audience
   ```
4. OBS → Browser source `https://your-host/live/?hud=1` at **1080×1920**.

Chat commands: `!clan <verdant|tide|ember|umbra>` `!me` `!top` `!quest` `!lore` `!calm` `!1 !2 !3` `!summon` `!decree` `!dance !feed !hide !seek`

---

## 🗂 Repo layout

```
server/    PHP app — index.php, api/ (state, event, speak, game, tiktok), includes/ (game_engine, ai_engine…), admin/, assets/
bridge/    Node bridge: TikTok LIVE → api/tiktok.php  (tiktok-live-connector)
web/       Static demo for Vercel: index.html + mock-api.js (assets copied from server/ at build)
scripts/   build-web.sh (Vercel static) · build-standalone.sh (one-file HTML)
.github/   CI: PHP + JS lint, engine smoke test, builds
```

## Roadmap
v12.1 permanent land fragments & seasonal biomes · v12.2 TTS voice of the Beast + shareable guardian cards · v12.3 YouTube/Twitch bridges · v13 skin marketplace.

## License
MIT
