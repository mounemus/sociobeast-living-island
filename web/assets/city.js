/**
 * SOCIOBEAST — City (the daylight plaza of the online game, "NeoCity" in the NEOLIFE brief)
 * Seed Plaza in the middle and five places around it: Pulse Tower north, Bloom Gallery north-east, Seed Market east,
 * Echo Garden south-west, Canopy Lounge west. The camera always looks north, from behind the creature. Everything is built from primitives in the Organic Future palette, on first entry.
 * The creature walks where the player taps (a place or the ground); each place also carries a real button above it, so the
 * city works with a keyboard. This file knows the space; what a place gives belongs to pet.js.
 * window.City = { enter(onArrive, walkable, opts), leave(), goTo(id), active() } · onArrive(id) fires at a place, onArrive(null) when it sets off.
 */
(function() {
  'use strict';
  const T = THREE;
  const $ = function(id) { return document.getElementById(id); };
  const CALM = matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 1;
  // x, z: centre of the place · door: where the creature stands · top: label height · r: radius of its tap target
  const PLACES = [
    { id: 'seed',   label: 'Seed Plaza',    x: 0,     z: 0,    door: [0, 5.8],     top: 6.4,  r: 3.6 },
    { id: 'pulse',  label: 'Pulse Tower',   x: 0,     z: -15,  door: [0, -10.4],   top: 14,   r: 3.2 },
    { id: 'bloom',  label: 'Bloom Gallery', x: 11.5,  z: -10,  door: [7.9, -6.4],  top: 5.6,  r: 4.4 },
    { id: 'market', label: 'Seed Market',   x: 15.5,  z: 2,    door: [10.6, 2.1],  top: 4.6,  r: 4.2 },
    { id: 'echo',   label: 'Echo Garden',   x: -10,   z: 10.5, door: [-7.4, 7.6],  top: 3.4,  r: 4 },   // south-west: the south stays open for the camera
    { id: 'canopy', label: 'Canopy Lounge', x: -15.5, z: 2,    door: [-10.6, 2.1], top: 7,    r: 4.4 }
  ];
  const WALK_R = 12.6, CORE_R = 4.7; // the walkable ring: inside the buildings, outside the fountain
  const GROUND = new T.Plane(new T.Vector3(0, 1, 0), 0);
  let group = null, on = false, cb = null, canWalk = null, hits = [], marker, anim = [], M = {};
  const groups = {}; // place id → its group, facing the plaza
  let seedRand = 7; function rnd() { seedRand = (seedRand * 16807) % 2147483647; return seedRand / 2147483647; } // same city on every visit

  // ─────────────────────────────────────────────────────────────
  // BUILD
  // ─────────────────────────────────────────────────────────────
  function col(hex) { return new T.Color(hex).convertSRGBToLinear(); } // the palette is given as screen colours
  function std(hex, o) { return new T.MeshStandardMaterial(Object.assign({ color: col(hex), roughness: 0.6 }, o || {})); }
  function glow(hex, k) { return std(hex, { emissive: col(hex), emissiveIntensity: k || 0.6, roughness: 0.3 }); }
  function sph(r) { return new T.SphereGeometry(r, 20, 14); }
  function dome(r) { return new T.SphereGeometry(r, 24, 10, 0, Math.PI * 2, 0, Math.PI / 2); }
  function cyl(rt, rb, h, seg) { return new T.CylinderGeometry(rt, rb, h, seg || 20); }
  function add(g, geo, mat, x, y, z, sx, sy, sz) { const m = new T.Mesh(geo, mat); m.position.set(x || 0, y || 0, z || 0); m.scale.set(sx || 1, sy || sx || 1, sz || sx || 1); g.add(m); return m; }
  function flat(g, geo, mat, y) { const m = new T.Mesh(geo, mat); m.rotation.x = -Math.PI / 2; m.position.y = y; g.add(m); return m; }
  function placeGroup(id) { const p = PLACES.filter(function(q) { return q.id === id; })[0], g = new T.Group(); g.position.set(p.x, 0, p.z); g.rotation.y = Math.atan2(-p.x, -p.z); group.add(g); groups[id] = g; return g; } // its front (+z) faces the plaza

  function build() {
    group = new T.Group();
    M = { pearl: std(0xf7efe6, { roughness: 0.4 }), haze: std(0xe6dcf7, { roughness: 0.5 }), jade: std(0x7cc9a4, { roughness: 0.9 }), moss: std(0x5fae84, { roughness: 1 }),
      glass: std(0x9ee7e8, { roughness: 0.08, metalness: 0.1, transparent: true, opacity: 0.74, emissive: col(0x6fdbd7), emissiveIntensity: 0.22 }),
      water: std(0x8fe3df, { roughness: 0.12, metalness: 0.25, emissive: col(0x6fdbd7), emissiveIntensity: 0.16 }),
      lilac: glow(0xc6a5f3, 0.55), aqua: glow(0x6fdbd7, 0.5), coral: std(0xffa6a3), pink: std(0xf9c0d7, { roughness: 0.85 }), cream: std(0xf7e9d9, { roughness: 0.7 }) };
    ground(); fountain(); pulse(); bloom(); market(); echo(); canopy(); trees(); skyline();
    loadModel('bloom', 10.5); loadModel('pulse', 8.5); loadModel('market', 10.5); loadModel('canopy', 10.5);
    loadModel('echo', 9, true); loadModel('seed', 7.6, true); // these two can stand between the camera and the creature: they fade
    spray();
    PLACES.forEach(function(p) { // tap targets and name buttons
      const h = add(group, cyl(p.r, p.r, p.top, 12), new T.MeshBasicMaterial({ visible: false }), p.x, p.top / 2, p.z); h.userData.id = p.id; hits.push(h);
      const b = document.createElement('button'); b.type = 'button'; b.className = 'place'; b.textContent = p.label; b.addEventListener('click', function() { goTo(p.id); }); $('places').appendChild(b); p.el = b;
    });
    marker = flat(group, new T.RingGeometry(0.45, 0.6, 28), new T.MeshBasicMaterial({ color: col(0xc6a5f3), transparent: true, opacity: 0.9 }), 0.03); marker.visible = false;
    $('scene').addEventListener('click', tap);
    Creature.attach(group);
  }
  // Optional textured building of a place: assets/models/city-<id>.glb, made from a concept image like the creatures
  // (assets/art/city-<id>.png → image_to_3d). When the file exists it replaces that place's primitives; a missing file keeps them.
  // width: its footprint in the plaza's units · fade: it turns transparent when the camera comes close (see fountain()).
  function loadModel(id, width, fade) {
    if (!T.GLTFLoader) return;
    Creature.loader().load('assets/models/city-' + id + '.glb', function(gltf) {
      const obj = gltf.scene, g = groups[id], p = PLACES.filter(function(q) { return q.id === id; })[0], box = new T.Box3().setFromObject(obj), size = box.getSize(new T.Vector3());
      obj.scale.setScalar(width / Math.max(size.x, size.z)); box.setFromObject(obj);
      const c = box.getCenter(new T.Vector3()); obj.position.set(-c.x, -box.min.y, -c.z);
      g.children.forEach(function(ch) { ch.visible = false; }); g.userData.model = true; g.add(obj);
      p.top = box.max.y - box.min.y + 0.4; // the name sits just above the roof
      if (fade) { const mats = []; obj.traverse(function(o) { if (o.isMesh) { o.material.transparent = true; mats.push(o.material); } });
        anim.push(function() { const cam = Creature.cameraPos(), k = Math.max(0, Math.min(1, (Math.hypot(cam.x - p.x, cam.z - p.z) - 7) / 4)); obj.visible = k > 0.02; mats.forEach(function(m) { m.opacity = k; }); }); }
    }, undefined, function() {});
  }
  // Painted on canvases, so nothing to download: the plaza's paving and the lagoon's ripples. Colours are screen colours (sRGB textures).
  function paint(n, draw) { const c = document.createElement('canvas'); c.width = c.height = n; draw(c.getContext('2d'), n); const t = new T.CanvasTexture(c); t.encoding = T.sRGBEncoding; t.anisotropy = 8; return t; }
  function pavement() { // rings of pastel pavers, a band of petals, a lighter path to each door, fallen blossom towards the trees
    return paint(LOW ? 1024 : 2048, function(g, n) {
      let s = 11; const rand = function() { s = (s * 16807) % 2147483647; return s / 2147483647; }, R = 19.6, u = n / (R * 2), TAU = Math.PI * 2;
      g.fillStyle = '#c9bbdd'; g.fillRect(0, 0, n, n);                                             // the joints
      g.setTransform(0, -u, u, 0, n / 2, n / 2);                                                  // from here on we draw in plaza units (x, z): this is how the cylinder's top cap is mapped
      const tints = ['#e9dff3', '#e1d5ee', '#ecdfe9', '#ddd2ec', '#e6ddf2'];
      for (let r0 = 0, ring = 0; r0 < R; ring++) { const r1 = r0 + 0.95 + (ring % 3) * 0.12, count = Math.max(6, Math.round((r0 + r1) * Math.PI / 1.5)), off = rand() * TAU, gap = 0.035, ri = Math.max(0.05, r0 + gap), ro = r1 - gap;
        for (let i = 0; i < count; i++) { const a0 = off + i / count * TAU, a1 = off + (i + 1) / count * TAU;
          g.beginPath(); g.arc(0, 0, ro, a0 + gap / ro, a1 - gap / ro); g.arc(0, 0, ri, a1 - gap / ri, a0 + gap / ri, true); g.closePath(); g.fillStyle = tints[Math.floor(rand() * tints.length)]; g.fill(); }
        r0 = r1; }
      for (let i = 0; i < 28; i++) { g.save(); g.rotate(i / 28 * TAU); g.globalAlpha = 0.75; g.fillStyle = i % 2 ? '#f6e3d6' : '#f5c3d8'; g.beginPath(); g.ellipse(9.6, 0, 0.9, 0.34, 0, 0, TAU); g.fill(); g.restore(); } // petals inlaid between the two light lines
      g.lineCap = 'round'; g.lineWidth = 1.5; g.strokeStyle = 'rgba(250,244,236,.45)';
      PLACES.slice(1).forEach(function(p) { const d = Math.hypot(p.door[0], p.door[1]); g.beginPath(); g.moveTo(p.door[0] / d * 4.4, p.door[1] / d * 4.4); g.lineTo(p.door[0], p.door[1]); g.stroke(); });
      for (let i = 0; i < 420; i++) { const a = rand() * TAU, r = 11 + Math.sqrt(rand()) * 8.4; g.save(); g.translate(Math.cos(a) * r, Math.sin(a) * r); g.rotate(rand() * TAU); g.globalAlpha = 0.5 + rand() * 0.4; g.fillStyle = rand() < 0.5 ? '#f7b9d2' : '#fbd9e6'; g.beginPath(); g.ellipse(0, 0, 0.1, 0.055, 0, 0, TAU); g.fill(); g.restore(); }
      const shade = g.createRadialGradient(0, 0, 4, 0, 0, R); shade.addColorStop(0, 'rgba(255,250,246,.16)'); shade.addColorStop(0.6, 'rgba(255,250,246,0)'); shade.addColorStop(1, 'rgba(150,128,190,.2)'); // lighter at the heart, deeper at the rim
      g.globalAlpha = 1; g.fillStyle = shade; g.beginPath(); g.arc(0, 0, R + 1, 0, TAU); g.fill();
    });
  }
  function ripples() { // a tile of soft light and dark streaks; two copies slide across each other on the lagoon
    return paint(256, function(g, n) {
      let s = 5; const rand = function() { s = (s * 16807) % 2147483647; return s / 2147483647; };
      g.fillStyle = '#8fe3df'; g.fillRect(0, 0, n, n);
      for (let i = 0; i < 46; i++) { const x = rand() * n, y = rand() * n, w = 18 + rand() * 40, h = 2.5 + rand() * 4; g.fillStyle = i % 3 ? '#dffcf8' : '#63c9cf';
        for (let k = 0; k < 3; k++) { g.globalAlpha = 0.14; for (let ox = -1; ox <= 1; ox++) for (let oy = -1; oy <= 1; oy++) { g.beginPath(); g.ellipse(x + ox * n, y + oy * n, w * (1 - k * 0.28), h * (1 - k * 0.28), 0, 0, Math.PI * 2); g.fill(); } } } // drawn nine times: it tiles
    });
  }
  function lagoon() {
    const a = ripples(), b = ripples(); a.wrapS = a.wrapT = b.wrapS = b.wrapT = T.RepeatWrapping; a.repeat.set(13, 13); b.repeat.set(7.3, 7.3); b.rotation = 0.7;
    flat(group, new T.CircleGeometry(120, 48), new T.MeshStandardMaterial({ map: a, roughness: 0.12, metalness: 0.25, emissive: col(0x6fdbd7), emissiveIntensity: 0.16 }), -0.4);
    flat(group, new T.CircleGeometry(120, 48), new T.MeshBasicMaterial({ map: b, transparent: true, opacity: 0.32, depthWrite: false }), -0.39);
    const foam = paint(256, function(g, n) { const f = g.createRadialGradient(n / 2, n / 2, n * 0.4, n / 2, n / 2, n / 2); f.addColorStop(0, 'rgba(255,255,255,0)'); f.addColorStop(0.2, 'rgba(255,255,255,.85)'); f.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = f; g.fillRect(0, 0, n, n); });
    const surf = flat(group, new T.CircleGeometry(24.5, 64), new T.MeshBasicMaterial({ map: foam, transparent: true, opacity: 0.5, depthWrite: false }), -0.38); // foam where the lagoon meets the plaza
    anim.push(function(t) { a.offset.set(t * 0.011, t * 0.006); b.offset.set(-t * 0.008, t * 0.01); surf.material.opacity = 0.42 + Math.sin(t * 0.8) * 0.14; surf.scale.setScalar(1 + Math.sin(t * 0.8) * 0.006); });
  }
  // The textured fountain's water moves: droplets leap from under the lotus into the basin and rings spread where they land.
  // Heights measured on city-seed.glb at its 7.6 width: water at 1.47, the jets leave near y 3 at radius 1.2. Like the model, it fades near the camera.
  function spray() {
    const n = LOW ? 36 : 84, pos = new Float32Array(n * 3), geo = new T.BufferGeometry(); geo.setAttribute('position', new T.BufferAttribute(pos, 3));
    const mat = new T.PointsMaterial({ map: Creature.dotTexture(), size: 0.3, transparent: true, depthWrite: false, toneMapped: false }), pts = new T.Points(geo, mat); pts.frustumCulled = false; pts.visible = false; group.add(pts);
    pts.renderOrder = 2; // after the fountain: its model is transparent too (it fades), and drawn later it would paint over the droplets
    const rings = [0, 1, 2, 3, 4].map(function() { const r = flat(group, new T.RingGeometry(0.82, 1, 24), new T.MeshBasicMaterial({ transparent: true, depthWrite: false, toneMapped: false }), 1.5); r.visible = false; r.renderOrder = 2; return r; });
    anim.push(function(t) {
      const cam = Creature.cameraPos(), k = Math.max(0, Math.min(1, (Math.hypot(cam.x, cam.z) - 7) / 4)), show = !!groups.seed.userData.model && k > 0.02;
      pts.visible = show; rings.forEach(function(r) { r.visible = show; }); if (!show) return;
      for (let i = 0; i < n; i++) { const a = i * 2.399963, s = (t * 0.55 + i * 0.618034) % 1, r = 1.2 + s * 1.45; pos[i * 3] = Math.cos(a) * r; pos[i * 3 + 1] = 3 + 1.6 * s - 3.1 * s * s; pos[i * 3 + 2] = Math.sin(a) * r; } // one small arc each, all round the lotus
      geo.attributes.position.needsUpdate = true; mat.opacity = 0.85 * k;
      rings.forEach(function(r, i) { const u = t * 0.5 + i * 0.2, s = u % 1, a = i * 2.399963 + Math.floor(u) * 1.7; r.position.set(Math.cos(a) * 2.6, 1.5, Math.sin(a) * 2.6); r.scale.setScalar(0.1 + s * 0.5); r.material.opacity = (1 - s) * 0.6 * k; });
    });
  }
  function ground() {
    lagoon();
    const side = std(0xe4d8f0, { roughness: 0.55 });                                              // the plaza: paving on top, plain sides
    add(group, cyl(19.6, 20.6, 0.6, 64), [side, new T.MeshStandardMaterial({ map: pavement(), roughness: 0.6 }), side], 0, -0.3, 0);
    flat(group, new T.RingGeometry(17.4, 19.6, 64), M.jade, 0.012);                               // planted rim
    flat(group, new T.RingGeometry(12.5, 12.8, 64), M.lilac, 0.014); flat(group, new T.RingGeometry(6.6, 6.8, 64), M.aqua, 0.014); // inlaid light lines
    PLACES.slice(1).forEach(function(p) { const m = flat(group, new T.CircleGeometry(1.5, 28), M.pearl, 0.016); m.position.set(p.door[0], 0.016, p.door[1]); }); // a doorstep in front of each place
  }
  function fountain() { // the seed: a bud of opal resin over a round basin
    const g = groups.seed = new T.Group(); group.add(g);
    add(g, cyl(3.4, 3.7, 0.6, 40), M.pearl, 0, 0.3, 0); add(g, cyl(3.05, 3.05, 0.1, 40), M.water, 0, 0.62, 0); add(g, cyl(0.35, 0.7, 1.7), M.pearl, 0, 1.45, 0);
    // the bud has its own materials: it fades out when the camera comes close, so it never hides a creature standing north of it
    const top = new T.Group(); g.add(top); const own = [M.pink.clone(), M.glass.clone(), M.lilac.clone()], full = own.map(function(m) { m.transparent = true; return m.opacity; });
    for (let i = 0; i < 6; i++) { const a = new T.Group(); a.rotation.y = i / 6 * Math.PI * 2; top.add(a); const p = add(a, sph(1), own[i % 2], 0, 2.35, 1.35, 0.8, 0.2, 1.5); p.rotation.x = -0.55; }
    const seed = add(top, sph(1.1), own[2], 0, 3.7, 0, 1, 1.45, 1);
    const halo = new T.Sprite(new T.SpriteMaterial({ map: Creature.dotTexture(), color: col(0xc6a5f3), transparent: true, opacity: 0.4, depthWrite: false })); halo.scale.setScalar(6.5); halo.position.y = 3.7; top.add(halo);
    anim.push(function(t) {
      if (g.userData.model) return; // the textured fountain took over
      const cam = Creature.cameraPos(), k = Math.max(0, Math.min(1, (Math.hypot(cam.x, cam.z) - 7) / 4));
      top.visible = k > 0.02; own.forEach(function(m, i) { m.opacity = full[i] * k; });
      seed.position.y = 3.7 + Math.sin(t * 1.2) * 0.14; seed.rotation.y = t * 0.3; halo.material.opacity = (0.34 + Math.sin(t * 1.2) * 0.08) * k;
    });
  }
  function pulse() { // a pearl tower wrapped in rings of light, a glass dome on top
    const g = placeGroup('pulse');
    add(g, cyl(3.1, 3.4, 0.4, 32), M.haze, 0, 0.2, 0); add(g, cyl(1.5, 2.2, 10, 28), M.pearl, 0, 5, 0);
    [[3, 2.75, 0.2], [5.6, 2.45, -0.24], [8.2, 2.15, 0.2]].forEach(function(r) { const m = add(g, new T.TorusGeometry(r[1], 0.16, 10, 40), M.lilac, 0, r[0], 0); m.rotation.set(Math.PI / 2 + r[2], 0, r[2]); });
    add(g, sph(1.85), M.glass, 0, 10.5, 0, 1, 1.2, 1); add(g, cyl(0.06, 0.06, 1.6, 6), M.pearl, 0, 13, 0);
    const orb = add(g, sph(0.3), M.aqua, 0, 13.9, 0); anim.push(function(t) { orb.scale.setScalar(1 + Math.sin(t * 3) * 0.18); });
    const screen = add(g, cyl(1.45, 1.45, 0.14, 32), M.glass, 0, 4.7, 1.92); screen.rotation.x = Math.PI / 2;
    add(g, new T.CircleGeometry(0.7, 3), M.lilac, 0.12, 4.7, 2.02);                               // the "play" sign
    add(g, sph(0.95), M.glass, 0, 0.9, 2.05, 1, 1.5, 0.3);                                        // door
  }
  function bloom() { // a low pearl shell with a glass mouth and blossom on the roof
    const g = placeGroup('bloom');
    add(g, dome(4.2), M.pearl, 0, 0, 0, 1.15, 0.8, 0.9); add(g, dome(2.5), M.haze, -4.4, 0, 0.6, 1, 0.8, 0.9);
    add(g, sph(2.3), M.glass, 0, 0.5, 3.1, 1, 1, 0.45);
    [[0, 3.5, 0, 1.3], [1.5, 3.1, 0.7, 1], [-1.6, 3.0, 0.5, 1.05], [0.4, 3.0, -1.4, 0.95], [-4.4, 2.2, 0.6, 0.8]].forEach(function(b, i) { add(g, sph(b[3]), i % 2 ? M.cream : M.pink, b[0], b[1], b[2], 1, 0.75, 1); });
    [-2.6, 2.6].forEach(function(x) { add(g, sph(0.34), M.lilac, x, 1.3, 3.9); add(g, cyl(0.07, 0.1, 1.2, 8), M.pearl, x, 0.6, 3.9); });
  }
  function market() { // three petal canopies over round stalls
    const g = placeGroup('market');
    [[-2.7, M.coral], [0, M.cream], [2.7, M.pink]].forEach(function(s, i) {
      add(g, cyl(0.12, 0.17, 2.7, 8), M.pearl, s[0], 1.35, 0); add(g, dome(1.6), s[1], s[0], 2.5, 0, 1, 0.55, 1);
      add(g, cyl(1.0, 1.1, 0.9, 20), M.haze, s[0], 0.45, 1.3, 1, 1, 0.7);
      [M.jade, M.lilac, M.aqua].forEach(function(m, j) { add(g, sph(0.2), m, s[0] + (j - 1) * 0.5, 1.08, 1.3 + (j % 2) * 0.15); });
      add(g, sph(0.16), M.lilac, s[0], 2.2, 0.9);
    });
  }
  function echo() { // a pond with lily pads, moss mounds and glowing shoots; kept low because it lies on the camera's side of the plaza
    const g = placeGroup('echo');
    add(g, cyl(2.9, 3.1, 0.24, 36), M.pearl, 0, 0.12, -0.6); add(g, cyl(2.6, 2.6, 0.06, 36), M.water, 0, 0.26, -0.6);
    for (let i = 0; i < 6; i++) { const a = i * 1.05 + 0.4, r = 0.7 + (i % 3) * 0.6; add(g, cyl(0.36, 0.36, 0.04, 14), M.jade, Math.cos(a) * r, 0.31, -0.6 + Math.sin(a) * r); if (i % 2) add(g, sph(0.13), M.pink, Math.cos(a) * r, 0.42, -0.6 + Math.sin(a) * r); }
    [[-4.2, -0.4, 1.7], [4.2, -0.8, 1.9], [-3.1, -3.0, 1.3], [3.0, -3.2, 1.4]].forEach(function(m, i) { add(g, sph(m[2]), i % 2 ? M.moss : M.jade, m[0], 0, m[1], 1, 0.5, 1); });
    for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2 + 0.3; const c = add(g, new T.ConeGeometry(0.13, 0.9, 8), i % 2 ? M.aqua : M.lilac, Math.cos(a) * 3.5, 0.45, -0.6 + Math.sin(a) * 3.3); c.rotation.z = Math.cos(a) * 0.2; }
    [-2.7, 2.7].forEach(function(x) { add(g, cyl(0.13, 0.2, 0.9, 8), M.pearl, x, 0.45, 2.4); add(g, sph(0.3), M.glass, x, 1.1, 2.4); }); // low lanterns: a tall gate would stand in front of the creature
  }
  function canopy() { // three big leaves on white stems, cocoon seats underneath
    const g = placeGroup('canopy');
    [[-1.9, 0, 4.8, 0.16], [1.7, -0.7, 5.9, -0.14], [0.1, 1.5, 3.9, 0.1]].forEach(function(l, i) {
      add(g, cyl(0.2, 0.38, l[2], 10), M.pearl, l[0], l[2] / 2, l[1]);
      const leaf = add(g, sph(2.7), i === 1 ? M.moss : M.jade, l[0], l[2], l[1], 1, 0.13, 0.8); leaf.rotation.z = l[3]; leaf.rotation.y = i * 1.1;
      add(g, sph(0.2), M.lilac, l[0] + 0.5, l[2] - 0.7, l[1] + 0.4);
    });
    [[-1.7, 2.9, M.cream], [1.6, 2.7, M.pink], [-0.2, 3.6, M.haze], [2.9, 1.2, M.cream]].forEach(function(s) { add(g, sph(0.72), s[2], s[0], 0.45, s[1], 1, 0.72, 1); });
    add(g, cyl(0.7, 0.75, 0.36, 20), M.pearl, 0.1, 0.18, 2.5);
  }
  function trees() { // blossom trees around the rim and a grove to the north-west (instanced: two draw calls)
    const spots = [];
    for (let i = 0; i < 26; i++) { const a = i / 26 * Math.PI * 2 + 0.12, near = PLACES.some(function(p) { return p.id !== 'seed' && Math.abs(Math.atan2(Math.sin(a - Math.atan2(p.z, p.x)), Math.cos(a - Math.atan2(p.z, p.x)))) < 0.4; }); if (!near && Math.sin(a) < 0.55) spots.push([Math.cos(a) * 18.3, Math.sin(a) * 18.3]); }
    [[-11.5, -10], [-9.4, -12.4], [-13.6, -8.2], [-12.6, -12]].forEach(function(s) { spots.push(s); });
    const trunks = new T.InstancedMesh(cyl(0.16, 0.3, 1, 8), M.pearl, spots.length), blobs = new T.InstancedMesh(sph(1), std(0xffffff, { roughness: 0.85 }), spots.length * 3), o = new T.Object3D();
    const tints = [col(0xf9c0d7), col(0xfbd3e2), col(0xf2b4d0)];
    spots.forEach(function(s, i) {
      const h = 2.4 + rnd() * 1.4; o.position.set(s[0], h / 2, s[1]); o.scale.set(1, h, 1); o.rotation.set(0, 0, 0); o.updateMatrix(); trunks.setMatrixAt(i, o.matrix);
      for (let j = 0; j < 3; j++) { const r = 1.0 + rnd() * 0.6; o.position.set(s[0] + (rnd() - 0.5) * 1.4, h + 0.4 + rnd() * 0.8, s[1] + (rnd() - 0.5) * 1.4); o.scale.set(r, r * 0.8, r); o.updateMatrix(); blobs.setMatrixAt(i * 3 + j, o.matrix); blobs.setColorAt(i * 3 + j, tints[(i + j) % 3]); }
    });
    trunks.frustumCulled = blobs.frustumCulled = false; group.add(trunks); group.add(blobs);
    scatter('city-tree', spots.filter(function(s, i) { return !LOW || i % 2 === 0; }).map(function(s, i) { return [s[0], 0, s[1], 4.6 + (i * 7 % 5) * 0.35, i * 2.4]; }), [trunks, blobs]);
  }
  function skyline() { // towers in the haze and two floating gardens, for depth
    const tower = cyl(0.55, 1, 1, 14), cap = sph(1), old = [], floats = [[-22, 15, -34, 4], [26, 19, -44, 5]];
    for (let i = 0; i < 13; i++) { const a = -Math.PI * (0.06 + i / 12 * 0.88) + (rnd() - 0.5) * 0.1, r = 44 + rnd() * 30, h = 12 + rnd() * 22, w = 1.6 + rnd() * 1.6;
      old.push(add(group, tower, i % 3 ? M.haze : M.pearl, Math.cos(a) * r, h / 2 - 0.4, Math.sin(a) * r, w, h, w), add(group, cap, i % 2 ? M.glass : M.lilac, Math.cos(a) * r, h - 0.2, Math.sin(a) * r, w * 0.75, w, w * 0.75)); }
    floats.forEach(function(f, i) { const g = new T.Group(); g.position.set(f[0], f[1], f[2]); group.add(g); old.push(g);
      add(g, sph(f[3]), M.moss, 0, 0, 0, 1, 0.3, 1); const c = add(g, new T.ConeGeometry(f[3] * 0.8, f[3] * 1.1, 12), M.haze, 0, -f[3] * 0.62, 0); c.rotation.x = Math.PI;
      add(g, dome(f[3] * 0.45), M.pearl, 0, f[3] * 0.2, 0); add(g, sph(f[3] * 0.3), M.pink, f[3] * 0.5, f[3] * 0.45, 0.4);
      anim.push(function(t) { g.position.y = f[1] + Math.sin(t * 0.4 + i * 2) * 0.5; }); });
    // the textured version is one model, an island of towers (assets/art/city-isle.png): the two gardens float, the others stand
    // in the lagoon with their rock under the water, facing the plaza
    const isles = floats.map(function(f, i) { return [f[0], f[1] - f[3] * 1.1, f[2], f[3] * 2.8, i ? -0.4 : 0.4]; }), n = LOW ? 4 : 7;
    for (let i = 0; i < n; i++) { const a = -Math.PI * (0.1 + i / (n - 1) * 0.8), r = 46 + (i * 5 % 3) * 9, h = 28 + (i * 3 % 4) * 5; isles.push([Math.cos(a) * r, -h * 0.34, Math.sin(a) * r, h, (i % 3 - 1) * 0.5]); }
    scatter('city-isle', isles, old, floats.length);
  }
  // One model repeated at many spots: an InstancedMesh per mesh of the file (a generated model is one mesh, so one draw call).
  // spots: [x, y, z, height, yaw] · old: the primitives it replaces, hidden once the file is there (a missing file keeps them)
  // bob: the first `bob` spots float up and down.
  function scatter(file, spots, old, bob) {
    if (!T.GLTFLoader) return;
    Creature.loader().load('assets/models/' + file + '.glb', function(gltf) {
      const obj = gltf.scene; obj.updateMatrixWorld(true);
      const box = new T.Box3().setFromObject(obj), c = box.getCenter(new T.Vector3()), k = 1 / Math.max(0.001, box.max.y - box.min.y);
      const norm = new T.Matrix4().makeScale(k, k, k).multiply(new T.Matrix4().makeTranslation(-c.x, -box.min.y, -c.z)); // 1 unit tall, standing on the origin
      const o = new T.Object3D(), ims = [];
      const put = function(im, i, dy) { const s = spots[i]; o.position.set(s[0], s[1] + dy, s[2]); o.rotation.set(0, s[4], 0); o.scale.setScalar(s[3]); o.updateMatrix(); im.setMatrixAt(i, o.matrix.multiply(norm).multiply(im.userData.local)); };
      obj.traverse(function(m) { if (!m.isMesh) return;
        const im = new T.InstancedMesh(m.geometry, m.material, spots.length); im.userData.local = m.matrixWorld.clone(); im.frustumCulled = false;
        for (let i = 0; i < spots.length; i++) put(im, i, 0); group.add(im); ims.push(im); });
      old.forEach(function(x) { x.visible = false; });
      if (bob && CALM) anim.push(function(t) { ims.forEach(function(im) { for (let i = 0; i < bob; i++) put(im, i, Math.sin(t * 0.4 + i * 2) * 0.5); im.instanceMatrix.needsUpdate = true; }); });
    }, undefined, function() {});
  }

  // ─────────────────────────────────────────────────────────────
  // WALK
  // ─────────────────────────────────────────────────────────────
  // a straight line to `to` (from the player's creature, or from `from`), with one side step when it would cross the fountain
  function route(to, from) {
    const a = from || Creature.pos(), dx = to.x - a.x, dz = to.z - a.z, L2 = dx * dx + dz * dz; if (L2 < 0.01) return [to];
    const t = -(a.x * dx + a.z * dz) / L2; if (t <= 0 || t >= 1) return [to];
    let cx = a.x + dx * t, cz = a.z + dz * t, d = Math.hypot(cx, cz); if (d >= CORE_R) return [to];
    if (d < 0.05) { cx = -dz; cz = dx; d = Math.hypot(cx, cz); }
    const k = (CORE_R + 0.5) / d; return [{ x: cx * k, z: cz * k }, to];
  }
  function clampWalk(x, z) { let d = Math.hypot(x, z); if (d < 0.01) { x = 0; z = 1; d = 1; } const k = Math.max(CORE_R + 0.6, Math.min(WALK_R, d)) / d; return { x: x * k, z: z * k }; }
  function mark(id) { PLACES.forEach(function(p) { p.el.classList.toggle('on', p.id === id); }); }
  function goTo(id) {
    const p = PLACES.filter(function(q) { return q.id === id; })[0]; if (!on || !p || (canWalk && !canWalk())) return;
    marker.visible = false; mark(null); if (cb) cb(null);
    Creature.goTo(route({ x: p.door[0], z: p.door[1] }), function() { mark(id); if (cb) cb(id); });
  }
  function tap(e) {
    if (!on || (canWalk && !canWalk())) return;
    const r = Creature.ray(e.clientX, e.clientY), hit = r.intersectObjects(hits)[0]; if (hit) return goTo(hit.object.userData.id);
    const p = r.ray.intersectPlane(GROUND, new T.Vector3()); if (!p) return;
    const c = clampWalk(p.x, p.z); marker.position.set(c.x, 0.03, c.z); marker.visible = true; mark(null); if (cb) cb(null);
    Creature.goTo(route(c), function() { marker.visible = false; });
  }
  // ─────────────────────────────────────────────────────────────
  // RESIDENTS — creatures of the other species stroll between the places and greet the player's creature
  // ─────────────────────────────────────────────────────────────
  // ponytail: they are scenery with manners, each one its own copy of a creature model (no shared skeleton), five at most
  // (two with ?q=low). Other players replace them when the city goes real-time.
  const LOW = /[?&]q=low\b/.test(location.search);
  const HELLO = ['Hi {n}!', 'Lovely day on the plaza, {n}.', 'Have you seen the fountain glow?', 'The gallery smells like fresh paint.', 'Race you to the market!', 'I like your style, {n}.', 'The garden pond is warm today.'];
  let residents = [], npcBubble = null, speaker = null, lastFrame = 0, playerName = '', onMeet = null;
  function spawnResidents(list) {
    npcBubble = document.createElement('div'); npcBubble.className = 'bubble npc hidden'; $('hud').appendChild(npcBubble);
    (list || []).slice(0, LOW ? 2 : 5).forEach(function(r, i) {
      const a = i * 2.4 + 1, start = clampWalk(Math.cos(a) * 9, Math.sin(a) * 9), g = new T.Group(); g.position.set(start.x, 0, start.z); g.visible = false; group.add(g);
      const res = { g: g, name: r.name, path: [], wait: 1 + i * 1.7, yaw: 0, phase: i * 1.3, hello: 4 + i * 3, face: null, mixer: null, h: 2 };
      residents.push(res);
      const place = function(gltf, rigged) { // same scaling rules as the player's creature: a rig is measured by its bones
        const obj = gltf.scene, H = 1.9, bb = new T.Box3(), wp = new T.Vector3();
        obj.traverse(function(o) { if (o.isMesh && o.material) { o.frustumCulled = false; if (o.material.map && o.material.emissive) { o.material.emissiveMap = o.material.map; o.material.emissive.set(0xffffff); o.material.emissiveIntensity = 0.18; } } });
        obj.updateMatrixWorld(true); if (rigged) obj.traverse(function(o) { if (o.isBone) bb.expandByPoint(o.getWorldPosition(wp)); });
        if (!bb.isEmpty()) { const bh = Math.max(0.001, bb.max.y - bb.min.y) * 1.22, sc = H / bh, c = bb.getCenter(new T.Vector3()); obj.scale.setScalar(sc); obj.position.set(-c.x * sc, -(bb.min.y - bh * 0.04) * sc, -c.z * sc); }
        else { const box = new T.Box3().setFromObject(obj), sc = H / Math.max(0.001, box.getSize(new T.Vector3()).y); obj.scale.setScalar(sc); box.setFromObject(obj); const c = box.getCenter(new T.Vector3()); obj.position.set(-c.x, -box.min.y, -c.z); }
        if (rigged && gltf.animations[0]) { res.mixer = new T.AnimationMixer(obj); res.mixer.clipAction(gltf.animations[0]).play(); }
        g.add(obj); g.visible = true;
      };
      const L = Creature.loader(); // the rigged file when it exists, else the static one, else nobody
      L.load('assets/models/' + r.model + '-idle.glb', function(gltf) { place(gltf, true); }, undefined, function() { L.load('assets/models/' + r.model + '.glb', function(gltf) { place(gltf, false); }, undefined, function() {}); });
    });
  }
  function greet(r) {
    speaker = r; npcBubble.dataset.who = r.name; npcBubble.textContent = HELLO[Math.floor(Math.random() * HELLO.length)].replace('{n}', playerName || 'friend');
    anchorBubble(); // placed before it shows: no flash in the corner
    npcBubble.classList.remove('hidden'); npcBubble.classList.remove('pop'); void npcBubble.offsetWidth; npcBubble.classList.add('pop');
    if (onMeet) onMeet(r.name);
    clearTimeout(npcBubble._t); npcBubble._t = setTimeout(function() { npcBubble.classList.add('hidden'); speaker = null; }, 3600);
  }
  function updateResidents(dt, t) {
    const me = Creature.pos();
    residents.forEach(function(r) {
      if (!r.g.visible) return; if (r.mixer) r.mixer.update(dt);
      const p = r.g.position, toMe = Math.hypot(me.x - p.x, me.z - p.z); let moving = false;
      r.hello -= dt;
      if (toMe < 2.8 && r.hello <= 0) { r.hello = 28; r.wait = 3.8; r.path = []; r.face = Math.atan2(me.x - p.x, me.z - p.z); greet(r); } // it stops, turns to the creature and says hello
      if (r.wait > 0) r.wait -= dt;
      else if (!r.path.length) { // next stroll: mostly towards a place, sometimes anywhere on the plaza
        const pl = PLACES[Math.floor(Math.random() * PLACES.length)], rx = (Math.random() - 0.5) * 3.6, rz = (Math.random() - 0.5) * 3.6;
        const to = Math.random() < 0.7 ? clampWalk(pl.door[0] + rx, pl.door[1] + rz) : clampWalk((Math.random() - 0.5) * 24, (Math.random() - 0.5) * 24);
        r.path = route(to, p); r.face = null;
      } else if (CALM) {
        const q = r.path[0], dx = q.x - p.x, dz = q.z - p.z, d = Math.hypot(dx, dz), step = 2.1 * dt; moving = true;
        if (d <= step) { p.x = q.x; p.z = q.z; r.path.shift(); if (!r.path.length) r.wait = 2 + Math.random() * 6; }
        else { p.x += dx / d * step; p.z += dz / d * step; r.face = Math.atan2(dx, dz); }
      }
      const yawT = r.face === null ? 0 : r.face; // standing with nothing to look at: it faces the camera
      r.yaw += (((yawT - r.yaw + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI) * Math.min(1, dt * 6); r.g.rotation.y = r.yaw;
      p.y = moving ? Math.abs(Math.sin(t * 7 + r.phase)) * 0.16 : 0; // a little hop while it walks: the models only have an idle clip
    });
    if (speaker && !npcBubble.classList.contains('hidden')) anchorBubble();
  }
  function anchorBubble() { const s = Creature.project(speaker.g.position.x, speaker.h + 0.5, speaker.g.position.z);
    npcBubble.style.transform = 'translate(-50%, -100%) translate(' + Math.round(Math.max(150, Math.min(innerWidth - 150, s.x))) + 'px,' + Math.round(Math.max($('top').offsetHeight + 60, s.y)) + 'px)'; }
  function frame(now) {
    if (!on) return; requestAnimationFrame(frame);
    const t = now / 1000 * CALM, dt = Math.min(0.1, lastFrame ? (now - lastFrame) / 1000 : 0); lastFrame = now; anim.forEach(function(f) { f(t); });
    updateResidents(dt, now / 1000);
    // a name stays on screen even when its place is not: it slides along the edge and points the way (a place behind the camera sits at the bottom)
    const cam = Creature.cameraPos(), top = $('top').offsetHeight + 56, bottom = innerHeight - $('dock').offsetHeight - 28;
    const placed = [];
    PLACES.forEach(function(p) { const s = Creature.project(p.x, p.top + 0.5, p.z), behind = p.z > cam.z - 1;
      const x = Math.max(70, Math.min(innerWidth - 70, behind ? innerWidth / 2 + (p.x - cam.x) * 30 : s.x)); let y = behind ? bottom : Math.max(top, Math.min(bottom, s.y));
      placed.forEach(function(q) { if (Math.abs(q[0] - x) < 130 && Math.abs(q[1] - y) < 34) y = q[1] + 36; }); placed.push([x, y]); // two names never sit on each other
      p.el.style.transform = 'translate(-50%, -100%) translate(' + Math.round(x) + 'px,' + Math.round(y) + 'px)'; });
  }

  // onArrive(id | null): see the header · walkable(): false while the creature cannot walk (an egg)
  // opts: { name: the player's creature, residents: [{ name, model }], onMeet(name): a resident just said hello } — the residents are created on the first entry
  function enter(onArrive, walkable, opts) {
    if (!group) { build(); spawnResidents(opts && opts.residents); }
    playerName = (opts && opts.name) || playerName; onMeet = (opts && opts.onMeet) || null; lastFrame = 0;
    on = true; cb = onArrive || null; canWalk = walkable || null; group.visible = true; $('places').classList.remove('hidden');
    Creature.setView('city'); Creature.standAt(PLACES[0].door[0], PLACES[0].door[1]); mark('seed'); requestAnimationFrame(frame);
    if (cb) cb('seed');
  }
  function leave() { on = false; if (group) group.visible = false; if (npcBubble) npcBubble.classList.add('hidden'); $('places').classList.add('hidden'); Creature.setView('home'); }

  window.City = { enter: enter, leave: leave, goTo: goTo, active: function() { return on; } };
})();
