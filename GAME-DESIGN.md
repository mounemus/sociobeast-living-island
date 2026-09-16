# 🌲 SOCIOBEAST — THE LIVING ISLAND
### Game Design Document · v14 "Nature Plays" · TikTok Live Edition

> **One-line pitch**: A floating island of ancient forest drifting through the cosmos, where **every TikTok viewer becomes a kodama** — a small tree spirit. Four peoples share the island: the Grove, the Forge, the Fang and the Veil. The audience does not watch a pet; **the audience is the ecosystem**, and what it does together during the live tips the balance between forest and iron, writes the island's mythology, and is inherited by the next live.

---

## 1. Inspiration & tone

The universe takes its *spirit* from Hayao Miyazaki's films — above all the moral world of *Princess Mononoke* — without borrowing its characters:

| Miyazaki principle | How the game lives it |
|---|---|
| **No villains** — only hunger, fear and pride | The Forge is not evil; it feeds people. The Fang are not cruel; they are afraid. Every people has a motto and a point of view. The Beast's AI voice is instructed never to name an enemy. |
| **Nature is a character, not a backdrop** | The island has a **Balance** (forest ↔ forge). Trees green up or turn to ash in real time depending on what the audience does. |
| **Curses are born of hatred** | Spam and industrial pressure raise **the Curse**. It spreads through the roots; the chat heals it by calming down (`!calm`, `!pray`, `!breathe`), not by fighting. |
| **Awe and silence** ("ma") | The **Tall One** — an immense, translucent night-walking spirit — crosses behind the island. Everything goes quiet. The Beast speaks in short sentences. |
| **Small things matter** | Kodama vanish and reappear on their own. Fireflies migrate. Rain washes the curse. Growth is slow and visible. |
| **Hand-painted palette** | Soft greens, ochre iron, indigo nights, pale-blue rain, warm dawns. |

Visual assets and names are original: the kodama model belongs to UbMaker; "kodama" itself is a Japanese folklore term for tree spirits.

---

## 2. Core loop

```
  A viewer appears ─► their kodama sprouts (name floating above, tint of their people)
        │
        ▼
  They interact (like / comment / gift / share / follow)
        │
        ├─► their kodama gains XP ─► Sprout → Kodama → Elder → Guardian (size, aura, crown)
        ├─► their PEOPLE gains influence ─► its quarter of the island glows
        ├─► the island's ENERGY rises ─► a WORLD EVENT awakens when full
        ├─► the BALANCE shifts: forest peoples vs the Forge ─► trees green or turn to ash
        └─► the Beast (the island's old spirit) reacts, remembers, dreams
        │
        ▼
  Every ~8 min: the COUNCIL ("!1 / !2 / !3") ─► a decision carved into the island's lore
        │
        ▼
  End of the live: SEASON closes ─► the winning people reshapes the biome ─► a PROPHECY for next time
```

---

## 3. The four peoples

Viewers are auto-assigned to the smallest people on first interaction; `!clan forge` etc. lets them move once per season.

| People | Element | Side | Tint | Quarter | Power at 100 % influence |
|---|---|---|---|---|---|
| 🌲 **Grove** | Ancient forest | forest | moss green | North | **Green Tide** — the whole island blooms, everyone +10 XP, the curse recedes |
| ⚒️ **Forge** | Iron & fire | industry | ochre | East | **Iron Bell** — embers rain, ×2 XP for 60 s… and the curse grows by 10 |
| 🐺 **Fang** | Wild beasts | forest | crimson | South | **The Hunt** — every spirit scatters, then charges back together; ×1.5 XP for 90 s |
| 🌙 **Veil** | Night spirits | forest | indigo | West | **Spirit Veil** — the sky goes dark, the Beast delivers a prophecy |

Influence decays 1 %/min, so a people must keep acting to hold its power.

---

## 4. Balance — the heart of the game

```
balance = (avg influence of Grove, Fang, Veil  −  influence of Forge) / 60      ∈ [−1 … +1]
```

- **+1 · "The forest thrives"** — lush greens, warm forest glow, thin mist.
- **0 · "Balance holds"** — the Miyazaki ideal: nobody wins, everyone lives.
- **−1 · "The Forge devours the land"** — foliage turns grey-ochre, the ground darkens, the mist thickens, and **the curse rises by 1.5 %/min** while the Forge holds more than 75 % influence.

Balance is shown on a two-sided bar in the HUD (🌲 ← → ⚒️) and drives the foliage colour of every tree in real time. The Forge being *useful* (×2 XP) but *dangerous* (curse) is the central tension: the audience decides how much industry the island can bear.

