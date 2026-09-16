/**
 * SOCIOBEAST — Creature
 * A fully procedural 3D creature (no sprites, no models): body, eyes, mouth, brows, cheeks,
 * horns, arms, feet, tail, wings and a halo that appear stage by stage. Every motion is
 * generated: breathing, blinking, eye tracking, squash & stretch, hops, sleep, begging…
 * Three.js r128 UMD. Public API at the bottom (window.Creature).
 */
(function() {
  'use strict';

  const T = THREE;
  const randDir = function() { const z = Math.random() * 2 - 1, a = Math.random() * Math.PI * 2, r = Math.sqrt(1 - z * z); return new T.Vector3(r * Math.cos(a), z, r * Math.sin(a)); }; // r128 has no Vector3.randomDirection
  let renderer, scene, camera, composer, clock;
  let root, body, bodyMat, bellyMat, glowMat, parts = {}, eyes = [], eyeGroups = [];
  let nest, sky, skyMat, stars, fireflies, fireflyVel = [];
  let hearts = [], sparks = [], orbitAngle = 0.4, camPunch = 0, camTarget = new T.Vector3();
  const uni = { time: { value: 0 }, wobble: { value: 1 } };

  // Animation state — everything visible derives from this
  const A = {
    stage: 0, mood: 'curious', asleep: false, fading: false, energy: 80, food: 70, joy: 50,
    breathRate: 1, y: 0, vy: 0, grounded: true, squash: 0, face: 0, faceTarget: 0,
    look: new T.Vector2(0, 0), lookTarget: new T.Vector2(0, 0), blink: 0, nextBlink: 2,
    mouthOpen: 0, mouthOpenT: 0, smile: 0.4, smileT: 0.4, brow: 0, browT: 0, blush: 0, blushT: 0,
    talk: 0, wave: 0, spin: 0, spinT: 0, dance: 0, wobble: 0, growth: 1, growthT: 1,
    px: 0, pz: 0, tx: 0, tz: 0, act: null, actT: 0, actDur: 0, glow: 0.3, stageGrow: 1
  };

  // ─────────────────────────────────────────────────────────────
  // BUILD
  // ─────────────────────────────────────────────────────────────
  function init(canvas) {
    renderer = new T.WebGLRenderer({ canvas: canvas, antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.outputEncoding = T.sRGBEncoding;
    renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
    scene = new T.Scene();
    camera = new T.PerspectiveCamera(38, 1, 0.1, 200);
    clock = new T.Clock();

    buildSky(); buildLights(); buildNest(); buildCreature(); buildFireflies();
    resize(); addEventListener('resize', resize);
    if (T.EffectComposer && T.UnrealBloomPass) {
      composer = new T.EffectComposer(renderer);
      composer.addPass(new T.RenderPass(scene, camera));
      const bloom = new T.UnrealBloomPass(new T.Vector2(innerWidth, innerHeight), 0.32, 0.5, 0.9);
      composer.addPass(bloom);
    }
    requestAnimationFrame(loop);
  }

  function resize() {
    const w = innerWidth, h = innerHeight;
    renderer.setSize(w, h); camera.aspect = w / h;
    camera.fov = w < h ? 52 : 38; // portrait: wider so the creature fills the phone
    camera.updateProjectionMatrix();
    if (composer) composer.setSize(w, h);
  }

  function dotTexture() { const c = document.createElement('canvas'); c.width = c.height = 32; const g = c.getContext('2d'); const r = g.createRadialGradient(16, 16, 0, 16, 16, 16); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.4, 'rgba(255,255,255,.6)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, 32, 32); return new T.CanvasTexture(c); }
  let dot;
  function buildSky() {
    dot = dotTexture();
    skyMat = new T.ShaderMaterial({
      side: T.BackSide, depthWrite: false,
      uniforms: { top: { value: new T.Color(0x070b1c) }, mid: { value: new T.Color(0x11304a) }, bot: { value: new T.Color(0x1f5a63) } },
      vertexShader: 'varying vec3 vp; void main(){ vp = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'uniform vec3 top, mid, bot; varying vec3 vp; void main(){ float h = normalize(vp).y; vec3 c = h > 0.0 ? mix(mid, top, pow(h, 0.7)) : mix(mid, bot, pow(-h, 0.8)); gl_FragColor = vec4(c, 1.0); }'
    });
    sky = new T.Mesh(new T.SphereGeometry(90, 32, 16), skyMat); scene.add(sky);
    const n = 700, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { const v = randDir().multiplyScalar(80); if (v.y < -5) v.y = -v.y; pos.set([v.x, v.y, v.z], i * 3); }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(pos, 3));
    stars = new T.Points(g, new T.PointsMaterial({ color: 0xffffff, size: 0.6, map: dot, transparent: true, opacity: 0.8, depthWrite: false, blending: T.AdditiveBlending }));
    scene.add(stars);
    scene.fog = new T.FogExp2(0x0d2233, 0.018);
  }

  function buildLights() {
    scene.add(new T.HemisphereLight(0xbfe8ff, 0x1c2b1a, 0.5));
    const sun = new T.DirectionalLight(0xfff1d6, 0.75); sun.position.set(4, 7, 5); scene.add(sun);
    const rim = new T.DirectionalLight(0x7fd0ff, 0.35); rim.position.set(-5, 3, -4); scene.add(rim);
    parts.innerLight = new T.PointLight(0x9fffd0, 0.4, 4); parts.innerLight.position.set(0, 1, 0); scene.add(parts.innerLight);
  }

  function jitter(geo, amt) {
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) { p.setXYZ(i, p.getX(i) + (Math.random() - 0.5) * amt, p.getY(i) + (Math.random() - 0.5) * amt * 0.5, p.getZ(i) + (Math.random() - 0.5) * amt); }
    geo.computeVertexNormals(); return geo;
  }

  function buildNest() {
    nest = new T.Group(); scene.add(nest);
    const rock = new T.Mesh(jitter(new T.CylinderGeometry(2.6, 3.1, 1.1, 28, 3), 0.18), new T.MeshStandardMaterial({ color: 0x5b5e62, roughness: 0.95, flatShading: true }));
    rock.position.y = -0.55; nest.add(rock);
    const moss = new T.Mesh(jitter(new T.CylinderGeometry(2.65, 2.5, 0.22, 28, 1), 0.08), new T.MeshStandardMaterial({ color: 0x5fae62, roughness: 0.9, flatShading: true }));
    moss.position.y = 0.02; nest.add(moss);
    const grassMat = new T.MeshStandardMaterial({ color: 0x7ed07a, roughness: 0.9, flatShading: true });
    for (let i = 0; i < 26; i++) { const a = Math.random() * Math.PI * 2, r = 1.2 + Math.random() * 1.3; const g = new T.Mesh(new T.ConeGeometry(0.06 + Math.random() * 0.05, 0.25 + Math.random() * 0.3, 5), grassMat); g.position.set(Math.cos(a) * r, 0.1, Math.sin(a) * r); g.rotation.set((Math.random() - .5) * .6, 0, (Math.random() - .5) * .6); nest.add(g); }
    const stoneMat = new T.MeshStandardMaterial({ color: 0x8a8f94, roughness: 1, flatShading: true });
    for (let i = 0; i < 5; i++) { const a = Math.random() * Math.PI * 2, r = 1.8 + Math.random() * 0.7; const s = new T.Mesh(jitter(new T.DodecahedronGeometry(0.12 + Math.random() * 0.12, 0), 0.05), stoneMat); s.position.set(Math.cos(a) * r, 0.12, Math.sin(a) * r); nest.add(s); }
    parts.mushrooms = new T.Group(); nest.add(parts.mushrooms);
    for (let i = 0; i < 4; i++) { const a = i * 1.7 + 0.5, r = 2; const m = new T.Group(); m.add(new T.Mesh(new T.CylinderGeometry(0.05, 0.07, 0.25, 8), new T.MeshStandardMaterial({ color: 0xf1e6c8 }))); const cap = new T.Mesh(new T.SphereGeometry(0.16, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), new T.MeshStandardMaterial({ color: 0xff8f6b, emissive: 0xff5a3a, emissiveIntensity: 0.4 })); cap.position.y = 0.12; m.add(cap); m.position.set(Math.cos(a) * r, 0.12, Math.sin(a) * r); m.scale.setScalar(0.001); parts.mushrooms.add(m); }
    // spirit stones that light up per stage
    parts.runes = new T.Group(); nest.add(parts.runes);
    for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; const r = new T.Mesh(new T.OctahedronGeometry(0.14, 0), new T.MeshStandardMaterial({ color: 0x9fffd0, emissive: 0x4fffa0, emissiveIntensity: 0, roughness: 0.3 })); r.position.set(Math.cos(a) * 2.35, 0.55, Math.sin(a) * 2.35); r.userData.base = 0.55; parts.runes.add(r); }
  }

  function livingMaterial(color, opts) {
    const m = new T.MeshStandardMaterial(Object.assign({ color: color, roughness: 0.55, metalness: 0.02 }, opts || {}));
    m.onBeforeCompile = function(sh) {
      sh.uniforms.uTime = uni.time; sh.uniforms.uWobble = uni.wobble;
      sh.vertexShader = 'uniform float uTime; uniform float uWobble;\n' + sh.vertexShader.replace('#include <begin_vertex>',
        '#include <begin_vertex>\n float w = sin(position.y * 5.0 + uTime * 2.2) * 0.018 + sin(position.x * 7.0 - uTime * 1.7) * 0.012 + sin(position.z * 6.0 + uTime * 2.9) * 0.01;\n transformed += normal * w * uWobble;');
    };
    return m;
  }

  function buildCreature() {
    root = new T.Group(); scene.add(root);
    parts.rig = new T.Group(); root.add(parts.rig);        // hop / squash
    parts.tilt = new T.Group(); parts.rig.add(parts.tilt); // lean / spin
    const G = parts.tilt;

    bodyMat = livingMaterial(0x6fd6b2, { emissive: 0x1a6b55, emissiveIntensity: 0.25 });
    body = new T.Mesh(new T.SphereGeometry(1, 56, 48), bodyMat); body.scale.set(1, 1.12, 0.96); body.position.y = 1.1; G.add(body);
    bellyMat = livingMaterial(0xfff2d6, { roughness: 0.7 });
    const belly = new T.Mesh(new T.SphereGeometry(0.72, 40, 32), bellyMat); belly.scale.set(0.8, 0.95, 0.55); belly.position.set(0, 0.9, 0.5); G.add(belly);
    glowMat = new T.MeshBasicMaterial({ color: 0x9fffd0, transparent: true, opacity: 0.08, side: T.BackSide, blending: T.AdditiveBlending, depthWrite: false });
    parts.aura = new T.Mesh(new T.SphereGeometry(1.35, 32, 24), glowMat); parts.aura.position.copy(body.position); G.add(parts.aura);

    // egg shell (stage 0) — two halves so it can crack open
    parts.egg = new T.Group(); G.add(parts.egg);
    const shellMat = new T.MeshStandardMaterial({ color: 0xf6f0e3, roughness: 0.6 });
    const spotMat = new T.MeshStandardMaterial({ color: 0x9dd6c5, roughness: 0.6 });
    const shell = new T.Mesh(new T.SphereGeometry(1.08, 40, 32), shellMat); shell.scale.set(1, 1.22, 1); shell.position.y = 1.2; parts.egg.add(shell);
    for (let i = 0; i < 9; i++) { const s = new T.Mesh(new T.SphereGeometry(0.12 + Math.random() * 0.08, 10, 8), spotMat); const a = Math.random() * Math.PI * 2, e = (Math.random() - .5) * 2; s.position.set(Math.cos(a) * Math.sqrt(1 - e * e) * 1.06, 1.2 + e * 1.28, Math.sin(a) * Math.sqrt(1 - e * e) * 1.06); s.scale.z = 0.35; s.lookAt(0, 1.2, 0); parts.egg.add(s); }

    // eyes
    const eyeWhite = new T.MeshStandardMaterial({ color: 0xffffff, roughness: 0.25 });
    const pupilMat = new T.MeshStandardMaterial({ color: 0x102018, roughness: 0.3 });
    const glint = new T.MeshBasicMaterial({ color: 0xffffff });
    [-1, 1].forEach(function(side) {
      const g = new T.Group(); g.position.set(side * 0.34, 1.32, 0.8); G.add(g); eyeGroups.push(g);
      const w = new T.Mesh(new T.SphereGeometry(0.2, 28, 20), eyeWhite); g.add(w);
      const p = new T.Mesh(new T.SphereGeometry(0.105, 20, 16), pupilMat); p.position.z = 0.13; g.add(p);
      const h = new T.Mesh(new T.SphereGeometry(0.035, 10, 8), glint); h.position.set(0.05, 0.06, 0.2); g.add(h);
      const lid = new T.Mesh(new T.SphereGeometry(0.215, 28, 14, 0, Math.PI * 2, 0, Math.PI * 0.5), bodyMat); g.add(lid);
      eyes.push({ g: g, pupil: p, lid: lid, side: side });
    });
    // brows
    parts.brows = [-1, 1].map(function(side) { const b = new T.Mesh(new T.BoxGeometry(0.22, 0.045, 0.05), pupilMat); b.position.set(side * 0.34, 1.6, 0.86); G.add(b); return b; });
    // mouth: open ellipse + smile arc
    parts.mouthOpen = new T.Mesh(new T.CircleGeometry(0.11, 24), new T.MeshStandardMaterial({ color: 0x3a1420, roughness: 0.6 })); parts.mouthOpen.position.set(0, 1.02, 0.955); parts.mouthOpen.scale.set(1, 0.001, 1); G.add(parts.mouthOpen);
    parts.smile = new T.Mesh(new T.TorusGeometry(0.15, 0.022, 8, 24, Math.PI), pupilMat); parts.smile.position.set(0, 1.06, 0.95); parts.smile.rotation.z = Math.PI; G.add(parts.smile);
    parts.tongue = new T.Mesh(new T.SphereGeometry(0.06, 12, 8), new T.MeshStandardMaterial({ color: 0xff7f95 })); parts.tongue.position.set(0, 0.98, 0.97); parts.tongue.scale.set(1, 0.6, 0.5); parts.tongue.visible = false; G.add(parts.tongue);
    // cheeks
    const cheekMat = new T.MeshBasicMaterial({ color: 0xff8fa8, transparent: true, opacity: 0 });
    parts.cheeks = [-1, 1].map(function(side) { const c = new T.Mesh(new T.CircleGeometry(0.11, 18), cheekMat); c.position.set(side * 0.55, 1.08, 0.78); c.lookAt(side * 2, 1.1, 3); G.add(c); return c; });
    // horns (stage 2+), tufts (stage 3+)
    const hornMat = new T.MeshStandardMaterial({ color: 0xf5e6c4, roughness: 0.4, emissive: 0xffd28a, emissiveIntensity: 0.15 });
    parts.horns = [-1, 1].map(function(side) { const h = new T.Mesh(new T.ConeGeometry(0.11, 0.5, 10), hornMat); h.position.set(side * 0.38, 2.05, 0.05); h.rotation.z = -side * 0.5; h.scale.setScalar(0.001); G.add(h); return h; });
    parts.tufts = [-1, 1].map(function(side) { const t = new T.Mesh(new T.ConeGeometry(0.16, 0.42, 8), bodyMat); t.position.set(side * 0.85, 1.72, 0.1); t.rotation.z = -side * 1.2; t.scale.setScalar(0.001); G.add(t); return t; });
    // arms (stage 1+)
    parts.arms = [-1, 1].map(function(side) { const a = new T.Group(); a.position.set(side * 0.86, 1.05, 0.3); const c = new T.Mesh(new T.CylinderGeometry(0.09, 0.11, 0.42, 10), bodyMat); c.position.y = -0.2; a.add(c); const hand = new T.Mesh(new T.SphereGeometry(0.13, 12, 10), bodyMat); hand.position.y = -0.42; a.add(hand); a.rotation.z = side * 0.55; a.scale.setScalar(0.001); G.add(a); return a; });
    // feet (always)
    parts.feet = [-1, 1].map(function(side) { const f = new T.Mesh(new T.SphereGeometry(0.24, 14, 10), bellyMat); f.scale.set(1, 0.45, 1.25); f.position.set(side * 0.42, 0.1, 0.42); G.add(f); return f; });
    // tail (stage 1+): chain of spheres
    parts.tail = new T.Group(); parts.tail.position.set(0, 0.75, -0.85); G.add(parts.tail); parts.tailSegs = [];
    for (let i = 0; i < 7; i++) { const s = new T.Mesh(new T.SphereGeometry(0.2 - i * 0.022, 12, 10), bodyMat); parts.tail.add(s); parts.tailSegs.push(s); }
    parts.tail.scale.setScalar(0.001);
    // wings (stage 4+)
    const wingShape = new T.Shape(); wingShape.moveTo(0, 0); wingShape.bezierCurveTo(0.5, 0.9, 1.4, 1.1, 1.9, 0.6); wingShape.bezierCurveTo(1.5, 0.45, 1.4, 0.2, 1.7, -0.2); wingShape.bezierCurveTo(1.2, -0.1, 0.9, -0.3, 0.9, -0.55); wingShape.bezierCurveTo(0.5, -0.3, 0.2, -0.2, 0, 0);
    const wingMat = new T.MeshStandardMaterial({ color: 0xbfffe6, emissive: 0x5fe0b0, emissiveIntensity: 0.6, transparent: true, opacity: 0.7, side: T.DoubleSide, roughness: 0.3 });
    parts.wings = [-1, 1].map(function(side) { const w = new T.Mesh(new T.ShapeGeometry(wingShape, 12), wingMat); w.position.set(side * 0.7, 1.75, -0.5); w.scale.set(side * 0.001, 0.001, 0.001); w.rotation.y = side * 0.5; G.add(w); return w; });
    // halo orbs (stage 5)
    parts.halo = new T.Group(); parts.halo.position.y = 2.6; G.add(parts.halo);
    for (let i = 0; i < 7; i++) { const o = new T.Mesh(new T.SphereGeometry(0.07, 10, 8), new T.MeshStandardMaterial({ color: 0xfff3c0, emissive: 0xffd36b, emissiveIntensity: 1.2 })); parts.halo.add(o); }
    parts.halo.scale.setScalar(0.001);
    // sleep Zs and thought sparkle are plain geometry too
    parts.zz = new T.Group(); parts.zz.position.set(0.9, 2.3, 0.3); G.add(parts.zz); parts.zz.visible = false;
    for (let i = 0; i < 3; i++) { const z = new T.Mesh(new T.TorusKnotGeometry(0.06 + i * 0.02, 0.02, 30, 6, 1, 3), new T.MeshBasicMaterial({ color: 0xcfe9ff })); z.position.set(i * 0.22, i * 0.3, 0); parts.zz.add(z); }
    // hearts pool
    const hs = new T.Shape(); hs.moveTo(0, 0.5); hs.bezierCurveTo(0, 0.5, -0.1, 0.9, -0.5, 0.9); hs.bezierCurveTo(-1.1, 0.9, -1.1, 0.2, -1.1, 0.2); hs.bezierCurveTo(-1.1, -0.2, -0.7, -0.6, 0, -1); hs.bezierCurveTo(0.7, -0.6, 1.1, -0.2, 1.1, 0.2); hs.bezierCurveTo(1.1, 0.2, 1.1, 0.9, 0.5, 0.9); hs.bezierCurveTo(0.1, 0.9, 0, 0.5, 0, 0.5);
    parts.heartGeo = new T.ExtrudeGeometry(hs, { depth: 0.25, bevelEnabled: true, bevelSize: 0.08, bevelThickness: 0.05, bevelSegments: 2 }); parts.heartGeo.scale(0.14, 0.14, 0.14); parts.heartGeo.rotateZ(Math.PI);
    parts.heartMats = [0xff5f7a, 0xff8fa8, 0xffc1cf, 0xff3d5c].map(function(c) { return new T.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.5, transparent: true }); });
    parts.sparkGeo = new T.OctahedronGeometry(0.06, 0);
    parts.sparkMat = new T.MeshBasicMaterial({ color: 0xffe9a3, transparent: true });
  }

  function buildFireflies() {
    const n = 90, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { pos.set([(Math.random() - .5) * 9, 0.4 + Math.random() * 3.5, (Math.random() - .5) * 9], i * 3); fireflyVel.push(new T.Vector3((Math.random() - .5) * .3, (Math.random() - .5) * .2, (Math.random() - .5) * .3)); }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(pos, 3));
    fireflies = new T.Points(g, new T.PointsMaterial({ color: 0xd8ff9a, size: 0.16, map: dot, transparent: true, opacity: 0.9, blending: T.AdditiveBlending, depthWrite: false }));
    scene.add(fireflies);
  }

  // ─────────────────────────────────────────────────────────────
  // STAGE & MOOD
  // ─────────────────────────────────────────────────────────────
  const STAGE_LOOK = [ // scale, body colour, glow
    { s: 0.75, col: 0x6fd6b2, glow: 0.15 }, { s: 0.7, col: 0x6fd6b2, glow: 0.25 }, { s: 0.9, col: 0x62d4a6, glow: 0.35 },
    { s: 1.1, col: 0x55c9a2, glow: 0.5 }, { s: 1.3, col: 0x4fc3ad, glow: 0.7 }, { s: 1.5, col: 0x5ac0d6, glow: 1.0 }
  ];
  function setStage(n, animate) {
    A.stage = n; const L = STAGE_LOOK[n] || STAGE_LOOK[5];
    A.growthT = L.s; if (!animate) A.growth = L.s;
    bodyMat.color.set(L.col); A.glow = L.glow;
    parts.egg.visible = n === 0;
    if (animate) { A.stageGrow = 0; camPunch = 1; }
  }
  function partScale(obj, on, k, mult) { const t = on ? (mult || 1) : 0.001; obj.scale.x += (t * Math.sign(obj.scale.x || 1) - obj.scale.x) * k; obj.scale.y += (t - obj.scale.y) * k; obj.scale.z += (t - obj.scale.z) * k; }

  const MOODS = {
    curious:  { smile: 0.35, brow: 0.1, blush: 0, open: 0.05, breath: 1 },
    happy:    { smile: 0.9, brow: 0.2, blush: 0.6, open: 0.15, breath: 1.2 },
    ecstatic: { smile: 1, brow: 0.4, blush: 1, open: 0.5, breath: 1.6 },
    hungry:   { smile: -0.5, brow: -0.5, blush: 0, open: 0.35, breath: 0.9 },
    sleepy:   { smile: 0.1, brow: -0.2, blush: 0, open: 0.1, breath: 0.6 },
    lonely:   { smile: -0.3, brow: -0.6, blush: 0, open: 0, breath: 0.8 },
    asleep:   { smile: 0.2, brow: 0, blush: 0, open: 0.05, breath: 0.45 },
    fading:   { smile: -0.6, brow: -0.7, blush: 0, open: 0, breath: 0.35 },
    angry:    { smile: -0.4, brow: 0.9, blush: 0.2, open: 0.2, breath: 1.4 }
  };
  function setMood(m) { A.mood = MOODS[m] ? m : 'curious'; }
  function setVitals(v) { A.food = v.food; A.joy = v.joy; A.energy = v.energy; A.asleep = !!v.asleep; A.fading = !!v.fading; }

  // ─────────────────────────────────────────────────────────────
  // ACTIONS (short procedural performances)
  // ─────────────────────────────────────────────────────────────
  function act(name, dur, data) { A.act = name; A.actT = 0; A.actDur = dur || 1.5; A.actData = data || {}; }
  function hop(power) { if (A.grounded) { A.vy = 4.2 * (power || 1); A.grounded = false; } }
  function wander() { const a = Math.random() * Math.PI * 2, r = 0.3 + Math.random() * 1.2; A.tx = Math.cos(a) * r; A.tz = Math.sin(a) * r; act('wander', 3); }
  function spin() { A.spinT += Math.PI * 2; hop(0.8); act('spin', 1.2); }
  function dance(sec) { act('dance', sec || 4); }
  function sing(sec) { act('sing', sec || 3.5); }
  function beg(sec) { A.tx = 0; A.tz = 0.4; act('beg', sec || 4); }
  function yawn() { act('yawn', 2.2); }
  function wave(sec) { act('wave', sec || 2.5); }
  function nom(sec) { act('nom', sec || 2); }
  function shiver(sec) { act('shiver', sec || 1.2); }
  function bow() { act('bow', 1.6); }
  function play() { A.tx = (Math.random() - .5) * 2; A.tz = (Math.random() - .5) * 1.5; act('play', 3.5); }
  function talk(sec) { A.talk = Math.max(A.talk, sec || 2); }
  function lookAtCamera(sec) { A.lookCam = sec || 3; }
  function lookAround() { A.lookTarget.set((Math.random() - .5) * 1.6, (Math.random() - .5) * 0.8); }

  // ─────────────────────────────────────────────────────────────
  // FX
  // ─────────────────────────────────────────────────────────────
  function burstHearts(n, big) {
    for (let i = 0; i < Math.min(n, 40); i++) {
      const m = new T.Mesh(parts.heartGeo, parts.heartMats[Math.floor(Math.random() * parts.heartMats.length)].clone());
      const a = Math.random() * Math.PI * 2, r = 0.6 + Math.random() * 1.2;
      m.position.set(root.position.x + Math.cos(a) * r, 0.6 + Math.random() * 1.2, root.position.z + Math.sin(a) * r);
      m.userData = { vy: 0.9 + Math.random() * 0.9, life: 2.2 + Math.random(), age: 0, spin: (Math.random() - .5) * 3, s: big ? 1.6 : 0.8 + Math.random() * 0.6 };
      m.scale.setScalar(0.001); scene.add(m); hearts.push(m);
    }
  }
  function burstSparks(n, color, spread) {
    for (let i = 0; i < Math.min(n, 400); i++) {
      const m = new T.Mesh(parts.sparkGeo, parts.sparkMat.clone()); if (color) m.material.color.set(color);
      m.position.set(root.position.x, 1.2 * A.growth, root.position.z);
      const v = randDir().multiplyScalar(1.5 + Math.random() * (spread || 3)); v.y = Math.abs(v.y) + 1;
      m.userData = { v: v, life: 1.4 + Math.random() * 1.2, age: 0 }; scene.add(m); sparks.push(m);
    }
  }
  function punch(k) { camPunch = Math.max(camPunch, k || 0.6); }

  // ─────────────────────────────────────────────────────────────
  // LOOP
  // ─────────────────────────────────────────────────────────────
  const clamp = function(v, a, b) { return Math.max(a, Math.min(b, v)); };
  const lerp = function(a, b, t) { return a + (b - a) * t; };
  let dayT = 0.3;

  function loop() {
    requestAnimationFrame(loop);
    const dt = Math.min(0.05, clock.getDelta()); const t = clock.elapsedTime;
    uni.time.value = t;
    const M = MOODS[A.mood];

    // ── face targets from mood, overridden by actions ──
    A.smileT = M.smile; A.browT = M.brow; A.blushT = M.blush; A.mouthOpenT = M.open; A.breathRate = M.breath;
    parts.zz.visible = A.asleep;
    parts.tongue.visible = false;

    // ── actions ──
    if (A.act) {
      A.actT += dt; const p = A.actT / A.actDur, D = A.actData;
      switch (A.act) {
        case 'wander': break;
        case 'dance': A.dance = 1; A.mouthOpenT = 0.4; A.smileT = 1; if (A.grounded && Math.floor(A.actT * 3) % 2 === 0) hop(0.5); break;
        case 'sing': A.mouthOpenT = 0.55 + Math.sin(t * 9) * 0.25; A.browT = 0.3; A.lookTarget.set(0, 0.8); if (Math.random() < dt * 6) noteSpark(); break;
        case 'beg': A.mouthOpenT = 0.6; A.browT = -0.6; A.smileT = -0.3; A.lookCam = 0.2; A.wave = Math.sin(t * 6) * 0.6; break;
        case 'yawn': A.mouthOpenT = Math.sin(p * Math.PI) * 0.9; A.browT = -0.3; A.lookTarget.set(0, 0.4 * Math.sin(p * Math.PI)); break;
        case 'wave': A.wave = Math.sin(t * 8) * 0.8; A.smileT = 0.9; A.lookCam = 0.2; break;
        case 'nom': A.mouthOpenT = Math.abs(Math.sin(t * 8)) * 0.6; A.smileT = 0.8; A.blushT = 0.8; parts.tongue.visible = true; break;
        case 'shiver': A.wobble = 1; A.browT = -0.4; break;
        case 'bow': A.faceTarget = Math.sin(p * Math.PI) * 0.6; A.smileT = 0.8; break;
        case 'play': A.lookTarget.set(Math.sin(t * 3), 0.6); if (A.grounded && Math.random() < dt * 1.2) hop(0.6); break;
        case 'spin': break;
      }
      if (A.actT >= A.actDur) { A.act = null; A.dance = 0; A.wobble = 0; }
    }
    if (A.talk > 0) { A.talk -= dt; A.mouthOpenT = 0.2 + Math.abs(Math.sin(t * 11)) * 0.45; }
    if (A.lookCam > 0) { A.lookCam -= dt; A.lookTarget.set(0, 0.15); }
    else if (Math.random() < dt * 0.35) lookAround();
    if (A.asleep) { A.lookTarget.set(0, -0.3); }

    // ── smoothing ──
    const k = 1 - Math.pow(0.001, dt);
    A.smile = lerp(A.smile, A.smileT, k * 0.6); A.brow = lerp(A.brow, A.browT, k * 0.6); A.blush = lerp(A.blush, A.blushT, k * 0.4);
    A.mouthOpen = lerp(A.mouthOpen, A.mouthOpenT, k); A.look.lerp(A.lookTarget, k * 0.8); A.face = lerp(A.face, A.faceTarget, k * 0.5);
    A.growth = lerp(A.growth, A.growthT, k * 0.3); A.stageGrow = Math.min(1, A.stageGrow + dt * 0.8);
    uni.wobble.value = lerp(uni.wobble.value, 1 + A.wobble * 4 + (A.mood === 'ecstatic' ? 1 : 0), k);

    // ── blink ──
    A.nextBlink -= dt; if (A.nextBlink <= 0) { A.blink = 1; A.nextBlink = 2 + Math.random() * 4; }
    if (A.blink > 0) A.blink = Math.max(0, A.blink - dt * 7);
    const lidClose = A.asleep ? 1 : A.fading ? 0.7 : Math.max(A.blink > 0.5 ? (1 - A.blink) * 2 : A.blink * 2, A.mood === 'sleepy' ? 0.45 : A.mood === 'happy' || A.mood === 'ecstatic' ? 0.1 : 0.18);

    // ── hop physics & squash ──
    if (!A.grounded) { A.vy -= 14 * dt; A.y += A.vy * dt; if (A.y <= 0) { A.y = 0; A.grounded = true; A.squash = Math.min(0.35, Math.abs(A.vy) * 0.06); A.vy = 0; } }
    A.squash = lerp(A.squash, 0, k * 1.5);
    const breath = Math.sin(t * 2.4 * A.breathRate) * 0.025 * A.breathRate;
    const sx = 1 + A.squash * 0.6 - (A.vy > 0 ? A.vy * 0.03 : 0) + breath * 0.5, sy = 1 - A.squash + (A.vy > 0 ? A.vy * 0.05 : 0) + breath;
    const g = A.growth * A.stageGrow + (1 - A.stageGrow) * A.growth * 0.6;
    parts.rig.scale.set(sx * g, sy * g, sx * g); parts.rig.position.y = A.y;

    // ── position (wander) & facing ──
    root.position.x = lerp(root.position.x, A.tx, k * 0.25); root.position.z = lerp(root.position.z, A.tz, k * 0.25);
    A.spin = lerp(A.spin, A.spinT, k * 0.8);
    const faceDir = Math.atan2(A.tx - root.position.x, A.tz - root.position.z);
    const moving = Math.hypot(A.tx - root.position.x, A.tz - root.position.z) > 0.08;
    parts.tilt.rotation.y = A.spin + (moving ? faceDir : 0) * 0.5;
    parts.tilt.rotation.x = A.face + (A.asleep ? 0.25 : 0) + (A.fading ? 0.3 : 0) + (A.dance ? Math.sin(t * 6) * 0.08 : 0);
    parts.tilt.rotation.z = A.dance ? Math.sin(t * 6) * 0.18 : (moving ? Math.sin(t * 10) * 0.05 : 0);
    if (moving && A.grounded && !A.asleep && Math.random() < dt * 3) hop(0.35);

    // ── eyes ──
    eyes.forEach(function(e) {
      e.pupil.position.x = A.look.x * 0.09; e.pupil.position.y = A.look.y * 0.08;
      e.lid.rotation.x = lerp(-0.9, 1.1, lidClose);
      const surprised = A.mood === 'ecstatic' ? 1.15 : 1; e.g.scale.set(surprised, surprised * (1 - lidClose * 0.85), surprised); // closed eyes squint to a line
    });
    parts.brows.forEach(function(b, i) { const side = i === 0 ? -1 : 1; b.rotation.z = side * -A.brow * 0.5; b.position.y = 1.6 + A.brow * 0.06 - (A.mood === 'lonely' ? 0.03 : 0); b.visible = A.stage > 0; });
    parts.mouthOpen.scale.set(0.8 + A.mouthOpen * 0.5, 0.001 + A.mouthOpen * 1.4, 1);
    parts.smile.scale.set(0.6 + Math.abs(A.smile) * 0.7, 0.6 + Math.abs(A.smile) * 0.9, 1); parts.smile.rotation.z = A.smile >= 0 ? Math.PI : 0; parts.smile.position.y = A.smile >= 0 ? 1.06 - A.mouthOpen * 0.05 : 0.98; parts.smile.visible = A.mouthOpen < 0.35;
    parts.cheeks.forEach(function(c) { c.material.opacity = A.blush * 0.85; });

    // ── stage parts ──
    const s = A.stage, gk = 1 - Math.pow(0.02, dt); // parts grow/shrink in about a second
    parts.arms.forEach(function(a, i) { partScale(a, s >= 1, gk); const side = i === 0 ? -1 : 1; a.rotation.z = side * (0.55 + Math.sin(t * 2 + i) * 0.08) + (A.wave && i === 1 ? -A.wave * 1.6 : 0) + (A.dance ? Math.sin(t * 6 + i * Math.PI) * 0.9 : 0) + (A.act === 'beg' ? -side * 0.7 : 0); a.rotation.x = A.act === 'beg' ? -0.8 : 0; });
    partScale(parts.tail, s >= 1, gk);
    parts.tailSegs.forEach(function(seg, i) { const ph = t * (A.dance ? 6 : 2.2) - i * 0.5; seg.position.set(Math.sin(ph) * 0.1 * i, -0.02 * i + Math.sin(ph * 0.7) * 0.04 * i, -0.17 * i); });
    parts.horns.forEach(function(h) { partScale(h, s >= 2, gk); });
    parts.tufts.forEach(function(tu) { partScale(tu, s >= 3, gk); });
    parts.wings.forEach(function(w, i) { const side = i === 0 ? -1 : 1; const on = s >= 4; const tgt = on ? 1.35 : 0.001; w.scale.x = lerp(w.scale.x, side * tgt, gk); w.scale.y = lerp(w.scale.y, tgt, gk); w.scale.z = w.scale.y; w.rotation.y = side * (0.5 + Math.sin(t * (A.grounded ? 3 : 9)) * 0.45); w.rotation.z = side * -0.2; });
    partScale(parts.halo, s >= 5, gk);
    parts.halo.rotation.y = t * 0.8; parts.halo.children.forEach(function(o, i) { const a = i / 7 * Math.PI * 2 + t * 0.8; o.position.set(Math.cos(a) * 0.55, Math.sin(t * 2 + i) * 0.08, Math.sin(a) * 0.55); });
    parts.egg.children.forEach(function(c) { c.material.opacity = 1; });
    parts.egg.scale.setScalar(A.stage === 0 ? 1 : Math.max(0.001, parts.egg.scale.x - dt * 1.5));
    parts.egg.rotation.z = A.stage === 0 && (A.mood === 'ecstatic' || A.wobble) ? Math.sin(t * 20) * 0.08 : Math.sin(t * 1.5) * 0.02;
    parts.mushrooms.children.forEach(function(m, i) { partScale(m, s >= 2 + Math.floor(i / 2), gk); });
    parts.runes.children.forEach(function(r, i) { r.material.emissiveIntensity = lerp(r.material.emissiveIntensity, i < s ? 1.2 : 0, gk); r.position.y = r.userData.base + (i < s ? Math.sin(t * 1.5 + i) * 0.08 : 0); r.rotation.y = t * 0.6 + i; });

    // ── glow & colour temperature ──
    const health = clamp((A.food + A.joy) / 200, 0, 1);
    const glow = A.fading ? 0.05 : A.asleep ? A.glow * 0.4 : A.glow * (0.6 + health * 0.8) * (A.mood === 'ecstatic' ? 1.6 : 1);
    bodyMat.emissiveIntensity = lerp(bodyMat.emissiveIntensity, Math.min(0.42, glow * 0.3), k); glowMat.opacity = lerp(glowMat.opacity, Math.min(0.14, 0.03 + glow * 0.05), k);
    parts.innerLight.intensity = lerp(parts.innerLight.intensity, Math.min(0.8, 0.2 + glow * 0.4), k);
    parts.innerLight.position.set(root.position.x, 1.1 * A.growth, root.position.z);
    bodyMat.color.lerp(new T.Color(A.fading ? 0x7d8a86 : STAGE_LOOK[Math.min(5, A.stage)].col), k * 0.5);
    parts.aura.scale.setScalar(1 + Math.sin(t * 1.6) * 0.04 + (A.mood === 'ecstatic' ? 0.15 : 0));

    // ── nest & environment ──
    nest.position.y = Math.sin(t * 0.5) * 0.05; nest.rotation.y = Math.sin(t * 0.1) * 0.02; root.position.y = nest.position.y;
    dayT = (dayT + dt / 240) % 1; // 4-minute day
    const night = 0.5 + 0.5 * Math.cos(dayT * Math.PI * 2);
    skyMat.uniforms.top.value.setHSL(0.63, 0.55, lerp(0.09, 0.03, night)); skyMat.uniforms.mid.value.setHSL(0.55, 0.5, lerp(0.34, 0.14, night)); skyMat.uniforms.bot.value.setHSL(0.47, 0.45, lerp(0.42, 0.2, night));
    stars.material.opacity = Math.max(0, night - 0.35) * 1.3; stars.rotation.y = t * 0.004;
    const fp = fireflies.geometry.attributes.position;
    for (let i = 0; i < fp.count; i++) { const v = fireflyVel[i]; v.x += (Math.random() - .5) * dt; v.y += (Math.random() - .5) * dt * 0.5; v.z += (Math.random() - .5) * dt; v.clampLength(0, 0.5); let x = fp.getX(i) + v.x * dt, y = fp.getY(i) + v.y * dt, z = fp.getZ(i) + v.z * dt; if (Math.abs(x) > 5) v.x *= -1; if (y < 0.3 || y > 4.2) v.y *= -1; if (Math.abs(z) > 5) v.z *= -1; fp.setXYZ(i, x, y, z); }
    fp.needsUpdate = true; fireflies.material.opacity = 0.35 + night * 0.6 + Math.sin(t * 3) * 0.15;

    // ── hearts & sparks ──
    for (let i = hearts.length - 1; i >= 0; i--) { const h = hearts[i], u = h.userData; u.age += dt; h.position.y += u.vy * dt; h.position.x += Math.sin(u.age * 3 + i) * dt * 0.3; h.rotation.y += u.spin * dt; const life = u.age / u.life; h.scale.setScalar(u.s * Math.min(1, u.age * 5) * (1 - life * 0.3)); h.material.opacity = 1 - life; h.lookAt(camera.position); if (u.age >= u.life) { scene.remove(h); hearts.splice(i, 1); } }
    for (let i = sparks.length - 1; i >= 0; i--) { const sp = sparks[i], u = sp.userData; u.age += dt; u.v.y -= 3 * dt; sp.position.addScaledVector(u.v, dt); sp.rotation.x += dt * 5; sp.rotation.y += dt * 7; const life = u.age / u.life; sp.material.opacity = 1 - life; sp.scale.setScalar(1 - life * 0.5); if (u.age >= u.life) { scene.remove(sp); sparks.splice(i, 1); } }

    // ── camera ──
    orbitAngle += dt * 0.06; camPunch = lerp(camPunch, 0, k * 0.8);
    const portrait = innerHeight > innerWidth;
    const dist = ((portrait ? 5.2 : 4.4) + A.growth * 3.1) * (1 - camPunch * 0.15);
    camTarget.lerp(new T.Vector3(root.position.x * 0.5, (1.15 + (A.stage >= 4 ? 0.35 : 0)) * A.growth + (portrait ? 0.3 : 0.1), root.position.z * 0.5), k * 0.5);
    const sway = Math.sin(orbitAngle * 0.5) * 0.35; // gentle ±20° sway, always in front of the face
    camera.position.set(camTarget.x + Math.sin(sway) * dist, camTarget.y + 0.9 + A.growth * 0.4 + camPunch * 0.2, camTarget.z + Math.cos(sway) * dist);
    camera.lookAt(camTarget);
    if (composer) composer.render(); else renderer.render(scene, camera);
  }

  function noteSpark() { const m = new T.Mesh(parts.sparkGeo, parts.sparkMat.clone()); m.material.color.set(0xbfe9ff); m.position.set(root.position.x + 0.4, 1.9 * A.growth, root.position.z + 0.5); m.userData = { v: new T.Vector3(0.4 + Math.random() * 0.4, 1.6, 0.3), life: 1.6, age: 0 }; scene.add(m); sparks.push(m); }

  function headScreenPos() {
    const v = new T.Vector3(root.position.x, (2.2 + (A.stage >= 2 ? 0.4 : 0)) * A.growth + A.y, root.position.z).project(camera);
    return { x: (v.x + 1) / 2 * innerWidth, y: (1 - v.y) / 2 * innerHeight, visible: v.z < 1 };
  }

  window.Creature = { init, setStage, setMood, setVitals, hop, wander, spin, dance, sing, beg, yawn, wave, nom, shiver, bow, play, talk, lookAtCamera, lookAround, burstHearts, burstSparks, punch, headScreenPos, anim: A };
})();
