# SocioBeast (project context for Claude Code)

A living 3D creature raised by a TikTok Live audience: likes feed it, comments make it talk, gifts make it evolve through
six forms (egg → hatchling → sprout → young beast → guardian → cosmic). It gets hungry, sleeps, gets lonely, remembers its
keepers and acts on its own. Everything user-facing is in **English**. v20 (2026-09-16) replaced the earlier "living island"
game (clans, council, 1000 kodama, painted sprites) which the owner rejected as cluttered and naive; do not bring it back.

- Demo (simulated audience): https://sociobeast-living-island.vercel.app/  (Vercel, auto-deploys from `main`)
- Repo: https://github.com/mounemus/sociobeast-living-island · Owner: Abdel-Mounem Taouai (UbMaker, Montréal)
- Design: `GAME-DESIGN.md` · Setup: `README.md`

## Layout
```
web/index.html            the page (static = demo). Served by server/server.js in live mode (BEAST_CONFIG injected, save preloaded)
web/assets/creature.js    procedural Three.js r128 creature + nest + sky + FX. Public API window.Creature (setStage, setMood,
                          setVitals, hop/dance/sing/beg/…, burstHearts, burstSparks, headScreenPos). All motion from the A state.
web/assets/game.js        rules (STAGES, RATE, GAIN), moods, scripted LINES, keepers, handle(event), director(), HUD, localStorage.
                          window.Game = { handle, state, mood, say, reset, evolve }
web/assets/cast.js        supporting characters: Pip (pink fairy host) and Moss (old turtle), 3D + bubbles. window.Cast.say(who,text)
web/assets/director.js    the AI show-runner: beats every 20-40 s (answer viewer questions by name, polls the chat votes on with 1/2,
                          greet new keepers, banter, tips). LLM via think in mode 'show' (JSON lines/action/poll), scripted bank as fallback.
web/assets/audience.js    demo crowd, or live = WebSocket /ws to the home server (events in, state out, admin cmds in)
web/assets/beast.css      HUD tokens + layout, portrait (max-aspect-ratio 3/4) rules at the bottom
server/server.js          home server (Pi): HTTP static + / with config injection, /admin, /api/state, /api/think, /api/status,
                          /api/events (external bridge, same contract), WebSocket /ws (roles display|admin), save in server/data/state.json
server/bridge.js          in-process TikTok bridge (tiktok-live-connector) + demo crowd; server/think.js the LLM voice (shared)
server/admin.html         admin panel (password → /api/login → token for /ws?role=admin): creature status, bridge, test events, settings
server/config.json        local config (git-ignored; config.example.json = defaults). Secrets live here, never in the repo.
api/think.js              Vercel function for the online demo; imports server/think.js (env ANTHROPIC_API_KEY / OPENAI_API_KEY)
web/assets/art/           the 11 form concept images (Higgsfield gpt_image_2_5, 2026-09-16) — the art bible and the input of the 3D step
web/assets/models/        optional form-NN.glb per form (NN = stage+1). creature.js loads them (GLTFLoader) and hides the
                          procedural body; the rig/FX/bubbles keep working. Missing file = procedural fallback.
scripts/meshy-forms.mjs   MESHY_API_KEY=… node scripts/meshy-forms.mjs [form numbers | char-pip prop-nest] → image-to-3D (Meshy 5, textured)
scripts/meshy-rig.mjs     MESHY_API_KEY=… [CLIPS=idle,wave,dance,jump] node scripts/meshy-rig.mjs 08 09 → rig + animation clips
                          (form-NN-idle/wave/dance/jump/cheer/look.glb). creature.js prefers form-NN-idle.glb (AnimationMixer, clips
                          cross-faded by dance/wave/sing/spin/hop) over the static form-NN.glb, over the procedural body.
web/assets/models/        also char-pip.glb, char-moss.glb (cast.js) and prop-nest.glb (floating rock nest, creature.js buildEnvironment)
web/assets/art/backdrop.png  painted 21:9 panorama on a cylinder behind the scene (creature.js buildEnvironment)
scripts/pi-install.sh     Raspberry Pi: Node 20, deps, avahi, systemd service `sociobeast` · pi-update.sh = git pull + restart
scripts/build-web.sh      web/dist = web (Vercel output, see vercel.json)
.github/workflows/ci.yml  node --check, home-server smoke test (demo), build
```

