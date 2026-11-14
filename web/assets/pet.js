/**
 * SOCIOBEAST — Pet (the online game: one creature per player)
 * The player picks a species, hatches it and raises it: feed, play, cuddle, sleep, talk. Its needs keep running while
 * the player is away, it evolves with care and it remembers its keeper (api/think, mode 'pet').
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
  // The four newer species share the dragon's egg and have 4 looks (<id>-1..4) for the 7 stages after it. `have` = how many of
  // those models exist yet: later stages keep the last one until theirs is generated.
  function looks(id, have) {
    const st = [1, 2, 2, 3, 3, 4, 4];
    return { art: ['form-01-galactic-egg'].concat(st.map(function(n) { return id + '-' + n; })), models: ['form-01'].concat(st.map(function(n) { return id + '-' + Math.min(n, have); })) };
  }
  const SPECIES = {
    dragon: { label: 'Star dragon', defaultName: 'Nova', blurb: 'Cheeky and brave. Glows when it is proud.',
      personality: 'You are cheeky, brave and a little dramatic; you glow when you are proud.',
      art: ['form-01-galactic-egg', 'form-03-baby-nova', 'form-04-mini-alien', 'form-06-companion', 'form-08-guardian', 'form-09-stellar', 'form-11-living-legend', 'form-10-cosmic-master'] },
    mochi: Object.assign({ label: 'Axolotl', defaultName: 'Mochi', blurb: 'Sweet and giggly. Almost never stops smiling.',
      personality: 'You are sweet, giggly and playful; you love water, bubbles and snacks, and you almost never stop smiling.' }, looks('mochi', 2)),
    bolt: Object.assign({ label: 'Plush robot', defaultName: 'Bolt', blurb: 'Curious and precise. Its heart light blinks when it is happy.',
      personality: 'You are a curious, precise little plush robot; you love facts and counting things, and your heart light blinks when you are happy.' }, looks('bolt', 2)),
    sprout: Object.assign({ label: 'Leaf spirit', defaultName: 'Sprout', blurb: 'Gentle and patient. Blooms when it is loved.',
      personality: 'You are gentle, patient and a little shy; you love rain, sunlight and quiet moments, and you bloom when you are loved.' }, looks('sprout', 2)),
    pixel: Object.assign({ label: 'Robot puppy', defaultName: 'Pixel', blurb: 'Loyal and bouncy. Wags its antenna tail.',
      personality: 'You are a loyal, bouncy robot puppy; you love fetching, running and guarding your keeper, and you wag your antenna tail when you are excited.' }, looks('pixel', 2))
  };
  const STAGES = [
    { name: 'Egg', xp: 0 },
    { name: 'Baby', xp: 12, intro: 'It hatched! Tiny, hungry, already attached to you.' },
    { name: 'Child', xp: 120, intro: 'Curious about everything now.' },
    { name: 'Teen', xp: 400, intro: 'A personality of its own. It talks back.' },
    { name: 'Adult', xp: 1000, intro: 'Fully grown, strong and bright.' },
    { name: 'Special Form', xp: 2500, intro: 'A rare form unlocked by your care.' },
    { name: 'Legendary', xp: 6000, intro: 'A legend, raised by you.' },
    { name: 'Infinite', xp: 15000, intro: 'And if you went even further…' }
  ];
  const H = 3600;
  const RATE = { food: 100 / (8 * H), joy: 100 / (10 * H), energy: 100 / (14 * H), sleepRegen: 100 / (2 * H) }; // per second
  const SLEEP_AT = 5, WAKE_AT = 96, AWAY_CAP = 24 * H, LONELY_AFTER = 180, TALK_XP_PER_DAY = 30;
  const KEY = 'sociobeast.pet.v1';
  let P = null;

  function fresh(species, name, owner) {
    return { v: 1, species: species, name: name, owner: owner, born: Date.now(), xp: 0, stage: 0, food: 55, joy: 50, energy: 80, asleep: false,
      bond: 0, memory: [], streak: 0, lastDay: '', talkXp: 0, totals: { feeds: 0, plays: 0, cuddles: 0, talks: 0 }, saved: Date.now() };
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
    s.food = clamp(s.food, 0, 100); s.joy = clamp(s.joy, 0, 100); s.energy = clamp(s.energy, 0, 100);
  }
  let awayFor = 0;
  function load() {
    try { const s = JSON.parse(localStorage.getItem(KEY)); if (!s || !SPECIES[s.species]) return null;
      awayFor = clamp((Date.now() - s.saved) / 1000, 0, AWAY_CAP); elapse(s, awayFor); return s; } catch (e) { return null; }
  }
  function save() { if (!P) return; P.saved = Date.now(); try { localStorage.setItem(KEY, JSON.stringify(P)); } catch (e) {} }
  addEventListener('beforeunload', save);
  document.addEventListener('visibilitychange', function() { if (document.hidden) save(); });

  function maxStage() { return SPECIES[P.species].art.length - 1; }
  function stageOf(xp) { let i = 0; STAGES.forEach(function(s, n) { if (xp >= s.xp && n <= maxStage()) i = n; }); return i; }
  function nextStage() { return P.stage < maxStage() ? STAGES[P.stage + 1] : null; }
  function dayKey(d) { return d.toLocaleDateString('en-CA'); }
  // returns the streak bonus when a new day starts, 0 otherwise
  function newDay() {
    const now = new Date(), d = dayKey(now); if (P.lastDay === d) return 0;
    const y = new Date(now); y.setDate(y.getDate() - 1);
    P.streak = P.lastDay === dayKey(y) ? P.streak + 1 : 1; P.lastDay = d; P.talkXp = 0;
    return P.streak > 1 ? 10 * Math.min(P.streak, 7) : 0;
  }

  // ─────────────────────────────────────────────────────────────
  // MOOD & VOICE
  // ─────────────────────────────────────────────────────────────
  let lastActAt = Date.now(), lastTreatAt = 0, mood = 'curious';
  function computeMood() {
    const now = Date.now();
    if (P.asleep) return 'asleep';
    if (P.food <= 2) return 'fading';
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
    fading: ['…so cold… …a little food… please…', '…{owner}… …I waited for you…'],
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
  function pip(text) { if (window.Cast && Cast.has('pip')) Cast.say('pip', text); }

  // ─────────────────────────────────────────────────────────────
  // CARE (what the player does)
  // ─────────────────────────────────────────────────────────────
  function gainXp(n) { P.xp += n; if (stageOf(P.xp) > P.stage) evolve(P.stage + 1); }
  function bond(n) { P.bond = clamp(P.bond + n, 0, 100); }
  let lastCuddleAt = 0;
  function act(kind) {
    if (!P) return; lastActAt = Date.now();
    if (P.stage === 0) { if (kind === 'warm') { Creature.shiver(0.8); Creature.burstHearts(4); gainXp(2); } return renderHud(); }
    if (kind === 'sleep') { if (P.asleep) wake(); else if (P.energy > 80) { speak('notSleepy'); Creature.hop(0.6); } else sleep(); return renderHud(); }
    if (P.asleep) { speak('asleep', 3000); return; }
    if (kind === 'feed') {
      if (P.food > 95) { speak('full'); Creature.lookAtCamera(2); return; }
      const g = Math.min(25, 100 - P.food); P.food += g; P.totals.feeds++; bond(0.5); lastTreatAt = P.food > 60 ? Date.now() : lastTreatAt;
      Creature.nom(1.5); Creature.burstHearts(6); if (Math.random() < 0.6) speak('feed', 3000); gainXp(g / 5);
    } else if (kind === 'play') {
      if (P.energy < 12) { speak('sleepy'); Creature.yawn(); return; }
      const g = Math.min(20, 100 - P.joy), r = Math.random(); P.joy += g; P.energy -= 8; P.totals.plays++; bond(0.5); lastTreatAt = Date.now();
      if (r < 0.4) Creature.dance(4); else if (r < 0.7) Creature.play(); else { Creature.spin(); Creature.hop(1); }
      if (Math.random() < 0.6) speak('play', 3000); gainXp(g / 4 + 1);
    } else if (kind === 'cuddle') {
      Creature.lookAtCamera(3); Creature.burstHearts(10, true);
      if (Date.now() - lastCuddleAt > 8000) { lastCuddleAt = Date.now(); P.joy = clamp(P.joy + 6, 0, 100); P.totals.cuddles++; bond(1); speak('cuddle', 3500); gainXp(1); }
    }
    renderHud();
  }
  function sleep() { if (P.asleep) return; P.asleep = true; Creature.setVitals(P); speak('sleep'); }
  function wake() { P.asleep = false; P.energy = Math.max(P.energy, 30); Creature.setVitals(P); Creature.hop(1); speak('wake'); }

  let aiBusy = false, aiFails = 0;
  function talk(text) {
    text = String(text || '').trim().slice(0, 200); if (!text || !P || P.stage === 0) return;
    lastActAt = Date.now(); if (P.asleep) { speak('asleep', 3000); return; }
    P.totals.talks++; P.joy = clamp(P.joy + 5, 0, 100); bond(1); Creature.lookAtCamera(4);
    if (P.talkXp < TALK_XP_PER_DAY) { P.talkXp += 3; gainXp(3); }
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

  function evolve(st) {
    P.stage = st; const stage = STAGES[st], art = SPECIES[P.species].art[st];
    Creature.punch(0.5); Creature.burstSparks(60, 0xffffff, 2);
    setTimeout(function() {
      Creature.setStage(st, true); Creature.burstSparks(200, 0xfff2b0, 6); Creature.burstHearts(24, true); Creature.punch(1);
      banner('<img src="assets/art/' + art + '.png" alt=""><div><b>' + esc(P.name) + '</b> ' + (st === 1 ? 'hatched' : 'evolved into <b>' + stage.name + '</b>') + '<span class="sub">' + esc(stage.intro) + '</span></div>', 'evolve art', 11000);
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
    const m = computeMood(); if (m !== mood) { mood = m; Creature.setMood(m); if (m === 'hungry') { Creature.beg(4); speak('hungry'); } if (m === 'fading') speak('fading', 8000); }
    Creature.setVitals(P); if (P.stage === 0) Creature.setHatchProgress(P.xp / STAGES[1].xp);
    nextWhim -= dt; if (nextWhim <= 0) { whim(); nextWhim = 8 + Math.random() * 10; }
    saveIn -= dt; if (saveIn <= 0) { saveIn = 5; const bonus = newDay(); if (bonus) dayBonus(bonus); save(); }
    renderHud();
  }
  function dayBonus(bonus) { pip('Day ' + P.streak + ' in a row! A little gift for ' + P.name + '.'); Creature.burstSparks(60, 0xffe08a, 3); gainXp(bonus); }
  function whim() {
    if (P.stage === 0) { if (Math.random() < 0.5) { Creature.shiver(1); say(pick(['*wobble*', '*tap tap* …from inside', 'Something is knocking.']), 3000); } return; }
    if (P.asleep) { if (Math.random() < 0.3) speak('asleep', 3000); return; }
    switch (mood) {
      case 'fading': Creature.shiver(2); return;
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
    if (mood === 'fading') return [esc(P.name) + ' is very weak · <b>feed it now</b>', 'urgent'];
    if (P.asleep) return [esc(P.name) + ' is asleep · it wakes up rested', 'sleep'];
    if (P.food < 30) return ['<b>Hungry!</b> Feed ' + esc(P.name), 'urgent'];
    if (P.energy < 22) return ['<b>Tired…</b> put ' + esc(P.name) + ' to sleep', ''];
    if (P.joy < 30) return ['<b>Bored…</b> play or talk', ''];
    if (nx && left <= Math.max(10, (nx.xp - STAGES[P.stage].xp) * 0.15)) return ['<b>' + left + ' XP</b> to ' + nx.name, 'evolve'];
    return [['Care for ' + esc(P.name) + ' and it grows', 'Come back every day · your streak is a gift', nx ? left + ' XP to ' + nx.name : 'Final form'][Math.floor(Date.now() / 9000) % 3], ''];
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
    document.querySelectorAll('#actions .act').forEach(function(b) { const a = b.dataset.act; b.classList.toggle('hidden', (a === 'warm') !== egg); if (a !== 'sleep' && a !== 'warm') b.disabled = P.asleep; if (a === 'sleep') b.textContent = P.asleep ? 'Wake up' : 'Sleep'; });
    const c = cta(), el = $('cta'); if (el.innerHTML !== c[0]) el.innerHTML = c[0]; el.className = c[1] + ($('talk').classList.contains('hidden') ? '' : ' hidden');
  }
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
    P.stage = stageOf(P.xp); Creature.setForms(SPECIES[P.species].models); Creature.setStage(P.stage, false); Creature.setVitals(P); mood = computeMood(); Creature.setMood(mood);
    const bonus = newDay(); renderHud(); setInterval(tick, 500);
    setTimeout(function() {
      if (P.stage === 0) say('Something is moving inside… keep it warm.', 6000);
      else speak(awayFor > H ? 'back' : mood === 'curious' ? 'hello' : mood, 5000);
      if (bonus) setTimeout(function() { dayBonus(bonus); }, 5000);
    }, 1500);
  }
  function boot() {
    Creature.init($('scene')); anchorBubble();
    $('actions').addEventListener('click', function(e) {
      const b = e.target.closest('.act'); if (!b) return;
      if (b.dataset.act === 'talk') { const f = $('talk'); f.classList.toggle('hidden'); if (!f.classList.contains('hidden')) $('talk-in').focus(); if (P) renderHud(); }
      else act(b.dataset.act);
    });
    $('talk').addEventListener('submit', function(e) { e.preventDefault(); const i = $('talk-in'); talk(i.value); i.value = ''; });
    P = load(); if (P) start(); else showPicker();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();

  // self-test of the needs clock: run Pet.check() in the console
  function check() {
    const a = { stage: 2, asleep: false, food: 100, joy: 100, energy: 100 }; elapse(a, 4 * H);
    const b = { stage: 2, asleep: false, food: 100, joy: 100, energy: 6 }; elapse(b, 3 * H);   // dozes off, sleeps 1.8 h, wakes up
    const c = { stage: 0, asleep: false, food: 50, joy: 50, energy: 50 }; elapse(c, 24 * H);   // an egg has no needs
    const d = { stage: 2, asleep: false, food: 10, joy: 10, energy: 50 }; elapse(d, AWAY_CAP);
    const ok = [Math.abs(a.food - 50) < 0.01 && !a.asleep, !b.asleep && b.energy > 85 && b.energy < 96, c.food === 50, d.food === 0 && d.joy === 0 && d.energy >= SLEEP_AT - 0.01,
      Object.keys(SPECIES).every(function(k) { const s = SPECIES[k]; return s.art.length === STAGES.length && (!s.models || s.models.length === STAGES.length); })]; // every species covers every stage
    console.assert(ok.every(Boolean), 'Pet.check failed', ok, a, b, c, d); return ok.every(Boolean);
  }
  window.Pet = { state: function() { return P; }, mood: function() { return mood; }, act: act, talk: talk, check: check,
    reset: function() { P = null; localStorage.removeItem(KEY); location.reload(); } };
})();
