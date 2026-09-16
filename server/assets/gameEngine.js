/**
 * SOCIOBEAST GENESIS v12 — Game Engine (front)
 * Polls api/game.php, spawns viewer guardians, renders the stream HUD,
 * and turns TikTok interactions into world effects.
 */
(function() {
  'use strict';

  const CFG = window.SOCIOBEAST_CONFIG || {};
  const POLL_MS = 1500;
  const HUD_ON = new URLSearchParams(location.search).get('hud') !== '0';
  const DEMO = CFG.demoMode || new URLSearchParams(location.search).get('demo') === '1';

  let lastEventId = 0;
  let game = null;
  let VE = null;
  let labelCache = {};       // instanceId → label element
  const activeUntil = {};    // instanceId → timestamp (label shown while active)
  let feedEl, toastEl;
  const SKY = { normal: 0x050510, aurora: 0x0a2a3a, eclipse: 0x1a0000, fracture: 0x2a0505, night: 0x02020a, dawn: 0x1a1020 };

  const $ = function(id) { return document.getElementById(id); };

  // ─────────────────────────────────────────────────────────────
  // BOOT
  // ─────────────────────────────────────────────────────────────
  function waitVE(cb) { if (window.VisualEngine && VisualEngine.spawnGuardian) { VE = VisualEngine; cb(); } else setTimeout(function() { waitVE(cb); }, 150); }

  waitVE(function() {
    buildHud();
    loadGuardians();
    loadFragments();
    setInterval(poll, POLL_MS);
    poll();
    setInterval(reportSpirits, 20000);
    requestAnimationFrame(updateLabels);
    if (DEMO) startDemoAudience();
    console.log('[Game] v12 engine ready. HUD=' + HUD_ON + ' demo=' + DEMO);
  });

  // ─────────────────────────────────────────────────────────────
  // HUD
  // ─────────────────────────────────────────────────────────────
  function buildHud() {
    const hud = document.createElement('div');
    hud.id = 'game-hud';
    if (!HUD_ON) hud.classList.add('hidden');
    hud.innerHTML =
      '<div id="hud-top">' +
      '  <div id="hud-season">🌌 <b>Season <span id="hud-season-n">1</span></b> · <span id="hud-time">🌅</span></div>' +
      '  <div id="hud-energy"><div class="bar"><div id="hud-energy-fill"></div><span id="hud-energy-txt">Island energy</span></div>' +
      '    <div id="hud-energy-hint">❤️ likes · 💬 comments · 🎁 gifts → World Event</div></div>' +
      '  <div id="hud-balance"><span class="bl">🌲 Forest</span><div class="bar"><div id="hud-balance-fill"></div><span id="hud-balance-txt">Balance</span></div><span class="bl">Forge ⚒️</span></div>' +
      '  <div id="hud-clans"></div>' +
      '  <div id="hud-chaos"><div class="bar"><div id="hud-chaos-fill"></div><span>The Curse</span></div></div>' +
      '</div>' +
      '<div id="hud-vote" class="hidden"></div>' +
      '<div id="hud-quests"></div>' +
      '<div id="hud-board"></div>' +
      '<div id="hud-feed"></div>' +
      '<div id="hud-toast" class="hidden"></div>' +
      '<div id="hud-banner" class="hidden"></div>' +
      '<div id="hud-fracture" class="hidden"><div>🩸 THE CURSE SPREADS 🩸</div><div class="sub">type <b>!calm</b> (or <b>!pray</b>) in chat to heal the island</div><div id="hud-fracture-t"></div></div>' +
      '<div id="hud-cta">Comment <b>!clan grove</b> / <b>forge</b> / <b>fang</b> / <b>veil</b> · <b>!me</b> · <b>!top</b> · vote <b>!1</b> / <b>!2</b></div>' +
      '<div id="guardian-labels"></div>';
    document.body.appendChild(hud);
    feedEl = $('hud-feed'); toastEl = $('hud-toast');
  }

  function renderHud() {
    if (!game) return;
    $('hud-season-n').textContent = game.season;
    const tm = game.islandTime;
    $('hud-time').textContent = tm < 0.2 ? '🌙 Night' : tm < 0.3 ? '🌅 Dawn' : tm < 0.7 ? '☀️ Day' : tm < 0.8 ? '🌇 Dusk' : '🌙 Night';
    const pct = Math.min(100, game.energy / game.energyThreshold * 100);
    $('hud-energy-fill').style.width = pct + '%';
    $('hud-energy-txt').textContent = '⚡ ' + game.energy + ' / ' + game.energyThreshold + (game.xpMultiplier > 1 ? '  ×' + game.xpMultiplier + ' XP' : '');
    $('hud-chaos-fill').style.width = game.chaos + '%';
    if (typeof game.balance === 'number') {
      const pct = (1 - game.balance) / 2 * 100; // 0 = full forest (left), 100 = full forge (right)
      const f = $('hud-balance-fill'); f.style.left = Math.min(pct, 50) + '%'; f.style.width = Math.abs(pct - 50) + '%';
      f.style.background = game.balance >= 0 ? '#7fd67f' : '#e0a050';
      $('hud-balance-txt').textContent = game.balanceLabel || 'Balance';
      VE.setBalance(game.balance);
    }
    $('hud-chaos').classList.toggle('danger', game.chaos > 70);

    // Clans
    const clans = Object.keys(game.clans).map(function(k) { return Object.assign({ key: k }, game.clans[k]); }).sort(function(a, b) { return b.influence - a.influence; });
    $('hud-clans').innerHTML = clans.map(function(c) {
      return '<div class="clan" style="--c:' + c.color + '"><span class="ci">' + c.icon + '</span><div class="cbar"><div style="width:' + c.influence + '%"></div></div><span class="cn">' + c.members + '</span></div>';
    }).join('');

    // Quests
    $('hud-quests').innerHTML = '<div class="hq-title">🎯 Live quests</div>' + (game.quests || []).map(function(q) {
      const p = Math.min(100, (q.progress || 0) / q.target * 100);
      return '<div class="quest ' + (q.done ? 'done' : '') + '"><span>' + (q.done ? '✅' : '▫️') + ' ' + q.text + '</span><div class="qbar"><div style="width:' + p + '%"></div></div></div>';
    }).join('');

    // Leaderboard
    $('hud-board').innerHTML = '<div class="hq-title">👑 Top guardians</div>' + (game.leaderboard || []).map(function(g, i) {
      return '<div class="lb"><span class="pos">' + (i + 1) + '</span><span class="nm" style="color:' + g.clanColor + '">' + g.rankIcon + ' ' + esc(g.name) + '</span><span class="xp">' + g.xp + '</span></div>';
    }).join('');

    // Vote
    const v = game.vote;
    const vb = $('hud-vote');
    if (v) {
      const total = Object.values(v.votes).reduce(function(a, b) { return a + b; }, 0) || 1;
      vb.classList.remove('hidden');
      vb.innerHTML = '<div class="v-title">🏛️ Council vote · <span>' + v.remaining + 's</span></div><div class="v-q">' + esc(v.question) + '</div>' +
        v.options.map(function(o, i) {
          const n = v.votes[i + 1] || 0;
          return '<div class="v-opt"><b>!' + (i + 1) + '</b> ' + esc(o) + '<div class="vbar"><div style="width:' + (n / total * 100) + '%"></div></div><span>' + n + '</span></div>';
        }).join('');
    } else vb.classList.add('hidden');

    // Fracture overlay
    const fr = $('hud-fracture');
    fr.classList.toggle('hidden', !game.fractured);
    if (game.fractured) $('hud-fracture-t').textContent = game.fracturedRemaining + 's';

    // World
    VE.setTerritories(game.clans);
    VE.setDayTime(game.islandTime);
    if (game.fractured) VE.setSky(SKY.fracture);
    else if (game.chaos > 80) VE.setSky(0x1a0a10);
    else if (!skyOverride) VE.setSky(tm < 0.2 || tm > 0.8 ? SKY.night : tm < 0.3 || tm > 0.7 ? SKY.dawn : SKY.normal);
    if (game.biome !== currentBiome) { currentBiome = game.biome; VE.setBiome(currentBiome); }
  }
  let currentBiome = null, skyOverride = false;

  function esc(s) { return String(s || '').replace(/[&<>"]/g, function(c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  function feed(html, cls) {
    const el = document.createElement('div');
    el.className = 'fitem ' + (cls || '');
    el.innerHTML = html;
    feedEl.prepend(el);
    while (feedEl.children.length > 7) feedEl.lastChild.remove();
    setTimeout(function() { el.classList.add('fade'); }, 9000);
    setTimeout(function() { el.remove(); }, 10000);
  }

  function toast(html, ms) {
    toastEl.innerHTML = html; toastEl.classList.remove('hidden');
    clearTimeout(toastEl._t); toastEl._t = setTimeout(function() { toastEl.classList.add('hidden'); }, ms || 4000);
  }

  function banner(html, ms, cls) {
    const b = $('hud-banner');
    b.innerHTML = html; b.className = cls || ''; b.classList.remove('hidden');
    clearTimeout(b._t); b._t = setTimeout(function() { b.classList.add('hidden'); }, ms || 6000);
  }

  // ─────────────────────────────────────────────────────────────
  // POLLING
  // ─────────────────────────────────────────────────────────────
  function poll() {
    fetch('api/game.php?action=state&since=' + lastEventId, { credentials: 'same-origin' })
      .then(function(r) { return r.json(); })
      .then(function(d) {
        if (!d || !d.success) return;
        game = d.game;
        (d.events || []).forEach(handleEvent);
        if (d.lastId) lastEventId = d.lastId;
        renderHud();
      }).catch(function(e) { console.warn('[Game] poll failed', e.message); });
  }

  function loadGuardians() {
    fetch('api/game.php?action=guardians&n=400').then(function(r) { return r.json(); }).then(function(d) {
      if (!d.guardians) return;
      d.guardians.forEach(function(g, i) { setTimeout(function() { VE.spawnGuardian(g); }, i * 40); });
      console.log('[Game] restored', d.guardians.length, 'guardians');
    }).catch(function() {});
  }

  function loadFragments() {
    fetch('api/game.php?action=fragments').then(function(r) { return r.json(); }).then(function(d) {
      (d.fragments || []).forEach(function(f) { VE.addFragment({ name: f.name, angle: +f.angle, distance: +f.distance, radius: +f.radius }); });
    }).catch(function() {});
  }

  function reportSpirits() {
    fetch('api/game.php', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'report', spirits: VE.getKodamaCount() }) }).catch(function() {});
  }

  // ─────────────────────────────────────────────────────────────
  // EVENT HANDLERS  (server → world)
  // ─────────────────────────────────────────────────────────────
  function guardianOf(g) { const k = VE.spawnGuardian(g); if (k) activeUntil[g.instanceId] = Date.now() + 45000; return k; }

  function handleEvent(ev) {
    const p = ev.payload || {};
    switch (ev.type) {
      case 'guardian_born': {
        const k = guardianOf(p.guardian);
        feed(p.guardian.clanIcon + ' <b style="color:' + p.guardian.clanColor + '">' + esc(p.guardian.name) + '</b> was born on the island', 'born');
        if (k) VE.burst(k.wx, 0.3, k.wz, 60, p.guardian.clanColor, { speed: 1, up: 3, size: 0.18 });
        break;
      }
      case 'guardian_return': {
        const k = guardianOf(p.guardian);
        feed('🔁 <b>' + esc(p.guardian.name) + '</b> returned (' + p.guardian.lives + ' lives)', 'born');
        if (k) VE.jumpKodama(k);
        break;
      }
      case 'rank_up': {
        const k = guardianOf(p.guardian);
        banner(p.rank.icon + ' <b>' + esc(p.guardian.name) + '</b> became a <b>' + p.rank.name + '</b>', 5000, 'rank');
        if (k) { VE.burst(k.wx, 0.5, k.wz, 150, 0xffe08a, { speed: 2, up: 6, size: 0.25, life: 3 }); VE.focusOn(k, 4); }
        if (p.rank.key === 'legend') { VE.meteorRain(6, 0xffe08a); if (window.SocioBeast) SocioBeast.requestSpeech('reactive', { force: true, context: p.guardian.name + ' has become a Legend of the island' }); }
        break;
      }
      case 'clan_change': {
        guardianOf(p.guardian);
        feed(p.guardian.clanIcon + ' <b>' + esc(p.guardian.name) + '</b> joined clan <b style="color:' + p.guardian.clanColor + '">' + p.guardian.clan + '</b>');
        break;
      }
      case 'gift_spell': giftSpell(p); break;
      case 'clan_power': clanPower(p); break;
      case 'world_event': worldEvent(p); break;
      case 'fracture':
        skyOverride = true; VE.setSky(SKY.fracture); VE.shake(1.2); VE.vanishHalf();
        banner('🩸 <b>CURSE OUTBREAK #' + p.number + '</b> — hatred spreads through the roots. <b>!calm</b>', 8000, 'fracture');
        if (window.SocioBeast) SocioBeast.requestSpeech('reactive', { force: true, context: 'A curse born of hatred is spreading through the island. Ask the humans, without anger, to calm their hearts.' });
        break;
      case 'fracture_healed':
        skyOverride = false; VE.triggerCuriousMode();
        banner('💚 The curse lifts' + (p.by !== 'time' ? ' — <b>' + esc(p.by) + '</b> calmed the island' : '') + ' · <b>×2 XP</b> for 2 min', 6000, 'heal');
        VE.burst(0, 1, 0, 300, 0x90ff90, { spread: 20, speed: 3, up: 6, size: 0.25, life: 4 });
        break;
      case 'council_open':
        banner('🏛️ <b>The Council convenes</b> — vote with <b>!1</b> / <b>!2</b>', 6000, 'council');
        if (window.SocioBeast) SocioBeast.requestSpeech('reactive', { force: true, context: 'Ask the humans solemnly: ' + p.vote.question + ' Options: ' + p.vote.options.join(' / ') });
        break;
      case 'vote_cast': break; // HUD refreshes on poll
      case 'council_closed':
        banner('📜 The island chose: <b>' + esc(p.decision) + '</b> (' + p.votes + ' votes)', 8000, 'council');
        VE.burst(0, 3, 0, 200, 0xc0b0ff, { spread: 6, speed: 3, up: 5, size: 0.25 });
        break;
      case 'quest_complete':
        banner('🎯 <b>Quest complete!</b> ' + esc(p.quest.text) + ' · ×1.5 XP', 7000, 'quest');
        break;
      case 'spotlight': {
        const g = p.guardian, k = guardianOf(g);
        toast(g.clanIcon + ' <b style="color:' + g.clanColor + '">' + esc(g.name) + '</b> · ' + g.rankIcon + ' ' + g.rankName + ' · ' + g.xp + ' XP' + (g.nextXp ? ' → ' + g.nextXp : ' · MAX'), 5000);
        if (k) { VE.jumpKodama(k); VE.focusOn(k, 4); }
        break;
      }
      case 'show_leaderboard': toast('👑 ' + p.top.map(function(g, i) { return (i + 1) + '. ' + esc(g.name) + ' (' + g.xp + ')'; }).join(' · '), 6000); break;
      case 'show_quests': toast('🎯 ' + p.quests.map(function(q) { return (q.done ? '✅ ' : '') + q.text + ' ' + (q.progress || 0) + '/' + q.target; }).join(' · '), 7000); break;
      case 'tell_lore':
        if (window.SocioBeast) SocioBeast.requestSpeech('reactive', { force: true, context: 'Retell as a legend the council decision: ' + p.decision.question + ' → ' + p.decision.decision });
        break;
      case 'summon': {
        const k = guardianOf(p.guardian);
        VE.spawnSpirits(p.count, k ? k.wx : 0, k ? k.wz : 0);
        feed('🧙 <b>' + esc(p.guardian.name) + '</b> summoned ' + p.count + ' spirits');
        break;
      }
      case 'collective_action': collective(p.action, p.by); break;
      case 'mass_xp': feed('🌿 Bloom: everyone +' + p.xp + ' XP'); break;
      case 'request_speech':
        if (window.SocioBeast) SocioBeast.requestSpeech(p.mode || 'monologue', { force: true, context: p.context || '' });
        break;
      case 'season_end':
        banner('🏆 <b>Season ' + p.season + ' ends</b> — clan <b>' + p.winner + '</b> reshapes the island', 10000, 'season');
        VE.meteorRain(10, 0xffffff); VE.setBiome(p.biome);
        break;
    }
  }

  // ─────────────────────────────────────────────────────────────
  // SPELLS / POWERS / WORLD EVENTS
  // ─────────────────────────────────────────────────────────────
  function giftSpell(p) {
    const g = p.guardian, k = guardianOf(g), t = p.tier;
    const x = k ? k.wx : 0, z = k ? k.wz : 0;
    feed(t.icon + ' <b style="color:' + g.clanColor + '">' + esc(g.name) + '</b> sent <b>' + esc(p.giftName) + '</b> → ' + t.name, 'gift');
    switch (t.effect) {
      case 'blessing': if (k) VE.jumpKodama(k); break;
      case 'local_bloom': VE.burst(x, 0.2, z, 120, 0xffa0d0, { spread: 2, speed: 1.5, up: 2.5, size: 0.22, life: 3 }); VE.spawnSpirits(3, x, z); break;
      case 'weather': VE.burst(x, 6, z, 400, 0xccff99, { spread: 14, speed: 2, up: 1, size: 0.2, life: 6, gravity: 1 }); toast('🌧️ ' + esc(g.name) + ' summoned a firefly storm', 4000); break;
      case 'meteor_rain': VE.meteorRain(8, 0xffc060); VE.allDance(); banner('☄️ <b>' + esc(g.name) + '</b> called a <b>meteor rain</b> · ×2 XP 60s', 7000, 'gift'); if (k) VE.focusOn(k, 5); break;
      case 'new_land':
        if (p.fragment) VE.addFragment(p.fragment);
        banner('🌌 <b>GENESIS</b> — <b>' + esc(g.name) + '</b> created a new land: <b>' + esc(p.fragment ? p.fragment.name : '') + '</b>', 12000, 'genesis');
        VE.meteorRain(12, 0xc0f0ff);
        if (window.SocioBeast) SocioBeast.requestSpeech('mythology', { force: true, type: 'legend', context: 'A new land, ' + (p.fragment ? p.fragment.name : '') + ', was born from the generosity of ' + g.name });
        break;
    }
    if (p.doubleXp) toast('⚡ ×2 XP for ' + p.doubleXp + 's', 3000);
  }

  function clanPower(p) {
    const c = game && game.clans[p.clan];
    banner((c ? c.icon : '') + ' Clan <b style="color:' + (c ? c.color : '#fff') + '">' + p.clan + '</b> unleashes <b>' + esc(p.name) + '</b>', 7000, 'power');
    switch (p.power) {
      case 'green_tide': VE.burst(0, 0.5, 0, 900, 0xb0ffb0, { spread: 50, speed: 0.5, up: 2, size: 0.2, life: 6, gravity: 0.5 }); VE.triggerCuriousMode(); break;
      case 'iron_bell': VE.meteorRain(6, 0xff9a4a); VE.shake(0.5); skyOverride = true; VE.setSky(0x2a1a0a); setTimeout(function() { skyOverride = false; }, 12000); break;
      case 'the_hunt': VE.triggerShyMode(); setTimeout(function() { VE.triggerCuriousMode(); VE.allDance(); }, 4000); break;
      case 'spirit_veil': skyOverride = true; VE.setSky(SKY.eclipse); VE.burst(0, 6, 0, 500, 0xc0c0ff, { spread: 40, speed: 0.6, up: 1, size: 0.2, life: 8, gravity: 0.2 }); setTimeout(function() { skyOverride = false; }, 20000); break;
    }
  }

  function worldEvent(p) {
    const names = { spirit_lights: '🌈 Spirit Lights', mother_tree: '🌳 The Mother Tree awakens', firefly_migration: '✨ Firefly Migration', tall_one: '🌑 The Tall One passes', first_rain: '🌧️ The First Rain', prophecy: '🔮 Prophecy' };
    banner('<b>WORLD EVENT' + (p.number ? ' #' + p.number : '') + '</b> — ' + (names[p.event] || p.event), 9000, 'world');
    switch (p.event) {
      case 'spirit_lights': skyOverride = true; VE.setSky(SKY.aurora); VE.allDance(); auroraCss(15000); setTimeout(function() { skyOverride = false; }, 15000); break;
      case 'mother_tree': VE.growWorldTree(); break;
      case 'firefly_migration': VE.burst(0, 4, 0, 1200, 0xccff99, { spread: 60, speed: 1.5, up: 2, size: 0.22, life: 10, gravity: 0.1 }); VE.spawnSpirits(20, 0, 0); break;
      case 'first_rain': VE.startRain(25); skyOverride = true; VE.setSky(0x0a1420); setTimeout(function() { skyOverride = false; }, 25000); VE.triggerCuriousMode(); break;
      case 'tall_one':
        skyOverride = true; VE.setSky(0x03040c); VE.triggerShyMode(); VE.tallOneWalk(26);
        setTimeout(function() { VE.triggerCuriousMode(); VE.burst(0, 1, 0, 600, 0xdfffff, { spread: 30, speed: 2, up: 5, size: 0.25, life: 5 }); }, 20000);
        setTimeout(function() { skyOverride = false; }, 28000);
        break;
      case 'prophecy': skyOverride = true; VE.setSky(0x100a20); setTimeout(function() { skyOverride = false; }, 12000); break;
    }
  }

  function auroraCss(ms) {
    let a = $('aurora-fx');
    if (!a) { a = document.createElement('div'); a.id = 'aurora-fx'; document.body.appendChild(a); }
    a.classList.add('on'); setTimeout(function() { a.classList.remove('on'); }, ms);
  }

  function collective(action, by) {
    switch (action) {
      case 'dance': VE.allDance(); feed('💃 <b>' + esc(by) + '</b> made everyone dance'); break;
      case 'hide': VE.triggerShyMode(); feed('👻 <b>' + esc(by) + '</b>: hide!'); break;
      case 'seek': VE.triggerCuriousMode(); feed('👀 <b>' + esc(by) + '</b>: come out!'); break;
      case 'feed': VE.burst(0, 1, 0, 200, 0xffe0a0, { spread: 10, speed: 2, up: 3, size: 0.2 }); feed('🍃 <b>' + esc(by) + '</b> fed the spirits'); break;
      case 'chaos': VE.shake(0.6); feed('🌀 <b>' + esc(by) + '</b> stirred chaos'); break;
      case 'sleep': VE.setSky(SKY.night); feed('😴 <b>' + esc(by) + '</b> sang a lullaby'); break;
      case 'rain': VE.startRain(15); feed('🌧️ <b>' + esc(by) + '</b> called the rain'); break;
    }
  }

  // ─────────────────────────────────────────────────────────────
  // GUARDIAN NAME LABELS (projected 3D → 2D, capped for perf)
  // ─────────────────────────────────────────────────────────────
  function updateLabels() {
    requestAnimationFrame(updateLabels);
    if (!HUD_ON || !VE) return;
    const box = $('guardian-labels'); if (!box) return;
    const now = Date.now();
    const list = VE.getGuardians().filter(function(k) {
      return !k.isVanished && k.currentAlpha > 0.5 && (k.owner.rank === 'legend' || k.owner.rank === 'elder' || (activeUntil[k.id] || 0) > now);
    }).slice(0, 40);
    const seen = {};
    list.forEach(function(k) {
      const pr = VE.projectToScreen(k.wx, 2.4 * k.s + 0.3, k.wz);
      if (!pr || pr.x < 0 || pr.x > innerWidth || pr.y < 0 || pr.y > innerHeight) return;
      let el = labelCache[k.id];
      if (!el) {
        el = document.createElement('div'); el.className = 'glabel'; box.appendChild(el); labelCache[k.id] = el;
        el.innerHTML = '<span>' + k.owner.rankIcon + '</span> ' + esc(k.owner.name);
        el.style.color = k.owner.clanColor;
      }
      el.style.transform = 'translate(-50%,-100%) translate(' + pr.x + 'px,' + pr.y + 'px) scale(' + Math.max(0.6, 1.4 - pr.depth) + ')';
      el.style.display = 'block';
      seen[k.id] = true;
    });
    Object.keys(labelCache).forEach(function(id) { if (!seen[id]) labelCache[id].style.display = 'none'; });
  }

  // ─────────────────────────────────────────────────────────────
  // DEMO AUDIENCE (browser-side, no bridge needed)
  // ─────────────────────────────────────────────────────────────
  function startDemoAudience() {
    const names = ['luna_qc', 'maxou3d', 'sakura.dev', 'kodama_fan', 'elise_mtl', 'nova_star', 'pixel_pierre', 'zoe.ai', 'mira_ubmaker', 'felix_lab', 'ambre_x', 'yuki_san'];
    const cmds = ['!clan forge', '!clan fang', '!clan veil', '!me', '!top', '!dance', '!1', '!2', '!calm', 'so cute', '!quest', '!summon', '!seek', '!rain'];
    const gifts = [['Rose', 1], ['Finger Heart', 5], ['Hand Hearts', 100], ['Galaxy', 1000]];
    console.log('[Game] demo audience running');
    setInterval(function() {
      const u = names[Math.floor(Math.random() * names.length)], r = Math.random();
      let ev;
      if (r < 0.55) ev = { type: 'like', username: u, count: 1 + Math.floor(Math.random() * 12) };
      else if (r < 0.85) ev = { type: 'comment', username: u, text: cmds[Math.floor(Math.random() * cmds.length)] };
      else if (r < 0.93) { const g = gifts[Math.floor(Math.random() * gifts.length)]; ev = { type: 'gift', username: u, giftName: g[0], coins: g[1] }; }
      else if (r < 0.97) ev = { type: 'follow', username: u };
      else ev = { type: 'join', username: 'new_' + Math.floor(Math.random() * 999) };
      ev.action = 'demo_event';
      fetch('api/game.php', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(ev) }).catch(function() {});
    }, 700);
  }

  // Keyboard: H toggles HUD, E ends season (admin), G simulates a Galaxy gift
  document.addEventListener('keydown', function(e) {
    if (e.key === 'h' || e.key === 'H') $('game-hud').classList.toggle('hidden');
    if (e.key === 'r' || e.key === 'R') VE.startRain(15);
    if (e.key === 'g' || e.key === 'G') fetch('api/game.php', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'demo_event', type: 'gift', username: 'streamer_test', giftName: 'Galaxy', coins: 1000 }) });
  });

  window.SocioGame = { getState: function() { return game; }, handleEvent: handleEvent };
})();
