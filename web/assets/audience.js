/**
 * SOCIOBEAST — Audience
 * Feeds Game.handle() with viewer events.
 *   demo : a simulated TikTok crowd in the browser (Vercel demo, rehearsals)
 *   live : polls api/tiktok.php?since=<id> — the PHP relay the Node bridge pushes real TikTok events into
 */
(function() {
  'use strict';
  const C = window.BEAST_CONFIG || {};
  const NAMES = ['luna_qc', 'maxou3d', 'sakura.dev', 'kodama_fan', 'elise_mtl', 'nova_star', 'pixel_pierre', 'zoe.ai', 'mira_ubmaker', 'felix_lab', 'ambre_x', 'yuki_san', 'tom.prints', 'nina.wav'];
  const COMMENTS = ['so cute!!', 'hello!', 'dance', 'sing for us', 'what are you?', 'feed him!!', 'spin', 'he is glowing', 'omg the tail', 'sleep little one', 'play!', 'hi from Montréal', 'is it hungry?', 'I love you beast', 'evolve!!', 'do you dream?'];
  const GIFTS = [['Rose', 1], ['Rose', 1], ['Rose', 1], ['Finger Heart', 5], ['Finger Heart', 5], ['Ice Cream', 1], ['GG', 1], ['Hand Hearts', 100]]; // Galaxy: 1 gift in 40 below
  const pick = function(a) { return a[Math.floor(Math.random() * a.length)]; };

  function ready(cb) { if (window.Game) cb(); else setTimeout(function() { ready(cb); }, 100); }

  // ── demo crowd: bursts and lulls, so hunger and loneliness actually happen ──
  function demo() {
    let energy = 1; // crowd activity 0.2 … 1.6, drifts over time
    (function loop() {
      energy = Math.max(0.15, Math.min(1.6, energy + (Math.random() - 0.5) * 0.4));
      const u = pick(NAMES), r = Math.random(); let ev;
      if (r < 0.58) ev = { type: 'like', username: u, count: Math.random() < 0.15 ? 15 + Math.floor(Math.random() * 30) : 1 + Math.floor(Math.random() * 6) };
      else if (r < 0.86) ev = { type: 'comment', username: u, text: pick(COMMENTS) };
      else if (r < 0.93) { const g = Math.random() < 0.025 ? ['Galaxy', 1000] : pick(GIFTS); ev = { type: 'gift', username: u, giftName: g[0], coins: g[1], count: 1 }; }
      else if (r < 0.97) ev = { type: 'follow', username: u };
      else if (r < 0.99) ev = { type: 'share', username: u };
      else ev = { type: 'join', username: pick(NAMES) };
      Game.handle(ev);
      setTimeout(loop, (600 + Math.random() * 2400) / energy);
    })();
  }

  // ── live: poll the relay ──
  function live() {
    let since = 0, failures = 0;
    function poll() {
      fetch('api/tiktok.php?since=' + since, { cache: 'no-store' }).then(function(r) { return r.json(); }).then(function(d) {
        failures = 0; (d.events || []).forEach(function(ev) { since = Math.max(since, ev.id || 0); Game.handle(ev); });
        if (d.lastId) since = Math.max(since, d.lastId);
        document.getElementById('h-live').classList.toggle('off', !d.bridgeAlive);
      }).catch(function() { failures++; if (failures === 5) document.getElementById('h-live').classList.add('off'); });
    }
    poll(); setInterval(poll, 1000);
  }

  ready(function() { if (C.mode === 'live') live(); else demo(); });
})();
