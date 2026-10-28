# SocioBeast

A living 3D creature raised by a TikTok Live audience.

Likes feed it. Comments make it talk back. Gifts make it grow through eight forms, from egg to legendary and beyond. It gets hungry, falls asleep, gets bored when nobody is around, remembers the people who feed it, and does things on its own between two interactions. Think tamagotchi, except the whole chat is the parent and the pet has a voice.

It is not alone. **Pip**, a pink fairy-light, hosts the show: she greets new keepers, explains what a like does, asks the chat questions and runs polls the viewers decide with `1` or `2`. **Moss**, a 400-year-old turtle on the table edge, answers the deep questions with a straight face. An AI director picks the next beat every half minute from what the chat just said.

**Demo (simulated audience):** https://sociobeast-living-island.vercel.app/

## How it works

```
TikTok LIVE ──► server/server.js (Raspberry Pi or any PC, Node 20) ──► http://<pi-ip>:8420/   the creature page (OBS browser source)
                 • built-in TikTok bridge (tiktok-live-connector)      http://<pi-ip>:8420/admin   settings, status, test events
                 • WebSocket to every open screen, real time           http://sociobeast.local:8420
                 • keeps the creature's save in server/data/state.json
                 • AI voice relay (keys stay on the Pi)
```

The rules of the game run in the browser tab that shows the creature (the OBS source). The server relays TikTok events to it in real time, remembers its state between restarts, exposes the admin panel on the local network and lends the cast a voice through an LLM. A Raspberry Pi 2 is enough for the server; it does not render the 3D scene, the streaming PC does.

| Folder | What |
|---|---|
| `web/` | The game page and its assets. `index.html` alone is the static demo (simulated audience). |
| `web/assets/creature.js` | Three.js scene: Meshy-textured and rigged forms (`models/`), painted backdrop, floating nest, effects; procedural fallback. |
| `web/assets/game.js` | Rules: vitals, moods, evolution, keepers, the creature's own behaviour, HUD, save. |
| `web/assets/cast.js` | Pip and Moss, the supporting characters. |
| `web/assets/director.js` | The show-runner: polls, viewer questions, greetings, banter (LLM or scripted). |
| `web/assets/audience.js` | Event source: simulated crowd (demo) or the home server over WebSocket (live). |
| `server/` | The home server: `server.js` (HTTP + WebSocket + admin + save), `bridge.js` (TikTok / demo crowd), `think.js` (LLM voice), `admin.html`. |
| `api/think.js` | The voice as a Vercel function, for the online demo (`ANTHROPIC_API_KEY` in the project env). |
| `scripts/` | `pi-install.sh` / `pi-update.sh` (Raspberry Pi), `meshy-forms.mjs` / `meshy-rig.mjs` (3D assets), `build-web.sh` (Vercel). |

## Run it

On a Raspberry Pi (or any Linux box), once:

```bash
git clone https://github.com/mounemus/sociobeast-living-island.git ~/sociobeast
bash ~/sociobeast/scripts/pi-install.sh
```

Then open `http://<pi-ip>:8420/admin` (password `beast`, change it), enter the TikTok username, press **Connect to TikTok** or **Demo crowd**. Updates later: `bash ~/sociobeast/scripts/pi-update.sh`. SD-card recipe and first-boot automation: `scripts/pi-image/README.md`.

To put the creature on TikTok without a PC: open `http://<pi-ip>:8420/?kiosk=1` on a phone and go LIVE with TikTok's screen sharing (the phone renders, the Pi runs the show). With a PC: OBS browser source on `http://<pi-ip>:8420/` at 1080×1920. Autonomous box on a Pi 5: `scripts/pi-stream.sh` (Chromium + ffmpeg → RTMP, needs a TikTok stream key).

On a PC for a rehearsal:

```bash
cd server && npm install && npm run demo      # http://localhost:8420/ and /admin
```

Online demo, no server: `bash scripts/build-web.sh && python3 -m http.server -d web/dist 8769`.

Keys on the page: `H` hide HUD · `L` 25 likes · `G` Galaxy gift · `E` force evolution · `P` next show beat · `V` voice · `R` reset to egg. The admin panel does the same from a phone.

## Rules in one table

| Viewer does | Creature gets |
|---|---|
| ❤️ like | +0.5 food, +1 XP, hearts. 10+ at once: a hop. 20 wake it up when asleep. |
| 💬 comment | +4 joy, +3 XP. `dance`, `sing`, `spin`, `play`, `sleep`, `hi` are understood. Questions get an answer. |
| 🎁 gift | +10 food, +20 joy, 3 XP per coin. 50+ coins: a dance. 500+: fireworks. |
| ➕ follow | +25 XP, the viewer becomes a keeper. |
| 🔗 share | +30 XP. |

Forms: Egg 0 · Baby 100 · Child 1000 · Teen 5000 · Adult 10000 · Special 50000 · Legendary 100000 · Infinite 250000 XP, at most one evolution per minute. A question with a `?` in the chat gets answered by name. During a poll, `1` or `2` is a vote.

Food drains in about seven minutes, joy in twelve, energy in fifteen. At zero food the creature fades until someone feeds it. At zero energy it sleeps.

## License

MIT. Made by Abdel-Mounem Taouai, UbMaker, Montréal.
