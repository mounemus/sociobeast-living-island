/**
 * SOCIOBEAST — Pet (the online game: one creature per player)
 * The player picks a species, hatches it and raises it: feed, play, cuddle, sleep, talk. Its needs keep running while
 * the player is away (down to a comfortable floor, never to death), it evolves with care and it remembers its keeper
 * (api/think, mode 'pet'). XP, traits, stages and the journal belong to evolution.js: this file only sends it events.
 * ponytail: this tab is the authority and the save lives in localStorage (a player can only cheat their own pet);
 * move the rules behind a server function when rankings or trades arrive.
 */
(function() {
  'use strict';
  const $ = function(id) { return document.getElementById(id); };
  const clamp = function(v, a, b) { return Math.max(a, Math.min(b, v)); };
  const pick = function(a) { return a[Math.floor(Math.random() * a.length)]; };
  const esc = function(s) { return String(s || '').replace(/[&<>"]/g, function(c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };

  // ─────────────────────────────────────────────────────────────
  // SPECIES & RULES
  // ─────────────────────────────────────────────────────────────
  // A species needs one concept image per stage (assets/art/<art>.png) and, unless it is the dragon, the name of its model per
  // stage (assets/models/<name>.glb, plus <name>-idle.glb when rigged); art.length = its number of forms.
  // The four newer species share the dragon's egg and have 4 looks (<id>-1..4) for the 6 stages after it. `have` = how many of
  // those models exist yet: later stages keep the last one until theirs is generated.
  function looks(id, have) {
    const st = [1, 2, 2, 3, 3, 4];
    return { art: ['form-01-galactic-egg'].concat(st.map(function(n) { return id + '-' + n; })), models: ['form-01'].concat(st.map(function(n) { return id + '-' + Math.min(n, have); })) };
  }
  const SPECIES = {
    dragon: { label: 'Star dragon', defaultName: 'Nova', blurb: 'Cheeky and brave. Glows when it is proud.',
      personality: 'You are cheeky, brave and a little dramatic; you glow when you are proud.',
      art: ['form-01-galactic-egg', 'form-03-baby-nova', 'form-04-mini-alien', 'form-06-companion', 'form-08-guardian', 'form-09-stellar', 'form-11-living-legend'] },
    mochi: Object.assign({ label: 'Axolotl', defaultName: 'Mochi', blurb: 'Sweet and giggly. Almost never stops smiling.',
      personality: 'You are sweet, giggly and playful; you love water, bubbles and snacks, and you almost never stop smiling.' }, looks('mochi', 2)),
    bolt: Object.assign({ label: 'Plush robot', defaultName: 'Bolt', blurb: 'Curious and precise. Its heart light blinks when it is happy.',
      personality: 'You are a curious, precise little plush robot; you love facts and counting things, and your heart light blinks when you are happy.' }, looks('bolt', 2)),
    sprout: Object.assign({ label: 'Leaf spirit', defaultName: 'Sprout', blurb: 'Gentle and patient. Blooms when it is loved.',
      personality: 'You are gentle, patient and a little shy; you love rain, sunlight and quiet moments, and you bloom when you are loved.' }, looks('sprout', 2)),
    pixel: Object.assign({ label: 'Robot puppy', defaultName: 'Pixel', blurb: 'Loyal and bouncy. Wags its antenna tail.',
      personality: 'You are a loyal, bouncy robot puppy; you love fetching, running and guarding your keeper, and you wag your antenna tail when you are excited.' }, looks('pixel', 2))
  };
  const XP = Evolution.RULES.stageXp;
  const STAGES = [
    { name: 'Egg' },
    { name: 'Awakening', intro: 'It hatched! Tiny, hungry, already attached to you.' },
    { name: 'Explorer', intro: 'Curious about everything now.' },
    { name: 'Creator', intro: 'It makes things of its own now.' },
    { name: 'Hybrid', intro: 'A new shape, grown from what you did together.' },
    { name: 'Guardian', intro: 'Strong and bright. It looks after others now.' },
    { name: 'Singular', intro: 'A form nobody else has, raised by you.' }
  ].map(function(s, i) { s.xp = XP[i]; return s; });
  const TRAIT = { creativity: 'Creativity', sociability: 'Sociability', curiosity: 'Curiosity', energy: 'Vitality', empathy: 'Empathy', expression: 'Expression' };
  const EVENT = { warm_egg: ['warm-up', 'warm-ups'], care_action: ['meal', 'meals'], play: ['game', 'games'], cuddle: ['cuddle', 'cuddles'], talk: ['talk', 'talks'],
    complete_creation: ['creation', 'creations'], explore_new_zone: ['discovery', 'discoveries'], join_coop_quest: ['quest', 'quests'], daily_return: ['daily gift', 'daily gifts'] };
  const H = 3600;
  const RATE = { food: 100 / (8 * H), joy: 100 / (10 * H), energy: 100 / (14 * H), sleepRegen: 100 / (2 * H) }; // per second
  const SLEEP_AT = 5, WAKE_AT = 96, AWAY_CAP = 24 * H, LONELY_AFTER = 180, FLOOR = 20; // FLOOR: food and joy never sink lower, however long the player is away
  const KEY = 'sociobeast.pet.v1';
  // the city's places: the hint shown while the creature stands there, and what it says on its first visit of the day.
  // Which actions a place offers is written on the buttons (data-at in play.html).
  const PLACE = {
    seed:   { hint: 'Seed Plaza · tap a place, or the ground, to walk there', hello: 'The big seed is humming. Can you hear it?' },
    pulse:  { hint: 'Pulse Tower · a studio to make things', hello: 'A whole tower for making things! Can we try?' },
    bloom:  { hint: 'Bloom Gallery · the first exhibition is being hung', hello: 'The walls are still empty. One day, our pictures?' },
    market: { hint: 'Seed Market · the stalls are not open yet', hello: 'So many little stalls! Nothing to trade yet.' },
    echo:   { hint: 'Echo Garden · a quiet place for care', hello: 'It smells like rain and moss here. I like it.' },
    canopy: { hint: 'Canopy Lounge · room to play', hello: 'Cocoon seats! Look how high I can bounce!' }
  };
  let P = null, where = 'home'; // where: 'home' (the nest), 'city' (on the way) or the id of the place it stands at
  let synced = false, ask = null, acctNote = '', acctEmail = ''; // account: saves reconciled · the account's creature awaiting a choice · message and email of the panel

  function fresh(species, name, owner) {
    return Object.assign(Evolution.fresh(), { v: 2, species: species, name: name, owner: owner, born: Date.now(), food: 55, joy: 50, energy: 80, asleep: false,
      bond: 0, memory: [], streak: 0, lastDay: '', totals: { feeds: 0, plays: 0, cuddles: 0, talks: 0 }, saved: Date.now() });
  }
  // advances the needs by dt seconds, through as many awake/asleep phases as dt covers (every tick, and for the time spent away)
  function elapse(s, dt) {
    if (s.stage === 0) return;
    for (let guard = 0; dt > 1e-4 && guard < 400; guard++) {
      if (s.asleep) {
        const step = Math.min(dt, Math.max(0, WAKE_AT - s.energy) / RATE.sleepRegen);
        s.energy += step * RATE.sleepRegen; s.food -= step * RATE.food * 0.3; dt -= step;
        if (s.energy >= WAKE_AT - 1e-6) s.asleep = false;
      } else {
        const step = Math.min(dt, Math.max(0, s.energy - SLEEP_AT) / RATE.energy);
        s.food -= step * RATE.food; s.joy -= step * RATE.joy; s.energy -= step * RATE.energy; dt -= step;
        if (s.energy <= SLEEP_AT + 1e-6) s.asleep = true;
      }
    }
    s.food = clamp(s.food, FLOOR, 100); s.joy = clamp(s.joy, FLOOR, 100); s.energy = clamp(s.energy, 0, 100);
  }
  let awayFor = 0;
  function load() {
    try { const s = JSON.parse(localStorage.getItem(KEY)); if (!s || !SPECIES[s.species]) return null;
      if (!s.traits) { const st = Math.min(s.stage || 0, XP.length - 1); Object.assign(s, Evolution.fresh()); s.stage = st; s.xp = XP[st]; s.v = 2; } // a v1 save keeps its stage and restarts at that stage's XP
      awayFor = clamp((Date.now() - s.saved) / 1000, 0, AWAY_CAP); elapse(s, awayFor); return s; } catch (e) { return null; }
  }
  // always in this browser; also online once the player is signed in and the two saves are reconciled (see ACCOUNT)
  function save(now) { if (!P) return; P.saved = Date.now(); try { localStorage.setItem(KEY, JSON.stringify(P)); } catch (e) {} if (synced) Cloud.save(P, now === true); }
  addEventListener('beforeunload', save);
  document.addEventListener('visibilitychange', function() { if (document.hidden) save(true); });

  function nextStage() { return STAGES[P.stage + 1] || null; }
  function dayKey(d) { return d.toLocaleDateString('en-CA'); }
  // true when a new day starts on a streak: a small gift, never a penalty (a missed day only restarts the count)
  function newDay() {
    const now = new Date(), d = dayKey(now); if (P.lastDay === d) return false;
    const y = new Date(now); y.setDate(y.getDate() - 1);
    P.streak = P.lastDay === dayKey(y) ? P.streak + 1 : 1; P.lastDay = d;
    return P.streak > 1;
  }

  // ─────────────────────────────────────────────────────────────
  // MOOD & VOICE
  // ─────────────────────────────────────────────────────────────
  let lastActAt = Date.now(), lastTreatAt = 0, mood = 'curious';
  function computeMood() {
    const now = Date.now();
    if (P.asleep) return 'asleep';
    if (P.food < 25) return 'hungry';
    if (now - lastTreatAt < 6000) return 'ecstatic';
    if (P.energy < 22) return 'sleepy';
    if (now - lastActAt > LONELY_AFTER * 1000) return 'lonely';
    if (P.joy > 65) return 'happy';
    return 'curious';
  }
  const LINES = {
    hungry: ['My tummy is a tiny empty cave, {owner}.', 'Hungry… so hungry.', '{owner}, I am not dramatic, I am just starving.'],
    sleepy: ['*yawn* …five more minutes?', 'My eyes are heavy. The fireflies are singing.'],
    lonely: ['Are you still there, {owner}?', 'I practised a dance and nobody saw it.', 'The nest is quiet. Talk to me?'],
    happy: ['Today is a good day. I can feel it in my toes.', 'You are here. That is my favourite weather.', 'I found a shiny stone. I named it after you.'],
    ecstatic: ['YES! MORE! I am made of fireworks!', 'I cannot stop bouncing!'],
    curious: ['What do humans dream about?', 'I think the fireflies know my name.', 'I wonder what my next form looks like.', 'Do you also glow when you are happy?'],
    asleep: ['zzz… {owner}… zzz…', '*snore* …strawberries…'],
    create: ['I made a song about you, {owner}. It has three notes.', 'Look! I drew us in light.', 'I invented a dance. I named it the {name}.'],
    later: ['My ideas need a little rest. Later?', 'I am all out of ideas for today. Tomorrow!'],
    feed: ['Nom. Thank you {owner}!', 'Tastes like sunrise.', 'Yum! More like that!'],
    full: ['I am full! One more bite and I roll away.', 'No more, {owner}, my belly is a balloon.'],
    play: ['Catch me, firefly!', 'Again! Again!', 'Watch this!'],
    cuddle: ['Warm. Stay like this.', 'I can hear your heart from here, {owner}.', 'This is my favourite spot.'],
    talk: ['I listen with my whole body.', 'Tell me more, {owner}!', 'I like your words. I keep them.'],
    notSleepy: ['I am not sleepy! Play with me first.', 'Sleep? Now? I am wide awake.'],
    evolve: ['I… I am changing! Look at me!', 'Your care did this. I am NEW.', 'This is my new form. Do you like it?'],
    wake: ['*blink* …oh! Good morning, {owner}.', 'I am up! I am up!'],
    sleep: ['Good night. Dream of me. I will dream of you.', 'The nest is warm. Sleeping now…'],
    back: ['{owner}! You came back! I saved you a firefly.', 'Welcome back {owner}. I kept the nest warm.'],
    hello: ['Hi {owner}! It is me, {name}.', 'There you are, {owner}.']
  };
  function line(kind) { return pick(LINES[kind] || LINES.curious).replace(/\{owner\}/g, P.owner || 'friend').replace(/\{name\}/g, P.name); }
  function say(text, ms) {
    const b = $('bubble'); if (!b || !text) return;
    b.textContent = text; b.classList.remove('hidden'); b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop');
    clearTimeout(b._t); b._t = setTimeout(function() { b.classList.add('hidden'); }, ms || 4500);
    Creature.talk(Math.min(4, text.length / 14));
  }
  function speak(kind, ms) { say(line(kind), ms); }
  function banner(html, cls, ms) { const b = $('banner'); b.innerHTML = html; b.className = cls || ''; clearTimeout(b._t); b._t = setTimeout(function() { b.classList.add('hidden'); }, ms || 6000); }
  function pip(text) { if (where === 'home' && window.Cast && Cast.has('pip')) Cast.say('pip', text); }

  // ─────────────────────────────────────────────────────────────
  // CARE (what the player does)
  // ─────────────────────────────────────────────────────────────
  // every gain goes through the rules engine: one event, applied once, written in the journal
  let seq = 0;
  function reward(type) {
    const now = Date.now(), r = Evolution.apply(P, { key: now + '-' + (++seq), type: type, at: now, day: dayKey(new Date(now)) });
    if (r.evolved) evolve(P.stage);
    return r;
  }
  function bond(n) { P.bond = clamp(P.bond + n, 0, 100); }
  let lastCuddleAt = 0;
  function act(kind) {
    if (!P) return; lastActAt = Date.now();
    if (P.stage === 0) { if (kind === 'warm') { Creature.shiver(0.8); Creature.burstHearts(4); reward('warm_egg'); } return renderHud(); }
    if (kind === 'sleep') { if (P.asleep) wake(); else if (P.energy > 80) { speak('notSleepy'); Creature.hop(0.6); } else sleep(); return renderHud(); }
    if (P.asleep) { speak('asleep', 3000); return; }
    if (kind === 'feed') {
      if (P.food > 95) { speak('full'); Creature.lookAtCamera(2); return; }
      const g = Math.min(25, 100 - P.food); P.food += g; P.totals.feeds++; bond(0.5); lastTreatAt = P.food > 60 ? Date.now() : lastTreatAt;
      Creature.nom(1.5); Creature.burstHearts(6); if (Math.random() < 0.6) speak('feed', 3000); reward('care_action');
    } else if (kind === 'play') {
      if (P.energy < 12) { speak('sleepy'); Creature.yawn(); return; }
      const g = Math.min(20, 100 - P.joy), r = Math.random(); P.joy += g; P.energy -= 8; P.totals.plays++; bond(0.5); lastTreatAt = Date.now();
      if (r < 0.4) Creature.dance(4); else if (r < 0.7) Creature.play(); else { Creature.spin(); Creature.hop(1); }
      if (Math.random() < 0.6) speak('play', 3000); reward('play');
    } else if (kind === 'cuddle') {
      Creature.lookAtCamera(3); Creature.burstHearts(10, true);
      if (Date.now() - lastCuddleAt > 8000) { lastCuddleAt = Date.now(); P.joy = clamp(P.joy + 6, 0, 100); P.totals.cuddles++; bond(1); speak('cuddle', 3500); reward('cuddle'); }
    } else if (kind === 'create') { // at the Pulse Tower. ponytail: a song and a spin stand in for a real creation tool
      if (P.energy < 12) { speak('sleepy'); Creature.yawn(); return; }
      if (!reward('complete_creation').ok) { speak('later', 3500); Creature.lookAtCamera(2); return; }
      P.energy -= 6; P.joy = clamp(P.joy + 8, 0, 100); bond(0.5); lastTreatAt = Date.now();
      Creature.sing(3); Creature.spin(); speak('create', 4500);
    }
    renderHud();
  }

  // ─────────────────────────────────────────────────────────────
  // CITY — out of the nest: walk between the places; the first visit of the day to each one is a discovery
  // ─────────────────────────────────────────────────────────────
  function fade(fn) { const f = $('fade'); if (f.classList.contains('on')) return; f.classList.add('on'); setTimeout(function() { fn(); f.classList.remove('on'); }, 350); }
  // The game opens in the city (instant = no fade), egg included: it hatches on the plaza. An egg cannot walk, a sleeper stays in the nest.
  function enterCity(instant) {
    if (!P || P.asleep || where !== 'home') return;
    const go = function() { $('hud').classList.add('city'); $('talk').classList.add('hidden'); if (window.Cast) Cast.show(false); City.enter(arrive, function() { return P.stage > 0 && !P.asleep; }); };
    if (instant === true) go(); else fade(go);
  }
  function goHome() {
    if (where === 'home') return;
    fade(function() { where = 'home'; $('hud').classList.remove('city'); City.leave(); if (window.Cast) Cast.show(true); renderHud(); });
  }
  function arrive(id) { // id: the place it reached, or null when it sets off
    where = id || 'city'; lastActAt = Date.now();
    if (id && P.stage > 0) {
      const d = dayKey(new Date()); if (P.visitDay !== d) { P.visitDay = d; P.visited = []; }
      if (P.visited.indexOf(id) < 0) { P.visited.push(id); if (reward('explore_new_zone').ok) { say(PLACE[id].hello, 5000); Creature.lookAround(); Creature.burstSparks(40, 0xc6a5f3, 2); } }
    }
    renderHud();
  }
  function sleep() { if (P.asleep) return; P.asleep = true; Creature.setVitals(P); speak('sleep'); }
  function wake() { P.asleep = false; P.energy = Math.max(P.energy, 30); Creature.setVitals(P); Creature.hop(1); speak('wake'); }

  // ─────────────────────────────────────────────────────────────
  // ACCOUNT — a guest plays from this browser; signing in (an emailed link, cloud.js) keeps the creature online
  // ─────────────────────────────────────────────────────────────
  // which save to keep when the browser and the account both have one: the same creature → the one further along;
  // two different creatures → the player chooses ('ask'), because the other one is lost
  function pickSave(local, cloud) {
    if (!cloud || !SPECIES[cloud.species]) return local ? 'push' : 'none';
    if (!local) return 'pull';
    if (local.born !== cloud.born) return 'ask';
    return cloud.xp > local.xp || (cloud.xp === local.xp && cloud.saved > local.saved) ? 'pull' : 'push';
  }
  function adopt(s) { P = null; localStorage.setItem(KEY, JSON.stringify(s)); location.reload(); } // P = null: the save on unload must not write the old creature back
  function onUser(user) {
    synced = false; ask = null; renderAccount(); if (!user) return;
    Cloud.load().then(function(cloud) {
      const what = pickSave(P, cloud);
      if (what === 'pull') return adopt(cloud);
      if (what === 'ask') { ask = cloud; return showAccount(); }
      synced = true; acctNote = ''; if (what === 'push') save(true); renderAccount();
    }).catch(function() { acctNote = 'Could not reach your online save. Playing from this device for now.'; renderAccount(); });
  }
  function describe(s) { return esc(s.name) + ' · ' + SPECIES[s.species].label + ' · ' + STAGES[Math.min(s.stage || 0, STAGES.length - 1)].name + ' · ' + Math.floor(s.xp || 0) + ' XP'; }
  function renderAccount() {
    const u = Cloud.user(), i = Cloud.info;
    $('h-acct').textContent = u ? 'Saved online' : 'Save online'; $('a-title').textContent = ask ? 'Two creatures' : u ? 'Your online save' : 'Save online'; $('a-close').classList.toggle('hidden', !!ask);
    $('a-body').innerHTML = ask ? '<p>There is a creature on this device and another one in your account. Which one do you keep? The other one will be lost.</p>' +
        '<button type="button" class="act pickone" data-a="keep-local"><b>This device</b><span class="sub">' + describe(P) + '</span></button>' +
        '<button type="button" class="act pickone" data-a="keep-cloud"><b>My account</b><span class="sub">' + describe(ask) + '</span></button>'
      : u ? '<p>Signed in as <b>' + esc(u.email) + '</b>. Your creature is saved online and follows you to any device.</p>' +
        '<p id="a-msg" role="status">' + esc(acctNote || (i.error ? 'The last save did not go through (' + i.error + ').' : i.savedAt ? 'Last saved at ' + new Date(i.savedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + '.' : '')) + '</p>' +
        '<div class="row"><button type="button" class="act" data-a="out">Sign out</button><button type="button" class="act" data-a="del">Delete my online save</button></div>'
      : '<p>Your creature lives in this browser. Sign in with your email to keep it online and find it on another device. We store your email and your creature’s save, nothing else.</p>' +
        '<form id="a-form"><input type="email" id="a-email" required maxlength="120" placeholder="you@example.com" autocomplete="email" aria-label="Your email" value="' + esc(acctEmail) + '">' +
        '<label class="check"><input type="checkbox" id="a-adult" required> I am 18 or older</label><button class="act primary">Email me a sign-in link</button></form>' +
        '<p id="a-msg" role="status">' + esc(acctNote || (i.error ? 'Signing in did not work (' + i.error + ').' : '')) + '</p>';
  }
  function showAccount() { renderAccount(); $('account').classList.remove('hidden'); $('a-close').focus(); }
  function hideAccount() { if (!ask) $('account').classList.add('hidden'); } // the choice between two creatures cannot be skipped
  function accountClick(e) {
    if (e.target === this) return hideAccount();
    const a = e.target.closest('[data-a]'), k = a && a.dataset.a; if (!k) return;
    if (k === 'keep-local') { ask = null; synced = true; save(true); renderAccount(); }
    else if (k === 'keep-cloud') adopt(ask);
    else if (k === 'out') { acctNote = ''; Cloud.signOut(); }
    else if (k === 'del' && confirm('Delete your online save? Your creature stays in this browser.')) { synced = false; Cloud.remove().then(function(gone) { acctNote = (gone ? 'Your account and its online save are deleted.' : 'Online save deleted.') + ' Your creature stays in this browser.'; return Cloud.signOut(); }, function() { acctNote = 'Could not delete it. Try again in a minute.'; }).then(renderAccount); } // render last: signing out of a deleted account fires no event
  }
  function accountSubmit(e) {
    e.preventDefault(); acctEmail = $('a-email').value.trim(); e.target.querySelector('button').disabled = true; $('a-msg').textContent = 'Sending…';
    Cloud.signIn(acctEmail).then(function() { acctNote = 'Check your inbox: the link in the email signs you in on this device.'; }, function(err) { acctNote = 'Could not send the link (' + ((err && err.message) || 'network') + '). Try again in a minute.'; }).then(renderAccount);
  }

  let aiBusy = false, aiFails = 0;
  function talk(text) {
    text = String(text || '').trim().slice(0, 200); if (!text || !P || P.stage === 0) return;
    lastActAt = Date.now(); if (P.asleep) { speak('asleep', 3000); return; }
    P.totals.talks++; P.joy = clamp(P.joy + 5, 0, 100); bond(1); Creature.lookAtCamera(4);
    reward('talk');
    if (aiBusy || aiFails >= 2) { speak('talk'); return; }
    aiBusy = true; const sp = SPECIES[P.species];
    const ctrl = new AbortController(); const to = setTimeout(function() { ctrl.abort(); }, 10000);
    fetch('api/think', { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: ctrl.signal,
      body: JSON.stringify({ mode: 'pet', prompt: text, name: P.name, owner: P.owner, species: sp.label, personality: sp.personality, stage: STAGES[P.stage].name, mood: mood, food: P.food, joy: P.joy, energy: P.energy, bond: P.bond, memory: P.memory }) })
      .then(function(r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function(d) {
        if (!d || !d.text) { aiFails++; speak('talk'); return; }
        aiFails = 0; say(d.text, 7000);
        if (d.remember) { P.memory.push(String(d.remember).slice(0, 120)); P.memory = P.memory.slice(-12); save(); }
      })
      .catch(function() { aiFails++; speak('talk'); }).finally(function() { clearTimeout(to); aiBusy = false; });
  }

  // why an evolution happened: what was done since the previous one, and the strongest trait at that moment
  function cause(e) {
    return Object.keys(e.tally).map(function(k) { return e.tally[k] + ' ' + EVENT[k][e.tally[k] === 1 ? 0 : 1]; }).join(' · ') + (e.top ? ' · strongest trait: ' + TRAIT[e.top].toLowerCase() : '');
  }
  function evolve(st) {
    const stage = STAGES[st], art = SPECIES[P.species].art[st], why = cause(P.evolutions[P.evolutions.length - 1]);
    Creature.punch(0.5); Creature.burstSparks(60, 0xffffff, 2);
    setTimeout(function() {
      Creature.setStage(st, true); Creature.burstSparks(200, 0xfff2b0, 6); Creature.burstHearts(24, true); Creature.punch(1);
      banner('<img src="assets/art/' + art + '.png" alt=""><div><b>' + esc(P.name) + '</b> ' + (st === 1 ? 'hatched' : 'evolved into <b>' + stage.name + '</b>') + '<span class="sub">' + esc(stage.intro) + '</span><span class="sub">' + esc(why) + '</span></div>', 'evolve art', 11000);
    }, 600);
    setTimeout(function() { speak(st === 1 ? 'hello' : 'evolve', 6000); Creature.spin(); Creature.dance(5); }, 1800);
    if (st === 1) setTimeout(function() { pip('Feed it, play with it, talk to it. It grows with your care.'); }, 8000);
    save();
  }

  // ─────────────────────────────────────────────────────────────
  // TICK — needs, mood, and the creature's own will
  // ─────────────────────────────────────────────────────────────
  let lastTick = Date.now(), nextWhim = 6, saveIn = 5;
  function tick() {
    if (!P) return;
    const now = Date.now(), dt = clamp((now - lastTick) / 1000, 0, 5), wasAsleep = P.asleep; lastTick = now;
    elapse(P, dt);
    if (P.asleep !== wasAsleep) { if (P.asleep) speak('sleep'); else { Creature.hop(1); speak('wake'); } }
    if (P.asleep && where !== 'home') goHome(); // it dozed off in the city: back to the nest
    const m = computeMood(); if (m !== mood) { mood = m; Creature.setMood(m); if (m === 'hungry') { Creature.beg(4); speak('hungry'); } }
    Creature.setVitals(P); if (P.stage === 0) Creature.setHatchProgress(P.xp / STAGES[1].xp);
    nextWhim -= dt; if (nextWhim <= 0) { whim(); nextWhim = 8 + Math.random() * 10; }
    saveIn -= dt; if (saveIn <= 0) { saveIn = 5; if (newDay()) dayGift(); save(); }
    renderHud();
  }
  function dayGift() { if (reward('daily_return').ok) { pip('Day ' + P.streak + ' in a row! A little gift for ' + P.name + '.'); Creature.burstSparks(60, 0xffe08a, 3); } }
  function whim() {
    if (P.stage === 0) { if (Math.random() < 0.5) { Creature.shiver(1); say(pick(['*wobble*', '*tap tap* …from inside', 'Something is knocking.']), 3000); } return; }
    if (P.asleep) { if (Math.random() < 0.3) speak('asleep', 3000); return; }
    switch (mood) {
      case 'hungry': Creature.beg(4); if (Math.random() < 0.5) speak('hungry'); return;
      case 'sleepy': Creature.yawn(); if (Math.random() < 0.5) speak('sleepy'); return;
      case 'lonely': if (Math.random() < 0.5) { Creature.lookAround(); speak('lonely'); } else Creature.wander(); return;
    }
    const r = Math.random();
    if (r < 0.25) Creature.wander();
    else if (r < 0.4) { Creature.lookAtCamera(4); speak(mood === 'happy' ? 'happy' : 'curious'); }
    else if (r < 0.52) Creature.play();
    else if (r < 0.62) Creature.hop(0.9);
    else if (r < 0.7) Creature.sing(3);
    else if (r < 0.8) Creature.wave(2);
    else if (r < 0.9) Creature.lookAround();
    else if (mood === 'happy') Creature.dance(3);
  }

  // ─────────────────────────────────────────────────────────────
  // HUD
  // ─────────────────────────────────────────────────────────────
  function bar(id, v) { $(id).style.width = clamp(v, 0, 100) + '%'; }
  function cta() {
    const nx = nextStage(), left = nx ? Math.ceil(nx.xp - P.xp) : 0;
    if (P.stage === 0) return ['Warm the egg · <b>' + Math.round(P.xp / STAGES[1].xp * 100) + '%</b> hatched', 'egg'];
    if (P.asleep) return [esc(P.name) + ' is asleep · it wakes up rested', 'sleep'];
    if (P.food < 30) return ['<b>Hungry!</b> ' + (where === 'home' || where === 'echo' ? 'Feed ' + esc(P.name) : 'Walk ' + esc(P.name) + ' to the Echo Garden to eat'), 'urgent'];
    if (P.energy < 22) return ['<b>Tired…</b> ' + (where === 'home' ? 'put ' + esc(P.name) + ' to sleep' : 'take ' + esc(P.name) + ' home to sleep'), ''];
    if (where !== 'home') return [where === 'city' ? 'Tap a place, or the ground, to walk there' : PLACE[where].hint, ''];
    if (P.joy < 30) return ['<b>Bored…</b> ' + (where === 'home' || where === 'canopy' ? 'play or talk' : 'the Canopy Lounge is the place to play'), ''];
    if (nx && left <= Math.max(10, (nx.xp - STAGES[P.stage].xp) * 0.15)) return ['<b>' + left + ' XP</b> to ' + nx.name, 'evolve'];
    return [['Care for ' + esc(P.name) + ' and it grows', 'Each day you visit brings a small gift', nx ? left + ' XP to ' + nx.name : 'Final form'][Math.floor(Date.now() / 9000) % 3], ''];
  }
  function renderHud() {
    const st = STAGES[P.stage], nx = nextStage(), egg = P.stage === 0;
    $('h-name').textContent = P.name; $('h-stage').textContent = st.name;
    $('h-mood').textContent = egg ? '' : mood; $('h-streak').textContent = P.streak > 1 ? P.streak + ' days' : ''; $('h-bond').textContent = egg ? '' : 'bond ' + Math.floor(P.bond);
    bar('h-xp', nx ? (P.xp - st.xp) / (nx.xp - st.xp) * 100 : 100);
    $('h-xp-txt').textContent = nx ? Math.floor(P.xp) + ' / ' + nx.xp + ' XP → ' + nx.name : 'Final form · ' + Math.floor(P.xp) + ' XP';
    bar('h-food', P.food); bar('h-joy', P.joy); bar('h-energy', P.energy);
    $('h-vitals').className = 'panel ' + (egg ? 'egg' : '');
    ['food', 'joy', 'energy'].forEach(function(k) { $('v-' + k).classList.toggle('low', P[k] < 30); });
    document.querySelectorAll('#actions .act').forEach(function(b) { // data-at: where a button shows ('home', a place id, or 'city' for anywhere in the city)
      const a = b.dataset.act, at = (b.dataset.at || '').split(' '), here = at.indexOf(where) >= 0 || (where !== 'home' && at.indexOf('city') >= 0);
      b.classList.toggle('hidden', egg ? a !== 'warm' : a === 'warm' || !here);
      if (a !== 'sleep' && a !== 'warm' && a !== 'home') b.disabled = P.asleep; if (a === 'sleep') b.textContent = P.asleep ? 'Wake up' : 'Sleep';
    });
    $('places').classList.toggle('hidden', where === 'home' || egg); // an egg does not walk: no place names yet
    const c = cta(), el = $('cta'); if (el.innerHTML !== c[0]) el.innerHTML = c[0]; el.className = c[1] + ($('talk').classList.contains('hidden') ? '' : ' hidden');
  }
  // the journal: the six traits, why each evolution happened, the latest rewarded events
  function showJournal() {
    if (!P) return;
    const li = function(a, empty) { return a.join('') || '<li class="sub">' + empty + '</li>'; };
    $('j-title').textContent = 'Why ' + P.name + ' is who it is';
    $('j-traits').innerHTML = Evolution.RULES.traits.map(function(t) { return '<div class="trait t-' + t + '"><span>' + TRAIT[t] + '</span><div class="bar"><div style="width:' + P.traits[t] + '%"></div></div><span class="num">' + P.traits[t] + '</span></div>'; }).join('');
    $('j-evo').innerHTML = li(P.evolutions.slice().reverse().map(function(e) { return '<li><b>' + STAGES[e.stage].name + '</b> at ' + e.xp + ' XP<span class="sub">' + esc(cause(e)) + '</span></li>'; }), 'Still an egg. Warmth makes it hatch.');
    $('j-log').innerHTML = li(P.journal.slice(-12).reverse().map(function(l) {
      const tr = Object.keys(l.traits).map(function(t) { return TRAIT[t].toLowerCase() + ' +' + l.traits[t]; }).join(', ');
      return '<li><span class="sub">' + new Date(l.at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) + '</span> ' + EVENT[l.type][0] + ' · +' + l.xp + ' XP' + (tr ? ' · ' + tr : '') + '</li>';
    }), 'Nothing yet.');
    $('journal').classList.remove('hidden'); $('j-close').focus();
  }
  function hideJournal() { $('journal').classList.add('hidden'); }
  function anchorBubble() {
    requestAnimationFrame(anchorBubble);
    const b = $('bubble'); if (!b || b.classList.contains('hidden')) return;
    const p = Creature.headScreenPos();
    const top = $('top').offsetHeight + 24 + b.offsetHeight + ($('banner').classList.contains('hidden') ? 0 : 150);
    const x = clamp(p.x, 190, innerWidth - 190), y = clamp(p.y, top, innerHeight - 190);
    b.style.transform = 'translate(-50%, -100%) translate(' + x + 'px,' + (y - 12) + 'px)';
  }

  // ─────────────────────────────────────────────────────────────
  // BOOT — the picker for a new player, then the game
  // ─────────────────────────────────────────────────────────────
  function showPicker() {
    let chosen = Object.keys(SPECIES)[0];
    $('hud').classList.add('picking'); $('picker').classList.remove('hidden'); Creature.setStage(0, false);
    $('species').innerHTML = Object.keys(SPECIES).map(function(id) { const s = SPECIES[id]; return '<button type="button" class="card" data-id="' + id + '"><img src="assets/art/' + s.art[Math.min(3, s.art.length - 1)] + '.png" alt=""><b>' + esc(s.label) + '</b></button>'; }).join('');
    function mark() { document.querySelectorAll('#species .card').forEach(function(c) { const on = c.dataset.id === chosen; c.classList.toggle('on', on); c.setAttribute('aria-pressed', on); }); $('p-name').placeholder = SPECIES[chosen].defaultName; $('p-blurb').textContent = SPECIES[chosen].blurb; }
    $('species').addEventListener('click', function(e) { const c = e.target.closest('.card'); if (c) { chosen = c.dataset.id; mark(); } });
    $('picker-form').addEventListener('submit', function(e) {
      e.preventDefault();
      P = fresh(chosen, $('p-name').value.trim().slice(0, 16) || SPECIES[chosen].defaultName, $('p-owner').value.trim().slice(0, 16));
      $('picker').classList.add('hidden'); $('hud').classList.remove('picking'); save(); start();
    });
    mark();
  }
  function start() {
    P.stage = Evolution.stageOf(P.xp); Creature.setForms(SPECIES[P.species].models); Creature.setStage(P.stage, false); Creature.setVitals(P); mood = computeMood(); Creature.setMood(mood);
    const gift = newDay(); enterCity(true); renderHud(); setInterval(tick, 500);
    setTimeout(function() {
      if (P.stage === 0) say('Something is moving inside… keep it warm.', 6000);
      else speak(awayFor > H ? 'back' : mood === 'curious' ? 'hello' : mood, 5000);
      if (gift) setTimeout(dayGift, 5000);
    }, 1500);
  }
  function boot() {
    Creature.init($('scene')); anchorBubble();
    $('actions').addEventListener('click', function(e) {
      const b = e.target.closest('.act'); if (!b) return;
      if (b.dataset.act === 'talk') { const f = $('talk'); f.classList.toggle('hidden'); if (!f.classList.contains('hidden')) $('talk-in').focus(); if (P) renderHud(); }
      else if (b.dataset.act === 'city') enterCity(); else if (b.dataset.act === 'home') goHome();
      else act(b.dataset.act);
    });
    $('talk').addEventListener('submit', function(e) { e.preventDefault(); const i = $('talk-in'); talk(i.value); i.value = ''; });
    $('h-why').addEventListener('click', showJournal); $('j-close').addEventListener('click', hideJournal);
    $('journal').addEventListener('click', function(e) { if (e.target === this) hideJournal(); });
    addEventListener('keydown', function(e) { if (e.key === 'Escape') { hideJournal(); hideAccount(); } });
    if (Cloud.on) { // accounts are configured: offer the online save, also from the picker (a returning player on a new device)
      ['h-acct', 'p-signin'].forEach(function(id) { $(id).classList.remove('hidden'); $(id).addEventListener('click', showAccount); });
      $('a-close').addEventListener('click', hideAccount); $('account').addEventListener('click', accountClick);
      $('account').addEventListener('submit', accountSubmit); Cloud.init(onUser);
    }
    P = load(); if (P) start(); else showPicker();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();

  // self-test of the needs clock: run Pet.check() in the console
  function check() {
    const a = { stage: 2, asleep: false, food: 100, joy: 100, energy: 100 }; elapse(a, 4 * H);
    const b = { stage: 2, asleep: false, food: 100, joy: 100, energy: 6 }; elapse(b, 3 * H);   // dozes off, sleeps 1.8 h, wakes up
    const c = { stage: 0, asleep: false, food: 50, joy: 50, energy: 50 }; elapse(c, 24 * H);   // an egg has no needs
    const d = { stage: 2, asleep: false, food: 10, joy: 10, energy: 50 }; elapse(d, AWAY_CAP);
    const L = { species: 'mochi', born: 1, xp: 50, saved: 5 }, C = function(born, xp, saved, sp) { return { species: sp || 'mochi', born: born, xp: xp, saved: saved }; };
    const ok = [pickSave(null, null) === 'none' && pickSave(L, null) === 'push' && pickSave(null, L) === 'pull' && pickSave(L, C(2, 9, 9)) === 'ask' && pickSave(L, C(1, 60, 1)) === 'pull'
      && pickSave(L, C(1, 50, 4)) === 'push' && pickSave(L, C(1, 50, 6)) === 'pull' && pickSave(L, C(1, 999, 9, 'nope')) === 'push', // which save wins
      Math.abs(a.food - 50) < 0.01 && !a.asleep, !b.asleep && b.energy > 85 && b.energy < 96, c.food === 50, d.food === FLOOR && d.joy === FLOOR && d.energy >= SLEEP_AT - 0.01,
      Object.keys(SPECIES).every(function(k) { const s = SPECIES[k]; return s.art.length === STAGES.length && (!s.models || s.models.length === STAGES.length); }), // every species covers every stage
      Object.keys(Evolution.RULES.events).every(function(k) { return EVENT[k]; }) && Evolution.RULES.traits.every(function(t) { return TRAIT[t]; }), Evolution.check(),
      [].every.call(document.querySelectorAll('#actions .act'), function(b) { return b.dataset.act === 'warm' || (b.dataset.at || '').split(' ').every(function(w) { return w === 'home' || w === 'city' || PLACE[w]; }); })]; // every button names real places
    console.assert(ok.every(Boolean), 'Pet.check failed', ok, a, b, c, d); return ok.every(Boolean);
  }
  window.Pet = { state: function() { return P; }, mood: function() { return mood; }, act: act, talk: talk, check: check,
    reset: function() { P = null; localStorage.removeItem(KEY); location.reload(); } };
})();
