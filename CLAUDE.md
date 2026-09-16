# SocioBeast — The Living Island (project context for Claude Code)

A TikTok-Live game: a floating island of ancient forest where every viewer becomes a kodama (tree spirit).
Four peoples (Grove 🌲 / Forge ⚒️ / Fang 🐺 / Veil 🌙) share the island; the audience tips the **balance** forest ↔ forge,
heals **the Curse**, votes at the **Council** (writes the lore), and **Nature itself is a player** (the Island Director)
advancing the story through 6 chapters with an original cast (Mossback, Ember-Eye, the Ironwright, the Wanderer,
the Blightling, the Tall One). Inspired by the moral universe of Hayao Miyazaki (no villains) — **original names & assets only,
never reproduce Ghibli characters**. Everything user-facing is in **English**.

- Live demo (browser-only mock): https://sociobeast-living-island.vercel.app/?demo=1  (Vercel, auto-deploys from `main`)
- Repo: https://github.com/mounemus/sociobeast-living-island · Owner: Abdel-Mounem Taouai (UbMaker, Montréal)
- Full design: `GAME-DESIGN.md` · Setup: `README.md`

## Layout
```
server/                 PHP 8 + SQLite app (real TikTok Live stack) — deploy on a PHP host (VPS), NOT on Vercel
  index.php             live page (Three.js scene + HUD); ?hud=1 for OBS, ?demo=1 simulated audience
  api/game.php          state/feed polled by the front (1.5 s) + admin ops; api/tiktok.php ingests bridge events; api/event.php on-page interactions
  includes/game_engine.php     peoples, guardians, energy, balance, curse, council, quests, seasons, event queue
  includes/island_director.php Nature as a player: chapters (levels), utility-based moves, cast voices, boss (Blightling)
  includes/ai_engine.php       OpenAI/Anthropic speech; system prompt carries the Miyazaki voice + game context + lore
  admin/island.php      control room: chapters, director params, cast, triggers, seasons, TikTok bridge panel
  assets/visualEngine.js Three.js: island, 1000+ kodama, vanish/reappear, balance-driven foliage, bloom, mist, pond,
                         shafts, rain, the Tall One, painted sprite cast (assets/art/*_sprite.png) with procedural fallback
  assets/gameEngine.js  polls api/game.php, spawns guardians, HUD (9:16 first), turns events into world effects
  assets/app.js         v11 creature layer (thoughts, speech, expressions)
  assets/art/           Higgsfield-generated art: 5 character sprites, backdrop.jpg (sky dome), keyart.jpg
bridge/tiktok-bridge.js Node: TikTok LIVE → api/tiktok.php (tiktok-live-connector), heartbeat every 30 s
web/index.html + mock-api.js   Vercel demo: the same engine re-implemented in the browser (localStorage) — keep it in sync
                                with game_engine.php whenever rules/constants change
scripts/build-web.sh    → web/dist (Vercel output, vercel.json)   scripts/build-standalone.sh → one-file HTML
.github/workflows/ci.yml PHP + JS lint, engine smoke test, builds
```

## Conventions
- Game rules live in `game_engine.php`; the browser mock (`web/mock-api.js`) mirrors them — change both.
- Event queue types (server → front): guardian_born, rank_up, gift_spell, clan_power, world_event, fracture, fracture_healed,
  council_open/closed, vote_cast, quest_complete, nature_move, nature_gift, blight, boss_defeated, character_speak, chapter,
  chapter_complete, silence, season_end, request_speech. Handlers: `gameEngine.js → handleEvent`.
- Chat commands: `!clan <grove|forge|fang|veil> !me !top !quest !lore !calm !pray !breathe !1 !2 !3 !summon !decree !dance !feed !hide !seek !rain`
- Keys on the live page: H hud · G test gift · R rain · T thought · S/C shy/curious · D debug · click `? keys` (bottom right) for the operator cheat-sheet
- HUD (v16, `game.css` + `gameEngine.js → buildHud/renderHud`): one glass design system (tokens in `:root`), zones = top strip (chapter · season · energy · balance · peoples · curse when > 10%) · side panels (quests / top guardians, positioned under the strip via `--hud-top-h`) · centre (vote, banner, boss) · voice (`#creature-expression` Beast + `#hud-speech` cast, bottom centre) · feed (4 items, bottom left) · one contextual call-to-action (`renderCta`: vote → curse → boss → join a people). Portrait 9:16 turns side panels into one-line tickers. The v11 overlays (creature-info, nav-hint, mythology panel, event-feed, connection pill, idle prompt) are gone — keep it that way; Nature's moves go through the feed.
- Admin password default `admin123` (`/admin/`); bridge secret generated in `/admin/island.php`.
- Three.js r128 UMD from cdnjs + examples/js post-processing from jsdelivr; no ES modules in the page.

## Test locally
```
php -S 127.0.0.1:8090 -t server            # then open /index.php?demo=1&hud=1 ; /admin/island.php
node --check server/assets/*.js web/mock-api.js
bash scripts/build-web.sh && python3 -m http.server -d web/dist 8769    # Vercel demo
cd bridge && npm install && npm run demo   # simulated TikTok audience against SOCIOBEAST_URL
```
Delete `server/data/sociobeast.db` after schema changes (tables are created on first run).

## Status (v16) & next steps
Done: full game loop, Island Director + chapters, painted cast & sky (Higgsfield), admin control room, Vercel demo, CI, HUD redesign (v16: single layer, calmer, portrait-first).
Backlog, in priority order:
1. Replace low-poly trees with painted tree billboards (2–3 sprites) or GLB trees; textured GLB cast when Higgsfield credits allow (`image_to_3d`, `should_texture:true`).
2. VPS deployment script (nginx + php-fpm + pm2 for the bridge) for virlabdesign.com/live.
3. TTS voice for the Beast/cast reading Council verdicts; shareable guardian cards.
4. YouTube/Twitch bridges reusing `api/tiktok.php` (rename to `api/live.php`).
