# SocioBeast

A living 3D creature raised by a TikTok Live audience.

Likes feed it. Comments make it talk back. Gifts make it grow through six forms, from egg to cosmic beast. It gets hungry, falls asleep, gets bored when nobody is around, remembers the people who feed it, and does things on its own between two interactions. Think tamagotchi, except the whole chat is the parent and the pet has a voice.

**Demo (simulated audience):** https://sociobeast-living-island.vercel.app/

## How it works

```
TikTok LIVE ──► bridge/tiktok-bridge.js ──► web/api/tiktok.php ──► web/index.php (OBS browser source)
                (Node, tiktok-live-connector)   (PHP relay, SQLite)      creature.js · game.js · audience.js
                                                                          └─► web/api/think.php (LLM voice, optional)
```

The game itself runs in one browser tab, the OBS source. It is the authority: vitals, evolution, keepers, memory, all in `localStorage`. The server only relays raw TikTok events and lends the creature a voice through an LLM.

| Folder | What |
|---|---|
| `web/` | The game. `index.html` is the static demo, `index.php` the live page. No build step. |
| `web/assets/creature.js` | Procedural Three.js creature: body, face, horns, arms, tail, wings, halo, nest, sky, effects. |
| `web/assets/game.js` | Rules: vitals, moods, evolution, keepers, the creature's own behaviour, HUD, persistence. |
| `web/assets/audience.js` | Event source: simulated crowd (demo) or the PHP relay (live). |
| `web/api/` | `tiktok.php` relay, `think.php` LLM voice, `config.php`. |
| `api/think.js` | Same voice as a Vercel function, for the demo (`ANTHROPIC_API_KEY` in the project env). |
| `bridge/` | Node bridge from TikTok Live to the relay. |

## Run it

Demo, no server:

```bash
bash scripts/build-web.sh && python3 -m http.server -d web/dist 8769
```

Live, on any PHP 8 host with SQLite and curl:

```bash
php -S 127.0.0.1:8090 -t web          # or point your web root at web/
cp web/api/config.local.php.example web/api/config.local.php   # bridge secret + API key
cd bridge && npm install && npm start  # after filling bridge/.env
```

OBS: browser source on `https://your-host/index.php` at 1080×1920. Add `?voice=1` for text-to-speech, `?name=Momo` to rename the creature.

Keys on the page: `H` hide HUD · `L` 25 likes · `G` Galaxy gift · `E` force evolution · `V` voice · `R` reset to egg.

## Rules in one table

| Viewer does | Creature gets |
|---|---|
| ❤️ like | +0.5 food, +1 XP, hearts. 10+ at once: a hop. 20 wake it up when asleep. |
| 💬 comment | +4 joy, +3 XP. `dance`, `sing`, `spin`, `play`, `sleep`, `hi` are understood. Questions get an answer. |
| 🎁 gift | +10 food, +20 joy, 3 XP per coin. 50+ coins: a dance. 500+: fireworks. |
| ➕ follow | +25 XP, the viewer becomes a keeper. |
| 🔗 share | +30 XP. |

Forms: Egg 0 · Hatchling 150 · Sprout 400 · Young Beast 2000 · Guardian 8000 · Cosmic Beast 25000 XP, at most one evolution per minute.

Food drains in about seven minutes, joy in twelve, energy in fifteen. At zero food the creature fades until someone feeds it. At zero energy it sleeps.

## License

MIT. Made by Abdel-Mounem Taouai, UbMaker, Montréal.
