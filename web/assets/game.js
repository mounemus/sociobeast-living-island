/**
 * SOCIOBEAST — Game
 * The rules of a creature raised by a TikTok Live audience.
 *   ❤️ likes feed it · 💬 comments cheer it (and it answers) · 🎁 gifts make it grow · ➕ follows make keepers.
 * It gets hungry, sleepy, lonely; it evolves through 6 forms; between two interactions it acts on its own.
 * One browser tab is the authority (the OBS source); state lives in localStorage.
 */
(function() {
  'use strict';
  const C = window.BEAST_CONFIG || {};
  const LIVE = C.mode === 'live';
  const $ = function(id) { return document.getElementById(id); };
  const clamp = function(v, a, b) { return Math.max(a, Math.min(b, v)); };
  const pick = function(a) { return a[Math.floor(Math.random() * a.length)]; };
  const esc = function(s) { return String(s || '').replace(/[&<>"]/g, function(c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };

  // ─────────────────────────────────────────────────────────────
  // RULES
  // ─────────────────────────────────────────────────────────────
  // 8 forms, thresholds from the launch poster (likes ≈ XP; gifts count 3 XP per coin)
  const STAGES = [
    { key: 'egg', name: 'Egg', xp: 0, intro: 'Everything starts here. Warm it with ❤️' },
    { key: 'baby', name: 'Baby', xp: 100, intro: 'It hatched thanks to your first hearts! Tiny, hungry, already in love with you.' },
    { key: 'child', name: 'Child', xp: 1000, intro: 'A crystal crest, tiny fangs. It is curious about everything now.' },
    { key: 'teen', name: 'Teen', xp: 5000, intro: 'A glowing collar and a personality. It talks back.' },
    { key: 'adult', name: 'Adult', xp: 10000, intro: 'Wings! Strong, bright, full of energy.' },
    { key: 'special', name: 'Special Form', xp: 50000, intro: 'Crystals bloom on its back. A unique evolution unlocked by your love.' },
    { key: 'legendary', name: 'Legendary', xp: 100000, intro: 'Feathered wings and a crown. An extraordinary creature born from you.' },
    { key: 'infinite', name: 'Infinite ?', xp: 250000, intro: 'And if we went even further…' }
  ];
  const RATE = { food: 0.22, joy: 0.14, energy: 0.11, sleepRegen: 0.9 };   // per second, awake
  const GAIN = { likeFood: 0.5, likeXp: 1, commentJoy: 4, commentXp: 3, followXp: 25, shareXp: 30, giftFood: 10, giftJoy: 20, giftXpPerCoin: 3 };
  const WAKE_LIKES = 20, LONELY_AFTER = 75, EVOLVE_COOLDOWN = 60000; // one form per minute, whatever the gift

  function fresh() { return { name: C.name || 'SocioBeast', born: Date.now(), xp: 0, stage: 0, food: 70, joy: 55, energy: 85, asleep: false, wakeLikes: 0, fadingSince: 0, keepers: {}, totals: { likes: 0, comments: 0, gifts: 0, coins: 0, follows: 0, shares: 0 }, evolvedAt: {}, saved: Date.now() }; }
  const KEY = 'sociobeast.beast.v1';
  let S = load();
  function load() {
    try { const s = JSON.parse(localStorage.getItem(KEY)); if (!s || !s.totals) return fresh();
      const away = clamp((Date.now() - s.saved) / 1000, 0, 1800);        // tamagotchi: it got hungry while you were away (30 min cap)
      s.food = clamp(s.food - away * RATE.food * 0.5, 0, 100); s.joy = clamp(s.joy - away * RATE.joy * 0.5, 0, 100);
      s.energy = clamp(s.energy + away * 0.3, 0, 100); s.asleep = false; return s; } catch (e) { return fresh(); }
  }
  function save() { S.saved = Date.now(); try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }
  addEventListener('beforeunload', save);

  function stageOf(xp) { let i = 0; STAGES.forEach(function(s, n) { if (xp >= s.xp) i = n; }); return i; }
  function nextStage() { return STAGES[S.stage + 1] || null; }

  // ─────────────────────────────────────────────────────────────
  // MOOD & VOICE
  // ─────────────────────────────────────────────────────────────
  let lastEventAt = Date.now(), lastGiftAt = 0, lastLikeBurstAt = 0, mood = 'curious';
  function computeMood() {
    const now = Date.now(); const fading = S.food <= 2 && now - S.fadingSince > 20000;
    if (fading) return 'fading';
    if (S.asleep) return 'asleep';
    if (S.food < 25) return 'hungry';
    if (now - lastGiftAt < 8000 || now - lastLikeBurstAt < 3000) return 'ecstatic';
    if (S.energy < 22) return 'sleepy';
    if (now - lastEventAt > LONELY_AFTER * 1000) return 'lonely';
    if (S.joy > 65) return 'happy';
    return 'curious';
  }

  const LINES = {
    hungry: ['My tummy is a tiny empty cave. Tap ❤️?', 'Hungry… so hungry. Likes taste like strawberries.', 'I could eat a hundred hearts right now.', '{name}, I am not dramatic, I am just starving.'],
    sleepy: ['*yawn* …five more minutes?', 'My eyes are heavy. The fireflies are singing.', 'I will sleep soon. Guard the nest for me?'],
    lonely: ['Is anyone there? I can hear the stars but not you.', 'The nest is quiet. Say hi and I will jump.', 'I practised a dance and nobody saw it.'],
    happy: ['Today is a good day. I can feel it in my tail.', 'You are here. That is my favourite weather.', 'I found a shiny stone. I named it after you.'],
    ecstatic: ['YES! MORE! I am made of fireworks!', 'I cannot stop bouncing!', 'My whole body is glowing because of you!'],
    curious: ['What do humans dream about?', 'I think the fireflies know my name.', 'Every heart you send stays inside me. I checked.', 'I wonder what my next form looks like.', 'Do you also glow when you are happy?'],
    asleep: ['zzz… hearts… zzz…', '*snore* …strawberries…'],
    fading: ['…so cold… …a little light… please…', '…{name}… …I remember you…'],
    like: ['Nom. Thank you {name}!', '{name} fed me! Tastes like sunrise.', 'Mmm, {n} hearts from {name}.', 'Yum! More like that, {name}!'],
    likeBig: ['{name} sent a whole feast! I am bouncing!', 'A storm of hearts from {name}!', '{name}! My belly is glowing!'],
    comment: ['{name} talks to me! I listen with my whole body.', 'I heard you, {name}.', 'Ooh, {name} said something. I like words.', '{name}, tell me more!'],
    hello: ['Hi {name}! I am {beast}. I eat likes.', 'Hello {name}! Come sit by the nest.', '{name}! I remember you… I think. I do now.'],
    who: ['I am {beast}. Half creature, half your hearts. I grow when you feed me.', 'A beast raised by strangers on the internet. Best family ever.'],
    gift: ['{name} gave me {gift}! I feel STRONGER.', 'A {gift} from {name}! I will remember this forever.', '{name}, that {gift} tasted like a thousand summers.'],
    giftBig: ['{name}!!! A {gift}! Something inside me is changing!', 'The stars came down for {name}\'s {gift}!'],
    follow: ['{name} is my keeper now. Welcome home.', 'A new keeper: {name}. I will guard your dreams.', '{name} joined the nest!'],
    share: ['{name} told the world about me! More friends will come!', '{name} shared my nest! My horns tingle.'],
    welcomeBack: ['{name}! You came back! I saved you a firefly.', 'Welcome back {name}. I kept the nest warm.'],
    evolve: ['I… I am changing! Look at me!', 'Your hearts did this. I am NEW.', 'This is my new form. Do you like it?'],
    wake: ['*blink* …oh! You woke me with hearts. Best alarm.', 'I am up! I am up! Who fed me?'],
    sleep: ['Good night. Dream of me. I will dream of you.', 'The nest is warm. Sleeping now… wake me with ❤️.'],
    dance: ['Dance mode! Watch my tail!', 'Everybody dance! {name} said so!'],
    sing: ['♪ la la, hearts and fireflies ♪', '♪ I am small but I am loud ♪'],
    play: ['Catch me, firefly!', 'Playtime!'],
    thinking: ['Hmm… let me think about that.', 'That is a big question for a small beast.', 'I am thinking with my tail.']
  };
  function line(kind, ctx) { const t = pick(LINES[kind] || LINES.curious); return t.replace(/\{name\}/g, (ctx && ctx.name) || 'friend').replace(/\{beast\}/g, S.name).replace(/\{gift\}/g, (ctx && ctx.gift) || 'a gift').replace(/\{n\}/g, (ctx && ctx.n) || ''); }

  let speaking = 0, aiBusy = false, lastAiAt = 0, aiFails = 0;
  const THINK_URL = LIVE ? 'api/think.php' : 'api/think';
  function say(text, ms) {
    const b = $('bubble'); if (!b || !text) return;
    b.textContent = text; b.classList.remove('hidden'); b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop');
    clearTimeout(b._t); b._t = setTimeout(function() { b.classList.add('hidden'); }, ms || 4500);
    Creature.talk(Math.min(4, text.length / 14)); tts(text, 'beast');
  }
  function speak(kind, ctx, ms) { say(line(kind, ctx), ms); }
  // In live mode the AI relay gives the creature real words; the scripted lines are the fallback and the demo voice.
  function aiSay(prompt, fallbackKind, ctx) {
    if (!C.ai || aiFails >= 2 || aiBusy || Date.now() - lastAiAt < 7000) return speak(fallbackKind, ctx);
    aiBusy = true; lastAiAt = Date.now();
    const ctrl = new AbortController(); const to = setTimeout(function() { ctrl.abort(); }, 6000);
    fetch(THINK_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: ctrl.signal,
      body: JSON.stringify({ prompt: prompt, mood: mood, stage: STAGES[S.stage].name, name: S.name, food: Math.round(S.food), joy: Math.round(S.joy), energy: Math.round(S.energy), keepers: topKeepers(3).map(function(k) { return k.name; }) }) })
      .then(function(r) { if (!r.ok) throw new Error(r.status); return r.json(); }).then(function(d) { if (!d || !d.text) aiFails++; else aiFails = 0; say(d && d.text ? d.text : line(fallbackKind, ctx), 6000); })
      .catch(function() { aiFails++; speak(fallbackKind, ctx); }).finally(function() { clearTimeout(to); aiBusy = false; });
  }
  let voiceOn = C.voice === true;
  const VOICES = { beast: { pitch: 1.5, rate: 1.05 }, pip: { pitch: 1.9, rate: 1.2 }, moss: { pitch: 0.6, rate: 0.85 } };
  function tts(text, who) { if (!voiceOn || !window.speechSynthesis) return; try { const v = VOICES[who] || VOICES.beast; const u = new SpeechSynthesisUtterance(text.replace(/[*♪]/g, '')); u.pitch = v.pitch; u.rate = v.rate; u.lang = 'en-US'; speechSynthesis.speak(u); } catch (e) {} }

  // ─────────────────────────────────────────────────────────────
  // KEEPERS (the audience's memory)
  // ─────────────────────────────────────────────────────────────
  function keeper(name) { const k = S.keepers[name] || (S.keepers[name] = { name: name, likes: 0, comments: 0, coins: 0, follows: 0, shares: 0, score: 0, first: Date.now(), last: 0 }); k.last = Date.now(); return k; }
  function topKeepers(n) { return Object.values(S.keepers).sort(function(a, b) { return b.score - a.score; }).slice(0, n); }
  function known(name) { const k = S.keepers[name]; return k && k.score >= 30 && Date.now() - k.last > 20 * 60 * 1000; }

  // ─────────────────────────────────────────────────────────────
  // EVENTS  (from the audience: demo or TikTok bridge)
  // ─────────────────────────────────────────────────────────────
  function feed(html, cls) {
    const f = $('feed'); if (!f) return; const el = document.createElement('div'); el.className = 'fitem ' + (cls || ''); el.innerHTML = html; f.prepend(el);
    while (f.children.length > 4) f.lastChild.remove(); setTimeout(function() { el.classList.add('fade'); }, 8000); setTimeout(function() { el.remove(); }, 9000);
  }
  function banner(html, cls, ms) { const b = $('banner'); b.innerHTML = html; b.className = cls || ''; clearTimeout(b._t); b._t = setTimeout(function() { b.classList.add('hidden'); }, ms || 6000); }
  let lastEvolveAt = 0;
  function gainXp(n) { S.xp += Math.round(n); if (stageOf(S.xp) > S.stage && Date.now() - lastEvolveAt > EVOLVE_COOLDOWN) evolve(S.stage + 1); }

  function handle(ev) {
    const name = ev.displayName || ev.username || 'someone'; const k = keeper(name); lastEventAt = Date.now();
    if (ev.type === 'join') { if (known(name)) { speak('welcomeBack', { name: name }); Creature.wave(); } return; }
    if (S.asleep && ev.type !== 'like') { /* only hearts wake it */ }
    switch (ev.type) {
      case 'like': {
        const n = Math.max(1, ev.count || 1); S.totals.likes += n; k.likes += n; k.score += n;
        if (S.asleep) { S.wakeLikes += n; Creature.shiver(0.6); if (S.wakeLikes >= WAKE_LIKES) wake(name); else if (Math.random() < 0.3) feed('❤️ <b>' + esc(name) + '</b> is waking ' + S.name + ' · ' + S.wakeLikes + '/' + WAKE_LIKES); return; }
        S.food = clamp(S.food + n * GAIN.likeFood, 0, 100); S.joy = clamp(S.joy + Math.min(n, 10) * 0.3, 0, 100); gainXp(n * GAIN.likeXp);
        Creature.burstHearts(Math.min(n, 12), n >= 10); if (n >= 10) { lastLikeBurstAt = Date.now(); Creature.hop(1); Creature.punch(0.4); }
        if (n >= 10) { feed('❤️ <b>' + esc(name) + '</b> sent ' + n + ' hearts', 'like'); if (Math.random() < 0.5) speak('likeBig', { name: name, n: n }); }
        else if (Math.random() < 0.15) { Creature.nom(1.2); speak('like', { name: name, n: n }, 3000); }
        else Creature.nom(0.8);
        break;
      }
      case 'comment': {
        S.totals.comments++; k.comments++; k.score += 3; S.joy = clamp(S.joy + GAIN.commentJoy, 0, 100); gainXp(GAIN.commentXp);
        feed('💬 <b>' + esc(name) + '</b> ' + esc((ev.text || '').slice(0, 60)), 'comment');
        Creature.lookAtCamera(3);
        if (!S.asleep) command(name, ev.text || '');
        break;
      }
      case 'gift': {
        const coins = Math.max(1, ev.coins || 1) * Math.max(1, ev.count || 1), gift = ev.giftName || 'a gift';
        S.totals.gifts++; S.totals.coins += coins; k.coins += coins; k.score += coins * 10; lastGiftAt = Date.now();
        if (S.asleep) wake(name);
        S.food = clamp(S.food + GAIN.giftFood, 0, 100); S.joy = clamp(S.joy + GAIN.giftJoy, 0, 100); S.energy = clamp(S.energy + 15, 0, 100);
        feed('🎁 <b>' + esc(name) + '</b> sent <b>' + esc(gift) + '</b>' + (coins > 1 ? ' ×' + coins : ''), 'gift');
        if (coins >= 500) { banner('🌟 <b>' + esc(name) + '</b> sent <b>' + esc(gift) + '</b><span class="sub">' + S.name + ' surges with power</span>', 'gift', 7000); Creature.burstSparks(260, 0xfff1a8, 5); Creature.burstHearts(30, true); Creature.spin(); Creature.dance(5); Creature.punch(1); speak('giftBig', { name: name, gift: gift }, 6000); }
        else if (coins >= 50) { Creature.burstSparks(120, 0xffe08a, 4); Creature.burstHearts(16, true); Creature.dance(3.5); Creature.punch(0.7); speak('gift', { name: name, gift: gift }, 5000); }
        else { Creature.burstSparks(40, 0xffe08a, 2.5); Creature.nom(2); Creature.hop(0.8); speak('gift', { name: name, gift: gift }, 4000); }
        gainXp(coins * GAIN.giftXpPerCoin);
        break;
      }
      case 'follow': S.totals.follows++; k.follows++; k.score += 25; gainXp(GAIN.followXp); feed('➕ <b>' + esc(name) + '</b> became a keeper', 'follow'); Creature.bow(); Creature.burstHearts(6); speak('follow', { name: name }); if (window.Director) Director.newKeeper(name); break;
      case 'share': S.totals.shares++; k.shares++; k.score += 30; gainXp(GAIN.shareXp); feed('🔗 <b>' + esc(name) + '</b> shared the nest', 'follow'); Creature.spin(); speak('share', { name: name }); break;
    }
  }

  function command(name, text) {
    if (window.Director && Director.onComment(name, text)) { Creature.lookAtCamera(2); return; }
    const t = text.toLowerCase();
    if (/\b(dance|danse|baile)\b/.test(t)) { Creature.dance(5); speak('dance', { name: name }); }
    else if (/\b(sing|chante|song)\b/.test(t)) { Creature.sing(4); speak('sing'); }
    else if (/\b(sleep|dodo|nap|dors)\b/.test(t)) { sleep(); }
    else if (/\b(spin|tourne)\b/.test(t)) { Creature.spin(); }
    else if (/\b(play|joue)\b/.test(t)) { Creature.play(); speak('play'); }
    else if (/\b(hi|hello|hey|salut|bonjour|hola|coucou)\b/.test(t)) { Creature.wave(); speak('hello', { name: name }); }
    else if (/who are you|what are you|qui es-tu|c'est quoi/.test(t)) { Creature.lookAtCamera(4); speak('who'); }
    else if (/\b(feed|eat|food|mange)\b/.test(t)) { Creature.beg(3); speak('hungry', { name: name }); }
    else if (Math.random() < 0.35) { Creature.hop(0.5); aiSay('A viewer named ' + name + ' says: "' + text.slice(0, 140) + '". React in one short sentence, address them by name.', 'comment', { name: name }); }
  }

  function evolve(st) {
    S.stage = st; S.evolvedAt[st] = Date.now(); lastEvolveAt = Date.now(); const stage = STAGES[st];
    Creature.setStage(st, true); Creature.burstSparks(160, 0xfff2b0, 5); Creature.burstHearts(18, true); Creature.punch(1);
    banner('✨ <b>' + S.name + '</b> evolved into <b>' + stage.name + '</b><span class="sub">' + esc(stage.intro) + '</span>', 'evolve', 9000);
    setTimeout(function() { speak('evolve', {}, 6000); Creature.spin(); Creature.dance(4); }, 1200);
    save();
  }
  function sleep() { if (S.asleep) return; S.asleep = true; S.wakeLikes = 0; Creature.setVitals(S); speak('sleep'); }
  function wake(by) { S.asleep = false; S.wakeLikes = 0; S.energy = Math.max(S.energy, 40); Creature.setVitals(S); Creature.hop(1); Creature.burstHearts(10); speak('wake', { name: by }); feed('☀️ <b>' + esc(by || 'the hearts') + '</b> woke ' + S.name + ' up'); }

  // ─────────────────────────────────────────────────────────────
  // TICK — drains, mood, director (the creature's own will)
  // ─────────────────────────────────────────────────────────────
  let lastTick = Date.now(), nextDirector = 4, saveIn = 5, moodSince = Date.now();
  function tick() {
    const now = Date.now(), dt = clamp((now - lastTick) / 1000, 0, 2); lastTick = now;
    if (S.stage > 0) {
      if (S.asleep) { S.energy = clamp(S.energy + RATE.sleepRegen * dt, 0, 100); S.food = clamp(S.food - RATE.food * 0.3 * dt, 0, 100); if (S.energy >= 96) wake('the morning'); }
      else { S.food = clamp(S.food - RATE.food * dt, 0, 100); S.joy = clamp(S.joy - RATE.joy * dt, 0, 100); S.energy = clamp(S.energy - RATE.energy * dt, 0, 100); if (S.energy <= 5) sleep(); }
    } else { S.food = clamp(S.food - RATE.food * 0.2 * dt, 0, 100); if (S.xp === 0 && Math.random() < dt * 0.05) Creature.shiver(0.8); }
    if (S.food <= 2) { if (!S.fadingSince) S.fadingSince = now; } else S.fadingSince = 0;
    const m = computeMood(); if (m !== mood) { mood = m; moodSince = now; Creature.setMood(m); if (m === 'hungry') { Creature.beg(4); speak('hungry'); } if (m === 'fading') speak('fading', {}, 8000); }
    Creature.setVitals(S); if (S.stage === 0) Creature.setHatchProgress(S.xp / STAGES[1].xp);
    nextDirector -= dt; if (nextDirector <= 0) { director(); nextDirector = 6 + Math.random() * 8; }
    saveIn -= dt; if (saveIn <= 0) { save(); saveIn = 5; }
    renderHud();
  }

  function director() {
    if (S.stage === 0) { if (Math.random() < 0.5) { Creature.shiver(1); say(pick(['*wobble*', '*tap tap* …from inside', 'Something is knocking.']), 3000); } return; }
    if (S.asleep) { if (Math.random() < 0.4) speak('asleep', {}, 3000); return; }
    switch (mood) {
      case 'fading': Creature.shiver(2); return;
      case 'hungry': Creature.beg(4); if (Math.random() < 0.6) speak('hungry', { name: (topKeepers(1)[0] || {}).name }); return;
      case 'sleepy': Creature.yawn(); if (Math.random() < 0.5) speak('sleepy'); return;
      case 'lonely': if (Math.random() < 0.5) { Creature.lookAround(); speak('lonely'); } else Creature.wander(); return;
    }
    const r = Math.random();
    if (r < 0.22) Creature.wander();
    else if (r < 0.34) { Creature.lookAtCamera(4); aiSay('Say one short, curious or funny thought out loud to your audience (no question required).', mood === 'happy' ? 'happy' : 'curious'); }
    else if (r < 0.46) Creature.play();
    else if (r < 0.55) Creature.hop(0.9);
    else if (r < 0.63) { Creature.sing(3); if (Math.random() < 0.5) speak('sing'); }
    else if (r < 0.7) Creature.spin();
    else if (r < 0.8) { Creature.wave(2); const k = topKeepers(1)[0]; if (k && Math.random() < 0.6) say(pick(['Where is ' + k.name + '? I miss them.', k.name + ' is my favourite. Do not tell the others.', 'I keep ' + k.name + '\'s hearts in a special place.']), 4500); }
    else if (r < 0.88) Creature.lookAround();
    else if (mood === 'happy' || mood === 'ecstatic') Creature.dance(3);
  }

  // ─────────────────────────────────────────────────────────────
  // HUD
  // ─────────────────────────────────────────────────────────────
  function bar(id, v) { $(id).style.width = clamp(v, 0, 100) + '%'; }
  let ctaIdx = 0;
  function cta() {
    const nx = nextStage(); const left = nx ? nx.xp - S.xp : 0;
    if (S.stage === 0) return ['Tap ❤️ to warm the egg · ' + Math.round(S.xp / STAGES[1].xp * 100) + '% hatched', 'egg'];
    if (mood === 'fading') return [S.name + ' is fading · tap ❤️ <b>now</b>', 'urgent'];
    if (S.asleep) return ['Zzz… <b>' + (WAKE_LIKES - S.wakeLikes) + ' more ❤️</b> to wake ' + S.name, 'sleep'];
    if (S.food < 30) return ['<b>Hungry!</b> Tap ❤️ · every like is food', 'urgent'];
    if (nx && left <= 0) return ['<b>Ready to evolve</b> · the next ❤️ does it', 'evolve'];
    if (nx && left <= Math.max(50, (nx.xp - STAGES[S.stage].xp) * 0.15)) return ['<b>' + left + ' ⚡</b> to evolve · a 🎁 finishes it', 'evolve'];
    if (S.joy < 30) return ['<b>Bored…</b> say hi in the comments', ''];
    if (S.energy < 25) return ['<b>Tired…</b> a 🌹 gives a second wind', ''];
    return [['Tap ❤️ to feed · comment to play · 🎁 to evolve', 'Say <b>dance</b>, <b>sing</b> or <b>spin</b> in the chat', 'Every 🎁 grows ' + S.name + ' · ' + (nx ? left + ' ⚡ to ' + nx.name : 'final form')][Math.floor(Date.now() / 9000) % 3], ''];
  }
  function renderHud() {
    const st = STAGES[S.stage], nx = nextStage();
    $('h-name').textContent = S.name; $('h-stage').textContent = st.name;
    $('h-keepers').textContent = Object.keys(S.keepers).length + ' keepers';
    bar('h-xp', nx ? (S.xp - st.xp) / (nx.xp - st.xp) * 100 : 100);
    $('h-xp-txt').textContent = nx ? S.xp + ' / ' + nx.xp + ' ⚡ → ' + nx.name : 'Final form · ' + S.xp + ' ⚡';
    bar('h-food', S.food); bar('h-joy', S.joy); bar('h-energy', S.energy);
    $('h-vitals').className = 'panel ' + (S.stage === 0 ? 'egg' : '');
    ['food', 'joy', 'energy'].forEach(function(k) { $('v-' + k).classList.toggle('low', S[k] < 30); });
    $('h-mood').textContent = S.asleep ? 'asleep' : mood;
    const c = cta(); const el = $('cta'); if (el.innerHTML !== c[0]) el.innerHTML = c[0]; el.className = c[1];
    $('keepers').innerHTML = '<span class="label">Top keepers</span>' + topKeepers(5).map(function(k, i) { return '<div class="lb"><span class="pos">' + (i + 1) + '</span><span class="nm">' + esc(k.name) + '</span><span class="xp">' + (k.coins ? '🎁' + k.coins + ' · ' : '') + '❤️' + k.likes + '</span></div>'; }).join('');
    $('h-live').textContent = LIVE ? 'Live' : 'Demo';
  }
  function anchorBubble() {
    requestAnimationFrame(anchorBubble);
    const b = $('bubble'); if (!b || b.classList.contains('hidden')) return;
    const p = Creature.headScreenPos(); const portrait = innerHeight > innerWidth;
    const top = $('top').offsetHeight + 24 + b.offsetHeight + ($('banner').classList.contains('hidden') && $('poll').classList.contains('hidden') ? 0 : 150), kw = portrait ? 0 : 230; // stay below the strip/banner, clear of the keepers panel
    const x = clamp(p.x, 190, innerWidth - 190 - kw), y = clamp(p.y, top, innerHeight - 170);
    b.style.transform = 'translate(-50%, -100%) translate(' + x + 'px,' + (y - 12) + 'px)';
  }

  // ─────────────────────────────────────────────────────────────
  // BOOT
  // ─────────────────────────────────────────────────────────────
  function boot() {
    Creature.init(document.getElementById('scene'));
    S.stage = stageOf(S.xp); Creature.setStage(S.stage, false); Creature.setVitals(S); mood = computeMood(); Creature.setMood(mood);
    renderHud(); anchorBubble(); setInterval(tick, 250);
    setTimeout(function() { if (S.stage === 0) say('Something is moving inside… warm it with ❤️', 6000); else speak(mood === 'curious' ? 'happy' : mood, {}, 5000); }, 1500);
    document.addEventListener('keydown', function(e) {
      if (e.key === 'h' || e.key === 'H') $('hud').classList.toggle('hidden');
      if (e.key === 'v' || e.key === 'V') { voiceOn = !voiceOn; feed('🔊 voice ' + (voiceOn ? 'on' : 'off')); }
      if (e.key === 'g' || e.key === 'G') handle({ type: 'gift', username: 'streamer', giftName: 'Galaxy', coins: 1000 });
      if (e.key === 'l' || e.key === 'L') handle({ type: 'like', username: 'streamer', count: 25 });
      if (e.key === 'e' || e.key === 'E') forceEvolve();
      if (e.key === 'p' || e.key === 'P') { if (window.Director) Director.beat(); }
      if (e.key === 'r' || e.key === 'R') { if (confirm('Reset ' + S.name + ' to an egg?')) reset(); }
    });
    document.getElementById('help').addEventListener('click', function() { this.classList.toggle('open'); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();

  function reset() { S = fresh(); save(); location.reload(); }
  function forceEvolve() { if (!nextStage()) return; S.xp = Math.max(S.xp, nextStage().xp); lastEvolveAt = 0; gainXp(0); }
  window.Game = { handle: handle, state: function() { return S; }, mood: function() { return mood; }, STAGES: STAGES, say: say, tts: tts, feed: feed, topKeepers: topKeepers, reset: reset, evolve: forceEvolve };
})();
