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
  // ?q=low: 1x pixels, no antialiasing, no post-processing (weak phones) · CALM: the system asks for reduced motion, the camera holds still
  const SET = window.BEAST_SETTINGS || {}; // the player's comfort settings (play.html), on top of ?q=low and of the device's own preference
  const LOW = /[?&]q=low\b/.test(location.search) || !!SET.low, CALM = matchMedia('(prefers-reduced-motion: reduce)').matches || SET.calm ? 0 : 1;

  let renderer, scene, camera, composer, clock;
  let root, parts = {}, eyes = [];
  let nest, skyMat, bokeh, fireflies, fireflyVel = [];
  let hearts = [], sparks = [], orbitAngle = 0.4, camPunch = 0, camTarget = new T.Vector3();
  let mouseX = 0, mouseY = 0, stars, starPhases, vignettePass;
  const uni = { time: { value: 0 }, wobble: { value: 1 } };
  const PINK = 0xe88cc8, CYAN = 0x7ecde6, GOLD = 0xf0c96a, WHITE = 0xf5f0f8, CREAM = 0xf5e6d0;

  const A = {
    stage: 0, mood: 'curious', asleep: false, fading: false, energy: 80, food: 70, joy: 50, hatch: 0,
    breathRate: 1, y: 0, vy: 0, grounded: true, squash: 0, face: 0, faceTarget: 0,
    look: new T.Vector2(0, 0), lookTarget: new T.Vector2(0, 0), blink: 0, nextBlink: 2,
    mouthOpen: 0, mouthOpenT: 0, smile: 0.5, smileT: 0.5, brow: 0, browT: 0, blush: 0.5, blushT: 0.5,
    talk: 0, wave: 0, spin: 0, spinT: 0, dance: 0, wobble: 0, growth: 1, growthT: 1,
    tx: 0, tz: 0, act: null, actT: 0, actDur: 0, glow: 0.3, stageGrow: 1, lookCam: 0,
    view: 'home', hx: 0, hz: 0, path: null, yaw: 0 // view: 'home' (nest at night) or 'city' (daylight plaza) · hx,hz: where it stands · path: points left to walk
  };
  const WALK = 4.6; // city walking speed, units per second

  // ─────────────────────────────────────────────────────────────
  // MATERIALS & HELPERS
  // ─────────────────────────────────────────────────────────────
  function dotTexture() { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); const id = g.createImageData(128, 128); for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) { const dx = x - 63.5, dy = y - 63.5, d = Math.sqrt(dx * dx + dy * dy) / 64; const a = Math.max(0, Math.exp(-d * d * 3.5)); const i = (y * 128 + x) * 4; id.data[i] = id.data[i + 1] = id.data[i + 2] = 255; id.data[i + 3] = a * 255 | 0; } g.putImageData(id, 0, 0); return new T.CanvasTexture(c); }
  function ringBokehTexture() { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); const id = g.createImageData(128, 128); for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) { const dx = x - 63.5, dy = y - 63.5, d = Math.sqrt(dx * dx + dy * dy) / 56; const ring = Math.exp(-Math.pow(d - 0.7, 2) * 18) * 0.9; const fill = Math.exp(-d * d * 4.5) * 0.35; const a = Math.min(1, ring + fill) * Math.max(0, 1 - d * 1.05); const i = (y * 128 + x) * 4; id.data[i] = id.data[i + 1] = id.data[i + 2] = 255; id.data[i + 3] = a * 255 | 0; } g.putImageData(id, 0, 0); return new T.CanvasTexture(c); }
  let dot, ringDot;
  function plush(color, opts) {
    const m = new T.MeshStandardMaterial(Object.assign({ color: color, roughness: 0.78, metalness: 0.03 }, opts || {}));
    m.onBeforeCompile = function(sh) {
      sh.uniforms.uTime = uni.time; sh.uniforms.uWobble = uni.wobble;
      sh.vertexShader = 'uniform float uTime; uniform float uWobble;\n' + sh.vertexShader.replace('#include <begin_vertex>',
        '#include <begin_vertex>\n float w = sin(position.y * 3.5 + uTime * 1.4) * 0.018 + sin(position.x * 5.0 - uTime * 1.0) * 0.013 + sin(position.z * 4.5 + uTime * 1.7) * 0.011 + sin((position.x + position.z) * 2.5 + uTime * 0.6) * 0.008;\n transformed += normal * w * uWobble;');
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
    renderer = new T.WebGLRenderer({ canvas: canvas, antialias: !LOW, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(devicePixelRatio, LOW ? 1 : 2));
    renderer.outputEncoding = T.sRGBEncoding; renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.08;
    scene = new T.Scene(); camera = new T.PerspectiveCamera(36, 1, 0.1, 200); clock = new T.Clock(); dot = dotTexture(); ringDot = ringBokehTexture();
    buildRoom(); buildLights(); buildNest(); buildCreature(); buildParticles(); buildEnvironment();
    resize(); addEventListener('resize', resize);
    addEventListener('mousemove', function(e) { mouseX = (e.clientX / innerWidth - 0.5) * 2; mouseY = (e.clientY / innerHeight - 0.5) * 2; });
    addEventListener('touchmove', function(e) { if (e.touches[0]) { mouseX = (e.touches[0].clientX / innerWidth - 0.5) * 2; mouseY = (e.touches[0].clientY / innerHeight - 0.5) * 2; } });
    if (!LOW && T.EffectComposer && T.UnrealBloomPass) { composer = new T.EffectComposer(renderer); composer.addPass(new T.RenderPass(scene, camera)); parts.bloom = new T.UnrealBloomPass(new T.Vector2(innerWidth, innerHeight), 0.5, 0.85, 0.78); composer.addPass(parts.bloom);
      // lift: 0 keeps the dark cinematic grade of the nest, 1 encodes to sRGB so the daylight city shows its real pastels
      if (T.ShaderPass) { vignettePass = new T.ShaderPass({ uniforms: { tDiffuse: { value: null }, darkness: { value: 0.45 }, flash: { value: 0 }, time: { value: 0 }, lift: { value: 0 } }, vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }', fragmentShader: 'uniform sampler2D tDiffuse; uniform float darkness; uniform float flash; uniform float time; uniform float lift; varying vec2 vUv; void main(){ vec2 uv = vUv; float d = distance(uv, vec2(0.5)); float ca = d * d * 0.006; vec3 c = vec3(texture2D(tDiffuse, uv + vec2(ca, ca * 0.5)).r, texture2D(tDiffuse, uv).g, texture2D(tDiffuse, uv - vec2(ca, ca * 0.5)).b); c = mix(c, pow(max(c, 0.0), vec3(0.4545)), lift); c *= smoothstep(1.4, 0.45, d * darkness * 2.4); float lum = dot(c, vec3(0.2126, 0.7152, 0.0722)); vec3 warmShift = mix(vec3(0.06, 0.03, 0.0), vec3(0.0, 0.01, 0.06), clamp(d * 1.4, 0.0, 1.0)); c += warmShift * (1.0 - lum) * 0.4; c += lum * lum * vec3(0.03, 0.02, 0.04) * 0.3; c *= vec3(1.02, 0.99, 0.96); float grain = fract(sin(dot(uv + fract(time * 0.1), vec2(12.9898, 78.233))) * 43758.5453); c += (grain - 0.5) * 0.018; c += flash * vec3(1.0, 0.96, 0.88); gl_FragColor = vec4(c, 1.0); }' }); composer.addPass(vignettePass); }
    }
    skyMat.uniforms.uSrgb.value = vignettePass ? 0 : 1; // without the grading pass, the day sky encodes itself
    requestAnimationFrame(loop);
  }
  function resize() { const w = innerWidth, h = innerHeight; renderer.setSize(w, h); camera.aspect = w / h; camera.fov = w < h ? 50 : 36; camera.updateProjectionMatrix(); if (composer) composer.setSize(w, h); }

  function buildRoom() {
    skyMat = new T.ShaderMaterial({ side: T.BackSide, depthWrite: false,
      uniforms: { uTime: uni.time, uDay: { value: 0 }, uSrgb: { value: 0 }, uTint: { value: new T.Vector3(1, 1, 1) } },
      vertexShader: 'varying vec3 vp; void main(){ vp = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: [
        'uniform float uTime; uniform float uDay; uniform float uSrgb; uniform vec3 uTint; varying vec3 vp;',
        'float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }',
        'float noise(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y); }',
        'float fbm(vec2 p){ float v=0.0,a=0.5; for(int i=0;i<5;i++){v+=a*noise(p);p*=2.1;a*=0.48;} return v; }',
        'void main(){',
        '  vec3 d = normalize(vp); float h = d.y;',
        '  vec3 deep = vec3(0.012,0.008,0.04);',
        '  vec3 mid  = vec3(0.035,0.02,0.09);',
        '  vec3 low  = vec3(0.055,0.025,0.1);',
        '  vec3 base = h > 0.0 ? mix(mid, deep, pow(h, 0.7)) : mix(mid, low, pow(-h, 0.6));',
        '  float t = uTime * 0.012;',
        '  vec2 uv = vec2(atan(d.x, -d.z) * 0.318, h);', // -d.z: the atan seam (hard vertical edge in the nebula) sits at +z, behind the camera
        '  float n1 = fbm(uv * 3.0 + vec2(t, t * 0.7));',
        '  float n2 = fbm(uv * 5.0 - vec2(t * 0.5, t * 1.1) + 40.0);',
        '  float n3 = fbm(uv * 8.0 + vec2(t * 0.3, -t * 0.4) + 80.0);',
        '  vec3 neb1 = vec3(0.12, 0.04, 0.18) * smoothstep(0.35, 0.7, n1) * 1.4;',
        '  vec3 neb2 = vec3(0.04, 0.06, 0.16) * smoothstep(0.4, 0.75, n2) * 1.0;',
        '  vec3 neb3 = vec3(0.08, 0.03, 0.12) * smoothstep(0.45, 0.8, n3) * 0.7;',
        '  vec3 c = (base + neb1 + neb2 + neb3) * uTint;', // uTint: the light the player chose for the nest (setRoom)
        // the city's late-afternoon sky (linear values): peach horizon, lilac-blue zenith, aqua haze below, soft clouds
        '  vec3 day = h > 0.0 ? mix(vec3(1.0, 0.62, 0.58), vec3(0.33, 0.42, 0.95), pow(h, 0.55)) : mix(vec3(1.0, 0.62, 0.58), vec3(0.45, 0.85, 0.80), pow(-h, 0.5));',
        '  day += vec3(0.30, 0.22, 0.26) * smoothstep(0.42, 0.78, n1) * smoothstep(0.02, 0.35, h);',
        '  day = mix(day, pow(day, vec3(0.4545)), uSrgb);',
        '  gl_FragColor = vec4(mix(c, day, uDay), 1.0);',
        '}'
      ].join('\n') });
    scene.add(new T.Mesh(new T.SphereGeometry(90, 48, 24), skyMat));
    scene.fog = new T.FogExp2(0x06041a, 0.015);
    var palette = [new T.Color(0xc488b8), new T.Color(0x7eaec0), new T.Color(0x8a6eaa), new T.Color(0xd4a0c4), new T.Color(0xc4a86a)];
    function makeLayer(count, minD, maxD, minY, maxY, sz, op, tex) {
      var p = new Float32Array(count * 3), c = new Float32Array(count * 3);
      for (var i = 0; i < count; i++) { var a = rnd(-1.6, 1.6), d = rnd(minD, maxD); p.set([Math.sin(a) * d, rnd(minY, maxY), -Math.cos(a) * d], i * 3); var co = palette[i % 5]; c.set([co.r, co.g, co.b], i * 3); }
      var g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(p, 3)); g.setAttribute('color', new T.BufferAttribute(c, 3));
      return new T.Points(g, new T.PointsMaterial({ size: sz, map: tex || ringDot, vertexColors: true, transparent: true, opacity: op, depthWrite: false, blending: T.AdditiveBlending }));
    }
    bokeh = makeLayer(45, 24, 40, -2, 12, 1.6, 0.22); scene.add(bokeh);
    parts.bokehMid = makeLayer(18, 12, 22, 0, 8, 2.8, 0.14); scene.add(parts.bokehMid);
    parts.bokehNear = makeLayer(5, 4, 9, 0.5, 3.5, 4.0, 0.04); scene.add(parts.bokehNear);
    var sn = 200, spos = new Float32Array(sn * 3), scol = new Float32Array(sn * 3); starPhases = new Float32Array(sn); parts.starBright = new Float32Array(sn); parts.starSpeeds = new Float32Array(sn);
    for (var si = 0; si < sn; si++) { var sa = rnd(0, Math.PI * 2), se = rnd(0.15, 1.4), br = 0.4 + Math.random() * 0.6; spos.set([Math.cos(sa) * 45 * Math.cos(se), Math.sin(se) * 45, Math.sin(sa) * 45 * Math.cos(se)], si * 3); scol.set([br, br, br * 0.95], si * 3); starPhases[si] = rnd(0, Math.PI * 2); parts.starBright[si] = br; parts.starSpeeds[si] = rnd(0.3, 1.8); }
    var sg = new T.BufferGeometry(); sg.setAttribute('position', new T.BufferAttribute(spos, 3)); sg.setAttribute('color', new T.BufferAttribute(scol, 3));
    stars = new T.Points(sg, new T.PointsMaterial({ size: 0.25, map: dot, vertexColors: true, transparent: true, opacity: 0.75, blending: T.AdditiveBlending, depthWrite: false }));
    scene.add(stars);
  }
  function buildLights() {
    parts.hemi = new T.HemisphereLight(0x9fb8ff, 0x2a1a3a, 0.45); scene.add(parts.hemi);
    const key = parts.key = new T.DirectionalLight(0xfff4e6, 0.85); key.position.set(3, 6, 5); scene.add(key);
    parts.fill = new T.PointLight(PINK, 0.9, 14); parts.fill.position.set(-4.5, 3, 3.5); scene.add(parts.fill);
    parts.rim = new T.PointLight(CYAN, 1.0, 14); parts.rim.position.set(4.5, 3.5, -3); scene.add(parts.rim);
    parts.innerLight = new T.PointLight(0xffc6f0, 0.3, 4); parts.innerLight.position.set(0, 1.2, 0.6); scene.add(parts.innerLight);
    parts.accent = new T.PointLight(0xffeedd, 0.45, 15); scene.add(parts.accent);
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
    for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2 + 0.3; const r = new T.Sprite(new T.SpriteMaterial({ map: dot, color: i % 2 ? PINK : CYAN, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false })); r.scale.setScalar(0.25); r.position.set(Math.cos(a) * 2.0, 0.25, Math.sin(a) * 2.0); r.userData.base = 0.25; parts.runes.add(r); }
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
    parts.pendant = new T.Sprite(new T.SpriteMaterial({ map: dot, color: PINK, transparent: true, opacity: 0.9, blending: T.AdditiveBlending, depthWrite: false })); parts.pendant.scale.setScalar(0.22); parts.pendant.position.set(0, -0.1, 0.56); parts.collar.add(parts.pendant);
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
    [[-0.5, 1.05, -0.4, 0.35], [0.5, 1.05, -0.4, 0.35], [-0.28, 1.4, -0.7, 0.28], [0.28, 1.4, -0.7, 0.28], [0, 0.95, -0.75, 0.32]].forEach(function(p) { const c = new T.Sprite(new T.SpriteMaterial({ map: dot, color: CYAN, transparent: true, opacity: 0.8, blending: T.AdditiveBlending, depthWrite: false })); c.position.set(p[0], p[1], p[2]); c.scale.setScalar(p[3]); parts.crystals.add(c); });
    parts.glyph = new T.Mesh(new T.TorusGeometry(0.13, 0.025, 8, 24), crystal(CYAN)); parts.glyph.position.set(0, 0.72, 0.9); G.add(hide(parts.glyph));
    // feather wings, crown, aura (stage 6+)
    parts.feathers = [-1, 1].map(function(side) { const w = new T.Mesh(featherShape(), new T.MeshStandardMaterial({ color: 0xffffff, emissive: 0xdfe9ff, emissiveIntensity: 0.55, transparent: true, opacity: 0.92, side: T.DoubleSide })); w.position.set(side * 0.45, 1.25, -0.55); w.rotation.y = side * 0.6; G.add(w); w.scale.set(side * 0.001, 0.001, 0.001); return w; });
    parts.crown = new T.Group(); parts.crown.position.set(0, 2.55, -0.05); G.add(hide(parts.crown));
    const goldMat = new T.MeshStandardMaterial({ color: GOLD, emissive: GOLD, emissiveIntensity: 0.5, roughness: 0.3, metalness: 0.6 });
    const ringC = new T.Mesh(new T.TorusGeometry(0.34, 0.045, 10, 32), goldMat); ringC.rotation.x = Math.PI / 2; parts.crown.add(ringC);
    for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; const pt = new T.Mesh(new T.ConeGeometry(0.06, 0.22, 6), goldMat); pt.position.set(Math.cos(a) * 0.32, 0.12, Math.sin(a) * 0.32); parts.crown.add(pt); const gem = new T.Sprite(new T.SpriteMaterial({ map: dot, color: i % 2 ? PINK : CYAN, transparent: true, opacity: 0.85, blending: T.AdditiveBlending, depthWrite: false })); gem.scale.setScalar(0.12); gem.position.set(Math.cos(a) * 0.32, 0.26, Math.sin(a) * 0.32); parts.crown.add(gem); }
    parts.aura = new T.Mesh(new T.SphereGeometry(1.9, 32, 24), new T.MeshBasicMaterial({ color: 0xff9be6, transparent: true, opacity: 0, side: T.BackSide, blending: T.AdditiveBlending, depthWrite: false })); parts.aura.position.y = 1.3; G.add(parts.aura);
    parts.halo = new T.Group(); parts.halo.position.y = 3.0; G.add(hide(parts.halo));
    for (let i = 0; i < 8; i++) { const h = new T.Sprite(new T.SpriteMaterial({ map: dot, color: i % 2 ? PINK : GOLD, transparent: true, opacity: 0.75, blending: T.AdditiveBlending, depthWrite: false })); h.scale.setScalar(0.15); parts.halo.add(h); }
    // egg (stage 0): white shell with a glowing mark, cracks light up as hatching nears
    parts.egg = new T.Group(); parts.tilt.add(parts.egg);
    const shell = sphere(1.0, new T.MeshStandardMaterial({ color: 0xfaf6ff, roughness: 0.45 }), 1, 1.25, 1); shell.position.y = 1.2; parts.egg.add(shell);
    parts.eggMark = new T.Sprite(new T.SpriteMaterial({ map: dot, color: PINK, transparent: true, opacity: 0.8, blending: T.AdditiveBlending, depthWrite: false })); parts.eggMark.scale.setScalar(0.35); parts.eggMark.position.set(0, 1.25, 0.95); parts.egg.add(parts.eggMark);
    parts.eggCracks = [];
    for (let i = 0; i < 5; i++) { const c = new T.Mesh(new T.BoxGeometry(0.02, rnd(0.25, 0.5), 0.02), crystal(CYAN)); const a = rnd(0, Math.PI * 2), e = rnd(-0.5, 0.6); c.position.set(Math.cos(a) * Math.sqrt(1 - e * e) * 0.99, 1.2 + e * 1.24, Math.sin(a) * Math.sqrt(1 - e * e) * 0.99); c.lookAt(0, 1.2, 0); c.rotation.z = rnd(0, Math.PI); c.visible = false; parts.egg.add(c); parts.eggCracks.push(c); }
    // sleep Zs
    parts.zz = new T.Group(); parts.zz.position.set(0.95, 2.4, 0.3); G.add(parts.zz); parts.zz.visible = false;
    for (let i = 0; i < 3; i++) { const z = new T.Mesh(new T.TorusKnotGeometry(0.06 + i * 0.02, 0.018, 30, 6, 1, 3), new T.MeshBasicMaterial({ color: 0xd7e8ff })); z.position.set(i * 0.22, i * 0.3, 0); parts.zz.add(z); }
    // FX pools
    const hs = new T.Shape(); hs.moveTo(0, 0.5); hs.bezierCurveTo(0, 0.5, -0.1, 0.9, -0.5, 0.9); hs.bezierCurveTo(-1.1, 0.9, -1.1, 0.2, -1.1, 0.2); hs.bezierCurveTo(-1.1, -0.2, -0.7, -0.6, 0, -1); hs.bezierCurveTo(0.7, -0.6, 1.1, -0.2, 1.1, 0.2); hs.bezierCurveTo(1.1, 0.2, 1.1, 0.9, 0.5, 0.9); hs.bezierCurveTo(0.1, 0.9, 0, 0.5, 0, 0.5);
    parts.heartGeo = new T.ExtrudeGeometry(hs, { depth: 0.25, bevelEnabled: true, bevelSize: 0.08, bevelThickness: 0.05, bevelSegments: 2 }); parts.heartGeo.scale(0.13, 0.13, 0.13); parts.heartGeo.rotateZ(Math.PI);
    parts.heartMats = [0xff4f8b, PINK, 0xff9ad0, 0xff2f6d].map(function(c) { return new T.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.6, transparent: true }); });
    parts.sparkMat = new T.SpriteMaterial({ map: dot, color: 0xffe9a3, transparent: true, blending: T.AdditiveBlending, depthWrite: false });
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
    A.glow = L.glow; parts.egg.visible = n === 0; parts.beast.visible = n > 0;
    loadRig(n); showModel(n); if (n < 7) loadRig(n + 1); // prefetch the next form. The static model is fetched only when a form has no rig (see loadRig)
    if (animate) { A.stageGrow = 0; camPunch = 1; }
  }

  // ─────────────────────────────────────────────────────────────
  // OPTIONAL MODELS — assets/models/form-NN.glb (NN = stage+1, 01..08). Generated with Higgsfield image_to_3d from
  // assets/art/form-NN-*.png. When a form has a model it replaces the procedural body; the rig (hop, squash, tilt,
  // spin, breathing), the FX and the bubbles keep working. Missing files simply keep the procedural creature.
  // ─────────────────────────────────────────────────────────────
  const models = {}; // model name → { obj, height } | 'missing' | 'loading'
  const MODEL_FORMS = [1, 3, 4, 6, 8, 9, 11, 10]; // art-bible form per game stage (same mapping as ART in game.js)
  let FORMS = null; // model name per stage for another species (play.html, see SPECIES in pet.js); null = the star dragon
  function setForms(list) { FORMS = list || null; }
  function base(n) { return FORMS ? FORMS[Math.min(n, FORMS.length - 1)] : 'form-' + String(MODEL_FORMS[n] || n + 1).padStart(2, '0'); }
  function loadModel(st, name) {
    const n = name || base(st);
    if (models[n] !== undefined || !T.GLTFLoader) return;
    models[n] = 'loading';
    loader().load('assets/models/' + n + '.glb', function(gltf) {
      const obj = gltf.scene; obj.traverse(function(o) { if (o.isMesh && o.material) { o.material.roughness = Math.min(0.85, (o.material.roughness || 0.7)); if (o.material.emissive && o.material.map) { o.material.emissiveMap = o.material.map; o.material.emissive.set(0xffffff); o.material.emissiveIntensity = 0.18; } } }); // textured models glow softly from their own texture, like the concept art
      const box = new T.Box3().setFromObject(obj), size = box.getSize(new T.Vector3()), h = Math.max(0.001, size.y);
      const sc = 2.55 / h; obj.scale.setScalar(sc); box.setFromObject(obj); const c = box.getCenter(new T.Vector3());
      obj.position.set(-c.x, -box.min.y, -c.z);
      const g = new T.Group(); g.add(obj); g.visible = false; parts.tilt.add(g);
      models[n] = { obj: g, height: 2.55 };
      if (base(A.stage) === n) showModel(A.stage);
    }, undefined, function() { models[n] = 'missing'; });
  }
  function showModel(st) {
    const n = base(st), R = rigs[n] && rigs[n].obj ? rigs[n] : null;
    Object.keys(rigs).forEach(function(k) { if (rigs[k] && rigs[k].obj) rigs[k].obj.visible = R && k === n; });
    Object.keys(models).forEach(function(k) { if (models[k] && models[k].obj) models[k].obj.visible = !R && k === n; });
    const m = R || (models[n] && models[n].obj ? models[n] : null);
    parts.beast.visible = !m && st > 0; parts.egg.visible = !m && st === 0;
    A.usingModel = !!m; A.usingRig = !!R;
  }


  // ─────────────────────────────────────────────────────────────
  // ENVIRONMENT UPGRADES — painted backdrop (assets/art/backdrop.png), the Meshy nest (assets/models/prop-nest.glb),
  // ground mist, orbiting crystal shards. Each one is optional: missing file = procedural version stays.
  // ─────────────────────────────────────────────────────────────
  let dustMotes, dustVel = [], nestModel = null;
  function buildEnvironment() {
    new T.TextureLoader().load('assets/art/backdrop.png', function(tex) {
      tex.encoding = T.sRGBEncoding; tex.wrapS = T.RepeatWrapping; tex.repeat.x = -1; tex.offset.x = 1;
      const arc = 2.3, r = 42, h = arc * r / 2.33;
      const m = new T.Mesh(new T.CylinderGeometry(r, r, h, 48, 1, true, Math.PI - arc / 2, arc), new T.MeshBasicMaterial({ map: tex, side: T.DoubleSide, color: 0x9a94c4, fog: false, depthWrite: false }));
      m.position.y = h * 0.28; m.renderOrder = -1; scene.add(m); parts.backdrop = m;
    }, undefined, function() {});
    if (T.GLTFLoader) loader().load('assets/models/prop-nest.glb', function(gltf) {
      const obj = gltf.scene; obj.traverse(function(o) { if (o.isMesh && o.material && o.material.map) { o.material.emissiveMap = o.material.map; o.material.emissive.set(0xffffff); o.material.emissiveIntensity = 0.22; } });
      const box = new T.Box3().setFromObject(obj), size = box.getSize(new T.Vector3());
      const sc = 4.7 / Math.max(size.x, size.z); obj.scale.setScalar(sc); box.setFromObject(obj); const c = box.getCenter(new T.Vector3());
      obj.position.set(-c.x, -box.max.y + 0.42, -c.z); // bowl rim just under the creature's feet
      nestModel = new T.Group(); nestModel.add(obj); nestModel.visible = A.view === 'home'; scene.add(nestModel);
      nest.children.forEach(function(ch) { if (ch !== parts.runes) ch.visible = false; }); // procedural nest & table give way to the floating rock
    }, undefined, function() {});
    // dust motes: soft organic particles drifting through the scene
    const dn = 40, dpos = new Float32Array(dn * 3), dcol = new Float32Array(dn * 3);
    for (let i = 0; i < dn; i++) { const a = rnd(0, Math.PI * 2), r = rnd(1.5, 5), y = rnd(0.3, 4); dpos.set([Math.cos(a) * r, y, Math.sin(a) * r], i * 3); const c = i % 3 === 0 ? new T.Color(CREAM) : i % 3 === 1 ? new T.Color(0xffd6ee) : new T.Color(0xd6e8ff); dcol.set([c.r, c.g, c.b], i * 3); dustVel.push({ sx: rnd(0.3, 0.9), sy: rnd(0.2, 0.5), sz: rnd(0.3, 0.9), px: rnd(0, Math.PI * 2), py: rnd(0, Math.PI * 2), pz: rnd(0, Math.PI * 2) }); }
    const dg = new T.BufferGeometry(); dg.setAttribute('position', new T.BufferAttribute(dpos, 3)); dg.setAttribute('color', new T.BufferAttribute(dcol, 3));
    dustMotes = new T.Points(dg, new T.PointsMaterial({ size: 0.08, map: dot, vertexColors: true, transparent: true, opacity: 0.5, blending: T.AdditiveBlending, depthWrite: false }));
    scene.add(dustMotes);
  }
  function updateEnvironment(t, dt) {
    if (decorGroup && decorGroup.visible) { decorGroup.position.y = Math.sin(t * 0.4 + 1) * 0.07; lanterns.forEach(function(s, i) { s.position.y = s.userData.y + Math.sin(t * 0.7 + i * 1.9) * 0.16; s.material.opacity = 0.8 + Math.sin(t * 1.3 + i) * 0.15; }); }
    if (nestModel) { nestModel.position.y = Math.sin(t * 0.45) * 0.06; nestModel.rotation.y = Math.sin(t * 0.08) * 0.03; nest.position.y = nestModel.position.y; root.position.y = A.view === 'home' ? nestModel.position.y : 0; }
    if (dustMotes) { const dp = dustMotes.geometry.attributes.position; for (let i = 0; i < dp.count; i++) { const dv = dustVel[i]; dp.setX(i, dp.getX(i) + Math.sin(t * dv.sx + dv.px) * dt * 0.06); dp.setY(i, dp.getY(i) + Math.sin(t * dv.sy + dv.py) * dt * 0.03); dp.setZ(i, dp.getZ(i) + Math.sin(t * dv.sz + dv.pz) * dt * 0.06); } dp.needsUpdate = true; dustMotes.material.opacity = 0.35 + Math.sin(t * 0.3) * 0.1; }
    if (parts.backdrop) parts.backdrop.rotation.y = Math.sin(t * 0.02) * 0.02;
  }

  // ─────────────────────────────────────────────────────────────
  // RIGGED MODELS — form-NN-idle.glb (+ wave/dance/jump/cheer/look) from scripts/meshy-rig.mjs. When the idle clip
  // exists it is preferred over the static form model; the other clips are fetched lazily and cross-faded.
  // ─────────────────────────────────────────────────────────────
  const rigs = {}; // model name → { obj, mixer, actions:{name:action}, current, clips:{name:'loading'|'missing'|clip} }
  const CLIP_NAMES = ['wave', 'dance', 'jump', 'cheer', 'look'];
  function rigUrl(n, clip) { return 'assets/models/' + n + '-' + clip + '.glb'; }
  function loadRig(st) {
    const n = base(st);
    if (rigs[n] !== undefined || !T.GLTFLoader) return; rigs[n] = 'loading';
    loader().load(rigUrl(n, 'idle'), function(gltf) {
      const obj = gltf.scene; obj.traverse(function(o) { if (o.isMesh && o.material) { o.frustumCulled = false; if (o.material.map && o.material.emissive) { o.material.emissiveMap = o.material.map; o.material.emissive.set(0xffffff); o.material.emissiveIntensity = 0.18; } } });
      // Skinned meshes render where the bones are (Meshy rigs: armature in cm, mesh geometry in m), so measure the skeleton, not the geometry
      obj.updateMatrixWorld(true); const bb = new T.Box3(); const wp = new T.Vector3();
      obj.traverse(function(o) { if (o.isBone) bb.expandByPoint(o.getWorldPosition(wp)); });
      const bh = Math.max(0.001, bb.max.y - bb.min.y) * 1.22, sc = 2.9 / bh; // head bone sits below the top of the head
      obj.scale.setScalar(sc); obj.updateMatrixWorld(true); const c = bb.getCenter(new T.Vector3());
      obj.position.set(-c.x * sc, -(bb.min.y - bh * 0.04) * sc, -c.z * sc);
      const g = new T.Group(); g.add(obj); g.visible = false; parts.tilt.add(g);
      const mixer = new T.AnimationMixer(obj); const idle = gltf.animations[0] ? mixer.clipAction(gltf.animations[0]) : null; if (idle) idle.play();
      rigs[n] = { obj: g, root: obj, mixer: mixer, actions: { idle: idle }, current: idle, clips: {} };
      if (base(A.stage) === n) showModel(A.stage);
    }, undefined, function() { rigs[n] = 'missing'; loadModel(st, n); }); // no rigged file for this form: its static model, if any
  }
  function playClip(name, seconds) {
    const R = rigs[base(A.stage)]; if (!R || typeof R === 'string') return false;
    if (!R.actions[name]) {
      if (R.clips[name] === undefined) { R.clips[name] = 'loading'; loader().load(rigUrl(base(A.stage), name), function(gltf) { const clip = gltf.animations[0]; if (!clip) { R.clips[name] = 'missing'; return; } R.clips[name] = clip; R.actions[name] = R.mixer.clipAction(clip, R.root); if (A.clipWanted === name) playClip(name, seconds); }, undefined, function() { R.clips[name] = 'missing'; }); }
      A.clipWanted = name; return R.clips[name] !== 'missing';
    }
    const next = R.actions[name]; if (R.current === next) return true;
    next.reset(); next.setLoop(T.LoopRepeat, Infinity); next.fadeIn(0.25).play(); if (R.current) R.current.fadeOut(0.25); R.current = next;
    clearTimeout(A.clipTimer); A.clipTimer = setTimeout(function() { if (R.current === next && R.actions.idle) { R.actions.idle.reset().fadeIn(0.3).play(); next.fadeOut(0.3); R.current = R.actions.idle; } }, (seconds || 3) * 1000);
    return true;
  }

  // One loader for every model of the page. The models are stored with Draco-compressed geometry (scripts/shrink-models.sh):
  // DRACOLoader fetches its decoder from Google's CDN on first use. Without DRACOLoader a compressed model fails to load
  // and the procedural fallback stays.
  let gltfLoader = null;
  function loader() {
    if (!gltfLoader) { gltfLoader = new T.GLTFLoader(); if (T.DRACOLoader) gltfLoader.setDRACOLoader(new T.DRACOLoader().setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/')); }
    return gltfLoader;
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
  function hop(power) { if (A.usingRig && (power || 1) >= 0.8 && playClip('jump', 1.4)) return; if (A.grounded) { A.vy = 4.2 * (power || 1); A.grounded = false; } }
  function wander() { const a = Math.random() * Math.PI * 2, r = 0.2 + Math.random() * 0.6; A.tx = A.hx + Math.cos(a) * r; A.tz = A.hz + Math.sin(a) * r; act('wander', 3); }
  function spin() { if (!(A.usingRig && playClip('jump', 1.6))) { A.spinT += Math.PI * 2; hop(0.8); } act('spin', 1.2); }
  function dance(sec) { if (A.usingRig) playClip('dance', sec || 4); act('dance', sec || 4); }
  function sing(sec) { if (A.usingRig) playClip('cheer', sec || 3.5); act('sing', sec || 3.5); }
  function beg(sec) { A.tx = A.hx; A.tz = A.hz + 0.3; act('beg', sec || 4); }
  function yawn() { act('yawn', 2.2); }
  function wave(sec) { if (A.usingRig) playClip('wave', sec || 2.5); act('wave', sec || 2.5); }
  function nom(sec) { act('nom', sec || 2); }
  function shiver(sec) { act('shiver', sec || 1.2); }
  function bow() { act('bow', 1.6); }
  function play() { A.tx = A.hx + (Math.random() - .5) * 1.2; A.tz = A.hz + (Math.random() - .5) * 0.8; act('play', 3.5); }
  // ── the two places: the nest at night (camera in front) and the daylight city (3/4 camera that follows the walk) ──
  function setView(v) {
    const home = v !== 'city'; A.view = home ? 'home' : 'city'; A.path = null; A.act = null; A.yaw = 0;
    A.hx = A.hz = A.tx = A.tz = 0; root.position.set(0, 0, 0); camTarget.set(0, 1.5, 0);
    nest.visible = home; if (nestModel) nestModel.visible = home; if (parts.backdrop) parts.backdrop.visible = home;
    [stars, bokeh, parts.bokehMid, parts.bokehNear, fireflies].forEach(function(o) { if (o) o.visible = home; });
    skyMat.uniforms.uDay.value = home ? 0 : 1; scene.fog.color.set(home ? 0x06041a : 0xe3d0ee); if (!home) scene.fog.color.convertSRGBToLinear(); scene.fog.density = home ? 0.015 : 0.012;
    parts.hemi.color.set(home ? 0x9fb8ff : 0xffffff); parts.hemi.groundColor.set(home ? 0x2a1a3a : 0x9a86c4); parts.hemi.intensity = 0.45;
    parts.key.color.set(home ? 0xfff4e6 : 0xffdcc0); parts.key.intensity = home ? 0.85 : 0.6; if (home) parts.key.position.set(3, 6, 5); else parts.key.position.set(-6, 5, 5); // a low, warm sun
    parts.accent.visible = home;
    if (parts.bloom) parts.bloom.strength = home ? 0.5 : 0.16;
    if (vignettePass) { vignettePass.uniforms.lift.value = home ? 0 : 1; vignettePass.uniforms.darkness.value = home ? 0.45 : 0.3; }
    applyRoom();
  }
  // ROOM: what the player chose for the nest (pet.js decides what is unlocked and keeps it). A light tints the night sky and
  // the lamps; decorations are textured models the city already uses, floating beside the nest. Only shown at home.
  const LIGHTS = { night: { tint: [1, 1, 1], hemi: 0x9fb8ff, key: 0xfff4e6, fog: 0x06041a }, dawn: { tint: [3.2, 1.8, 1.1], hemi: 0xffc2d4, key: 0xffd2b0, fog: 0x1c0a18 },
    aurora: { tint: [0.4, 4.5, 1.0], hemi: 0x9dffe0, key: 0xdcfff2, fog: 0x04161a }, dusk: { tint: [3.0, 2.8, 0.5], hemi: 0xffdc9a, key: 0xffe6b8, fog: 0x1a1206 } };
  const DECOR = { lanterns: {}, tree: { file: 'city-tree', h: 4.6, at: [-2.4, -1.3, -4.6], yaw: 0.5 }, fountain: { file: 'city-seed', h: 2.3, at: [2.4, -0.8, -4.2], yaw: -0.4 }, isle: { file: 'city-isle', h: 15, at: [5.5, -2, -36], yaw: -0.3 } };
  let room = { light: 'night', decor: [] }, decorGroup = null; const decor = {}, lanterns = [];
  function setRoom(r) { room = { light: r && LIGHTS[r.light] ? r.light : 'night', decor: ((r && r.decor) || []).filter(function(id) { return DECOR[id]; }) }; applyRoom(); }
  function applyRoom() {
    if (!skyMat) return;
    const home = A.view === 'home', L = LIGHTS[home ? room.light : 'night'];
    skyMat.uniforms.uTint.value.fromArray(L.tint);
    if (home) { parts.hemi.color.set(L.hemi); parts.key.color.set(L.key); scene.fog.color.set(L.fog); }
    if (!decorGroup) { decorGroup = new T.Group(); scene.add(decorGroup); }
    decorGroup.visible = home;
    Object.keys(DECOR).forEach(function(id) { const want = room.decor.indexOf(id) >= 0; if (want && home && !decor[id]) loadDecor(id); if (decor[id]) decor[id].visible = want; }); // a model is fetched the first time it is shown
  }
  function loadDecor(id) {
    const d = DECOR[id], g = decor[id] = new T.Group(); decorGroup.add(g);
    if (!d.file) { // lanterns: warm lights floating behind and beside the nest
      for (let i = 0; i < 7; i++) { const a = -1.9 + i * 0.633, r = 2.5 + (i % 3) * 0.5, s = new T.Sprite(new T.SpriteMaterial({ map: dot, color: i % 2 ? 0xffc27a : 0xffe2a8, transparent: true, opacity: 0.95, blending: T.AdditiveBlending, depthWrite: false }));
        s.position.set(Math.sin(a) * r, 0.9 + (i * 7 % 5) * 0.55, -Math.cos(a) * r - 0.6); s.scale.setScalar(0.7); s.userData.y = s.position.y; g.add(s); lanterns.push(s); }
      return;
    }
    loader().load('assets/models/' + d.file + '.glb', function(gltf) {
      const obj = gltf.scene; obj.traverse(function(o) { if (o.isMesh && o.material && o.material.map) { o.material.emissiveMap = o.material.map; o.material.emissive.set(0xffffff); o.material.emissiveIntensity = 0.3; } }); // lit by its own texture: the nest is a night scene
      const box = new T.Box3().setFromObject(obj), sc = d.h / Math.max(0.001, box.max.y - box.min.y); obj.scale.setScalar(sc); box.setFromObject(obj); const c = box.getCenter(new T.Vector3());
      obj.position.set(-c.x, -box.min.y, -c.z); g.position.set(d.at[0], d.at[1], d.at[2]); g.rotation.y = d.yaw; g.add(obj);
    }, undefined, function() {});
  }
  // walks through the points [{x, z}, …] at a steady pace, then calls done()
  function goTo(points, done) { A.path = points.slice(); A.onArrive = done || null; A.act = null; }
  function standAt(x, z) { A.path = null; A.hx = A.tx = x; A.hz = A.tz = z; root.position.x = x; root.position.z = z; camTarget.set(x, 1.5, z); }
  function ray(cx, cy) { const r = new T.Raycaster(); r.setFromCamera(new T.Vector2(cx / innerWidth * 2 - 1, 1 - cy / innerHeight * 2), camera); return r; }
  function talk(sec) { A.talk = Math.max(A.talk, sec || 2); }
  function lookAtCamera(sec) { A.lookCam = sec || 3; }
  function lookAround() { A.lookTarget.set((Math.random() - .5) * 1.6, (Math.random() - .5) * 0.8); if (A.usingRig && Math.random() < 0.4) playClip('look', 3); }

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
      const m = new T.Sprite(parts.sparkMat.clone()); m.scale.setScalar(0.14); if (color) m.material.color.set(color);
      m.position.set(root.position.x, 1.4 * A.growth, root.position.z);
      const v = randDir().multiplyScalar(1.5 + Math.random() * (spread || 3)); v.y = Math.abs(v.y) + 1;
      m.userData = { v: v, life: 1.4 + Math.random() * 1.2, age: 0 }; scene.add(m); sparks.push(m);
    }
  }
  function noteSpark() { const m = new T.Sprite(parts.sparkMat.clone()); m.scale.setScalar(0.14); m.material.color.set(Math.random() < 0.5 ? CYAN : PINK); m.position.set(root.position.x + 0.5, 2.2 * A.growth, root.position.z + 0.5); m.userData = { v: new T.Vector3(0.4 + Math.random() * 0.4, 1.6, 0.3), life: 1.6, age: 0 }; scene.add(m); sparks.push(m); }
  function punch(k) { camPunch = Math.max(camPunch, k || 0.6); if (vignettePass) vignettePass.uniforms.flash.value = Math.max(vignettePass.uniforms.flash.value, (k || 0.6) * 0.4); }

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
    A.squash = lerp(A.squash, 0, k * 0.8);
    const breath = Math.sin(t * 2.4 * A.breathRate) * 0.022 * A.breathRate;
    const sx = 1 + A.squash * 0.6 - (A.vy > 0 ? A.vy * 0.03 : 0) + breath * 0.5, sy = 1 - A.squash + (A.vy > 0 ? A.vy * 0.05 : 0) + breath;
    const g = A.growth * (0.6 + 0.4 * A.stageGrow);
    if (A.usingRig) { parts.rig.scale.set(g * (1 + breath * 0.3), g * (1 + breath * 0.5), g * (1 + breath * 0.3)); } else parts.rig.scale.set(sx * g, sy * g, sx * g);
    parts.rig.position.y = A.y;

    // position & facing
    const walking = !!(A.path && A.path.length);
    if (walking) { // steady walk along the path; the last point becomes where it stands
      const p = A.path[0], dx = p.x - root.position.x, dz = p.z - root.position.z, d = Math.hypot(dx, dz), step = WALK * dt;
      if (d <= step) { root.position.x = p.x; root.position.z = p.z; A.path.shift(); if (!A.path.length) { A.hx = A.tx = p.x; A.hz = A.tz = p.z; const f = A.onArrive; A.onArrive = null; if (f) f(); } }
      else { root.position.x += dx / d * step; root.position.z += dz / d * step; A.walkDir = Math.atan2(dx, dz); }
    } else { root.position.x = lerp(root.position.x, A.tx, k * 0.25); root.position.z = lerp(root.position.z, A.tz, k * 0.25); }
    A.spin = lerp(A.spin, A.spinT, 1 - Math.pow(0.0001, dt)); if (Math.abs(A.spinT - A.spin) < 0.02) A.spin = A.spinT;
    const faceDir = Math.atan2(A.tx - root.position.x, A.tz - root.position.z);
    const moving = walking || Math.hypot(A.tx - root.position.x, A.tz - root.position.z) > 0.08;
    const yawT = walking ? A.walkDir || 0 : (moving ? clamp(faceDir, -0.6, 0.6) : 0) * 0.35; // walking: face the way it goes; standing: face the camera
    A.yaw += (((yawT - A.yaw + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI) * Math.min(1, k * 1.5);
    parts.tilt.rotation.y = A.spin + A.yaw;
    parts.tilt.rotation.x = A.face + (A.asleep ? 0.22 : 0) + (A.fading ? 0.3 : 0) + (A.dance ? Math.sin(t * 6) * 0.08 : 0);
    parts.tilt.rotation.z = A.usingRig ? 0 : (A.dance ? Math.sin(t * 6) * 0.18 : (moving ? Math.sin(t * 10) * 0.05 : 0));
    if (A.usingRig) parts.tilt.rotation.x = A.face * 0.5 + (A.asleep ? 0.12 : 0);
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
    partScale(parts.collar, s >= 3, gk); parts.pendant.material.opacity = 0.7 + Math.sin(t * 4) * 0.2; parts.pendant.scale.setScalar(0.2 + Math.sin(t * 3) * 0.03);
    parts.wings.forEach(function(w, i) { const side = i === 0 ? -1 : 1; const tgt = s >= 4 ? (s >= 5 ? 1.25 : 1) : 0.001; w.scale.x = lerp(w.scale.x, side * tgt, gk); w.scale.y = lerp(w.scale.y, tgt, gk); w.scale.z = w.scale.y; w.rotation.y = side * (0.55 + Math.sin(t * (A.grounded ? 3 : 9)) * 0.4); w.rotation.z = side * -0.15 + Math.sin(t * 3) * 0.08; });
    partScale(parts.crystals, s >= 5, gk); partScale(parts.glyph, s >= 5, gk); parts.glyph.rotation.z = t;
    parts.feathers.forEach(function(w, i) { const side = i === 0 ? -1 : 1; const tgt = s >= 6 ? 1 : 0.001; w.scale.x = lerp(w.scale.x, side * tgt, gk); w.scale.y = lerp(w.scale.y, tgt, gk); w.scale.z = w.scale.y; w.rotation.y = side * (0.7 + Math.sin(t * 2.2) * 0.3); w.rotation.z = side * -0.1 + Math.sin(t * 2.2) * 0.1; });
    partScale(parts.crown, s >= 6, gk); parts.crown.rotation.y = t * 0.4; parts.crown.position.y = 2.55 + Math.sin(t * 2) * 0.03;
    partScale(parts.halo, s >= 7, gk); parts.halo.rotation.y = t * 0.8; parts.halo.children.forEach(function(o, i) { const a = i / 8 * Math.PI * 2 + t * 0.8; o.position.set(Math.cos(a) * 0.7, Math.sin(t * 2 + i) * 0.1, Math.sin(a) * 0.7); });
    parts.aura.material.opacity = lerp(parts.aura.material.opacity, s >= 6 ? 0.07 + (A.mood === 'ecstatic' ? 0.05 : 0) : 0, gk); parts.aura.scale.setScalar(1 + Math.sin(t * 1.6) * 0.04); parts.aura.material.color.setHSL((t * 0.05) % 1, 0.8, 0.75);
    parts.runes.children.forEach(function(r, i) { r.material.opacity = lerp(r.material.opacity, i < s ? 0.7 : 0, gk); r.position.y = r.userData.base + (i < s ? Math.sin(t * 1.5 + i) * 0.06 + 0.1 : 0); r.scale.setScalar(0.25 + (i < s ? Math.sin(t * 0.8 + i * 1.3) * 0.05 : 0)); });
    // egg: wobbles when warmed, cracks glow as hatching nears
    if (!A.usingModel) parts.egg.scale.setScalar(s === 0 ? 1 : Math.max(0.001, parts.egg.scale.x - dt * 1.5));
    if (!A.usingModel) partScale(parts.beast, s > 0, s > 0 ? gk * 0.6 : 1);
    parts.egg.rotation.z = s === 0 && (A.mood === 'ecstatic' || A.wobble) ? Math.sin(t * 20) * 0.08 : Math.sin(t * 1.5) * 0.02;
    parts.eggCracks.forEach(function(c, i) { c.visible = s === 0 && A.hatch > (i + 1) / 6; });
    parts.eggMark.material.opacity = 0.5 + Math.sin(t * 2) * 0.2 + A.hatch * 0.3; parts.eggMark.scale.setScalar(0.3 + Math.sin(t * 2) * 0.05 + A.hatch * 0.15);

    // colour, glow, fading
    const L = STAGE_LOOK[Math.min(7, s)], health = clamp((A.food + A.joy) / 200, 0, 1);
    const glow = A.fading ? 0.05 : A.asleep ? A.glow * 0.4 : A.glow * (0.6 + health * 0.8) * (A.mood === 'ecstatic' ? 1.5 : 1);
    parts.fur.color.lerp(new T.Color(A.fading ? 0x8d8a99 : L.col), k * 0.5);
    parts.fur.emissive.set(s >= 7 ? 0x3a2470 : s >= 5 ? 0xb9d8ff : 0xffd6ee); parts.fur.emissiveIntensity = lerp(parts.fur.emissiveIntensity, Math.min(0.35, glow * 0.22), k);
    parts.innerLight.intensity = lerp(parts.innerLight.intensity, Math.min(0.9, 0.2 + glow * 0.4), k); parts.innerLight.position.set(root.position.x, 1.4 * A.growth, root.position.z + 0.6);
    parts.innerLight.color.setHSL((t * 0.03) % 1, 0.7, 0.8);
    const moodHue = (t * 0.03) % 1;
    const fillInt = A.fading ? 0.3 : A.asleep ? 0.4 : A.mood === 'ecstatic' ? 1.4 : A.mood === 'happy' ? 1.1 : 0.9;
    const rimInt = A.fading ? 0.3 : A.asleep ? 0.5 : A.mood === 'ecstatic' ? 1.5 : A.mood === 'lonely' ? 0.6 : 1.0;
    parts.fill.intensity = lerp(parts.fill.intensity, fillInt, k * 0.3);
    parts.rim.intensity = lerp(parts.rim.intensity, rimInt, k * 0.3);
    if (A.mood === 'ecstatic') { parts.fill.color.setHSL((moodHue + 0.9) % 1, 0.8, 0.7); parts.rim.color.setHSL((moodHue + 0.55) % 1, 0.8, 0.7); }
    else { parts.fill.color.set(PINK); parts.rim.color.set(CYAN); }
    if (A.view === 'city') { parts.fill.position.set(root.position.x - 4.5, 3, root.position.z + 3.5); parts.rim.position.set(root.position.x + 4.5, 3.5, root.position.z - 3); } // the pastel rim lights follow the walk

    Object.keys(rigs).forEach(function(k) { if (rigs[k] && rigs[k].mixer && rigs[k].obj.visible) rigs[k].mixer.update(dt); });
    updateEnvironment(t, dt);
    // room
    const bp = bokeh.geometry.attributes.position; for (let bi = 0; bi < bp.count; bi++) { bp.setX(bi, bp.getX(bi) + Math.sin(t * 0.08 + bi * 0.4) * dt * 0.02); bp.setY(bi, bp.getY(bi) + Math.sin(t * 0.15 + bi) * dt * 0.04); } bp.needsUpdate = true;
    bokeh.material.opacity = 0.2 + Math.sin(t * 0.25) * 0.04;
    if (parts.bokehMid) { const mp = parts.bokehMid.geometry.attributes.position; for (let mi = 0; mi < mp.count; mi++) { mp.setX(mi, mp.getX(mi) + Math.sin(t * 0.12 + mi * 0.7) * dt * 0.05); mp.setY(mi, mp.getY(mi) + Math.sin(t * 0.2 + mi * 1.3) * dt * 0.06); } mp.needsUpdate = true; parts.bokehMid.material.opacity = 0.12 + Math.sin(t * 0.3 + 1.0) * 0.03; }
    if (parts.bokehNear) { const np = parts.bokehNear.geometry.attributes.position; for (let ni = 0; ni < np.count; ni++) { np.setX(ni, np.getX(ni) + Math.sin(t * 0.05 + ni * 1.2) * dt * 0.01); np.setY(ni, np.getY(ni) + Math.sin(t * 0.1 + ni * 0.5) * dt * 0.015); } np.needsUpdate = true; parts.bokehNear.material.opacity = 0.03 + Math.sin(t * 0.15) * 0.015; parts.bokehNear.material.size = 4.0 + Math.sin(t * 0.2) * 0.6; }
    if (stars && parts.starBright) { const sc = stars.geometry.attributes.color; for (let si = 0; si < sc.count; si++) { const b = parts.starBright[si] * (0.6 + 0.4 * Math.sin(t * parts.starSpeeds[si] + starPhases[si])); sc.setXYZ(si, b, b, b * 0.95); } sc.needsUpdate = true; }
    if (parts.accent) { const aa = t * 0.13; parts.accent.position.set(Math.sin(aa) * 6, 3.5 + Math.sin(t * 0.3) * 0.5, Math.cos(aa) * 6); }
    const fp = fireflies.geometry.attributes.position;
    for (let fi = 0; fi < fp.count; fi++) { const v = fireflyVel[fi]; v.x += Math.sin(t * 0.7 + fi * 2.3) * dt * 0.08; v.y += Math.sin(t * 0.5 + fi * 1.7) * dt * 0.04; v.z += Math.sin(t * 0.6 + fi * 3.1) * dt * 0.08; v.clampLength(0, 0.15); let x = fp.getX(fi) + v.x * dt, y = fp.getY(fi) + v.y * dt, z = fp.getZ(fi) + v.z * dt; if (Math.abs(x) > 5) v.x *= -1; if (y < 0.3 || y > 4.2) v.y *= -1; if (Math.abs(z) > 5) v.z *= -1; fp.setXYZ(fi, x, y, z); }
    fp.needsUpdate = true; fireflies.material.opacity = 0.35 + Math.sin(t * 0.8) * 0.12 + (A.mood === 'ecstatic' ? 0.15 : 0); fireflies.material.size = 0.1 + Math.sin(t * 0.6) * 0.03;

    // hearts & sparks
    for (let i = hearts.length - 1; i >= 0; i--) { const h = hearts[i], u = h.userData; u.age += dt; u.vy *= 0.997; h.position.y += u.vy * dt; h.position.x += Math.sin(u.age * 1.8 + i) * dt * 0.18; h.position.z += Math.cos(u.age * 2.1 + i * 0.7) * dt * 0.1; h.rotation.y += u.spin * dt * 0.7; const life = u.age / u.life; const ease = life * life; h.scale.setScalar(u.s * Math.min(1, u.age * 4) * (1 - ease * 0.4)); h.material.opacity = Math.pow(1 - life, 1.5); h.lookAt(camera.position); if (u.age >= u.life) { scene.remove(h); hearts.splice(i, 1); } }
    for (let i = sparks.length - 1; i >= 0; i--) { const sp = sparks[i], u = sp.userData; u.age += dt; u.v.y -= 2.5 * dt; u.v.multiplyScalar(0.995); sp.position.addScaledVector(u.v, dt); const life = u.age / u.life; sp.material.opacity = Math.pow(1 - life, 1.5); sp.scale.setScalar(0.14 * (1 - life * 0.5)); if (u.age >= u.life) { scene.remove(sp); sparks.splice(i, 1); } }

    // camera: in front, gentle sway, pulls back as it grows
    orbitAngle += dt * 0.06; camPunch = lerp(camPunch, 0, k * 0.8);
    if (vignettePass) { vignettePass.uniforms.flash.value = lerp(vignettePass.uniforms.flash.value, 0, k * 1.5); vignettePass.uniforms.time.value = t; }
    const portrait = innerHeight > innerWidth;
    const breathe = 1.0 + (Math.sin(t * 0.4) * 0.012 + Math.sin(t * 0.17) * 0.008) * CALM;
    const dist = ((portrait ? 5.8 : 4.0) + A.growth * (portrait ? 4.0 : 3.4)) * (1 - camPunch * 0.15) * breathe;
    camTarget.lerp(A.view === 'city' ? new T.Vector3(root.position.x, 2.7, root.position.z) : new T.Vector3(root.position.x * 0.5, (1.35 + (A.stage >= 6 ? 0.3 : 0)) * A.growth + (portrait ? 0.55 : 0.05), root.position.z * 0.5), k * 0.35);
    const sway = Math.sin(orbitAngle * 0.5) * 0.3 * CALM;
    const microX = (Math.sin(t * 7.3) * 0.004 + Math.sin(t * 11.1) * 0.002) * CALM;
    const microY = (Math.sin(t * 5.7) * 0.003 + Math.sin(t * 9.3) * 0.002) * CALM;
    camera.position.set(camTarget.x + Math.sin(sway) * dist + mouseX * 0.3 + microX, camTarget.y + 0.7 + A.growth * 0.35 + camPunch * 0.2 - mouseY * 0.15 + microY, camTarget.z + Math.cos(sway) * dist);
    if (A.view === 'city') { // 3/4 view from the south, fixed heading, following the creature
      const cd = ((portrait ? 14 : 10.5) + A.growth * 3.5) * (1 - camPunch * 0.1);
      camera.position.set(camTarget.x + mouseX * 0.5 * CALM, camTarget.y + cd * 0.3, camTarget.z + cd);
    }
    camera.lookAt(camTarget);
    if (composer) composer.render(); else renderer.render(scene, camera);
  }

  function headScreenPos() {
    const v = new T.Vector3(root.position.x, (A.usingModel ? 2.7 : 2.6 + (A.stage >= 6 ? 0.5 : 0)) * A.growth + A.y, root.position.z).project(camera);
    return { x: (v.x + 1) / 2 * innerWidth, y: (1 - v.y) / 2 * innerHeight, visible: v.z < 1 };
  }

  function attach(obj) { scene.add(obj); }
  function ready() { return !!scene; }
  function project(x, y, z) { const v = new T.Vector3(x, y, z).project(camera); return { x: (v.x + 1) / 2 * innerWidth, y: (1 - v.y) / 2 * innerHeight, visible: v.z < 1 }; }
  function cameraPos() { return camera.position; }
  window.Creature = { init, ready, attach, project, loader, setView, setRoom, goTo, standAt, ray, pos: function() { return root.position; }, models: models, rigs: rigs, playClip: playClip, usingModel: function() { return !!A.usingModel; }, cameraPos, dotTexture: function() { return dot; }, gradientWing, wingShape, plush, crystal, PINK, CYAN, setForms, setStage, setMood, setVitals, setHatchProgress, hop, wander, spin, dance, sing, beg, yawn, wave, nom, shiver, bow, play, talk, lookAtCamera, lookAround, burstHearts, burstSparks, punch, headScreenPos, anim: A };
})();