---

## 5. Gifts → spells

TikTok gifts are converted by coin value:

| Tier | Coins | Spell | What happens |
|---|---|---|---|
| ✨ Ember | 1–9 | Blessing | The giver's kodama glows and jumps |
| 🌸 Seed | 10–99 | Local bloom | Flowers burst around the giver; 3 spirits sprout |
| 🌧️ Rainfall | 100–499 | Weather | A firefly storm; +20 % island energy |
| 🐺 Great Howl | 500–4 999 | Meteor rain | Every spirit dances; the giver becomes an Elder; ×2 XP 60 s |
| 🌳 New Grove | 5 000+ | New land | A **permanent island fragment** named *"Grove of <giver>"* appears and enters the mythology |

---

## 6. Island energy → World Events

Likes +1 · comments +3 · shares +15 · follows +25 · gifts +coins. When the bar fills, an event awakens, weighted by the Beast's dominant emotion (and by the curse):

| Event | Trigger | On screen |
|---|---|---|
| 🌈 **Spirit Lights** | joy | Aurora over the island, every spirit sings |
| 🌳 **The Mother Tree awakens** | curiosity | A giant tree grows at the centre; the Beast tells a legend |
| ✨ **Firefly Migration** | excitement | 1 200 fireflies sweep across; 20 spirits sprout |
| 🌑 **The Tall One passes** | loneliness | Night falls; an immense translucent spirit crosses behind the island for 26 s; spirits hide, then return |
| 🌧️ **The First Rain** | curse > 50 % (50 % chance) | Rain for 25 s; the curse drops by 40 |
| 🔮 **Prophecy** | inspiration | The Beast foretells the next live |

The threshold grows +25 % after each event.

---

## 7. The Curse (tension)

- More than 60 interactions in 10 s → the curse rises (+2 per event).
- Forge > 75 % influence → +1.5 %/min. Iron Bell → +10.
- **50 %**: spirits tremble, the camera shivers. **80 %**: the sky bleeds red.
- **100 % · Curse Outbreak**: half the spirits hide, the island stops earning for 30 s, a red overlay pleads for calm.
- The chat heals it: `!calm` / `!pray` / `!breathe` (−5 each), Green Tide (−15), First Rain (−40), or time (−3 %/min).
- Healing rewards everyone with ×2 XP for 2 minutes.

Outbreaks are designed to be *the* clip-able moments of a live.

---

## 8. The Council (branching lore)

Every 8 minutes (configurable in `/admin`), the Beast asks a question in the moral register of the film. Vote with `!1`, `!2`, `!3` (90 s):

- *The Forge asks to cut the eastern grove for iron. What does the island say?* — Allow / Refuse / Offer only fallen wood
- *A wounded boar-spirit drags a curse to the shore. Heal it or drive it away?*
- *A human child raised by wolves asks to live on the island. Welcome them?* — Welcome / Send home / Let the wolves decide
- *The Mother Tree's spring is drying. Divert the Forge's river?* — Divert / Let the Forge keep it / Dig a new spring together
- *Hunters seek the head of the Tall One, believing it grants eternal life. Warn it?*
- *The night spirits ask for one hour of silence. Grant it?*
- *Should the island bear a name?* — Aether / Kodamaya / Leave it nameless

Decisions are stored in `lore_decisions` and injected into every AI prompt: myths, dreams and prophecies reference what the audience chose. **The lore is a book the audience writes one page at a time.**

---

## 9. Guardian progression (per viewer, persistent across lives)

| Rank | XP | Look | Privilege |
|---|---|---|---|
| 🌱 Sprout | 0 | small, translucent | — |
| 👻 Kodama | 50 | full size, tint of its people | name shown |
| 🍃 Elder | 300 | large, glowing aura, never vanishes | `!summon` sprouts 2 spirits |
| 👑 Guardian | 1 500 | crown of light | cited in the mythology, `!decree` opens a Council vote, `!summon` sprouts 5 |

XP: like +1 · comment +3 · share +10 · follow +20 · gift +coins/2. Returning viewers find *their* kodama waiting.

---

## 10. Chat commands

`!clan grove|forge|fang|veil` · `!me` · `!top` · `!quest` · `!lore` · `!calm` `!pray` `!breathe` · `!1 !2 !3` · `!summon` (Elder+) · `!decree` (Guardian) · `!feed !dance !hide !seek !rain !sleep`

## 11. Live quests
Three drawn per live from: reach 1 000 spirits · 20 new guardians · survive 2 outbreaks · 50 Council votes · awaken 3 World Events · 2 000 likes · a people reaches 100 % · call the First Rain. Completing one grants ×1.5 XP for 5 minutes and a Firefly Migration.

