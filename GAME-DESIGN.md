# SocioBeast, game design

## Fantasy

The audience of a TikTok Live raises a creature together. Nobody owns it. The chat is its family. Every viewer can see, in one glance, what it needs right now and what their tap will do.

## Core loop

1. The creature shows a need (hungry, bored, sleepy) or a goal (next form).
2. The call-to-action line at the bottom names the one action that helps (tap ❤️, comment, send a gift).
3. The viewer acts. The creature reacts within a second: a hop, hearts, a line with the viewer's name.
4. Progress is visible: a bar moves, a keeper climbs the list, a new body part grows.

Drain rates are tuned so a quiet minute is noticed and a busy minute is rewarded. Hunger is the main lever because likes are free and unlimited.

## Vitals

| Vital | Filled by | Drains in | At zero |
|---|---|---|---|
| Food | likes, gifts | ~7 min | fades (grey, slow, begs) until fed |
| Joy | comments, gifts | ~12 min | bored, calls out to the chat |
| Energy | sleep, gifts | ~15 min | falls asleep; 20 likes or a gift wake it |

Away from the stream, food and joy keep draining at half speed for up to 30 minutes, so the creature is hungry when the stream comes back. Classic tamagotchi.

## Evolution

Eight forms, thresholds taken from the launch poster (likes count as XP, a gift is 3 XP per coin). XP comes from every interaction; gifts are the accelerator (3 XP per coin). One evolution per minute maximum, so a big gift pays off over several minutes of spectacle instead of one flash.

| Form | XP | New parts |
|---|---|---|
| Egg | 0 | white shell with a glowing mark; cracks light up as hatching nears |
| Baby | 100 | plush white chibi body, glossy black eyes, blush, yellow tuft, arms, tail |
| Child | 1000 | cyan crystal crest, tiny fangs |
| Teen | 5000 | collar with a glowing pendant |
| Adult | 10000 | pink→cyan membrane wings |
| Special | 50000 | crystals on the back, belly glyph, bigger wings |
| Legendary | 100000 | feathered wings, gold crown, aura |
| Infinite | 250000 | dark cosmic coat, orbiting stars ("and if we went even further?") |

## Mood

Priority order: fading, asleep, hungry, ecstatic (gift or like burst in the last seconds), sleepy, lonely (no event for 75 s), happy (joy above 65), curious. Mood drives the face (mouth, brows, blush, eyelids), breathing rate and glow, and picks which scripted line family the creature uses.

## Autonomy

Every 6 to 14 seconds the creature chooses an action by itself: wander, hop, play with a firefly, sing, spin, wave at the camera, look around, or a mood-specific move (beg when hungry, yawn when sleepy, call out when lonely). It also names its best keeper from time to time. This is what makes the stream feel alive between interactions.

## Voice

Scripted lines cover every event and mood, with the viewer's name inserted. In live mode, questions in the chat and idle thoughts go through `api/think.php` (Anthropic or OpenAI) with a short system prompt that fixes the character: gentle, funny, a little cheeky, first person, under 140 characters, never mentions being an AI. Scripted lines are the fallback and the demo voice. Optional text-to-speech with a high pitch.

## The cast and the director

Pip (host) and Moss (elder) give the show a second and third voice so the beast never has to explain itself. The director runs a beat every 20 to 40 seconds, in this priority: greet new keepers, answer a queued viewer question by name (Moss for deep ones, the beast for questions about itself, Pip otherwise), open a two-option poll the chat votes on with `1`/`2` (result applied to the beast: dance, sing, spin, nap), a tip, then banter about the current mood. With an LLM the beat is generated as JSON (lines, action, poll) from the last six comments and the vitals; without one a scripted bank plays.

## Memory

Keepers are remembered by name with their likes, comments, coins, follows and shares. The top five are on screen. A keeper who comes back after 20 minutes is greeted by name.

## HUD

One glass layer, portrait first. Top: name, form, XP to next form, three vitals. Right (or a ticker in portrait): top keepers. Bottom left: last four events. Bottom centre: the single call-to-action. Speech bubble anchored above the creature's head. Nothing else.

## Out of scope for now

Multiple creatures, viewer-owned pets, clans, votes, seasons. These were tried in v12 to v16 and made the screen unreadable on a phone. One creature, one need, one action.
