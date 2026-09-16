/**
 * SOCIOBEAST — Cast: the supporting characters (procedural, same scene as the beast)
 *   Pip  — a pink fairy-light host: hypes the chat, explains, runs polls, greets keepers.
 *   Moss — an old mossy turtle on the table edge: slow, dry, wise; answers the deep questions.
 * Each has a 3D body, an idle life, a "speaking" pose and a speech bubble anchored to it.
 * window.Cast = { say(who, text, ms), react(who, kind), positions }
 */
(function() {
  'use strict';
  const T = THREE;
  const $ = function(id) { return document.getElementById(id); };
  const lerp = function(a, b, t) { return a + (b - a) * t; };
  const clamp = function(v, a, b) { return Math.max(a, Math.min(b, v)); };
  const chars = {};
  let clockT = 0, built = false;

  function ready(cb) { if (window.Creature && Creature.ready && Creature.ready()) cb(); else setTimeout(function() { ready(cb); }, 120); }

  function buildPip() {
    const g = new T.Group(); g.position.set(-2.4, 2.3, 0.9);
    const core = new T.Mesh(new T.SphereGeometry(0.16, 24, 18), new T.MeshStandardMaterial({ color: 0xfff0fa, emissive: Creature.PINK, emissiveIntensity: 1.6, roughness: 0.3 })); g.add(core);
    const glow = new T.Mesh(new T.SphereGeometry(0.42, 24, 18), new T.MeshBasicMaterial({ color: Creature.PINK, transparent: true, opacity: 0.16, side: T.BackSide, blending: T.AdditiveBlending, depthWrite: false })); g.add(glow);
    const wings = [-1, 1].map(function(side) { const w = Creature.gradientWing(Creature.wingShape(0.28), 0xffc0ee, 0x9fe9ff); w.position.set(side * 0.08, 0.05, -0.05); w.rotation.y = side * 0.9; w.scale.x = side; g.add(w); return w; });
    // two tiny eyes so it has a face
    const eyeMat = new T.MeshBasicMaterial({ color: 0x3a1040 });
    [-1, 1].forEach(function(side) { const e = new T.Mesh(new T.SphereGeometry(0.03, 10, 8), eyeMat); e.position.set(side * 0.06, 0.03, 0.145); g.add(e); });
    const trail = []; for (let i = 0; i < 10; i++) { const s = new T.Mesh(new T.SphereGeometry(0.05 - i * 0.004, 8, 6), new T.MeshBasicMaterial({ color: i % 2 ? Creature.PINK : 0xffd6f4, transparent: true, opacity: 0.5 - i * 0.045 })); s.position.copy(g.position); Creature.attach(s); trail.push(s); }
    Creature.attach(g);
    chars.pip = { g: g, core: core, glow: glow, wings: wings, trail: trail, home: new T.Vector3(-2.4, 2.3, 0.9), speaking: 0, excite: 0, headY: 0.45, color: '#ffb3ea', bubble: 'bubble-pip' };
  }

  function buildMoss() {
    const g = new T.Group(); g.position.set(2.45, 0.0, 0.7); g.rotation.y = -0.6;
    const shellMat = new T.MeshStandardMaterial({ color: 0x46705a, roughness: 0.95, flatShading: true });
    const shell = new T.Mesh(new T.SphereGeometry(0.55, 18, 12), shellMat); shell.scale.set(1, 0.62, 1.05); shell.position.y = 0.28; g.add(shell);
    const mossMat = new T.MeshStandardMaterial({ color: 0x7fc76a, roughness: 1, flatShading: true });
    for (let i = 0; i < 9; i++) { const a = Math.random() * Math.PI * 2, r = Math.random() * 0.4; const m = new T.Mesh(new T.SphereGeometry(0.07 + Math.random() * 0.07, 8, 6), mossMat); m.position.set(Math.cos(a) * r, 0.28 + Math.sqrt(Math.max(0, 0.3 - r * r * 0.9)) * 0.9, Math.sin(a) * r); g.add(m); }
    const glowMoss = new T.Mesh(new T.SphereGeometry(0.05, 8, 6), new T.MeshStandardMaterial({ color: Creature.CYAN, emissive: Creature.CYAN, emissiveIntensity: 1.4 })); glowMoss.position.set(0.15, 0.62, -0.1); g.add(glowMoss);
    const skin = Creature.plush(0xcfe3b8);
    const head = new T.Group(); head.position.set(0, 0.32, 0.62); g.add(head);
    head.add(new T.Mesh(new T.SphereGeometry(0.2, 18, 14), skin));
    const eyeMat = new T.MeshStandardMaterial({ color: 0x0a0d1a, roughness: 0.15 });
    const eyes = [-1, 1].map(function(side) { const e = new T.Group(); e.position.set(side * 0.09, 0.05, 0.16); const b = new T.Mesh(new T.SphereGeometry(0.045, 12, 10), eyeMat); e.add(b); const gl = new T.Mesh(new T.SphereGeometry(0.014, 6, 6), new T.MeshBasicMaterial({ color: 0xffffff })); gl.position.set(0.015, 0.015, 0.04); e.add(gl); head.add(e); return e; });
    const brows = [-1, 1].map(function(side) { const b = new T.Mesh(new T.BoxGeometry(0.07, 0.018, 0.02), new T.MeshStandardMaterial({ color: 0x8aa27a })); b.position.set(side * 0.09, 0.12, 0.17); b.rotation.z = side * 0.35; head.add(b); return b; });
    const mouth = new T.Mesh(new T.TorusGeometry(0.05, 0.008, 6, 12, Math.PI), new T.MeshBasicMaterial({ color: 0x3a3a2a })); mouth.position.set(0, -0.04, 0.19); mouth.rotation.z = Math.PI; head.add(mouth);
    const legMat = skin;
    [[-0.35, 0.35], [0.35, 0.35], [-0.35, -0.35], [0.35, -0.35]].forEach(function(p) { const l = new T.Mesh(new T.SphereGeometry(0.12, 10, 8), legMat); l.scale.set(1, 0.5, 1.2); l.position.set(p[0], 0.06, p[1]); g.add(l); });
    const tail = new T.Mesh(new T.ConeGeometry(0.06, 0.22, 8), skin); tail.position.set(0, 0.16, -0.62); tail.rotation.x = -Math.PI / 2 - 0.3; g.add(tail);
    Creature.attach(g);
    chars.moss = { g: g, head: head, eyes: eyes, brows: brows, mouth: mouth, speaking: 0, nod: 0, blink: 0, nextBlink: 3, headY: 0.95, color: '#bfe8d8', bubble: 'bubble-moss' };
  }


  // Meshy-textured bodies for the cast (assets/models/char-pip.glb / char-moss.glb). Procedural bodies stay if missing.
  function loadCastModel(who, url, height, yaw) {
    if (!THREE.GLTFLoader) return;
    new T.GLTFLoader().load(url, function(gltf) {
      const c = chars[who]; if (!c) return;
      const obj = gltf.scene; obj.traverse(function(o) { if (o.isMesh && o.material && o.material.map && o.material.emissive) { o.material.emissiveMap = o.material.map; o.material.emissive.set(0xffffff); o.material.emissiveIntensity = who === 'pip' ? 0.5 : 0.25; } });
      const box = new T.Box3().setFromObject(obj), size = box.getSize(new T.Vector3()), sc = height / Math.max(0.001, size.y);
      obj.scale.setScalar(sc); box.setFromObject(obj); const ctr = box.getCenter(new T.Vector3());
      obj.position.set(-ctr.x, who === 'pip' ? -ctr.y : -box.min.y, -ctr.z); obj.rotation.y = yaw || 0;
      c.g.children.slice().forEach(function(ch) { if (ch !== c.glow) ch.visible = false; }); // hide the procedural body, keep Pip's glow
      c.g.add(obj); c.model = obj; c.headY = who === 'pip' ? height * 0.7 : height * 1.05;
    }, undefined, function() {});
  }

  function update(dt, t) {
    const P = chars.pip, M = chars.moss; if (!P || !M) return;
    // Pip: hovers in a figure-eight around home, comes forward when speaking, spirals when excited
    P.speaking = Math.max(0, P.speaking - dt); P.excite = Math.max(0, P.excite - dt);
    const k = 1 - Math.pow(0.02, dt);
    const portrait = innerHeight > innerWidth; P.home.x = portrait ? -1.7 : -2.4; M.g.position.x = portrait ? 2.1 : 2.9; M.g.position.z = portrait ? 1.6 : 1.3;
    const target = P.speaking > 0 ? new T.Vector3(portrait ? -1.1 : -1.5, 2.5, 1.9) : P.home.clone().add(new T.Vector3(Math.sin(t * 0.7) * 0.5, Math.sin(t * 1.9) * 0.25, Math.cos(t * 0.5) * 0.4));
    if (P.excite > 0) { target.x += Math.cos(t * 6) * 0.9; target.y += Math.sin(t * 6) * 0.5; }
    P.g.position.lerp(target, k * 0.6);
    P.wings.forEach(function(w, i) { const side = i === 0 ? -1 : 1; w.rotation.y = side * (0.9 + Math.sin(t * 22) * 0.5); });
    if (P.model) { P.model.rotation.z = Math.sin(t * 3) * 0.08 + (P.speaking > 0 ? Math.sin(t * 9) * 0.06 : 0); P.model.rotation.x = Math.sin(t * 2.1) * 0.06; P.model.rotation.y = 0.35 + Math.sin(t * 0.8) * 0.25 + (P.speaking > 0 ? -0.3 : 0); P.model.position.y = Math.sin(t * 4) * 0.03; }
    P.core.material.emissiveIntensity = 1.4 + Math.sin(t * 5) * 0.3 + (P.speaking > 0 ? 0.6 : 0);
    P.glow.scale.setScalar(1 + Math.sin(t * 4) * 0.08 + (P.speaking > 0 ? 0.25 : 0));
    for (let i = P.trail.length - 1; i >= 0; i--) { const prev = i === 0 ? P.g.position : P.trail[i - 1].position; P.trail[i].position.lerp(prev, k * (1.2 - i * 0.05)); }
    // Moss: slow breath, rare blinks, nods while speaking, brows lift when excited
    M.speaking = Math.max(0, M.speaking - dt); M.nextBlink -= dt; if (M.nextBlink <= 0) { M.blink = 1; M.nextBlink = 4 + Math.random() * 6; } if (M.blink > 0) M.blink = Math.max(0, M.blink - dt * 4);
    const lid = M.blink > 0.5 ? (1 - M.blink) * 2 : M.blink * 2;
    M.eyes.forEach(function(e) { e.scale.y = 1 - lid * 0.9; });
    M.g.scale.y = 1 + Math.sin(t * 0.9) * 0.015;
    M.head.position.z = 0.62 + (M.speaking > 0 ? 0.08 : 0) + Math.sin(t * 0.5) * 0.02;
    M.head.rotation.x = M.speaking > 0 ? Math.sin(t * 6) * 0.08 : Math.sin(t * 0.4) * 0.05;
    M.head.rotation.y = Math.sin(t * 0.3) * 0.25;
    M.mouth.scale.set(1, M.speaking > 0 ? 1 + Math.abs(Math.sin(t * 10)) * 0.8 : 1, 1);
    M.brows.forEach(function(b, i) { b.position.y = 0.12 + (M.speaking > 0 ? 0.02 : 0); });
    if (M.model) { M.model.rotation.x = (M.speaking > 0 ? Math.sin(t * 5) * 0.05 : Math.sin(t * 0.6) * 0.02); M.model.rotation.y = -0.2 + Math.sin(t * 0.25) * 0.15 + (M.speaking > 0 ? 0.25 : 0); M.model.scale.y = M.model.scale.x * (1 + Math.sin(t * 0.9) * 0.02); }
    // bubbles follow their speaker
    ['pip', 'moss'].forEach(function(who) { const c = chars[who], el = $(c.bubble); if (!el || el.classList.contains('hidden')) return; const p = Creature.project(c.g.position.x, c.g.position.y + c.headY, c.g.position.z); const top = ($('top') ? $('top').offsetHeight : 120) + 24 + el.offsetHeight; el.style.transform = 'translate(-50%, -100%) translate(' + clamp(p.x, 190, innerWidth - 190) + 'px,' + clamp(p.y, top, innerHeight - 150) + 'px)'; });
  }

  function say(who, text, ms) {
    const c = chars[who]; if (!c || !text) return;
    const el = $(c.bubble); if (!el) return;
    el.textContent = text; el.classList.remove('hidden'); el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop');
    clearTimeout(el._t); el._t = setTimeout(function() { el.classList.add('hidden'); }, ms || Math.max(3500, 1800 + text.length * 55));
    c.speaking = Math.min(6, 1 + text.length / 16);
    if (window.Game && Game.tts) Game.tts(text, who);
  }
  function react(who, kind) { const c = chars[who]; if (!c) return; if (who === 'pip') c.excite = kind === 'excited' ? 3 : 1; if (who === 'moss') c.nod = 1; }

  ready(function() {
    buildPip(); buildMoss(); built = true;
    loadCastModel('pip', 'assets/models/char-pip.glb', 0.62, 0.35); loadCastModel('moss', 'assets/models/char-moss.glb', 0.95, -0.2);
    let last = performance.now();
    (function tick(now) { requestAnimationFrame(tick); const dt = Math.min(0.05, (now - last) / 1000); last = now; clockT += dt; update(dt, clockT); })(last);
  });

  window.Cast = { say: say, react: react, has: function(who) { return !!chars[who]; } };
})();