## 12. Day, night, seasons
An island day lasts 45 real minutes (dawn → day → dusk → night). At night the light turns indigo and the Beast dreams. A **season = one live**; at the end (`/admin` → *End season*) the people with the most XP reshapes the biome — a Forge victory leaves an ochre, ash-toned island for the next live, a Grove victory a lush one. Seasons and their winners are recorded.

---

## 12b. Chapters (levels) & the Island Director — Nature plays

The island is a **player**. `includes/island_director.php` runs inside every server tick and:

1. **Advances the story through 6 chapters**, each with a goal, an intro line and unlocks:

| # | Chapter | Goal | Unlocks |
|---|---|---|---|
| 1 | The Sprouting | 60 spirits · 5 guardians | the pond |
| 2 | Iron Comes | Forge reaches 60 % once, then balance back above 0 | the Ironwright · embers on the eastern shore |
| 3 | The Curse Awakens | **Boss**: heal 300 curse points (`!calm` `!pray` rain) to dissolve the Blightling | the Blightling · mist |
| 4 | The Walking Hill | keep the balance green 8 min | Mossback · light shafts |
| 5 | The Long Night | survive the Tall One ×2 · 30 Council votes | Ember-Eye · stars |
| 6 | Balance | every people ≥ 20 % and curse < 10 % | the Wanderer · bloom |

2. **Takes one move every 45–120 s** (aggressiveness slider in admin), chosen by utility scoring against the live state: call the rain, push blight, lean toward the weakest people (+12 % influence), let the Ironwright tempt the audience (×1.5 XP, +8 % Forge), make a character speak, send fireflies when the room is quiet, convene the Council, or ask for silence. Every move is logged ("Nature plays" panel on stream).

3. **Gives voice to the cast** — original characters occupying Miyazaki-like roles: 🐢 **Mossback** (ancient tortoise-god carrying a grove, keeper of balance), 🐆 **Ember-Eye** (great grey lynx, matriarch of the Fang), ⚒️ **The Ironwright** (leader of the Forge, "we are not evil, we are hungry"), 🎭 **The Wanderer** (masked traveller, speaks for balance), 🩸 **The Blightling** (the curse made flesh), 🌑 **The Tall One** (never speaks). With an AI key they improvise in character; without, they use written lines. They walk the island as procedural low-poly figures with lanterns and glows.

## 12c. Visual layer (v14)
Bloom post-processing (UnrealBloom), drifting mist planes, a glowing pond with ripples at the island's heart, volumetric-looking light shafts, embers over the Forge shore, rain, the Tall One's passing — each unlocked by chapter progress so the island visibly grows richer as the audience plays.

## 13. Architecture

```
 TikTok LIVE ──► bridge/tiktok-bridge.js (Node · tiktok-live-connector)
                          │  normalises like/comment/gift/follow/share/join, batches every 0.8 s
                          ▼  POST + secret
                  server/api/tiktok.php ──► includes/game_engine.php ──► SQLite
                                        │  (peoples, guardians, energy, balance,
                                        │   curse, council, quests, seasons)
                                        ▼
                  server/api/game.php ◄── poll 1.5 s ── assets/gameEngine.js
                                                       │
                                                       ├─► visualEngine.js (Three.js): named kodama, balance-driven
                                                       │    foliage, rain, the Tall One, fragments, fireflies
                                                       └─► HUD 9:16 (game.css): energy, balance, peoples,
                                                            curse, council, quests, leaderboard
 web/mock-api.js ── the same engine, in the browser (localStorage) ── Vercel demo
```

- No WebSocket needed on the PHP host: the bridge pushes over HTTP from any machine.
- `?demo=1` simulates an audience; `H` toggles the HUD, `G` fires a test Great Howl, `R` calls rain.
- OBS: browser source at 1080×1920.

---

## 14. Why it works on TikTok Live
1. **Your name on your creature** — instant attachment, a reason to come back.
2. **Four peoples with a real dilemma** — the Forge is tempting (×2 XP) but poisons the land; gifting becomes a moral choice, not just generosity.
3. **Outbreaks and the Tall One** — dramatic, clip-able, shareable.
4. **A lore written by votes** — a reason to type, not just tap.
5. **Persistence** — lives become episodes of one long story.

## 15. Roadmap
**v13.1** wind on grass, seasonal weather · **v13.2** the Beast's voice (TTS) narrating Council results, shareable guardian cards · **v13.3** YouTube / Twitch bridges · **v14** original creature-skin marketplace (UbMaker).
