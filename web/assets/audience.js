/**
 * SOCIOBEAST — Audience
 * Feeds Game.handle() with viewer events.
 *   demo : a simulated TikTok crowd in the browser (Vercel demo, rehearsals)
 *   live : WebSocket to the home server (server/server.js) that bridges TikTok Live and keeps the creature's save
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

  // ── live: WebSocket to the home server (server/server.js). Events come in real time; the page sends its state back
  //    every few seconds so the server keeps the creature on disk; admin commands arrive as {type:'cmd'}. ──
  let ws = null, wsOpen = false;
  function live() {
    const liveEl = document.getElementById('h-live');
    function connect() {
      ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws?role=display');
      ws.onopen = function() { wsOpen = true; };
      ws.onclose = function() { wsOpen = false; liveEl.classList.add('off'); setTimeout(connect, 2000); };
      ws.onmessage = function(m) {
        let d; try { d = JSON.parse(m.data); } catch (e) { return; }
        if (d.type === 'event' && d.ev) Game.handle(d.ev);
        else if (d.type === 'hello' || d.type === 'bridge') { const b = d.bridge || {}; liveEl.classList.toggle('off', !(b.status === 'connected' || b.status === 'demo')); liveEl.textContent = b.status === 'demo' ? 'Demo' : 'Live'; }
        else if (d.type === 'cmd') Game.command(d.cmd, d.text);
        else if (d.type === 'config' && d.config) { C.ai = d.config.ai; C.voice = d.config.voice; }
      };
    }
    connect();
  }
  function sendState(state) { if (ws && wsOpen) ws.send(JSON.stringify({ type: 'state', state: state })); }
  window.Audience = { sendState: sendState, connected: function() { return wsOpen; } };

  ready(function() { if (C.mode === 'live') live(); else demo(); });
})();
