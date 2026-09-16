/**
 * SOCIOBEAST — Director: the AI that runs the show.
 * Every 20–40 s it picks a beat: answer a viewer's question (by name), launch a poll the chat votes on,
 * greet new keepers, let the cast banter about the beast's state, or explain how to help.
 * With an LLM behind api/think (live: think.php · demo: Vercel api/think) the beats are generated as JSON
 * ({lines:[{who,text}], poll:{q,options}, action}); without one, a scripted bank keeps the show going.
 * Speakers: beast (the creature) · pip (host fairy) · moss (old turtle).
 */
(function() {
  'use strict';
  const C = window.BEAST_CONFIG || {};
  const LIVE = C.mode === 'live', THINK_URL = LIVE ? 'api/think.php' : 'api/think';
  const $ = function(id) { return document.getElementById(id); };
  const pick = function(a) { return a[Math.floor(Math.random() * a.length)]; };
  const esc = function(s) { return String(s || '').replace(/[&<>"]/g, function(c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };

  const D = { poll: null, questions: [], recent: [], newKeepers: [], lastPollAt: 0, lastBeatAt: Date.now(), aiFails: 0, busy: false, started: false, beats: 0 };

  // ── scripted bank (demo voice + fallback) ──
  const POLLS = [
    { q: 'What should {beast} learn first?', options: ['dance', 'sing'], effect: ['dance', 'sing'] },
    { q: 'Is {beast} cuter awake or asleep?', options: ['awake', 'asleep'], effect: ['spin', 'yawn'] },
    { q: 'Team ❤️ Food or team 🎁 Power?', options: ['food', 'power'], effect: ['nom', 'spin'] },
    { q: 'Should {beast} play or take a nap?', options: ['play', 'nap'], effect: ['play', 'yawn'] },
    { q: 'Spin or wave to the chat?', options: ['spin', 'wave'], effect: ['spin', 'wave'] }
  ];
  const OPEN = ['Where are you watching from tonight?', 'What should we call {beast}\'s next form?', 'First time here? Say hi and {beast} will wave.', 'Who fed {beast} today? Raise a ❤️'];
  const BANTER = {
    hungry: [[['pip', '{beast} is starving! Tap ❤️ everyone, quick!'], ['moss', 'In my day we fed it moss. Hearts work better, I admit.']], [['moss', 'A hungry beast is a sad beast. Feed it.'], ['pip', 'You heard the turtle! Hearts, hearts, hearts!']]],
    sleepy: [[['pip', 'Shh… {beast} is getting sleepy.'], ['moss', 'Let it sleep. Twenty hearts will wake it if you must.']]],
    asleep: [[['moss', 'It dreams of strawberries. I can tell by the snoring.'], ['pip', 'If you want it back, send 20 ❤️ — I counted.']]],
    lonely: [[['pip', 'Hello? Anyone? {beast} is doing a dance for nobody.'], ['moss', 'The nest is quiet. Say something, humans.']]],
    happy: [[['pip', 'Look at that smile! {top} did that.'], ['moss', 'Happiness looks good on it. Keep going.']], [['moss', '{beast} grew again while I blinked.'], ['pip', 'Blink slower, Moss!']]],
    ecstatic: [[['pip', 'GIFT ENERGY! {beast} is glowing!'], ['moss', 'Careful, it will float away.']]],
    curious: [[['pip', 'Fun fact: every ❤️ you tap becomes food for {beast}. Free snacks!'], ['moss', 'And gifts make it evolve. I have seen it seven times.']], [['moss', 'Ask me anything. I am 400 years old and mostly awake.'], ['pip', 'Type a question with a ? and Moss will answer. Probably.']], [['pip', 'Comment "dance" or "sing" and watch what happens!'], ['beast', 'I know three dances. Two are the same dance.']]],
    egg: [[['pip', 'It is still an egg! Warm it with ❤️ and it will hatch.'], ['moss', 'I hatched too, once. Took a century.']]],
    fading: [[['pip', '{beast} is fading… please, hearts, now!'], ['moss', 'Even I am worried. Feed it.']]]
  };
  const ANSWERS = {
    pip: ['{name} asks "{q}" — great question! Short answer: feed the beast and everything works out.', '{name}, I love that question. The answer is hearts. It is always hearts.'],
    moss: ['{name} asks "{q}". Hmm. In four hundred years I learned this: what you feed, grows.', '{name}, that is a deep one. Sit with me. The answer comes slowly, like moss.'],
    beast: ['{name}! You asked me something! I am thinking with my whole tail.', '{name}, I am not sure, but I like that you asked.']
  };
  const GREET = ['Welcome to the nest, {name}! You are a keeper now.', '{name} joined the keepers! Say hi, {beast}!', 'A new keeper: {name}. Moss, wake up, say hello.'];
  const TIPS = [['pip', 'Every 🎁 gives {beast} XP — {left} ⚡ to the next form!'], ['moss', 'Comments make it happy. It reads every one. Mostly.'], ['pip', 'Type 1 or 2 during a poll and you decide what happens!']];

  const fill = function(t, ctx) { const S = Game.state(); const top = (Game.topKeepers(1)[0] || {}).name || 'someone'; const nx = Game.STAGES[S.stage + 1]; return t.replace(/\{beast\}/g, S.name).replace(/\{top\}/g, top).replace(/\{name\}/g, (ctx && ctx.name) || 'friend').replace(/\{q\}/g, (ctx && ctx.q) || '').replace(/\{left\}/g, nx ? nx.xp - S.xp : 0); };
  function speak(who, text, ms) { if (who === 'beast') Game.say(text, ms); else if (window.Cast) Cast.say(who, text, ms); }
  function sequence(lines, ctx) { lines.forEach(function(l, i) { setTimeout(function() { speak(l[0] || l.who, fill(l[1] || l.text, ctx), 5500); if ((l[0] || l.who) === 'pip' && window.Cast) Cast.react('pip', 'excited'); }, i * 4200); }); }

  // ── polls ──
  function openPoll(q, options, effect) {
    const S = Game.state();
    D.poll = { q: fill(q), options: options, votes: options.map(function() { return 0; }), voters: {}, closes: Date.now() + 45000, effect: effect || null };
    D.lastPollAt = Date.now();
    const el = $('poll'); el.classList.remove('hidden'); $('hud').classList.add('polling'); renderPoll();
    speak('pip', fill(q) + ' Type 1 or 2!', 6000); if (window.Cast) Cast.react('pip', 'excited');
    Game.feed('🗳️ <b>Poll</b> ' + esc(D.poll.q), 'comment');
  }
  function renderPoll() {
    const p = D.poll; if (!p) return; const total = p.votes.reduce(function(a, b) { return a + b; }, 0) || 1;
    $('poll').innerHTML = '<div class="row v-title"><span class="label">Chat decides</span><span class="num">' + Math.max(0, Math.ceil((p.closes - Date.now()) / 1000)) + 's</span></div><div class="v-q">' + esc(p.q) + '</div>' +
      p.options.map(function(o, i) { return '<div class="v-opt"><span class="key">' + (i + 1) + '</span><span>' + esc(o) + '</span><span class="num">' + p.votes[i] + '</span><div class="vbar"><div style="width:' + (p.votes[i] / total * 100) + '%"></div></div></div>'; }).join('');
  }
  function closePoll() {
    const p = D.poll; if (!p) return; D.poll = null; $('poll').classList.add('hidden'); $('hud').classList.remove('polling');
    const total = p.votes.reduce(function(a, b) { return a + b; }, 0);
    const w = total ? p.votes.indexOf(Math.max.apply(null, p.votes)) : -1;
    if (w < 0) { speak('moss', 'Nobody voted. The beast decides alone, then.', 4500); return; }
    const win = p.options[w];
    Game.feed('🗳️ The chat chose <b>' + esc(win) + '</b> (' + p.votes[w] + ' votes)', 'comment');
    speak('pip', 'The chat says: ' + win + '! ' + p.votes[w] + ' votes!', 5000);
    const fx = p.effect ? p.effect[w] : null;
    setTimeout(function() { if (fx && Creature[fx]) Creature[fx](4); speak('beast', pick(['Okay okay, ' + win + ' it is!', 'You chose ' + win + '. I obey the chat.', win + '! Watch me!']), 4500); }, 2500);
  }
  function vote(name, text) {
    const p = D.poll; if (!p) return false; const t = text.trim().toLowerCase();
    let i = -1; if (/^[12]$/.test(t)) i = +t - 1; else p.options.forEach(function(o, n) { if (t.indexOf(o.toLowerCase()) >= 0) i = n; });
    if (i < 0 || p.voters[name]) return false;
    p.voters[name] = i; p.votes[i]++; renderPoll(); return true;
  }

  // ── viewer input ──
  function onComment(name, text) {
    D.recent.push({ name: name, text: text.slice(0, 120) }); if (D.recent.length > 12) D.recent.shift();
    if (vote(name, text)) return true;
    if (text.indexOf('?') >= 0 && text.length > 6) { if (D.questions.length < 6 && !D.questions.some(function(q) { return q.name === name; })) D.questions.push({ name: name, text: text.slice(0, 160) }); return true; }
    return false;
  }
  function newKeeper(name) { D.newKeepers.push(name); if (D.newKeepers.length > 5) D.newKeepers.shift(); }

  // ── the beat ──
  function beat() {
    const S = Game.state(), mood = Game.mood(); D.beats++; D.lastBeatAt = Date.now();
    if (D.newKeepers.length) { const n = D.newKeepers.splice(0, 3); speak('pip', fill(pick(GREET), { name: n.join(', ') }), 5500); if (window.Cast) Cast.react('pip', 'excited'); Creature.wave(2); return; }
    if (D.questions.length) return answer(D.questions.shift());
    if (!D.poll && S.stage > 0 && !S.asleep && Date.now() - D.lastPollAt > 150000 && Math.random() < 0.6) { if (Math.random() < 0.7) { const p = pick(POLLS); openPoll(p.q, p.options, p.effect); } else speak('pip', fill(pick(OPEN)), 6000); return; }
    if (D.beats % 4 === 0) { const tip = pick(TIPS); return speak(tip[0], fill(tip[1]), 5500); }
    aiBeat(function(show) {
      if (show && show.lines && show.lines.length) { sequence(show.lines.slice(0, 3).map(function(l) { return [l.who, l.text]; })); if (show.poll && show.poll.q && show.poll.options && show.poll.options.length === 2 && !D.poll) setTimeout(function() { openPoll(show.poll.q, show.poll.options.map(String), null); }, 9000); if (show.action && Creature[show.action]) Creature[show.action](3); }
      else { const key = S.stage === 0 ? 'egg' : (BANTER[mood] ? mood : 'curious'); sequence(pick(BANTER[key])); }
    }, { kind: 'banter' });
  }
  function answer(q) {
    const who = /why|how|what is|what are|who are|meaning|life|love|old|moss|wise|dream/i.test(q.text) ? 'moss' : (/beast|you|hungry|eat|evolve|form|dance|sing/i.test(q.text) && Math.random() < 0.6 ? 'beast' : 'pip');
    aiBeat(function(show) {
      if (show && show.lines && show.lines.length) sequence(show.lines.slice(0, 2).map(function(l) { return [l.who, l.text]; }), { name: q.name });
      else speak(who, fill(pick(ANSWERS[who]), { name: q.name, q: q.text.slice(0, 60) }), 7000);
      if (who === 'beast') Creature.lookAtCamera(4); if (who === 'moss' && window.Cast) Cast.react('moss', 'nod');
    }, { kind: 'answer', question: q, who: who });
  }

  // ── LLM ──
  function aiBeat(cb, extra) {
    if (!C.ai || D.aiFails >= 2 || D.busy) return cb(null);
    D.busy = true; const S = Game.state(); const ctrl = new AbortController(); const to = setTimeout(function() { ctrl.abort(); }, 8000);
    fetch(THINK_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: ctrl.signal,
      body: JSON.stringify({ mode: 'show', kind: extra.kind, question: extra.question || null, who: extra.who || null, name: S.name, stage: Game.STAGES[S.stage].name, mood: Game.mood(), food: Math.round(S.food), joy: Math.round(S.joy), energy: Math.round(S.energy), keepers: Game.topKeepers(3).map(function(k) { return k.name; }), recent: D.recent.slice(-6), pollOpen: !!D.poll }) })
      .then(function(r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function(d) { if (!d || !d.show) { D.aiFails++; return cb(null); } D.aiFails = 0; cb(d.show); })
      .catch(function() { D.aiFails++; cb(null); })
      .finally(function() { clearTimeout(to); D.busy = false; });
  }

  // ── loop ──
  function tick() {
    if (D.poll) { renderPoll(); if (Date.now() >= D.poll.closes) closePoll(); }
    const gap = D.questions.length ? 9000 : D.newKeepers.length ? 6000 : 22000 + Math.random() * 18000;
    if (Date.now() - D.lastBeatAt > gap) beat();
  }
  function ready(cb) { if (window.Game && window.Cast && Cast.has('pip')) cb(); else setTimeout(function() { ready(cb); }, 200); }
  ready(function() { D.lastBeatAt = Date.now() - 12000; setInterval(tick, 500); setTimeout(function() { speak('pip', fill(Game.state().stage === 0 ? 'Welcome! This egg hatches when you tap ❤️. Ready?' : 'Welcome to the nest! Tap ❤️ to feed {beast}, comment to play.'), 6500); }, 4000); });

  window.Director = { onComment: onComment, newKeeper: newKeeper, openPoll: openPoll, beat: beat, state: D };
})();
