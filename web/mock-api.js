/**
 * SOCIOBEAST — Browser-only mock backend (Vercel demo)
 * Intercepts fetch("api/*.php") and runs a lightweight version of the
 * PHP GameEngine + StateEngine entirely in the browser (localStorage).
 * The real backend lives in /server (PHP + SQLite) for TikTok Live.
 */
(function() {
  'use strict';
  const LS = 'sociobeast_demo_v14';
  const now = () => Math.floor(Date.now() / 1000);
  const rnd = (a, b) => a + Math.random() * (b - a);
  const pick = a => a[Math.floor(Math.random() * a.length)];

  const CLANS = {
    grove: { name: 'Grove', icon: '🌲', color: '#7fd67f', quadrant: 0, power: 'green_tide',  power_name: 'Green Tide',  side: 'forest',   motto: 'The trees remember everything.' },
    forge: { name: 'Forge', icon: '⚒️', color: '#e0a050', quadrant: 1, power: 'iron_bell',   power_name: 'Iron Bell',   side: 'industry', motto: 'We are not evil. We are hungry.' },
    fang:  { name: 'Fang',  icon: '🐺', color: '#d9534f', quadrant: 2, power: 'the_hunt',    power_name: 'The Hunt',    side: 'forest',   motto: 'Teeth and loyalty.' },
    veil:  { name: 'Veil',  icon: '🌙', color: '#8f8ff0', quadrant: 3, power: 'spirit_veil', power_name: 'Spirit Veil', side: 'forest',   motto: 'What is unseen still watches.' }
  };
  const RANKS = [
    { key: 'wisp', name: 'Sprout', icon: '🌱', xp: 0, scale: 0.45 },
    { key: 'spirit', name: 'Kodama', icon: '👻', xp: 50, scale: 0.7 },
    { key: 'elder', name: 'Elder', icon: '🍃', xp: 300, scale: 1.0 },
    { key: 'legend', name: 'Guardian', icon: '👑', xp: 1500, scale: 1.3 }
  ];
  const TIERS = [
    { min: 5000, key: 'genesis', name: 'New Grove', icon: '🌳', effect: 'new_land' },
    { min: 500, key: 'cosmic', name: 'Great Howl', icon: '🐺', effect: 'meteor_rain' },
    { min: 100, key: 'storm', name: 'Rainfall', icon: '🌧️', effect: 'weather' },
    { min: 10, key: 'bloom', name: 'Seed', icon: '🌸', effect: 'local_bloom' },
    { min: 1, key: 'spark', name: 'Ember', icon: '✨', effect: 'blessing' }
  ];
  const QUESTS = [
    { key: 'spirits_500', text: 'Reach 500 spirits on the island', metric: 'spirits', target: 500 },
    { key: 'guardians_10', text: '10 new guardians join the island', metric: 'new_guardians', target: 10 },
    { key: 'votes_20', text: '20 votes at the Council', metric: 'votes', target: 20 },
    { key: 'energy_2', text: 'Awaken 2 World Events', metric: 'world_events', target: 2 },
    { key: 'likes_500', text: 'Gather 500 likes', metric: 'likes', target: 500 },
    { key: 'clan_100', text: 'A people reaches 100% influence', metric: 'clan_max', target: 1 },
    { key: 'rain_1', text: 'Call the First Rain to wash the curse', metric: 'rains', target: 1 }
  ];
  const COUNCIL = [
    { q: 'The Forge asks to cut the eastern grove for iron. What does the island say?', options: ['Allow the cutting', 'Refuse', 'Offer only fallen wood'] },
    { q: 'A wounded boar-spirit drags a curse to the shore. Heal it or drive it away?', options: ['Heal it', 'Drive it away'] },
    { q: 'A human child raised by wolves asks to live on the island. Welcome them?', options: ['Welcome them', 'Send them home', 'Let the wolves decide'] },
    { q: 'The Mother Tree\'s spring is drying. Divert the Forge\'s river?', options: ['Divert the river', 'Let the Forge keep it', 'Dig a new spring together'] },
    { q: 'Hunters seek the head of the Tall One, believing it grants eternal life. Warn it?', options: ['Warn the Tall One', 'Stay silent', 'Set a trap for the hunters'] },
    { q: 'Should the island bear a name?', options: ['Aether', 'Kodamaya', 'Leave it nameless'] }
  ];
  const WORLD = ['spirit_lights', 'mother_tree', 'firefly_migration', 'tall_one', 'first_rain', 'prophecy'];
  const CAST = {
    mossback: { name: 'Mossback', icon: '🐢', color: '#6fa86f', lines: ['I have carried this grove for a thousand springs. I can carry your quarrels too.', 'Slow down. The moss is listening.'] },
    ember_eye: { name: 'Ember-Eye', icon: '🐆', color: '#d9534f', lines: ['Humans smell of smoke and apology. Prove you are more than that.', 'Courage I respect. Greed I bury.'] },
    ironwright: { name: 'The Ironwright', icon: '⚒️', color: '#e0a050', lines: ['We do not hate the forest. We simply cannot eat it.', 'Iron feeds children. Show me a tree that does.'] },
    wanderer: { name: 'The Wanderer', icon: '🎭', color: '#c0c0ff', lines: ['Who here has asked the river what it wants?', 'Every side is right about something. That is the problem.'] },
    blightling: { name: 'The Blightling', icon: '🩸', color: '#3a0a12', lines: ['...see me... see me...', 'you made me. you made me.'] },
    tall_one: { name: 'The Tall One', icon: '🌑', color: '#9fd0ff', lines: ['…'] }
  };
  const CHAPTERS = [
    { n: 1, title: 'The Sprouting', goal: 'Reach 30 spirits and welcome 3 guardians', check: { spirits: 30, new_guardians: 3 }, unlock: ['pond'], intro: 'A grove wakes on a rock adrift in the dark. Small spirits open their eyes.', mood: 'gentle' },
    { n: 2, title: 'Iron Comes', goal: 'The Forge reaches 60% once — then bring the balance back above 0', check: { forge_60: 1, balance_pos: 1 }, unlock: ['ironwright', 'embers'], intro: 'Smoke rises on the eastern shore. The Ironwright has come, and her people are hungry.', mood: 'tempting' },
    { n: 3, title: 'The Curse Awakens', goal: 'Defeat the Blightling: heal 120 curse points with !calm, !pray and rain', check: { healed: 120 }, unlock: ['blightling', 'mist'], intro: 'Something black moves under the roots. Hatred has found a body.', mood: 'hostile' },
    { n: 4, title: 'The Walking Hill', goal: 'Keep the balance green for 3 minutes so Mossback wakes', check: { green_minutes: 3 }, unlock: ['mossback', 'shafts'], intro: 'The old tortoise stirs. A whole forest rides on its back.', mood: 'wise' },
    { n: 5, title: 'The Long Night', goal: 'Survive the Tall One once and hold 10 Council votes', check: { tall_one: 1, votes: 10 }, unlock: ['ember_eye', 'stars'], intro: 'The night grows tall. Ember-Eye watches the humans from the ridge.', mood: 'solemn' },
    { n: 6, title: 'Balance', goal: 'Every people above 20% and the curse below 10%', check: { all_peoples_20: 1, curse_low: 1 }, unlock: ['wanderer', 'bloom'], intro: 'Nobody won. Everyone lives. This is the hardest chapter, and the only one that matters.', mood: 'serene' }
  ];
  const SPEECH = {
    monologue: ['The forest does not hate the Forge. It only remembers.', 'Listen. Even the smallest kodama hears the rain before it falls.', 'We drift between stars, and still the moss hums beneath our feet.', 'There is no villain here. Only hunger, and the patience of trees.'],
    prophecy: ['When the four peoples share one fire, a new grove will rise from the void.', 'The Tall One will pass on the night the Forge falls silent.', 'A curse is only love that lost its way home.'],
    dream: ['I dreamed of a thousand small lanterns, each one a name I remember.', 'In the dream the trees were made of glass and sang your questions back.'],
    mythology: ['Long before the first human looked into the dark, the island already waited, patient as moss on stone. It learned to shine only when it was seen.', 'The Council of Sparks was born the night the sky cracked; four voices, one island, and a promise never to let the silence win.'],
    reactive: ['We feel it. The island shifts because of you.', 'Something changed in the wind — the spirits noticed.', 'The forest remembers this moment.'],
    greeting: ['A new spark. Welcome to the island.', 'We see you. Stay a while.'],
    evolution: ['Something ancient wakes inside us. We are more than we were.']
  };

  // ─── persistent store ───
  let D = load();
  function load() {
    try { const s = JSON.parse(localStorage.getItem(LS)); if (s && s.v === 1) return s; } catch (e) {}
    return fresh();
  }
  function fresh() {
    const t = now();
    return {
      v: 1,
      state: { evolution_stage: 0, total_xp: 0, energy: 80, happiness: 70, hunger: 30, autonomy_level: 0.1,
               emotions: { happy: 55, curious: 60, excited: 30, lonely: 20, inspired: 40, shy: 25 },
               personality: { trust: 50, confidence: 50, attachment: 40 },
               myth_count: 3, dream_count: 2, kodama_count: 1, age: 0, total_sessions: 1, birth: t,
               visual_instances: [{ instance_id: 'kodama_prime', pos_x: 0, pos_z: 0.5, scale: 1 }] },
      game: { season: 1, energy: 0, threshold: 300, chaos: 0, fractures: 0, fracturedUntil: 0, worldEvents: 0,
              islandTime: 0.3, biome: 'grove', mult: 1, multUntil: 0, lastTick: t, lastCouncil: t,
              winStart: t, winCount: 0, quests: rollQuests(), metrics: {} },
      clans: Object.fromEntries(Object.keys(CLANS).map(k => [k, { influence: 25, members: 0, xp: 0, wins: 0, lastPower: 0 }])),
      guardians: {}, vote: null, lore: [], fragments: [], events: [], eventId: 0,
      director: { chapter: 1, enabled: true, aggressiveness: 0.5, lastAction: now(), bossActive: false, bossHp: 0, greenSec: 0, unlocks: [], cm: {}, log: [], cast: {} }
    };
  }
  function save() { try { localStorage.setItem(LS, JSON.stringify(D)); } catch (e) {} }
  function rollQuests() { return QUESTS.slice().sort(() => Math.random() - 0.5).slice(0, 3).map(q => Object.assign({ progress: 0, done: false }, q)); }
  function queue(type, payload) { D.eventId++; D.events.push({ id: D.eventId, type, payload: payload || {}, created_at: now() }); if (D.events.length > 200) D.events.splice(0, D.events.length - 200); }
  function metric(k, n) { D.game.metrics[k] = (D.game.metrics[k] || 0) + (n || 1); }
  function rankFor(xp) { let r = RANKS[0]; RANKS.forEach(x => { if (xp >= x.xp) r = x; }); return r; }
  function pub(g) {
    const r = rankFor(g.xp), next = RANKS.find(x => x.xp > g.xp);
    return { username: g.username, name: g.name, clan: g.clan, clanColor: CLANS[g.clan].color, clanIcon: CLANS[g.clan].icon,
             xp: g.xp, rank: r.key, rankName: r.name, rankIcon: r.icon, scale: r.scale, nextXp: next ? next.xp : null,
             instanceId: g.instanceId, x: g.x, z: g.z, lives: g.lives };
  }

  // ─── guardians ───
  function touch(username, name) {
    let g = D.guardians[username];
    if (g) { g.lastSeen = now(); return [g, false]; }
    const clan = Object.keys(D.clans).sort((a, b) => D.clans[a].members - D.clans[b].members)[0];
    const a = CLANS[clan].quadrant * Math.PI / 2 + Math.random() * Math.PI / 2, d = 4 + Math.random() * 20;
    g = { username, name: name || username, clan, xp: 0, x: Math.cos(a) * d, z: Math.sin(a) * d, lives: 1, gifts: 0,
          instanceId: 'guardian_' + username.replace(/[^a-z0-9_]/gi, '') + '_' + Math.random().toString(36).slice(2, 8), lastSeen: now(), clanSeason: 0 };
    D.guardians[username] = g; D.clans[clan].members++;
    metric('new_guardians'); queue('guardian_born', { guardian: pub(g) });
    return [g, true];
  }
  function addXp(username, xp) {
    const g = D.guardians[username]; if (!g) return null;
    const mult = now() < D.game.multUntil ? D.game.mult : 1;
    xp = Math.round(xp * mult);
    const old = rankFor(g.xp); g.xp += xp; D.clans[g.clan].xp += xp;
    const nr = rankFor(g.xp);
    if (nr.key !== old.key) queue('rank_up', { guardian: pub(g), rank: nr });
    return { xp: g.xp, rankUp: nr.key !== old.key ? nr : null };
  }
  function setClan(username, clan) {
    if (!CLANS[clan]) return { ok: false };
    const [g] = touch(username);
    if (g.clanSeason === D.game.season && g.clan !== clan) return { ok: false, reason: 'already_changed' };
    if (g.clan === clan) return { ok: true };
    D.clans[g.clan].members = Math.max(0, D.clans[g.clan].members - 1); D.clans[clan].members++;
    const a = CLANS[clan].quadrant * Math.PI / 2 + Math.random() * Math.PI / 2, d = 4 + Math.random() * 20;
    g.clan = clan; g.clanSeason = D.game.season; g.x = Math.cos(a) * d; g.z = Math.sin(a) * d;
    queue('clan_change', { guardian: pub(g) }); return { ok: true };
  }
  const leaderboard = n => Object.values(D.guardians).sort((a, b) => b.xp - a.xp).slice(0, n).map(pub);

  // ─── core event ───
  function handle(type, d) {
    const username = (d.username || 'anonymous').trim() || 'anonymous';
    const count = Math.max(1, +d.count || 1);
    const [g, isNew] = touch(username, d.displayName);
    tick();
    const G = D.game, t = now();
    const isCalm = type === 'comment' && /^\s*!calm/i.test(d.text || '');
    if (t - G.winStart >= 10) { G.winStart = t; G.winCount = 0; }
    if (!isCalm) { G.winCount += type === 'like' ? Math.min(count, 5) : 1; if (G.winCount > 40) G.chaos = Math.min(100, G.chaos + 2); }
    let xp = 0, energy = 0, infl = 0, tier = null;
    switch (type) {
      case 'like': xp = Math.min(count, 30); energy = count; infl = 0.05 * count; metric('likes', count); break;
      case 'comment': xp = 3; energy = 3; infl = 0.5; command(username, d.text || ''); break;
      case 'gift': {
        const coins = Math.max(1, +d.coins || +d.value || 1) * count; tier = TIERS.find(x => coins >= x.min) || TIERS[TIERS.length - 1];
        xp = coins / 2; energy = coins; infl = coins * 0.4; g.gifts += coins;
        const payload = { guardian: pub(g), tier, coins, giftName: d.giftName || 'gift' };
        if (tier.key === 'genesis') payload.fragment = fragment(username, g.name);
        if (tier.key === 'cosmic' || tier.key === 'genesis') { if (g.xp < 300) xp += 300 - g.xp; G.mult = 2; G.multUntil = t + 60; payload.doubleXp = 60; }
        queue('gift_spell', payload); break;
      }
      case 'follow': xp = 20; energy = 25; infl = 3; break;
      case 'share': xp = 10; energy = 15; infl = 2; break;
      case 'join': if (!isNew) queue('guardian_return', { guardian: pub(g) }); break;
    }
    if (t < G.fracturedUntil) { xp = 0; energy = 0; infl = 0; }
    if (xp > 0) addXp(username, xp);
    if (infl > 0) clanInfluence(g.clan, infl);
    if (energy > 0) addEnergy(energy);
    // creature emotions (v11)
    const E = D.state.emotions;
    const bump = (k, v) => E[k] = Math.max(0, Math.min(100, E[k] + v));
    ({ like: () => { bump('happy', 2); bump('lonely', -3); }, comment: () => { bump('curious', 3); bump('lonely', -4); },
       gift: () => { bump('happy', 8); bump('excited', 8); bump('lonely', -10); bump('inspired', 3); }, follow: () => { bump('happy', 5); },
       share: () => { bump('excited', 3); }, join: () => {} })[type]();
    D.state.total_xp += xp;
    checkQuests(); save();
    return { type, username, newGuardian: isNew, tier };
  }
  function command(username, text) {
    if (!text.startsWith('!')) return;
    const [cmd, arg] = text.slice(1).toLowerCase().split(/\s+/);
    if (/^[123]$/.test(cmd)) return castVote(username, +cmd);
    const g = D.guardians[username];
    switch (cmd) {
      case 'calm': case 'pray': case 'breathe': metric('healed', Math.min(5, D.game.chaos)); D.game.chaos = Math.max(0, D.game.chaos - 5);
        if (D.game.chaos <= 0 && now() < D.game.fracturedUntil) { D.game.fracturedUntil = 0; D.game.mult = 2; D.game.multUntil = now() + 120; metric('fractures_survived'); queue('fracture_healed', { by: username }); }
        break;
      case 'clan': setClan(username, arg); break;
      case 'me': queue('spotlight', { guardian: pub(g) }); break;
      case 'top': queue('show_leaderboard', { top: leaderboard(5) }); break;
      case 'quest': queue('show_quests', { quests: D.game.quests }); break;
      case 'lore': if (D.lore.length) queue('tell_lore', { decision: D.lore[D.lore.length - 1] }); break;
      case 'summon': { const r = rankFor(g.xp).key; if (r === 'elder' || r === 'legend') queue('summon', { guardian: pub(g), count: r === 'legend' ? 5 : 2 }); break; }
      case 'decree': if (rankFor(g.xp).key === 'legend') openCouncil(); break;
      case 'feed': case 'dance': case 'hide': case 'seek': case 'chaos': case 'sleep': case 'rain': queue('collective_action', { action: cmd, by: username }); break;
    }
  }
  function clanInfluence(clan, amt) {
    const c = D.clans[clan]; c.influence = Math.min(100, c.influence + amt);
    if (c.influence >= 100 && now() - c.lastPower > 120) {
      c.influence = 40; c.lastPower = now(); metric('clan_max');
      const p = CLANS[clan].power; queue('clan_power', { clan, power: p, name: CLANS[clan].power_name });
      if (p === 'iron_bell') { D.game.mult = 2; D.game.multUntil = now() + 60; D.game.chaos = Math.min(100, D.game.chaos + 10); }
      if (p === 'spirit_veil') queue('request_speech', { mode: 'prophecy' });
      if (p === 'green_tide') { queue('mass_xp', { xp: 10 }); Object.values(D.guardians).forEach(g => g.xp += 10); D.game.chaos = Math.max(0, D.game.chaos - 15); }
      if (p === 'the_hunt') { D.game.mult = 1.5; D.game.multUntil = now() + 90; }
    }
  }
  function addEnergy(n) {
    const G = D.game; G.energy += n;
    if (G.energy >= G.threshold) {
      G.energy = 0; G.threshold = Math.round(G.threshold * 1.25); G.worldEvents++; metric('world_events');
      const E = D.state.emotions, map = { happy: 'spirit_lights', curious: 'mother_tree', excited: 'firefly_migration', lonely: 'tall_one', inspired: 'prophecy' };
      const dom = Object.keys(map).sort((a, b) => E[b] - E[a])[0];
      let ev = Math.random() < 0.6 ? map[dom] : pick(WORLD);
      if (G.chaos > 50 && Math.random() < 0.5) ev = 'first_rain';
      queue('world_event', { event: ev, number: G.worldEvents });
      if (ev === 'prophecy') queue('request_speech', { mode: 'prophecy' });
      if (ev === 'mother_tree') queue('request_speech', { mode: 'mythology' });
      if (ev === 'first_rain') { metric('healed', Math.min(40, G.chaos)); G.chaos = Math.max(0, G.chaos - 40); metric('rains'); }
      if (ev === 'tall_one') metric('tall_one_events');
      if (ev === 'tall_one') queue('request_speech', { mode: 'reactive', context: 'The Tall One is crossing the island. Speak in awe and silence.' });
    }
  }
  function fragment(username, name) {
    const n = D.fragments.length, f = { name: 'Grove of ' + name, donor: username, angle: (n * 2.399) % (2 * Math.PI), distance: 42 + n * 3, radius: 6 + Math.random() * 4, season: D.game.season };
    D.fragments.push(f); return f;
  }
  // council
  function openVote() { if (!D.vote || D.vote.status !== 'open') return null; return Object.assign({}, D.vote, { remaining: Math.max(0, D.vote.closes_at - now()) }); }
  function openCouncil() {
    if (openVote()) return; const q = pick(COUNCIL);
    D.vote = { id: D.eventId + 1, question: q.q, options: q.options, votes: Object.fromEntries(q.options.map((_, i) => [i + 1, 0])), voters: {}, status: 'open', opened_at: now(), closes_at: now() + 90 };
    D.game.lastCouncil = now(); queue('council_open', { vote: openVote() });
  }
  function castVote(username, c) { const v = openVote(); if (!v || c > v.options.length || D.vote.voters[username]) return; D.vote.voters[username] = c; D.vote.votes[c]++; metric('votes'); queue('vote_cast', { votes: D.vote.votes, total: Object.keys(D.vote.voters).length }); }
  function closeCouncil() {
    const v = D.vote; if (!v || v.status !== 'open' || now() < v.closes_at) return;
    const win = +Object.keys(v.votes).sort((a, b) => v.votes[b] - v.votes[a])[0], total = Object.values(v.votes).reduce((a, b) => a + b, 0);
    v.status = 'closed'; const decision = v.options[win - 1];
    D.lore.push({ question: v.question, decision, vote_count: total, season: D.game.season });
    queue('council_closed', { question: v.question, decision, votes: total });
    queue('request_speech', { mode: 'reactive', context: 'The council voted: ' + decision });
  }
  function checkQuests() {
    D.game.quests.forEach(q => { if (q.done) return; q.progress = D.game.metrics[q.metric] || 0;
      if (q.progress >= q.target) { q.done = true; D.game.mult = 1.5; D.game.multUntil = now() + 300; queue('quest_complete', { quest: q }); queue('world_event', { event: 'firefly_migration', number: 0, reward: true }); } });
  }
  function tick() {
    const G = D.game, t = now(), dt = t - G.lastTick; if (dt <= 0) return; G.lastTick = t; const m = dt / 60;
    if (G.chaos >= 100 && t >= G.fracturedUntil) { G.fracturedUntil = t + 30; G.fractures++; G.chaos = 60; queue('fracture', { number: G.fractures }); }
    else if (G.fracturedUntil && t >= G.fracturedUntil) { G.fracturedUntil = 0; metric('fractures_survived'); queue('fracture_healed', { by: 'time' }); }
    G.chaos = Math.max(0, G.chaos - 3 * m);
    Object.values(D.clans).forEach(c => c.influence = Math.max(5, c.influence - 1 * m));
    if (D.clans.forge.influence > 75) G.chaos = Math.min(100, G.chaos + 1.5 * m);
    G.islandTime = (G.islandTime + m / 45) % 1;
    closeCouncil(); if (t - G.lastCouncil > 4 * 60) openCouncil();
    directorTick(m, t);
    // creature decay
    const s = D.state; s.energy = Math.max(10, s.energy - 0.2 * m); s.hunger = Math.min(100, s.hunger + 0.3 * m);
    Object.keys(s.emotions).forEach(k => s.emotions[k] += (50 - s.emotions[k]) * 0.01 * m);
    s.age = t - s.birth; s.evolution_stage = s.total_xp > 1500 ? 4 : s.total_xp > 800 ? 3 : s.total_xp > 350 ? 2 : s.total_xp > 100 ? 1 : 0;
  }

  // ─── Nature plays (light Island Director) ───
  function unlockTo(ch) { const R = D.director; R.unlocks = []; for (let c = 1; c <= ch; c++) CHAPTERS[c - 1].unlock.forEach(u => R.unlocks.push(u)); if (R.unlocks.includes('blightling') && ch === 3 && !R.bossActive) { R.bossActive = true; R.bossHp = 120; } ['ironwright', 'mossback', 'ember_eye', 'wanderer'].forEach(k => R.cast[k] = R.unlocks.includes(k)); R.cast.blightling = R.bossActive; }
  function dlog(line) { D.director.log.push({ t: now(), line }); if (D.director.log.length > 30) D.director.log.shift(); queue('nature_move', { line, chapter: D.director.chapter }); }
  function speak(who, line) { const c = CAST[who]; if (!c) return; queue('character_speak', { who, name: c.name, icon: c.icon, color: c.color, line: line || pick(c.lines) }); }
  function directorTick(m, t) {
    const R = D.director, G = D.game, M = D.game.metrics;
    if (!R.unlocks.length) { unlockTo(1); dlog('Chapter 1 — ' + CHAPTERS[0].title + '. ' + CHAPTERS[0].intro); }
    const forest = (D.clans.grove.influence + D.clans.fang.influence + D.clans.veil.influence) / 3, forge = D.clans.forge.influence, balance = (forest - forge) / 60;
    const cm = R.cm;
    if (forge >= 60) cm.forge_60 = 1;
    if (balance > 0) { cm.balance_pos = 1; R.greenSec += m * 60; } else R.greenSec = Math.max(0, R.greenSec - m * 30);
    cm.green_minutes = Math.round(R.greenSec / 60 * 10) / 10; cm.spirits = M.spirits || 0; cm.new_guardians = M.new_guardians || 0; cm.votes = M.votes || 0; cm.tall_one = M.tall_one_events || 0; cm.healed = M.healed || 0;
    cm.all_peoples_20 = Math.min(...Object.values(D.clans).map(c => c.influence)) >= 20 ? 1 : 0; cm.curse_low = G.chaos < 10 ? 1 : 0;
    if (R.bossActive) { R.bossHp = Math.max(0, 120 - (cm.healed || 0) + G.chaos * 0.2); if (cm.healed >= 120) { R.bossActive = false; R.bossHp = 0; G.chaos = 0; R.cast.blightling = false; dlog('The Blightling dissolves into rain. Hatred remembered how to be water.'); queue('boss_defeated', { name: 'The Blightling' }); } }
    const ch = CHAPTERS[R.chapter - 1]; let done = true; Object.keys(ch.check).forEach(k => { if ((cm[k] || 0) < ch.check[k]) done = false; });
    if (done && R.chapter < CHAPTERS.length) { queue('chapter_complete', { chapter: R.chapter, title: ch.title }); R.chapter++; R.cm = {}; R.greenSec = 0; unlockTo(R.chapter); const nx = CHAPTERS[R.chapter - 1]; dlog('Chapter ' + R.chapter + ' — ' + nx.title + '. ' + nx.intro); queue('chapter', chapterPub() ); G.mult = 1.5; G.multUntil = t + 180; }
    const interval = 60 - 40 * R.aggressiveness;
    if (R.enabled && t - R.lastAction > interval) {
      R.lastAction = t;
      const weakest = Object.keys(D.clans).sort((a, b) => D.clans[a].influence - D.clans[b].influence)[0];
      const mood = ch.mood, r = Math.random;
      const c = { rain: G.chaos / 100 * 1.4 + r() * 0.3, blight: (balance < -0.2 ? 0.8 : 0.1) + (mood === 'hostile' ? 0.5 : 0) + r() * 0.3, help_weak: (1 - D.clans[weakest].influence / 100) * 0.9 + r() * 0.3,
                  tempt: (mood === 'tempting' ? 0.9 : 0.2) + r() * 0.3, character: (R.unlocks.length > 2 ? 0.6 : 0.1) + r() * 0.5, fireflies: 0.4 + r() * 0.3, council: (mood === 'solemn' || mood === 'serene' ? 0.5 : 0.2) + r() * 0.4 };
      const act = Object.keys(c).sort((a, b) => c[b] - c[a])[0];
      switch (act) {
        case 'rain': metric('healed', Math.min(25, G.chaos)); G.chaos = Math.max(0, G.chaos - 25); queue('world_event', { event: 'first_rain', number: 0, by: 'nature' }); dlog('Nature calls the rain. The curse loosens its grip.'); break;
        case 'blight': G.chaos = Math.min(100, G.chaos + 12 + 15 * R.aggressiveness); queue('blight', { strength: R.aggressiveness, boss: R.bossActive }); dlog('Black tendrils push through the roots. The island tests the humans.'); break;
        case 'help_weak': D.clans[weakest].influence = Math.min(100, D.clans[weakest].influence + 12); queue('nature_gift', { clan: weakest, amount: 12 }); dlog('Nature leans toward the ' + CLANS[weakest].name + ', who were losing ground.'); break;
        case 'tempt': D.clans.forge.influence = Math.min(100, D.clans.forge.influence + 8); G.mult = 1.5; G.multUntil = t + 60; speak('ironwright'); dlog('The Ironwright lights the furnaces: ×1.5 XP for a minute, and the forest holds its breath.'); break;
        case 'character': { const present = Object.keys(R.cast).filter(k => R.cast[k]); if (present.length) { const who = pick(present); speak(who); dlog(CAST[who].name + ' speaks.'); } break; }
        case 'fireflies': queue('world_event', { event: 'firefly_migration', number: 0, by: 'nature' }); dlog('Nature sends fireflies to call the humans back.'); break;
        case 'council': openCouncil(); dlog('The Wanderer convenes the Council.'); break;
      }
    }
  }
  function chapterPub() { const R = D.director, ch = CHAPTERS[R.chapter - 1]; const progress = {}; Object.keys(ch.check).forEach(k => progress[k] = { value: R.cm[k] || 0, target: ch.check[k] }); return { number: R.chapter, total: CHAPTERS.length, title: ch.title, goal: ch.goal, progress, unlocks: R.unlocks, mood: ch.mood, intro: ch.intro }; }
  function directorPub() { const R = D.director; const cast = {}; Object.keys(CAST).forEach(k => cast[k] = Object.assign({}, CAST[k], { present: !!R.cast[k] })); return { enabled: R.enabled, aggressiveness: R.aggressiveness, chapter: chapterPub(), boss: { active: R.bossActive, hp: Math.round(R.bossHp), max: 120 }, cast, log: R.log.slice(-12) }; }

  function gameState() {
    tick(); const G = D.game, t = now();
    const forest = (D.clans.grove.influence + D.clans.fang.influence + D.clans.veil.influence) / 3, balance = Math.max(-1, Math.min(1, (forest - D.clans.forge.influence) / 60));
    return { balance: Math.round(balance * 1000) / 1000, balanceLabel: balance > 0.35 ? 'The forest thrives' : balance < -0.35 ? 'The Forge devours the land' : 'Balance holds', season: G.season, biome: G.biome, energy: Math.round(G.energy), energyThreshold: G.threshold, chaos: Math.round(G.chaos * 10) / 10,
      fractured: t < G.fracturedUntil, fracturedRemaining: Math.max(0, G.fracturedUntil - t), fractures: G.fractures, worldEvents: G.worldEvents,
      islandTime: G.islandTime, xpMultiplier: t < G.multUntil ? G.mult : 1, xpMultiplierRemaining: Math.max(0, G.multUntil - t),
      clans: Object.fromEntries(Object.keys(CLANS).map(k => [k, Object.assign({}, CLANS[k], { influence: Math.round(D.clans[k].influence * 10) / 10, members: D.clans[k].members, xp: D.clans[k].xp, wins: D.clans[k].wins })])),
      quests: G.quests, vote: openVote(), leaderboard: leaderboard(5), director: directorPub(), guardianCount: Object.keys(D.guardians).length, lore: D.lore.slice(-3) };
  }
  function endSeason() {
    const winner = Object.keys(D.clans).sort((a, b) => D.clans[b].xp - D.clans[a].xp)[0];
    D.clans[winner].wins++; Object.values(D.clans).forEach(c => { c.influence = 25; c.xp = 0; });
    const G = D.game; G.season++; G.biome = winner; G.energy = 0; G.threshold = 300; G.chaos = 0; G.worldEvents = 0; G.quests = rollQuests(); G.metrics = {};
    queue('season_end', { winner, season: G.season - 1, biome: winner }); queue('request_speech', { mode: 'prophecy' }); save();
    return { winner, season: G.season };
  }
  function creatureState() {
    const s = D.state; const dom = Object.keys(s.emotions).sort((a, b) => s.emotions[b] - s.emotions[a])[0];
    return Object.assign({}, s, { dominant_emotion: dom, evolution: { name: ['Solitary Spirit', 'Awakening Colony', 'Forest Nation', 'Ancient Grove', 'Cosmic Forest'][s.evolution_stage] } });
  }

  // ─── fetch interceptor ───
  const realFetch = window.fetch.bind(window);
  const json = o => Promise.resolve(new Response(JSON.stringify(o), { status: 200, headers: { 'Content-Type': 'application/json' } }));
  window.fetch = function(url, opts) {
    const u = typeof url === 'string' ? url : url.url;
    const m = /api\/([a-z_]+)\.php(\?.*)?$/.exec(u);
    if (!m) return realFetch(url, opts);
    let body = {}; try { body = opts && opts.body ? JSON.parse(opts.body) : {}; } catch (e) {}
    const qs = Object.fromEntries(new URLSearchParams(m[2] || ''));
    const action = body.action || qs.action || 'get';
    try {
      switch (m[1]) {
        case 'state':
          tick();
          if (action === 'add_instance') { const id = 'kodama_' + Math.random().toString(36).slice(2, 10); D.state.visual_instances.push({ instance_id: id, pos_x: body.x, pos_z: body.z, scale: body.scale }); if (D.state.visual_instances.length > 1200) D.state.visual_instances.splice(1, 200); D.state.kodama_count = D.state.visual_instances.length; save(); return json({ success: true, instance_id: id, state: creatureState() }); }
          if (action === 'sync_instances') { D.state.kodama_count = (body.instances || []).length; metric('spirits', 0); D.game.metrics.spirits = Math.max(D.game.metrics.spirits || 0, D.state.kodama_count); save(); return json({ success: true }); }
          if (action === 'new_session') { D.state.total_sessions++; }
          save(); return json({ success: true, state: creatureState(), auto_content: Math.random() < 0.03 ? { type: Math.random() < 0.5 ? 'dream_pending' : 'mythology_pending' } : null });
        case 'event': { const r = handle(body.type || 'like', body); return json(Object.assign({ success: true, visualEffect: { like: 'glow', gift: 'burst', follow: 'sparkle', share: 'ripple', comment: 'ripple' }[body.type] || null, intensity: 1, state: creatureState() }, r)); }
        case 'speak': {
          const mode = body.mode || 'monologue', ctx = body.context || {};
          const bank = SPEECH[mode] || SPEECH.monologue;
          let text = pick(bank);
          if (ctx.context) text = 'The island stirs: ' + ctx.context + '. ' + pick(SPEECH.reactive);
          if (mode === 'mythology') { D.state.myth_count++; save(); return json({ success: true, text, mode, myth_type: ctx.type || 'legend', emotion: 'inspired' }); }
          if (mode === 'dream') { D.state.dream_count++; save(); return json({ success: true, text, mode, dream_type: 'vision', emotion: 'dreamy' }); }
          return json({ success: true, text, mode, emotion: creatureState().dominant_emotion });
        }
        case 'game':
          if (action === 'state') { const since = +(qs.since || body.since || 0); const st = gameState(); const evs = D.events.filter(e => e.id > since).slice(0, 60); save(); return json({ success: true, game: st, events: evs, lastId: evs.length ? evs[evs.length - 1].id : since }); }
          if (action === 'guardians') return json({ success: true, guardians: Object.values(D.guardians).sort((a, b) => b.lastSeen - a.lastSeen).slice(0, 400).map(pub) });
          if (action === 'fragments') return json({ success: true, fragments: D.fragments });
          if (action === 'report') { D.game.metrics.spirits = Math.max(D.game.metrics.spirits || 0, +body.spirits || 0); checkQuests(); save(); return json({ success: true }); }
          if (action === 'demo_event') return json({ success: true, result: handle(body.type || 'like', body) });
          if (action === 'end_season') return json(Object.assign({ success: true }, endSeason()));
          if (action === 'director') return json({ success: true, director: directorPub(), chapters: CHAPTERS.map(c => ({ number: c.n, title: c.title, goal: c.goal, unlock: c.unlock })) });
          if (action === 'admin') { const R = D.director;
            if (body.op === 'director') { if (body.key === 'chapter') { R.chapter = Math.max(1, Math.min(CHAPTERS.length, +body.value)); R.cm = {}; unlockTo(R.chapter); queue('chapter', chapterPub()); } if (body.key === 'enabled') R.enabled = !!body.value; if (body.key === 'aggressiveness') R.aggressiveness = Math.max(0, Math.min(1, +body.value)); }
            if (body.op === 'trigger') { if (body.event === 'speak') speak(body.who || 'wanderer'); else if (body.event === 'blight') queue('blight', { strength: 0.6 }); else if (body.event === 'council') openCouncil(); else queue('world_event', { event: body.event, number: 0, by: 'admin' }); }
            if (body.op === 'curse') D.game.chaos = Math.max(0, Math.min(100, D.game.chaos + (+body.delta || 0)));
            if (body.op === 'reset_game') { localStorage.removeItem(LS); D = fresh(); }
            save(); return json({ success: true, game: gameState() }); }
          if (action === 'bridge_status') return json({ success: true, lastPing: 0, lastEvent: 'demo mode — browser mock', status: { demo: true }, username: 'demo', now: now() });
          return json({ error: 'unknown' });
        case 'tiktok': { const evs = body.events || (body.type ? [body] : []); evs.forEach(e => handle(e.type, e)); return json({ success: true, processed: evs.length, game: gameState() }); }
        default: return json({ success: true });
      }
    } catch (e) { console.error('[mock]', e); return json({ error: e.message }); }
  };

  window.SocioMock = { reset() { localStorage.removeItem(LS); location.reload(); }, endSeason, state: () => D };
  console.log('[mock] Browser backend active — data in localStorage. SocioMock.reset() to wipe.');
})();
