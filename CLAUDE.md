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
web/play.html             the online game, one creature per player (2026-11-14): species picker, care buttons, talk. No audience,
                          no home server needed; loads creature.js + cast.js + pet.js. The live show stays on index.html.
web/assets/evolution.js   the online game's rules engine (2026-11-14, after the NEOLIFE brief in ../_docs/neolife): RULES (6 traits, the XP of
                          the 7 stages, reward + cooldown + daily cap per event type), apply(state, {key, type, at, day}) = applied once or
                          refused with a reason, journal, evolutions with their cause. No DOM, clock or randomness; also runs under Node:
                          node -e "import('./web/assets/evolution.js').then(() => console.log(Evolution.check()))"  (in CI).
web/assets/pet.js         the game around it (SPECIES, STAGES names, RATE): needs clock elapse() (ticks and time away, food and joy never
                          below FLOOR, no death), daily streak, bond, memory, journal panel, AI talk through api/think mode 'pet'
                          ({text, remember}). Every gain is reward(type) → Evolution.apply; the AI voice never grants anything.
                          Save: localStorage 'sociobeast.pet.v1' (v2 = engine state merged in; v1 saves are migrated on load).
                          window.Pet = { state, mood, act, talk, check, reset }; Pet.check() self-tests the needs clock and the engine.
                          `where` = 'home' | 'city' | a place id; each action button lists where it shows (data-at in play.html);
                          the first visit of the day to a place = explore_new_zone. ?q=low = low graphics (creature.js).
web/assets/cloud.js       accounts and online save of the online game on Firebase (2026-11-14): sign-in by emailed link (Firebase
                          Authentication, compat SDK from gstatic), one Firestore document pets/{uid} reached over REST, readable and
                          writable by its owner only (firestore.rules at the repo root). Off while BEAST_CONFIG.firebase in play.html is
                          empty (guests only). pet.js decides which save wins (pickSave: same creature -> the one further along; two
                          different creatures -> the player chooses) and pushes at most every 20 s. The page is still the authority;
                          moving events behind a server function running evolution.js is the next step before anything shared.
                          Supabase was the first choice and was dropped: the owner's account is at its 2 free projects limit.
                          Firebase project `sociobeast` (owner's Google account, Firestore nam5 = United States, free plan). firebase.json +
                          .firebaserc at the repo root; deploy rules with the Firebase tools (`firebase deploy --only firestore`).
                          scripts/test-firestore-rules.mjs = the real check of the rules: two throwaway accounts on the live project,
                          15 assertions (owner only, no listing, no extra field, size cap), accounts deleted at the end.
web/assets/city.js        (state on 2026-11-14 night) play.html OPENS in this city, egg included; the nest is only for sleeping. Each place is a
                          textured model assets/models/city-<id>.glb (bloom, pulse, market, canopy, echo, seed; source image
                          assets/art/city-<id>.png, made like the creatures), loaded by loadModel(id, width, fade); a missing file keeps
                          the primitives below. Residents: one creature of every other species strolls and greets (spawnResidents).
web/assets/city.js        the daylight plaza of the online game (2026-11-14): Seed Plaza + Pulse Tower (Create), Bloom Gallery, Seed Market,
                          Echo Garden (Feed, Cuddle), Canopy Lounge (Play), built from primitives on first entry, palette given in sRGB
                          (col()). Tap a place or the ground to walk (one side step around the fountain), a name button per place
                          (keyboard), names slide along the screen edge when their place is off screen. window.City = { enter(onArrive),
                          leave, goTo(id), active }. It uses creature.js: setView('home'|'city') (sky, fog, lights, bloom, sRGB lift,
                          camera that follows from the south), goTo(points, done), standAt, ray, pos. The camera always looks north:
                          keep anything tall out of the south side, and fade what can stand between it and the creature (the fountain bud).
                          5 species: dragon (form-NN files) + mochi, bolt, sprout, pixel. The 4 newer ones share the dragon's egg and
                          have 4 looks each: art assets/art/<id>-1..4.png, models assets/models/<id>-N-idle.glb (rigged, Meshy via
                          Higgsfield image_to_3d) or <id>-N.glb (static; pixel is a quadruped, the humanoid rig does not fit it).
                          looks(id, have) in pet.js says how many of a species' models exist; raise `have` when one is added.
                          creature.js: Creature.setForms(names per stage) switches species; models and rigs are cached by file name.
web/assets/play.css       HUD additions for play.html (beast.css stays the base)
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
