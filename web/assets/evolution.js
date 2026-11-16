/**
 * SOCIOBEAST — Evolution engine (rules of the online game)
 * An event {key, type, at, day} is either applied once or refused; XP, the six traits, the stage and the journal ("why did
 * it evolve") all come from here, never from the AI voice. No DOM, no clock, no randomness: the same events always give
 * the same creature. Runs in the page (classic script) and under Node (import): `Evolution.check()` is the self-test.
 * ponytail: the page applies the events and keeps only the last 60 keys and journal lines; when accounts arrive, the same
 * file runs behind the server function and the full event log lives in the database.
 */
(function() {
  'use strict';
  const RULES = {
    version: 'prototype-0.4',
    traits: ['creativity', 'sociability', 'curiosity', 'energy', 'empathy', 'expression'],
    stageXp: [0, 50, 150, 350, 700, 1200, 2000], // cumulated XP of the 7 stages; prototype balance, to calibrate
    // cooldown: seconds between two rewarded events of a type · daily: rewarded events per day · onlyStage: valid at that stage only.
    // Past a limit the action still works in the game, it just earns nothing. Nothing here depends on an outside audience.
    events: {
      warm_egg:          { xp: 5,  traits: { empathy: 1 },     onlyStage: 0 },
      care_action:       { xp: 5,  traits: { empathy: 1 },     cooldown: 5,  daily: 8 },
      play:              { xp: 6,  traits: { energy: 1 },      cooldown: 5,  daily: 6 },
      cuddle:            { xp: 2,  traits: { sociability: 1 }, cooldown: 8,  daily: 5 },
      talk:              { xp: 3,  traits: { expression: 1 },  daily: 10 },
      complete_creation: { xp: 10, traits: { creativity: 2 },  cooldown: 30, daily: 3 },
      explore_new_zone:  { xp: 7,  traits: { curiosity: 2 },   cooldown: 2,  daily: 6 }, // first visit of the day to each place of the city
      join_coop_quest:   { xp: 8,  traits: { sociability: 1 }, cooldown: 60, daily: 3 },
      meet_resident:     { xp: 3,  traits: { sociability: 1 }, cooldown: 20, daily: 6 }, // a resident of the plaza says hello and the creature answers
      daily_return:      { xp: 20, traits: {},                 daily: 1 }
    }
  };
  const KEEP = 60;

  function fresh() {
    const traits = {}; RULES.traits.forEach(function(t) { traits[t] = 0; });
    return { xp: 0, stage: 0, traits: traits, last: {}, day: '', counts: {}, seen: [], journal: [], tally: {}, evolutions: [] };
  }
  function stageOf(xp) { let n = 0; RULES.stageXp.forEach(function(v, i) { if (xp >= v) n = i; }); return n; }
  function topTrait(s) { let best = ''; RULES.traits.forEach(function(t) { if (s.traits[t] > (best ? s.traits[best] : 0)) best = t; }); return best; }

  // applies one event to the state s (in place). Returns { ok, reason } and, when ok, { xp, traits, evolved }.
  function apply(s, ev) {
    const r = ev && RULES.events[ev.type];
    if (!r) return { ok: false, reason: 'unknown_type' };
    if (typeof ev.key !== 'string' || !ev.key || !isFinite(ev.at) || typeof ev.day !== 'string' || !ev.day) return { ok: false, reason: 'invalid' };
    if (s.seen.indexOf(ev.key) >= 0) return { ok: false, reason: 'duplicate' };
    if (r.onlyStage !== undefined && s.stage !== r.onlyStage) return { ok: false, reason: 'wrong_stage' };
    if (r.cooldown && s.last[ev.type] !== undefined && ev.at - s.last[ev.type] < r.cooldown * 1000) return { ok: false, reason: 'cooldown' };
    const counts = s.day === ev.day ? s.counts : {};
    if (r.daily && (counts[ev.type] || 0) >= r.daily) return { ok: false, reason: 'daily_cap' };

    s.day = ev.day; s.counts = counts; counts[ev.type] = (counts[ev.type] || 0) + 1; s.last[ev.type] = ev.at;
    s.seen.push(ev.key); if (s.seen.length > KEEP) s.seen.splice(0, s.seen.length - KEEP);
    s.xp += r.xp; s.tally[ev.type] = (s.tally[ev.type] || 0) + 1;
    Object.keys(r.traits).forEach(function(t) { s.traits[t] = Math.max(0, Math.min(100, s.traits[t] + r.traits[t])); });
    const line = { at: ev.at, type: ev.type, xp: r.xp, traits: r.traits }, st = stageOf(s.xp), evolved = st > s.stage;
    if (evolved) { // the cause of an evolution: what was done since the previous one, and the strongest trait at that moment
      s.stage = st; line.stage = st;
      s.evolutions.push({ at: ev.at, stage: st, xp: s.xp, tally: s.tally, top: topTrait(s) }); s.tally = {};
    }
    s.journal.push(line); if (s.journal.length > KEEP) s.journal.splice(0, s.journal.length - KEEP);
    return { ok: true, xp: r.xp, traits: r.traits, evolved: evolved };
  }
  function replay(events) { const s = fresh(); events.forEach(function(e) { apply(s, e); }); return s; }

  // self-test: thresholds, duplicates, limits, trait bounds, reload, determinism
  function check() {
    const T0 = 1e12, ev = function(i, type, day, at) { return { key: 'k' + i, type: type, at: at === undefined ? T0 + i * 3600e3 : at, day: day || 'd' + i }; };
    const ok = [];
    ok.push(RULES.stageXp.every(function(v, i) { return stageOf(v) === i && (i === 0 || stageOf(v - 1) === i - 1); }) && stageOf(1e9) === RULES.stageXp.length - 1); // thresholds
    const a = fresh(); for (let i = 0; i < 9; i++) apply(a, ev(i, 'warm_egg'));
    ok.push(a.xp === 45 && a.stage === 0);
    const hatch = apply(a, ev(9, 'warm_egg'));
    ok.push(hatch.evolved && a.stage === 1 && a.xp === 50 && a.evolutions.length === 1 && a.evolutions[0].tally.warm_egg === 10 && a.evolutions[0].top === 'empathy');
    ok.push(apply(a, ev(10, 'warm_egg')).reason === 'wrong_stage');                                    // an egg event after the hatch
    ok.push(apply(a, ev(9, 'care_action')).reason === 'duplicate' && a.xp === 50);                    // same key twice
    ok.push(apply(a, ev(11, 'nope')).reason === 'unknown_type' && apply(a, { type: 'talk' }).reason === 'invalid');
    const c = fresh(); apply(c, ev(0, 'play', 'd', T0));
    ok.push(apply(c, ev(1, 'play', 'd', T0 + 1000)).reason === 'cooldown' && apply(c, ev(2, 'play', 'd', T0 + 6000)).ok); // cooldown
    const d = fresh(); let got = 0; for (let i = 0; i < 14; i++) if (apply(d, ev(i, 'talk', 'd')).ok) got++;
    ok.push(got === 10 && apply(d, ev(20, 'talk', 'd')).reason === 'daily_cap' && apply(d, ev(21, 'talk', 'e')).ok); // daily cap, lifted the next day
    const m = fresh(); let met = 0; for (let i = 0; i < 9; i++) if (apply(m, ev(i, 'meet_resident', 'd')).ok) met++;
    ok.push(met === 6 && m.traits.sociability === 6 && m.xp === 18 && apply(fresh(), ev(0, 'meet_resident', 'd', T0)).ok && (function(s) { apply(s, ev(0, 'meet_resident', 'd', T0)); return apply(s, ev(1, 'meet_resident', 'd', T0 + 5000)).reason === 'cooldown'; })(fresh())); // meetings: capped per day, not farmable
    const t = fresh(); for (let i = 0; i < 200; i++) apply(t, ev(i, 'complete_creation'));
    ok.push(t.traits.creativity === 100 && t.stage === 6 && t.xp === 2000 && t.seen.length === KEEP && t.journal.length === KEEP && t.evolutions.length === 6); // bounds
    const log = []; for (let i = 0; i < 40; i++) log.push(ev(i, ['care_action', 'play', 'talk', 'explore_new_zone'][i % 4], 'd' + (i >> 3)));
    const whole = replay(log), half = JSON.parse(JSON.stringify(replay(log.slice(0, 20)))); log.slice(20).forEach(function(e) { apply(half, e); });
    ok.push(JSON.stringify(whole) === JSON.stringify(half) && JSON.stringify(whole) === JSON.stringify(replay(log)));  // reload, determinism
    if (!ok.every(Boolean)) console.error('Evolution.check failed', ok);
    return ok.every(Boolean);
  }

  globalThis.Evolution = { RULES: RULES, fresh: fresh, apply: apply, replay: replay, stageOf: stageOf, topTrait: topTrait, check: check };
})();