## Conventions
- The display tab is the game authority (rules in game.js); the server only relays events, stores the save (state.json) and configures.
  One display should run the show; extra screens start from the same save. Admin commands travel server → display as {type:'cmd'}.
- Event contract (bridge → WebSocket → game): `{type: like|comment|gift|follow|share|join, username, displayName, count, text, giftName, coins}`.
- Rules live in `game.js` only (STAGES / RATE / GAIN / LINES). One evolution per minute max (`EVOLVE_COOLDOWN`).
- Creature parts appear per stage via `partScale` in the render loop; add a part = build it at scale 0.001, reveal it by stage.
- Three.js r128 UMD from cdnjs + examples/js post-processing from jsdelivr; no ES modules, no `Vector3.randomDirection` (r130+).
- HUD: one glass layer, one contextual call-to-action (`cta()` in game.js). Check every UI change at 405×720 and 1600×900.
- Keys: H hud · L 25 likes · G Galaxy · E force evolution · P next show beat · V voice · R reset · `? keys` bottom right.
- Creature look (v21): white plush chibi dragon after the owner's reference poster (big glossy black eyes, blush, fangs, cyan crystal crest,
  glowing collar, pink→cyan membrane wings, feather wings + crown, neon night room with bokeh). 8 forms: egg 0 · baby 100 · child 1000 ·
  teen 5000 · adult 10000 · special 50000 · legendary 100000 · infinite 250000 XP. No TikTok logo anywhere (trademark).
- Comments flow: game.js command() → Director.onComment (votes, questions with '?') first, then the beast's tricks (dance/sing/…).

## Test locally
```
cd server && npm install && npm run demo       # http://localhost:8420/  ·  /admin (password beast)  ·  demo crowd server-side
bash scripts/build-web.sh && python3 -m http.server -d web/dist 8769     # static demo (Vercel)
for f in web/assets/*.js api/think.js server/*.js; do node --check "$f"; done
```
npm cannot install inside the Google Drive folder (EBADF): develop the server from a local copy (C:\Users\moune\sociobeast-local,
`web` junction to the Drive web folder) and copy package-lock.json back. On the Pi (ext4) it just works.
In the page console: `Game.reset()`, `Game.evolve()`, `Game.handle({type:'gift',username:'x',giftName:'Galaxy',coins:1000})`,
`Director.openPoll('Dance or sing?', ['dance','sing'], ['dance','sing'])`, `Director.beat()`, `Cast.say('moss', 'Hello')`.

## Graphics pipeline (owner's target: the Pixar-style poster)
Higgsfield costs measured 2026-09-16: 1 credit per image, 30 credits per textured image_to_3d (20 untextured); balance was 28 →
no model yet. Path: art images (done) → `scripts/meshy-forms.mjs` with a Meshy key (or Higgsfield image_to_3d when credits allow)
→ commit `web/assets/models/form-NN.glb`. Textured GLBs cannot blink or talk (static face); the rig still hops, squashes, tilts. Rigged forms (Meshy rigging, height_meters 0.6)
render where their BONES are (armature in cm, geometry in m): measure the skeleton, never the geometry, to scale them (loadRig).
Each clip GLB embeds the mesh (~6 MB): keep clips to what the show uses.

## Going live without a PC
`?kiosk=1` on the page = full screen + wake lock on first tap + no `? keys` (html.kiosk). Phone opens it and TikTok screen-share LIVE
streams it; the Pi only runs the show. `scripts/pi-stream.sh` = Chromium kiosk + ffmpeg x11grab → RTMP for a Pi 5 / PC (needs TikTok
RTMP URL + key; untested, no Pi 5 here). `scripts/pi-image/`: SD-card recipe + `firstrun.sh` first-boot automation (untested on hardware).

## Raspberry Pi 2 notes
32-bit armv7l: pi-install.sh uses the official Node tarball (NodeSource has no armhf build). 1 GB RAM is plenty for the server;
it never renders the scene. tiktok-live-connector, ws and bonjour-service are pure JS. Port 8420; mDNS name `sociobeast.local`.

## Backlog
1. Sound: a few procedural chirps (WebAudio) for hop / nom / evolve; TTS voice choice.
2. Idle mini-events every ~10 min (a shooting star to wish on, a visiting firefly swarm) to pull the chat in.
3. Shareable keeper card (canvas → PNG) when someone becomes top keeper.
4. YouTube / Twitch bridges writing to the same relay.
