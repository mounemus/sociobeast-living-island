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
web/index.html            the page (static = demo). index.php = same page in live mode on a PHP host (OBS browser source)
web/assets/creature.js    procedural Three.js r128 creature + nest + sky + FX. Public API window.Creature (setStage, setMood,
                          setVitals, hop/dance/sing/beg/…, burstHearts, burstSparks, headScreenPos). All motion from the A state.
web/assets/game.js        rules (STAGES, RATE, GAIN), moods, scripted LINES, keepers, handle(event), director(), HUD, localStorage.
                          window.Game = { handle, state, mood, say, reset, evolve }
web/assets/cast.js        supporting characters: Pip (pink fairy host) and Moss (old turtle), 3D + bubbles. window.Cast.say(who,text)
web/assets/director.js    the AI show-runner: beats every 20-40 s (answer viewer questions by name, polls the chat votes on with 1/2,
                          greet new keepers, banter, tips). LLM via think in mode 'show' (JSON lines/action/poll), scripted bank as fallback.
web/assets/audience.js    demo crowd or live poller of api/tiktok.php?since=id
web/assets/beast.css      HUD tokens + layout, portrait (max-aspect-ratio 3/4) rules at the bottom
web/api/tiktok.php        relay: POST from the bridge (secret, events, heartbeat) → SQLite queue; GET ?since= for the page
web/api/think.php         LLM voice (Anthropic/OpenAI), key in web/api/config.local.php (git-ignored)
api/think.js              same voice as a Vercel function for the demo (env ANTHROPIC_API_KEY) — keep its prompt in sync
bridge/tiktok-bridge.js   Node: TikTok LIVE → web/api/tiktok.php (tiktok-live-connector), heartbeat every 30 s
web/assets/art/           the 11 form concept images (Higgsfield gpt_image_2_5, 2026-09-16) — the art bible and the input of the 3D step
web/assets/models/        optional form-NN.glb per form (NN = stage+1). creature.js loads them (GLTFLoader) and hides the
                          procedural body; the rig/FX/bubbles keep working. Missing file = procedural fallback.
scripts/meshy-forms.mjs   MESHY_API_KEY=… node scripts/meshy-forms.mjs → image-to-3D (Meshy 5, textured) for each art image
scripts/build-web.sh      web/dist = web minus api (Vercel output, see vercel.json)
.github/workflows/ci.yml  php -l, node --check, relay smoke test, build
```

## Conventions
- The browser tab is the game authority; the server never holds game state. Keep it that way (one OBS source = one creature).
- Event contract (bridge → relay → game): `{type: like|comment|gift|follow|share|join, username, displayName, count, text, giftName, coins}`.
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
bash scripts/build-web.sh && python3 -m http.server -d web/dist 8769     # demo
php -S 127.0.0.1:8090 -t web                                             # live page + relay (index.php, api/)
curl -X POST 127.0.0.1:8090/api/tiktok.php -H 'Content-Type: application/json' -d '{"events":[{"type":"like","username":"t","count":5}]}'
for f in web/assets/*.js api/think.js; do node --check "$f"; done; for f in web/*.php web/api/*.php; do php -l "$f"; done
```
In the page console: `Game.reset()`, `Game.evolve()`, `Game.handle({type:'gift',username:'x',giftName:'Galaxy',coins:1000})`,
`Director.openPoll('Dance or sing?', ['dance','sing'], ['dance','sing'])`, `Director.beat()`, `Cast.say('moss', 'Hello')`.

## Graphics pipeline (owner's target: the Pixar-style poster)
Higgsfield costs measured 2026-09-16: 1 credit per image, 30 credits per textured image_to_3d (20 untextured); balance was 28 →
no model yet. Path: art images (done) → `scripts/meshy-forms.mjs` with a Meshy key (or Higgsfield image_to_3d when credits allow)
→ commit `web/assets/models/form-NN.glb`. Textured GLBs cannot blink or talk (static face); the rig still hops, squashes, tilts.

## Backlog
1. Sound: a few procedural chirps (WebAudio) for hop / nom / evolve; TTS voice choice.
2. Idle mini-events every ~10 min (a shooting star to wish on, a visiting firefly swarm) to pull the chat in.
3. Shareable keeper card (canvas → PNG) when someone becomes top keeper.
4. YouTube / Twitch bridges writing to the same relay.
