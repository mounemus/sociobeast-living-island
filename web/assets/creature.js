/**
 * SOCIOBEAST — Creature (v21, "neon chibi dragon")
 * Fully procedural Three.js r128: a plush white chibi dragon with big glossy black eyes, rosy cheeks, tiny fangs,
 * a crystal crest, a glowing collar, membrane wings (pink → cyan), feather wings, a crown and an aura, all appearing
 * form by form. Nest of twigs on a table in a neon night room (bokeh). Every motion is generated from the A state.
 * Public API at the bottom (window.Creature) — game.js only talks to that.
 */
(function() {
  'use strict';

  const T = THREE;
  const randDir = function() { const z = Math.random() * 2 - 1, a = Math.random() * Math.PI * 2, r = Math.sqrt(1 - z * z); return new T.Vector3(r * Math.cos(a), z, r * Math.sin(a)); };
  const clamp = function(v, a, b) { return Math.max(a, Math.min(b, v)); };
  const lerp = function(a, b, t) { return a + (b - a) * t; };
  const rnd = function(a, b) { return a + Math.random() * (b - a); };

  let renderer, scene, camera, composer, clock;
  let root, parts = {}, eyes = [];
  let nest, skyMat, bokeh, fireflies, fireflyVel = [];
  let hearts = [], sparks = [], orbitAngle = 0.4, camPunch = 0, camTarget = new T.Vector3();
  const uni = { time: { value: 0 }, wobble: { value: 1 } };
  const PINK = 0xff7ad9, CYAN = 0x6fe9ff, GOLD = 0xffd36b, WHITE = 0xfbf7ff, CREAM = 0xfff1dc;

  const A = {
    stage: 0, mood: 'curious', asleep: false, fading: false, energy: 80, food: 70, joy: 50, hatch: 0,
    breathRate: 1, y: 0, vy: 0, grounded: true, squash: 0, face: 0, faceTarget: 0,
    look: new T.Vector2(0, 0), lookTarget: new T.Vector2(0, 0), blink: 0, nextBlink: 2,
    mouthOpen: 0, mouthOpenT: 0, smile: 0.5, smileT: 0.5, brow: 0, browT: 0, blush: 0.5, blushT: 0.5,
    talk: 0, wave: 0, spin: 0, spinT: 0, dance: 0, wobble: 0, growth: 1, growthT: 1,
    tx: 0, tz: 0, act: null, actT: 0, actDur: 0, glow: 0.3, stageGrow: 1, lookCam: 0
  };

  // ─────────────────────────────────────────────────────────────
  // MATERIALS & HELPERS
  // ─────────────────────────────────────────────────────────────
  function dotTexture() { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); const r = g.createRadialGradient(32, 32, 0, 32, 32, 32); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.3, 'rgba(255,255,255,.7)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, 64, 64); return new T.CanvasTexture(c); }
  let dot;
  function plush(color, opts) { // soft "fur" look + the living wobble in the vertex shader
    const m = new T.MeshStandardMaterial(Object.assign({ color: color, roughness: 0.85, metalness: 0 }, opts || {}));
    m.onBeforeCompile = function(sh) {
      sh.uniforms.uTime = uni.time; sh.uniforms.uWobble = uni.wobble;
      sh.vertexShader = 'uniform float uTime; uniform float uWobble;\n' + sh.vertexShader.replace('#include <begin_vertex>',
        '#include <begin_vertex>\n float w = sin(position.y * 6.0 + uTime * 2.1) * 0.012 + sin(position.x * 8.0 - uTime * 1.6) * 0.009 + sin(position.z * 7.0 + uTime * 2.7) * 0.007;\n transformed += normal * w * uWobble;');
    };
    return m;
  }
  function crystal(color) { return new T.MeshStandardMaterial({ color: color, emissive: color, emissiveIntensity: 0.9, roughness: 0.2, transparent: true, opacity: 0.92 }); }
  function jitter(geo, amt) { const p = geo.attributes.position; for (let i = 0; i < p.count; i++) p.setXYZ(i, p.getX(i) + (Math.random() - .5) * amt, p.getY(i) + (Math.random() - .5) * amt * .5, p.getZ(i) + (Math.random() - .5) * amt); geo.computeVertexNormals(); return geo; }
  function sphere(r, mat, sx, sy, sz) { const m = new T.Mesh(new T.SphereGeometry(r, 36, 28), mat); m.scale.set(sx || 1, sy || 1, sz || 1); return m; }
  function hide(o) { o.scale.setScalar(0.001); return o; }
  function wingShape(scale) { const s = new T.Shape(); s.moveTo(0, 0); s.bezierCurveTo(0.5, 0.9, 1.4, 1.1, 1.9, 0.6); s.bezierCurveTo(1.5, 0.45, 1.4, 0.2, 1.7, -0.2); s.bezierCurveTo(1.2, -0.1, 0.9, -0.3, 0.9, -0.55); s.bezierCurveTo(0.5, -0.3, 0.2, -0.2, 0, 0); const g = new T.ShapeGeometry(s, 14); g.scale(scale, scale, scale); return g; }
  function featherShape() { const s = new T.Shape(); s.moveTo(0, 0); s.bezierCurveTo(0.4, 1.2, 1.6, 1.6, 2.4, 1.1); s.bezierCurveTo(2.0, 0.9, 2.2, 0.5, 2.5, 0.2); s.bezierCurveTo(1.9, 0.2, 1.9, -0.2, 2.1, -0.5); s.bezierCurveTo(1.5, -0.35, 1.2, -0.5, 1.0, -0.8); s.bezierCurveTo(0.5, -0.4, 0.2, -0.2, 0, 0); return new T.ShapeGeometry(s, 16); }
  function gradientWing(geo, c1, c2) { // pink → cyan across the span, like a neon membrane
    const p = geo.attributes.position, col = new Float32Array(p.count * 3), a = new T.Color(c1), b = new T.Color(c2), tmp = new T.Color();
    let maxX = 0; for (let i = 0; i < p.count; i++) maxX = Math.max(maxX, p.getX(i));
    for (let i = 0; i < p.count; i++) { tmp.copy(a).lerp(b, clamp(p.getX(i) / maxX, 0, 1)); col.set([tmp.r, tmp.g, tmp.b], i * 3); }
    geo.setAttribute('color', new T.BufferAttribute(col, 3));
    return new T.Mesh(geo, new T.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.82, side: T.DoubleSide, depthWrite: false }));
  }

  // ─────────────────────────────────────────────────────────────
  // BUILD
  // ─────────────────────────────────────────────────────────────
  function init(canvas) {
    renderer = new T.WebGLRenderer({ canvas: canvas, antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.outputEncoding = T.sRGBEncoding; renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
    scene = new T.Scene(); camera = new T.PerspectiveCamera(36, 1, 0.1, 200); clock = new T.Clock(); dot = dotTexture();
    buildRoom(); buildLights(); buildNest(); buildCreature(); buildParticles();
    resize(); addEventListener('resize', resize);
    if (T.EffectComposer && T.UnrealBloomPass) { composer = new T.EffectComposer(renderer); composer.addPass(new T.RenderPass(scene, camera)); composer.addPass(new T.UnrealBloomPass(new T.Vector2(innerWidth, innerHeight), 0.45, 0.7, 0.86)); }
    requestAnimationFrame(loop);
  }
  function resize() { const w = innerWidth, h = innerHeight; renderer.setSize(w, h); camera.aspect = w / h; camera.fov = w < h ? 50 : 36; camera.updateProjectionMatrix(); if (composer) composer.setSize(w, h); }

  function buildRoom() { // neon night: navy → purple gradient, big soft bokeh lights far behind
    skyMat = new T.ShaderMaterial({ side: T.BackSide, depthWrite: false,
      uniforms: { top: { value: new T.Color(0x05061a) }, mid: { value: new T.Color(0x171243) }, bot: { value: new T.Color(0x2a1550) } },
      vertexShader: 'varying vec3 vp; void main(){ vp = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'uniform vec3 top, mid, bot; varying vec3 vp; void main(){ float h = normalize(vp).y; vec3 c = h > 0.0 ? mix(mid, top, pow(h, 0.8)) : mix(mid, bot, pow(-h, 0.7)); gl_FragColor = vec4(c, 1.0); }' });
    scene.add(new T.Mesh(new T.SphereGeometry(90, 32, 16), skyMat));
    scene.fog = new T.FogExp2(0x120d2e, 0.02);
    const n = 70, pos = new Float32Array(n * 3), col = new Float32Array(n * 3), palette = [new T.Color(PINK), new T.Color(CYAN), new T.Color(0xb07cff), new T.Color(0xffb3e6)];
    for (let i = 0; i < n; i++) { const a = rnd(-1.4, 1.4), d = rnd(14, 30); pos.set([Math.sin(a) * d, rnd(-1, 9), -Math.cos(a) * d], i * 3); const c = palette[i % 4]; col.set([c.r, c.g, c.b], i * 3); }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(pos, 3)); g.setAttribute('color', new T.BufferAttribute(col, 3));
    bokeh = new T.Points(g, new T.PointsMaterial({ size: 2.6, map: dot, vertexColors: true, transparent: true, opacity: 0.55, depthWrite: false, blending: T.AdditiveBlending }));
    scene.add(bokeh);
  }
  function buildLights() {
    scene.add(new T.HemisphereLight(0x9fb8ff, 0x2a1a3a, 0.45));
    const key = new T.DirectionalLight(0xfff4e6, 0.85); key.position.set(3, 6, 5); scene.add(key);
    const fill = new T.PointLight(PINK, 0.9, 14); fill.position.set(-4.5, 3, 3.5); scene.add(fill);
    const rim = new T.PointLight(CYAN, 1.0, 14); rim.position.set(4.5, 3.5, -3); scene.add(rim);
    parts.innerLight = new T.PointLight(0xffc6f0, 0.3, 4); parts.innerLight.position.set(0, 1.2, 0.6); scene.add(parts.innerLight);
  }
  function buildNest() {
    nest = new T.Group(); scene.add(nest);
    const table = new T.Mesh(new T.CylinderGeometry(3.2, 3.4, 0.35, 40), new T.MeshStandardMaterial({ color: 0x2b2340, roughness: 0.9 })); table.position.y = -0.2; nest.add(table);
    const wood = new T.MeshStandardMaterial({ color: 0x6b4a2e, roughness: 0.95, flatShading: true });
    const ring = new T.Mesh(jitter(new T.TorusGeometry(1.45, 0.36, 10, 40), 0.06), wood); ring.rotation.x = Math.PI / 2; ring.scale.z = 0.6; ring.position.y = 0.12; nest.add(ring);
    const twig = new T.MeshStandardMaterial({ color: 0x8a6238, roughness: 0.95 });
    for (let i = 0; i < 46; i++) { const a = rnd(0, Math.PI * 2), r = rnd(1.15, 1.8); const m = new T.Mesh(new T.CylinderGeometry(0.018, 0.028, rnd(0.7, 1.4), 5), twig); m.position.set(Math.cos(a) * r, rnd(0.05, 0.4), Math.sin(a) * r); m.rotation.set(rnd(-.5, .5), a + Math.PI / 2 + rnd(-.9, .9), Math.PI / 2 + rnd(-.45, .45)); nest.add(m); }
    const floor = new T.Mesh(new T.CircleGeometry(1.25, 24), new T.MeshStandardMaterial({ color: 0x4d3620, roughness: 1 })); floor.rotation.x = -Math.PI / 2; floor.position.y = 0.02; nest.add(floor);
    // spirit stones light up with each form
    parts.runes = new T.Group(); nest.add(parts.runes);
    for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2 + 0.3; const r = new T.Mesh(new T.OctahedronGeometry(0.12, 0), new T.MeshStandardMaterial({ color: i % 2 ? PINK : CYAN, emissive: i % 2 ? PINK : CYAN, emissiveIntensity: 0, roughness: 0.3 })); r.position.set(Math.cos(a) * 2.6, 0.25, Math.sin(a) * 2.6); r.userData.base = 0.25; parts.runes.add(r); }
  }

  function buildCreature() {
    root = new T.Group(); scene.add(root);
    parts.rig = new T.Group(); root.add(parts.rig);
    parts.tilt = new T.Group(); parts.rig.add(parts.tilt);
    parts.beast = new T.Group(); parts.tilt.add(parts.beast);
    const G = parts.beast;
    const fur = plush(WHITE); parts.fur = fur;
    const cream = plush(CREAM); parts.cream = cream;
    const dark = new T.MeshStandardMaterial({ color: 0x1a1024, roughness: 0.6 });

    // body (sitting) + belly
    parts.body = sphere(0.66, fur, 1, 1.02, 0.9); parts.body.position.y = 0.66; G.add(parts.body);
    parts.belly = sphere(0.46, cream, 0.85, 0.92, 0.5); parts.belly.position.set(0, 0.6, 0.44); G.add(parts.belly);
    // head (big, chibi)
    parts.head = new T.Group(); parts.head.position.y = 1.55; G.add(parts.head);
    const H = parts.head;
    H.add(sphere(0.86, fur, 1.06, 0.95, 0.96));
    parts.muzzle = sphere(0.34, fur, 1.2, 0.72, 0.72); parts.muzzle.position.set(0, -0.22, 0.7); H.add(parts.muzzle);
    // eyes: glossy black with two highlights, plush eyelids
    const eyeMat = new T.MeshStandardMaterial({ color: 0x0a0d1a, roughness: 0.12, metalness: 0.1 });
    const glint = new T.MeshBasicMaterial({ color: 0xffffff });
    [-1, 1].forEach(function(side) {
      const g = new T.Group(); g.position.set(side * 0.37, 0.08, 0.66); H.add(g);
      g.add(sphere(0.27, eyeMat));
      const iris = sphere(0.19, new T.MeshStandardMaterial({ color: 0x1b2a5c, roughness: 0.2, emissive: 0x0f1d4a, emissiveIntensity: 0.4 })); iris.position.z = 0.1; g.add(iris);
      const h1 = sphere(0.085, glint); h1.position.set(0.09 - side * 0.02, 0.1, 0.21); g.add(h1);
      const h2 = sphere(0.04, glint); h2.position.set(-0.08, -0.07, 0.23); g.add(h2);
      const lid = new T.Mesh(new T.SphereGeometry(0.29, 28, 14, 0, Math.PI * 2, 0, Math.PI * 0.5), fur); g.add(lid);
      eyes.push({ g: g, lid: lid, iris: iris, h1: h1, h2: h2, side: side });
    });
    // mouth: open ellipse, smile arc, two tiny fangs, tongue
    parts.mouthOpen = new T.Mesh(new T.CircleGeometry(0.1, 24), new T.MeshStandardMaterial({ color: 0x4a1030, roughness: 0.6 })); parts.mouthOpen.position.set(0, -0.3, 0.95); parts.mouthOpen.scale.set(1, 0.001, 1); H.add(parts.mouthOpen);
    parts.smile = new T.Mesh(new T.TorusGeometry(0.13, 0.02, 8, 24, Math.PI), dark); parts.smile.position.set(0, -0.26, 0.94); parts.smile.rotation.z = Math.PI; H.add(parts.smile);
    parts.fangs = [-1, 1].map(function(side) { const f = new T.Mesh(new T.ConeGeometry(0.03, 0.09, 6), new T.MeshStandardMaterial({ color: 0xffffff })); f.position.set(side * 0.08, -0.31, 0.95); f.rotation.x = Math.PI; H.add(hide(f)); return f; });
    parts.tongue = sphere(0.05, new T.MeshStandardMaterial({ color: 0xff7f95 }), 1, 0.6, 0.5); parts.tongue.position.set(0, -0.36, 0.96); parts.tongue.visible = false; H.add(parts.tongue);
    // cheeks
    const cheekMat = new T.MeshBasicMaterial({ color: 0xff8fb8, transparent: true, opacity: 0.55 });
    parts.cheeks = [-1, 1].map(function(side) { const c = new T.Mesh(new T.CircleGeometry(0.13, 18), cheekMat); c.position.set(side * 0.6, -0.17, 0.62); c.lookAt(side * 3, -0.3, 3); H.add(c); return c; });
    // ears (stage 1+): rounded with pink inside
    parts.ears = [-1, 1].map(function(side) { const e = new T.Group(); e.position.set(side * 0.78, 0.36, 0.05); e.rotation.z = -side * 1.05; const outer = new T.Mesh(new T.ConeGeometry(0.17, 0.4, 12), fur); e.add(outer); const inner = new T.Mesh(new T.ConeGeometry(0.1, 0.3, 12), new T.MeshStandardMaterial({ color: 0xffa7d1, emissive: 0xff5fb0, emissiveIntensity: 0.15 })); inner.position.set(0, -0.02, 0.06); e.add(inner); H.add(hide(e)); return e; });
    // baby tuft (stage 1 only) & crystal crest (stage 2+)
    parts.tuft = new T.Group(); parts.tuft.position.set(0, 0.86, 0.05); H.add(hide(parts.tuft));
    [[-0.1, 0.2], [0.05, 0.35], [0.14, 0.15]].forEach(function(p) { const t = new T.Mesh(new T.ConeGeometry(0.07, 0.34, 8), new T.MeshStandardMaterial({ color: 0xffe37a, emissive: 0xffc247, emissiveIntensity: 0.3 })); t.position.set(p[0], p[1] * 0.5, 0); t.rotation.z = -p[0] * 3; parts.tuft.add(t); });
    parts.crest = new T.Group(); parts.crest.position.set(0, 0.8, -0.05); H.add(hide(parts.crest));
    [[0, 0.62, 0], [-0.3, 0.46, -0.12], [0.3, 0.46, -0.12], [-0.55, 0.3, -0.25], [0.55, 0.3, -0.25]].forEach(function(p) { const c = new T.Mesh(new T.ConeGeometry(0.09, p[1], 6), crystal(CYAN)); c.position.set(p[0], p[1] * 0.45, p[2]); c.rotation.z = -p[0] * 0.9; parts.crest.add(c); });
    // collar + pendant (stage 3+)
    parts.collar = new T.Group(); parts.collar.position.y = 1.02; G.add(hide(parts.collar));
    const band = new T.Mesh(new T.TorusGeometry(0.56, 0.055, 10, 36), dark); band.rotation.x = Math.PI / 2; parts.collar.add(band);
    parts.pendant = new T.Mesh(new T.OctahedronGeometry(0.11, 0), crystal(PINK)); parts.pendant.position.set(0, -0.1, 0.56); parts.collar.add(parts.pendant);
    // arms & paws (stage 1+), feet
    parts.arms = [-1, 1].map(function(side) { const a = new T.Group(); a.position.set(side * 0.62, 0.95, 0.3); const c = new T.Mesh(new T.CylinderGeometry(0.1, 0.12, 0.36, 12), fur); c.position.y = -0.18; a.add(c); const paw = sphere(0.14, fur); paw.position.y = -0.38; a.add(paw); a.rotation.z = side * 0.5; G.add(hide(a)); return a; });
    parts.feet = [-1, 1].map(function(side) { const f = sphere(0.24, fur, 1, 0.5, 1.2); f.position.set(side * 0.34, 0.1, 0.5); G.add(f); return f; });
    // tail (stage 1+): tapered chain with a pink spike tip
    parts.tail = new T.Group(); parts.tail.position.set(0, 0.5, -0.6); G.add(hide(parts.tail)); parts.tailSegs = [];
    for (let i = 0; i < 8; i++) { const s = sphere(0.19 - i * 0.018, fur); parts.tail.add(s); parts.tailSegs.push(s); }
    parts.tailTip = new T.Mesh(new T.ConeGeometry(0.09, 0.28, 8), crystal(PINK)); parts.tail.add(parts.tailTip);
    // membrane wings (stage 4+): pink → cyan gradient
    parts.wings = [-1, 1].map(function(side) { const w = gradientWing(wingShape(1.05), PINK, CYAN); w.position.set(side * 0.5, 1.15, -0.45); w.rotation.y = side * 0.55; G.add(w); w.scale.set(side * 0.001, 0.001, 0.001); return w; });
    // back crystals + belly glyph (stage 5+)
    parts.crystals = new T.Group(); G.add(hide(parts.crystals));
    [[-0.5, 1.05, -0.4, 0.22], [0.5, 1.05, -0.4, 0.22], [-0.28, 1.4, -0.7, 0.16], [0.28, 1.4, -0.7, 0.16], [0, 0.95, -0.75, 0.2]].forEach(function(p) { const c = new T.Mesh(new T.OctahedronGeometry(p[3], 0), crystal(CYAN)); c.position.set(p[0], p[1], p[2]); c.scale.y = 1.6; parts.crystals.add(c); });
    parts.glyph = new T.Mesh(new T.TorusGeometry(0.13, 0.025, 8, 24), crystal(CYAN)); parts.glyph.position.set(0, 0.72, 0.9); G.add(hide(parts.glyph));
    // feather wings, crown, aura (stage 6+)
    parts.feathers = [-1, 1].map(function(side) { const w = new T.Mesh(featherShape(), new T.MeshStandardMaterial({ color: 0xffffff, emissive: 0xdfe9ff, emissiveIntensity: 0.55, transparent: true, opacity: 0.92, side: T.DoubleSide })); w.position.set(side * 0.45, 1.25, -0.55); w.rotation.y = side * 0.6; G.add(w); w.scale.set(side * 0.001, 0.001, 0.001); return w; });
    parts.crown = new T.Group(); parts.crown.position.set(0, 2.55, -0.05); G.add(hide(parts.crown));
    const goldMat = new T.MeshStandardMaterial({ color: GOLD, emissive: GOLD, emissiveIntensity: 0.5, roughness: 0.3, metalness: 0.6 });
    const ringC = new T.Mesh(new T.TorusGeometry(0.34, 0.045, 10, 32), goldMat); ringC.rotation.x = Math.PI / 2; parts.crown.add(ringC);
    for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; const pt = new T.Mesh(new T.ConeGeometry(0.06, 0.22, 6), goldMat); pt.position.set(Math.cos(a) * 0.32, 0.12, Math.sin(a) * 0.32); parts.crown.add(pt); const gem = new T.Mesh(new T.OctahedronGeometry(0.045, 0), crystal(i % 2 ? PINK : CYAN)); gem.position.set(Math.cos(a) * 0.32, 0.26, Math.sin(a) * 0.32); parts.crown.add(gem); }
    parts.aura = new T.Mesh(new T.SphereGeometry(1.9, 32, 24), new T.MeshBasicMaterial({ color: 0xff9be6, transparent: true, opacity: 0, side: T.BackSide, blending: T.AdditiveBlending, depthWrite: false })); parts.aura.position.y = 1.3; G.add(parts.aura);
    parts.halo = new T.Group(); parts.halo.position.y = 3.0; G.add(hide(parts.halo));
    for (let i = 0; i < 8; i++) parts.halo.add(new T.Mesh(new T.OctahedronGeometry(0.06, 0), crystal(i % 2 ? PINK : GOLD)));
    // egg (stage 0): white shell with a glowing mark, cracks light up as hatching nears
    parts.egg = new T.Group(); parts.tilt.add(parts.egg);
    const shell = sphere(1.0, new T.MeshStandardMaterial({ color: 0xfaf6ff, roughness: 0.45 }), 1, 1.25, 1); shell.position.y = 1.2; parts.egg.add(shell);
    parts.eggMark = new T.Mesh(new T.OctahedronGeometry(0.16, 0), crystal(PINK)); parts.eggMark.position.set(0, 1.25, 0.95); parts.eggMark.scale.z = 0.4; parts.egg.add(parts.eggMark);
    parts.eggCracks = [];
    for (let i = 0; i < 5; i++) { const c = new T.Mesh(new T.BoxGeometry(0.02, rnd(0.25, 0.5), 0.02), crystal(CYAN)); const a = rnd(0, Math.PI * 2), e = rnd(-0.5, 0.6); c.position.set(Math.cos(a) * Math.sqrt(1 - e * e) * 0.99, 1.2 + e * 1.24, Math.sin(a) * Math.sqrt(1 - e * e) * 0.99); c.lookAt(0, 1.2, 0); c.rotation.z = rnd(0, Math.PI); c.visible = false; parts.egg.add(c); parts.eggCracks.push(c); }
    // sleep Zs
    parts.zz = new T.Group(); parts.zz.position.set(0.95, 2.4, 0.3); G.add(parts.zz); parts.zz.visible = false;
    for (let i = 0; i < 3; i++) { const z = new T.Mesh(new T.TorusKnotGeometry(0.06 + i * 0.02, 0.018, 30, 6, 1, 3), new T.MeshBasicMaterial({ color: 0xd7e8ff })); z.position.set(i * 0.22, i * 0.3, 0); parts.zz.add(z); }
    // FX pools
    const hs = new T.Shape(); hs.moveTo(0, 0.5); hs.bezierCurveTo(0, 0.5, -0.1, 0.9, -0.5, 0.9); hs.bezierCurveTo(-1.1, 0.9, -1.1, 0.2, -1.1, 0.2); hs.bezierCurveTo(-1.1, -0.2, -0.7, -0.6, 0, -1); hs.bezierCurveTo(0.7, -0.6, 1.1, -0.2, 1.1, 0.2); hs.bezierCurveTo(1.1, 0.2, 1.1, 0.9, 0.5, 0.9); hs.bezierCurveTo(0.1, 0.9, 0, 0.5, 0, 0.5);
    parts.heartGeo = new T.ExtrudeGeometry(hs, { depth: 0.25, bevelEnabled: true, bevelSize: 0.08, bevelThickness: 0.05, bevelSegments: 2 }); parts.heartGeo.scale(0.13, 0.13, 0.13); parts.heartGeo.rotateZ(Math.PI);
    parts.heartMats = [0xff4f8b, PINK, 0xff9ad0, 0xff2f6d].map(function(c) { return new T.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.6, transparent: true }); });
    parts.sparkGeo = new T.OctahedronGeometry(0.045, 0); parts.sparkMat = new T.MeshBasicMaterial({ color: 0xffe9a3, transparent: true });
  }

  function buildParticles() {
    const n = 70, pos = new Float32Array(n * 3), col = new Float32Array(n * 3), a = new T.Color(CYAN), b = new T.Color(PINK);
    for (let i = 0; i < n; i++) { pos.set([rnd(-5, 5), rnd(0.3, 4), rnd(-5, 5)], i * 3); const c = i % 3 ? a : b; col.set([c.r, c.g, c.b], i * 3); fireflyVel.push(new T.Vector3(rnd(-.15, .15), rnd(-.1, .1), rnd(-.15, .15))); }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(pos, 3)); g.setAttribute('color', new T.BufferAttribute(col, 3));
    fireflies = new T.Points(g, new T.PointsMaterial({ size: 0.14, map: dot, vertexColors: true, transparent: true, opacity: 0.9, blending: T.AdditiveBlending, depthWrite: false }));
    scene.add(fireflies);
  }

  // ─────────────────────────────────────────────────────────────
  // STAGE & MOOD
  // ─────────────────────────────────────────────────────────────
  // 0 egg · 1 baby · 2 child · 3 teen · 4 adult · 5 special · 6 legendary · 7 infinite
  const STAGE_LOOK = [
    { s: 0.85, col: WHITE, glow: 0.1 }, { s: 0.6, col: WHITE, glow: 0.15 }, { s: 0.72, col: WHITE, glow: 0.25 }, { s: 0.84, col: WHITE, glow: 0.35 },
    { s: 0.96, col: WHITE, glow: 0.45 }, { s: 1.06, col: 0xf4f6ff, glow: 0.7 }, { s: 1.16, col: 0xf7f9ff, glow: 1.0 }, { s: 1.26, col: 0x2a1c4a, glow: 1.3 }
  ];
  function setStage(n, animate) {
    A.stage = n; const L = STAGE_LOOK[Math.min(7, n)];
    A.growthT = L.s; if (!animate) A.growth = L.s;
    A.glow = L.glow; parts.egg.visible = n === 0;
    if (animate) { A.stageGrow = 0; camPunch = 1; }
  }
  function partScale(obj, on, k, mult) { const t = on ? (mult || 1) : 0.001; obj.scale.x += (t * Math.sign(obj.scale.x || 1) - obj.scale.x) * k; obj.scale.y += (t - obj.scale.y) * k; obj.scale.z += (t - obj.scale.z) * k; }

  const MOODS = {
    curious:  { smile: 0.5, brow: 0.1, blush: 0.5, open: 0.1, breath: 1 },
    happy:    { smile: 0.9, brow: 0.2, blush: 0.8, open: 0.25, breath: 1.2 },
    ecstatic: { smile: 1, brow: 0.4, blush: 1, open: 0.6, breath: 1.6 },
    hungry:   { smile: -0.5, brow: -0.5, blush: 0.3, open: 0.4, breath: 0.9 },
    sleepy:   { smile: 0.2, brow: -0.2, blush: 0.4, open: 0.1, breath: 0.6 },
    lonely:   { smile: -0.3, brow: -0.6, blush: 0.2, open: 0, breath: 0.8 },
    asleep:   { smile: 0.3, brow: 0, blush: 0.4, open: 0.05, breath: 0.45 },
    fading:   { smile: -0.6, brow: -0.7, blush: 0, open: 0, breath: 0.35 },
    angry:    { smile: -0.4, brow: 0.9, blush: 0.5, open: 0.2, breath: 1.4 }
  };
  function setMood(m) { A.mood = MOODS[m] ? m : 'curious'; }
  function setVitals(v) { A.food = v.food; A.joy = v.joy; A.energy = v.energy; A.asleep = !!v.asleep; A.fading = !!v.fading; }
  function setHatchProgress(p) { A.hatch = clamp(p, 0, 1); }

  // ─────────────────────────────────────────────────────────────
  // ACTIONS
  // ─────────────────────────────────────────────────────────────
  function act(name, dur) { A.act = name; A.actT = 0; A.actDur = dur || 1.5; }
  function hop(power) { if (A.grounded) { A.vy = 4.2 * (power || 1); A.grounded = false; } }
  function wander() { const a = Math.random() * Math.PI * 2, r = 0.2 + Math.random() * 0.6; A.tx = Math.cos(a) * r; A.tz = Math.sin(a) * r; act('wander', 3); }
  function spin() { A.spinT += Math.PI * 2; hop(0.8); act('spin', 1.2); }
  function dance(sec) { act('dance', sec || 4); }
  function sing(sec) { act('sing', sec || 3.5); }
  function beg(sec) { A.tx = 0; A.tz = 0.3; act('beg', sec || 4); }
  function yawn() { act('yawn', 2.2); }
  function wave(sec) { act('wave', sec || 2.5); }
  function nom(sec) { act('nom', sec || 2); }
  function shiver(sec) { act('shiver', sec || 1.2); }
  function bow() { act('bow', 1.6); }
  function play() { A.tx = (Math.random() - .5) * 1.2; A.tz = (Math.random() - .5) * 0.8; act('play', 3.5); }
  function talk(sec) { A.talk = Math.max(A.talk, sec || 2); }
  function lookAtCamera(sec) { A.lookCam = sec || 3; }
  function lookAround() { A.lookTarget.set((Math.random() - .5) * 1.6, (Math.random() - .5) * 0.8); }

  // ─────────────────────────────────────────────────────────────
  // FX
  // ─────────────────────────────────────────────────────────────
  function burstHearts(n, big) {
    for (let i = 0; i < Math.min(n, 40); i++) {
      const m = new T.Mesh(parts.heartGeo, parts.heartMats[Math.floor(Math.random() * parts.heartMats.length)].clone());
      const a = Math.random() * Math.PI * 2, r = 0.5 + Math.random() * 1.2;
      m.position.set(root.position.x + Math.cos(a) * r, 0.6 + Math.random() * 1.4, root.position.z + Math.sin(a) * r);
      m.userData = { vy: 0.9 + Math.random() * 0.9, life: 2.2 + Math.random(), age: 0, spin: (Math.random() - .5) * 3, s: big ? 1.5 : 0.8 + Math.random() * 0.6 };
      m.scale.setScalar(0.001); scene.add(m); hearts.push(m);
    }
  }
  function burstSparks(n, color, spread) {
    for (let i = 0; i < Math.min(n, 400); i++) {
      const m = new T.Mesh(parts.sparkGeo, parts.sparkMat.clone()); if (color) m.material.color.set(color);
      m.position.set(root.position.x, 1.4 * A.growth, root.position.z);
      const v = randDir().multiplyScalar(1.5 + Math.random() * (spread || 3)); v.y = Math.abs(v.y) + 1;
      m.userData = { v: v, life: 1.4 + Math.random() * 1.2, age: 0 }; scene.add(m); sparks.push(m);
    }
  }
  function noteSpark() { const m = new T.Mesh(parts.sparkGeo, parts.sparkMat.clone()); m.material.color.set(Math.random() < 0.5 ? CYAN : PINK); m.position.set(root.position.x + 0.5, 2.2 * A.growth, root.position.z + 0.5); m.userData = { v: new T.Vector3(0.4 + Math.random() * 0.4, 1.6, 0.3), life: 1.6, age: 0 }; scene.add(m); sparks.push(m); }
  function punch(k) { camPunch = Math.max(camPunch, k || 0.6); }

  // ─────────────────────────────────────────────────────────────
  // LOOP
  // ─────────────────────────────────────────────────────────────
  function loop() {
    requestAnimationFrame(loop);
    const dt = Math.min(0.05, clock.getDelta()); const t = clock.elapsedTime;
    uni.time.value = t;
    const M = MOODS[A.mood];
    A.smileT = M.smile; A.browT = M.brow; A.blushT = M.blush; A.mouthOpenT = M.open; A.breathRate = M.breath;
    parts.zz.visible = A.asleep; parts.tongue.visible = false; A.wave = 0;

    if (A.act) {
      A.actT += dt; const p = A.actT / A.actDur;
      switch (A.act) {
        case 'dance': A.dance = 1; A.mouthOpenT = 0.5; A.smileT = 1; if (A.grounded && Math.floor(A.actT * 3) % 2 === 0) hop(0.5); break;
        case 'sing': A.mouthOpenT = 0.55 + Math.sin(t * 9) * 0.25; A.browT = 0.3; A.lookTarget.set(0, 0.8); if (Math.random() < dt * 6) noteSpark(); break;
        case 'beg': A.mouthOpenT = 0.6; A.browT = -0.6; A.smileT = -0.3; A.lookCam = 0.2; A.wave = Math.sin(t * 6) * 0.6; break;
        case 'yawn': A.mouthOpenT = Math.sin(p * Math.PI) * 0.95; A.browT = -0.3; A.lookTarget.set(0, 0.4 * Math.sin(p * Math.PI)); break;
        case 'wave': A.wave = Math.sin(t * 8) * 0.8; A.smileT = 0.9; A.lookCam = 0.2; break;
        case 'nom': A.mouthOpenT = Math.abs(Math.sin(t * 8)) * 0.6; A.smileT = 0.8; A.blushT = 1; parts.tongue.visible = true; break;
        case 'shiver': A.wobble = 1; A.browT = -0.4; break;
        case 'bow': A.faceTarget = Math.sin(p * Math.PI) * 0.6; A.smileT = 0.8; break;
        case 'play': A.lookTarget.set(Math.sin(t * 3), 0.6); if (A.grounded && Math.random() < dt * 1.2) hop(0.6); break;
      }
      if (A.actT >= A.actDur) { A.act = null; A.dance = 0; A.wobble = 0; A.faceTarget = 0; }
    }
    if (A.talk > 0) { A.talk -= dt; A.mouthOpenT = 0.2 + Math.abs(Math.sin(t * 11)) * 0.5; }
    if (A.lookCam > 0) { A.lookCam -= dt; A.lookTarget.set(0, 0.15); } else if (Math.random() < dt * 0.35) lookAround();
    if (A.asleep) A.lookTarget.set(0, -0.3);

    const k = 1 - Math.pow(0.001, dt);
    A.smile = lerp(A.smile, A.smileT, k * 0.6); A.brow = lerp(A.brow, A.browT, k * 0.6); A.blush = lerp(A.blush, A.blushT, k * 0.4);
    A.mouthOpen = lerp(A.mouthOpen, A.mouthOpenT, k); A.look.lerp(A.lookTarget, k * 0.8); A.face = lerp(A.face, A.faceTarget, k * 0.5);
    A.growth = lerp(A.growth, A.growthT, k * 0.3); A.stageGrow = Math.min(1, A.stageGrow + dt * 0.8);
    uni.wobble.value = lerp(uni.wobble.value, 1 + A.wobble * 4 + (A.mood === 'ecstatic' ? 1 : 0), k);

    // blink & eyelids
    A.nextBlink -= dt; if (A.nextBlink <= 0) { A.blink = 1; A.nextBlink = 2 + Math.random() * 4; }
    if (A.blink > 0) A.blink = Math.max(0, A.blink - dt * 7);
    const lidClose = A.asleep ? 1 : A.fading ? 0.7 : Math.max(A.blink > 0.5 ? (1 - A.blink) * 2 : A.blink * 2, A.mood === 'sleepy' ? 0.45 : (A.mood === 'happy' || A.mood === 'ecstatic') ? 0.05 : 0.12);

    // hop physics, squash & stretch, breathing
    if (!A.grounded) { A.vy -= 14 * dt; A.y += A.vy * dt; if (A.y <= 0) { A.y = 0; A.grounded = true; A.squash = Math.min(0.35, Math.abs(A.vy) * 0.06); A.vy = 0; } }
    A.squash = lerp(A.squash, 0, k * 1.5);
    const breath = Math.sin(t * 2.4 * A.breathRate) * 0.022 * A.breathRate;
    const sx = 1 + A.squash * 0.6 - (A.vy > 0 ? A.vy * 0.03 : 0) + breath * 0.5, sy = 1 - A.squash + (A.vy > 0 ? A.vy * 0.05 : 0) + breath;
    const g = A.growth * (0.6 + 0.4 * A.stageGrow);
    parts.rig.scale.set(sx * g, sy * g, sx * g); parts.rig.position.y = A.y;

    // position & facing
    root.position.x = lerp(root.position.x, A.tx, k * 0.25); root.position.z = lerp(root.position.z, A.tz, k * 0.25);
    A.spin = lerp(A.spin, A.spinT, 1 - Math.pow(0.0001, dt)); if (Math.abs(A.spinT - A.spin) < 0.02) A.spin = A.spinT;
    const faceDir = Math.atan2(A.tx - root.position.x, A.tz - root.position.z);
    const moving = Math.hypot(A.tx - root.position.x, A.tz - root.position.z) > 0.08;
    parts.tilt.rotation.y = A.spin + (moving ? clamp(faceDir, -0.6, 0.6) : 0) * 0.35;
    parts.tilt.rotation.x = A.face + (A.asleep ? 0.22 : 0) + (A.fading ? 0.3 : 0) + (A.dance ? Math.sin(t * 6) * 0.08 : 0);
    parts.tilt.rotation.z = A.dance ? Math.sin(t * 6) * 0.18 : (moving ? Math.sin(t * 10) * 0.05 : 0);
    parts.head.rotation.z = Math.sin(t * 1.3) * 0.04 + (A.mood === 'curious' ? Math.sin(t * 0.7) * 0.08 : 0) + (A.dance ? Math.sin(t * 6 + 1) * 0.12 : 0);
    parts.head.rotation.y = A.look.x * 0.18; parts.head.rotation.x = -A.look.y * 0.12 + (A.asleep ? 0.15 : 0);
    if (moving && A.grounded && !A.asleep && Math.random() < dt * 3) hop(0.35);

    // face
    eyes.forEach(function(e) {
      e.iris.position.x = A.look.x * 0.07; e.iris.position.y = A.look.y * 0.06;
      e.h1.position.x = 0.09 - e.side * 0.02 + A.look.x * 0.03; e.h1.position.y = 0.1 + A.look.y * 0.02;
      e.lid.rotation.x = lerp(-0.95, 1.15, lidClose); e.lid.rotation.z = -e.side * A.brow * 0.35;
      const wide = A.mood === 'ecstatic' ? 1.12 : 1; e.g.scale.set(wide, wide * (1 - lidClose * 0.85), wide);
    });
    parts.mouthOpen.scale.set(0.8 + A.mouthOpen * 0.6, 0.001 + A.mouthOpen * 1.5, 1);
    parts.smile.scale.set(0.7 + Math.abs(A.smile) * 0.8, 0.6 + Math.abs(A.smile) * 0.9, 1); parts.smile.rotation.z = A.smile >= 0 ? Math.PI : 0; parts.smile.position.y = A.smile >= 0 ? -0.26 : -0.32; parts.smile.visible = A.mouthOpen < 0.35;
    parts.fangs.forEach(function(f) { f.position.y = -0.27 - A.mouthOpen * 0.02; partScale(f, A.stage >= 2 && A.mouthOpen > 0.15, 0.2); });
    parts.cheeks.forEach(function(c) { c.material.opacity = 0.25 + A.blush * 0.6; });
    parts.muzzle.scale.y = 0.72 + A.mouthOpen * 0.12;

    // stage parts
    const s = A.stage, gk = 1 - Math.pow(0.02, dt);
    parts.ears.forEach(function(e, i) { partScale(e, s >= 1, gk); e.rotation.z = -(i === 0 ? -1 : 1) * (1.05 + Math.sin(t * 2 + i) * 0.06 + (A.mood === 'lonely' || A.mood === 'hungry' ? 0.35 : 0)); });
    partScale(parts.tuft, s === 1, gk); partScale(parts.crest, s >= 2, gk);
    parts.crest.children.forEach(function(c, i) { c.material.emissiveIntensity = 0.7 + Math.sin(t * 3 + i) * 0.25 + (A.mood === 'ecstatic' ? 0.5 : 0); });
    parts.arms.forEach(function(a, i) { partScale(a, s >= 1, gk); const side = i === 0 ? -1 : 1; a.rotation.z = side * (0.5 + Math.sin(t * 2 + i) * 0.08) + (A.wave && i === 1 ? -A.wave * 1.6 : 0) + (A.dance ? Math.sin(t * 6 + i * Math.PI) * 0.9 : 0) + (A.act === 'beg' ? -side * 0.7 : 0); a.rotation.x = A.act === 'beg' ? -0.8 : 0; });
    partScale(parts.tail, s >= 1, gk);
    parts.tailSegs.forEach(function(seg, i) { const ph = t * (A.dance ? 6 : 2.2) - i * 0.5; seg.position.set(Math.sin(ph) * 0.09 * i, i * i * 0.012 + Math.sin(ph * 0.7) * 0.03 * i, -0.16 * i); });
    const last = parts.tailSegs[7]; parts.tailTip.position.set(last.position.x * 1.1, last.position.y + 0.12, last.position.z - 0.1); parts.tailTip.rotation.z = Math.sin(t * 2.2 - 3.5) * 0.4;
    partScale(parts.collar, s >= 3, gk); parts.pendant.rotation.y = t * 1.5; parts.pendant.material.emissiveIntensity = 0.8 + Math.sin(t * 4) * 0.3;
    parts.wings.forEach(function(w, i) { const side = i === 0 ? -1 : 1; const tgt = s >= 4 ? (s >= 5 ? 1.25 : 1) : 0.001; w.scale.x = lerp(w.scale.x, side * tgt, gk); w.scale.y = lerp(w.scale.y, tgt, gk); w.scale.z = w.scale.y; w.rotation.y = side * (0.55 + Math.sin(t * (A.grounded ? 3 : 9)) * 0.4); w.rotation.z = side * -0.15 + Math.sin(t * 3) * 0.08; });
    partScale(parts.crystals, s >= 5, gk); partScale(parts.glyph, s >= 5, gk); parts.glyph.rotation.z = t;
    parts.feathers.forEach(function(w, i) { const side = i === 0 ? -1 : 1; const tgt = s >= 6 ? 1 : 0.001; w.scale.x = lerp(w.scale.x, side * tgt, gk); w.scale.y = lerp(w.scale.y, tgt, gk); w.scale.z = w.scale.y; w.rotation.y = side * (0.7 + Math.sin(t * 2.2) * 0.3); w.rotation.z = side * -0.1 + Math.sin(t * 2.2) * 0.1; });
    partScale(parts.crown, s >= 6, gk); parts.crown.rotation.y = t * 0.4; parts.crown.position.y = 2.55 + Math.sin(t * 2) * 0.03;
    partScale(parts.halo, s >= 7, gk); parts.halo.rotation.y = t * 0.8; parts.halo.children.forEach(function(o, i) { const a = i / 8 * Math.PI * 2 + t * 0.8; o.position.set(Math.cos(a) * 0.7, Math.sin(t * 2 + i) * 0.1, Math.sin(a) * 0.7); });
    parts.aura.material.opacity = lerp(parts.aura.material.opacity, s >= 6 ? 0.07 + (A.mood === 'ecstatic' ? 0.05 : 0) : 0, gk); parts.aura.scale.setScalar(1 + Math.sin(t * 1.6) * 0.04); parts.aura.material.color.setHSL((t * 0.05) % 1, 0.8, 0.75);
    parts.runes.children.forEach(function(r, i) { r.material.emissiveIntensity = lerp(r.material.emissiveIntensity, i < s ? 1.1 : 0, gk); r.position.y = r.userData.base + (i < s ? Math.sin(t * 1.5 + i) * 0.06 + 0.1 : 0); r.rotation.y = t * 0.6 + i; });
    // egg: wobbles when warmed, cracks glow as hatching nears
    parts.egg.scale.setScalar(s === 0 ? 1 : Math.max(0.001, parts.egg.scale.x - dt * 1.5));
    partScale(parts.beast, s > 0, s > 0 ? gk * 0.6 : 1);
    parts.egg.rotation.z = s === 0 && (A.mood === 'ecstatic' || A.wobble) ? Math.sin(t * 20) * 0.08 : Math.sin(t * 1.5) * 0.02;
    parts.eggCracks.forEach(function(c, i) { c.visible = s === 0 && A.hatch > (i + 1) / 6; });
    parts.eggMark.material.emissiveIntensity = 0.6 + Math.sin(t * 2) * 0.3 + A.hatch * 0.8;

    // colour, glow, fading
    const L = STAGE_LOOK[Math.min(7, s)], health = clamp((A.food + A.joy) / 200, 0, 1);
    const glow = A.fading ? 0.05 : A.asleep ? A.glow * 0.4 : A.glow * (0.6 + health * 0.8) * (A.mood === 'ecstatic' ? 1.5 : 1);
    parts.fur.color.lerp(new T.Color(A.fading ? 0x8d8a99 : L.col), k * 0.5);
    parts.fur.emissive.set(s >= 7 ? 0x3a2470 : s >= 5 ? 0xb9d8ff : 0xffd6ee); parts.fur.emissiveIntensity = lerp(parts.fur.emissiveIntensity, Math.min(0.35, glow * 0.22), k);
    parts.innerLight.intensity = lerp(parts.innerLight.intensity, Math.min(0.9, 0.2 + glow * 0.4), k); parts.innerLight.position.set(root.position.x, 1.4 * A.growth, root.position.z + 0.6);
    parts.innerLight.color.setHSL((t * 0.03) % 1, 0.7, 0.8);

    // room
    const bp = bokeh.geometry.attributes.position; for (let i = 0; i < bp.count; i++) bp.setY(i, bp.getY(i) + Math.sin(t * 0.3 + i) * dt * 0.15); bp.needsUpdate = true;
    bokeh.material.opacity = 0.45 + Math.sin(t * 0.5) * 0.1;
    const fp = fireflies.geometry.attributes.position;
    for (let i = 0; i < fp.count; i++) { const v = fireflyVel[i]; v.x += (Math.random() - .5) * dt; v.y += (Math.random() - .5) * dt * 0.5; v.z += (Math.random() - .5) * dt; v.clampLength(0, 0.4); let x = fp.getX(i) + v.x * dt, y = fp.getY(i) + v.y * dt, z = fp.getZ(i) + v.z * dt; if (Math.abs(x) > 5) v.x *= -1; if (y < 0.3 || y > 4.2) v.y *= -1; if (Math.abs(z) > 5) v.z *= -1; fp.setXYZ(i, x, y, z); }
    fp.needsUpdate = true; fireflies.material.opacity = 0.6 + Math.sin(t * 3) * 0.2;

    // hearts & sparks
    for (let i = hearts.length - 1; i >= 0; i--) { const h = hearts[i], u = h.userData; u.age += dt; h.position.y += u.vy * dt; h.position.x += Math.sin(u.age * 3 + i) * dt * 0.3; h.rotation.y += u.spin * dt; const life = u.age / u.life; h.scale.setScalar(u.s * Math.min(1, u.age * 5) * (1 - life * 0.3)); h.material.opacity = 1 - life; h.lookAt(camera.position); if (u.age >= u.life) { scene.remove(h); hearts.splice(i, 1); } }
    for (let i = sparks.length - 1; i >= 0; i--) { const sp = sparks[i], u = sp.userData; u.age += dt; u.v.y -= 3 * dt; sp.position.addScaledVector(u.v, dt); sp.rotation.x += dt * 5; sp.rotation.y += dt * 7; const life = u.age / u.life; sp.material.opacity = 1 - life; sp.scale.setScalar(1 - life * 0.5); if (u.age >= u.life) { scene.remove(sp); sparks.splice(i, 1); } }

    // camera: in front, gentle sway, pulls back as it grows
    orbitAngle += dt * 0.06; camPunch = lerp(camPunch, 0, k * 0.8);
    const portrait = innerHeight > innerWidth;
    const dist = ((portrait ? 4.6 : 4.0) + A.growth * 3.4) * (1 - camPunch * 0.15);
    camTarget.lerp(new T.Vector3(root.position.x * 0.5, (1.35 + (A.stage >= 6 ? 0.3 : 0)) * A.growth + (portrait ? 0.25 : 0.05), root.position.z * 0.5), k * 0.5);
    const sway = Math.sin(orbitAngle * 0.5) * 0.3;
    camera.position.set(camTarget.x + Math.sin(sway) * dist, camTarget.y + 0.7 + A.growth * 0.35 + camPunch * 0.2, camTarget.z + Math.cos(sway) * dist);
    camera.lookAt(camTarget);
    if (composer) composer.render(); else renderer.render(scene, camera);
  }

  function headScreenPos() {
    const v = new T.Vector3(root.position.x, (2.6 + (A.stage >= 6 ? 0.5 : 0)) * A.growth + A.y, root.position.z).project(camera);
    return { x: (v.x + 1) / 2 * innerWidth, y: (1 - v.y) / 2 * innerHeight, visible: v.z < 1 };
  }

  function attach(obj) { scene.add(obj); }
  function ready() { return !!scene; }
  function project(x, y, z) { const v = new T.Vector3(x, y, z).project(camera); return { x: (v.x + 1) / 2 * innerWidth, y: (1 - v.y) / 2 * innerHeight, visible: v.z < 1 }; }
  function cameraPos() { return camera.position; }
  window.Creature = { init, ready, attach, project, cameraPos, dotTexture: function() { return dot; }, gradientWing, wingShape, plush, crystal, PINK, CYAN, setStage, setMood, setVitals, setHatchProgress, hop, wander, spin, dance, sing, beg, yawn, wave, nom, shiver, bow, play, talk, lookAtCamera, lookAround, burstHearts, burstSparks, punch, headScreenPos, anim: A };
})();
