# 🌲 SocioBeast — The Living Island · v14 "Nature Plays"

> A floating island of ancient forest where **every TikTok Live viewer becomes a kodama**.
> Four peoples — Grove, Forge, Fang, Veil — share the island; the audience tips the **balance between forest and iron**,
> heals **the Curse** born of hatred, votes at the **Council** that writes the lore, and awakens World Events such as the passing of **the Tall One**.
> **Nature is a player too**: an autonomous Island Director advances the story through 6 chapters (levels), sends rain and blight, helps the weakest people and gives voice to an original cast — Mossback the walking hill, Ember-Eye the great lynx, the Ironwright, the Wanderer, the Blightling. Inspired by the moral universe of Hayao Miyazaki (no villains, nature as a character) with original names and assets.
>
> Admin control room: `/admin/island.php` — chapters, Nature parameters, cast, curse controls and the **TikTok Live transmission panel** (bridge status, secret, OBS URL, test events).
> Three.js + PHP/SQLite + a Node TikTok bridge. By [UbMaker](https://virlabdesign.com).

![SocioBeast — The Living Island](server/assets/art/keyart.jpg)

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/mounemus/sociobeast-living-island)

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
Live demo: **https://sociobeast-living-island.vercel.app/?demo=1** (Vercel) · single-file mirror: https://claude.ai/artifact/HRPHSYaWeRc6SD1q1mnn3y — `bash scripts/build-standalone.sh` rebuilds it (`web/dist/sociobeast-standalone.html`, ~1 MB, model inlined).

## 🚀 Deploy the demo on Vercel

```bash
npm i -g vercel
vercel            # first deploy — keep the defaults
vercel --prod     # production
```
Or import the GitHub repo in the Vercel dashboard — `vercel.json` already defines the build
(`scripts/build-web.sh` → `web/dist`). Open `https://<project>.vercel.app/?demo=1`.

Keys: **H** hide HUD · **G** test Great Howl gift · **R** rain · **T** thought · **S/C** shy/curious · drag / scroll to navigate.
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

Chat commands: `!clan <grove|forge|fang|veil>` `!me` `!top` `!quest` `!lore` `!calm !pray !breathe` `!1 !2 !3` `!summon` `!decree` `!dance !feed !hide !seek !rain`

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
