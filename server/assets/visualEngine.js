/**
 * SOCIOBEAST GENESIS v11 — Visual Engine
 * Bright realistic forest with thought bubbles
 */
(function() {
  'use strict';
  
  console.log('[V] VisualEngine script starting...');
  
  // Check THREE availability
  if (typeof THREE === 'undefined') {
    console.error('[V] THREE is not defined! Waiting...');
    // Retry after a delay
    setTimeout(() => {
      if (typeof THREE !== 'undefined') {
        console.log('[V] THREE now available, reloading...');
        location.reload();
      }
    }, 1000);
    return;
  }
  
  console.log('[V] THREE available, version r' + THREE.REVISION);

  // ═══ STATE ═══
  let scene, camera, renderer, clock;
  // v12 game hooks
  let mainLight = null, forestGlow = null, rimLight = null, islandTop = null;
  const foliageMeshes = [], grassMeshes = [];
  let skyTarget = new THREE.Color(0x050510), skyCurrent = new THREE.Color(0x050510);
  let shakeAmount = 0;
  let dayFactor = 1; // 0 night .. 1 day
  let templateModel = null;
  let kodamas = [];
  let t = 0, speaking = false, ready = false;
  const NECK_Y = 1.06;

  // Thought system
  let thoughtBubbles = [];
  let lastThoughtTime = 0;

  // Persistent state from server
  let S = {
    evolution_stage: 0,
    energy: 80,
    happiness: 55,
    autonomy_level: 0.05,
    kodama_count: 1,
    visual_instances: [],
    color_palette: { primary: '#f0f8f0', glow: '#a0d0a0' },
    visual_mutations: [],
    emotions: { happy: 50, excited: 30, sleepy: 10, curious: 50 },
    last_thought: null
  };

  // ═══ AUDIO ENGINE ═══
  let ac = null, mg = null, amb = false, audioReady = false;

  function initAudio() {
    if (ac) return;
    try {
      ac = new (window.AudioContext || window.webkitAudioContext)();
      mg = ac.createGain();
      mg.gain.value = 0.25;
      mg.connect(ac.destination);
      if (ac.state === 'suspended') ac.resume();
      audioReady = true;
    } catch(e) {}
  }

  function playClick() {
    if (!ac || !audioReady) return;
    if (ac.state === 'suspended') { ac.resume(); return; }
    try {
      const now = ac.currentTime;
      const len = Math.floor(ac.sampleRate * 0.04);
      const buf = ac.createBuffer(1, len, ac.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (len * 0.1));
      }
      const noise = ac.createBufferSource();
      noise.buffer = buf;
      const bandpass = ac.createBiquadFilter();
      bandpass.type = 'bandpass';
      bandpass.frequency.value = 700 + Math.random() * 900;
      bandpass.Q.value = 6;
      const noiseGain = ac.createGain();
      noiseGain.gain.setValueAtTime(0.2, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
      noise.connect(bandpass);
      bandpass.connect(noiseGain);
      noiseGain.connect(mg);
      noise.start(now);
      noise.stop(now + 0.06);

      const ping = ac.createOscillator();
      ping.type = 'sine';
      ping.frequency.value = 1100 + Math.random() * 800;
      const pingGain = ac.createGain();
      pingGain.gain.setValueAtTime(0.06, now);
      pingGain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
      ping.connect(pingGain);
      pingGain.connect(mg);
      ping.start(now);
      ping.stop(now + 0.05);
    } catch(e) {}
  }

  function playSpawn() {
    if (!ac || !audioReady) return;
    try {
      const now = ac.currentTime;
      const o = ac.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(250, now);
      o.frequency.exponentialRampToValueAtTime(550, now + 0.3);
      const g = ac.createGain();
      g.gain.setValueAtTime(0.05, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
      o.connect(g); g.connect(mg);
      o.start(now); o.stop(now + 0.7);
    } catch(e) {}
  }

  function playEvolution() {
    if (!ac || !audioReady) return;
    try {
      const now = ac.currentTime;
      [262, 330, 392, 523].forEach((freq, i) => {
        const o = ac.createOscillator();
        o.type = 'sine';
        o.frequency.value = freq;
        const g = ac.createGain();
        g.gain.setValueAtTime(0, now + i * 0.15);
        g.gain.linearRampToValueAtTime(0.06, now + i * 0.15 + 0.1);
        g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.15 + 0.8);
        o.connect(g); g.connect(mg);
        o.start(now + i * 0.15);
        o.stop(now + i * 0.15 + 1);
      });
    } catch(e) {}
  }

  function startMusic() {
    if (!ac || amb) return;
    amb = true;
    try {
      // Soft ambient drones
      const freqs = [[65, 'sine', 0.02], [98, 'sine', 0.015], [130, 'triangle', 0.008]];
      freqs.forEach(([f, type, vol]) => {
        const osc = ac.createOscillator();
        osc.type = type;
        osc.frequency.value = f;
        const gain = ac.createGain();
        gain.gain.value = vol;
        osc.connect(gain);
        gain.connect(mg);
        osc.start();
      });

      // Nature sounds - soft chimes
      function chime() {
        if (!ac || ac.state === 'closed') return;
        const notes = [392, 440, 523, 587, 659, 784];
        const now = ac.currentTime;
        const osc = ac.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = notes[Math.floor(Math.random() * notes.length)] * (Math.random() < 0.3 ? 2 : 1);
        const g = ac.createGain();
        g.gain.setValueAtTime(0.02, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 2.5);
        const delay = ac.createDelay();
        delay.delayTime.value = 0.3;
        const fb = ac.createGain();
        fb.gain.value = 0.15;
        g.connect(delay);
        delay.connect(fb);
        fb.connect(delay);
        delay.connect(mg);
        osc.connect(g);
        g.connect(mg);
        osc.start(now);
        osc.stop(now + 3);
        setTimeout(chime, 5000 + Math.random() * 10000);
      }
      setTimeout(chime, 3000);
    } catch(e) {}
  }

  // ═══ CAMERA CONTROLS ═══
  let controls = null;
  let isDragging = false;
  let previousMousePosition = { x: 0, y: 0 };
  let cameraTarget = new THREE.Vector3(0, 0, 0);
  let cameraDistance = 45;
  let cameraAngleX = 0.35;
  let cameraAngleY = 0;
  let autoRotate = true;
  let autoRotateSpeed = 0.08; // Radians per second
  let lastInteraction = 0;
  let autoResumeDelay = 5000; // Resume auto-rotate after 5s of no interaction

  function updateCameraPosition() {
    camera.position.x = cameraTarget.x + Math.sin(cameraAngleY) * Math.cos(cameraAngleX) * cameraDistance;
    camera.position.y = cameraTarget.y + Math.sin(cameraAngleX) * cameraDistance;
    camera.position.z = cameraTarget.z + Math.cos(cameraAngleY) * Math.cos(cameraAngleX) * cameraDistance;
    camera.lookAt(cameraTarget);
  }

  function updateAutoRotate(dt) {
    // Resume auto-rotate after inactivity
    if (!autoRotate && Date.now() - lastInteraction > autoResumeDelay) {
      autoRotate = true;
    }
    
    if (autoRotate && !isDragging) {
      cameraAngleY += autoRotateSpeed * dt;
      updateCameraPosition();
    }
  }

  // ═══ SCENE — FLOATING ISLAND IN COSMIC VOID ═══
  function initScene() {
    scene = new THREE.Scene();
    
    // Deep space background
    scene.background = new THREE.Color(0x050510);
    scene.fog = new THREE.FogExp2(0x0a0a15, 0.008);

    camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.1, 500);
    cameraDistance = 35;
    cameraAngleX = 0.4;
    cameraAngleY = 0;
    updateCameraPosition();

    renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('creature-canvas'), antialias: true });
    renderer.setSize(innerWidth, innerHeight);
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    clock = new THREE.Clock();

    // ═══ MOUSE/TOUCH CONTROLS ═══
    const canvas = renderer.domElement;
    
    canvas.addEventListener('mousedown', function(e) {
      isDragging = true;
      autoRotate = false;
      lastInteraction = Date.now();
      previousMousePosition = { x: e.clientX, y: e.clientY };
    });
    
    canvas.addEventListener('mousemove', function(e) {
      if (!isDragging) return;
      lastInteraction = Date.now();
      const deltaX = e.clientX - previousMousePosition.x;
      const deltaY = e.clientY - previousMousePosition.y;
      cameraAngleY -= deltaX * 0.005;
      cameraAngleX += deltaY * 0.005;
      cameraAngleX = Math.max(0.1, Math.min(Math.PI / 2.2, cameraAngleX));
      updateCameraPosition();
      previousMousePosition = { x: e.clientX, y: e.clientY };
    });
    
    canvas.addEventListener('mouseup', function() { isDragging = false; });
    canvas.addEventListener('mouseleave', function() { isDragging = false; });
    
    canvas.addEventListener('wheel', function(e) {
      e.preventDefault();
      autoRotate = false;
      lastInteraction = Date.now();
      cameraDistance += e.deltaY * 0.05;
      cameraDistance = Math.max(15, Math.min(120, cameraDistance));
      updateCameraPosition();
    }, { passive: false });
    
    // Touch controls
    let touchStart = null;
    canvas.addEventListener('touchstart', function(e) {
      if (e.touches.length === 1) {
        touchStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        autoRotate = false;
        lastInteraction = Date.now();
      }
    });
    
    canvas.addEventListener('touchmove', function(e) {
      if (!touchStart || e.touches.length !== 1) return;
      lastInteraction = Date.now();
      const deltaX = e.touches[0].clientX - touchStart.x;
      const deltaY = e.touches[0].clientY - touchStart.y;
      cameraAngleY -= deltaX * 0.008;
      cameraAngleX += deltaY * 0.008;
      cameraAngleX = Math.max(0.1, Math.min(Math.PI / 2.2, cameraAngleX));
      updateCameraPosition();
      touchStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    });
    
    canvas.addEventListener('touchend', function() { touchStart = null; });

    // ═══ STARFIELD BACKGROUND ═══
    const starCount = 3000;
    const starGeo = new THREE.BufferGeometry();
    const starPos = new Float32Array(starCount * 3);
    const starColors = new Float32Array(starCount * 3);
    
    for (let i = 0; i < starCount; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = 150 + Math.random() * 150;
      starPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      starPos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      starPos[i * 3 + 2] = r * Math.cos(phi);
      // Slight color variation
      const colorVal = 0.7 + Math.random() * 0.3;
      starColors[i * 3] = colorVal;
      starColors[i * 3 + 1] = colorVal * (0.9 + Math.random() * 0.1);
      starColors[i * 3 + 2] = colorVal * (0.8 + Math.random() * 0.2);
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    starGeo.setAttribute('color', new THREE.BufferAttribute(starColors, 3));
    
    const starMat = new THREE.PointsMaterial({
      size: 0.5,
      vertexColors: true,
      transparent: true,
      opacity: 0.9
    });
    scene.add(new THREE.Points(starGeo, starMat));

    // ═══ LIGHTING — COSMIC + FOREST ═══
    scene.add(new THREE.AmbientLight(0x3a4a5a, 0.55));
    scene.add(new THREE.HemisphereLight(0x8fb0d0, 0x2a3a1a, 0.45));
    
    // Main sunlight from above
    mainLight = new THREE.DirectionalLight(0xffe4c4, 1.35);
    mainLight.position.set(-20, 40, 30);
    mainLight.castShadow = true;
    mainLight.shadow.mapSize.set(4096, 4096);
    mainLight.shadow.camera.near = 1;
    mainLight.shadow.camera.far = 100;
    mainLight.shadow.camera.left = -40;
    mainLight.shadow.camera.right = 40;
    mainLight.shadow.camera.top = 40;
    mainLight.shadow.camera.bottom = -40;
    scene.add(mainLight);
    
    // Cosmic rim light
    rimLight = new THREE.DirectionalLight(0x8080ff, 0.5);
    rimLight.position.set(20, 10, -30);
    scene.add(rimLight);
    
    // Green forest glow
    forestGlow = new THREE.PointLight(0x60a060, 2, 50);
    forestGlow.position.set(0, 5, 0);
    scene.add(forestGlow);

    // ═══ FLOATING ISLAND ═══
    const islandRadius = 30;
    
    // Island top (grass)
    const islandTopGeo = new THREE.CylinderGeometry(islandRadius, islandRadius * 0.85, 2, 64, 8);
    const islandTopMat = new THREE.MeshStandardMaterial({ 
      color: 0x2a4020,
      roughness: 0.9
    });
    // Add terrain variation
    const topPos = islandTopGeo.attributes.position;
    for (let i = 0; i < topPos.count; i++) {
      const y = topPos.getY(i);
      if (y > 0.5) {
        const x = topPos.getX(i);
        const z = topPos.getZ(i);
        const dist = Math.sqrt(x * x + z * z);
        const noise = Math.sin(x * 0.3) * Math.cos(z * 0.3) * 0.5;
        topPos.setY(i, y + noise + (1 - dist / islandRadius) * 0.5);
      }
    }
    islandTopGeo.computeVertexNormals();
    islandTop = new THREE.Mesh(islandTopGeo, islandTopMat);
    islandTop.position.y = -1;
    islandTop.receiveShadow = true;
    scene.add(islandTop);
    
    // Island bottom (rock)
    const islandBottomGeo = new THREE.ConeGeometry(islandRadius * 0.85, 15, 32, 8);
    const islandBottomMat = new THREE.MeshStandardMaterial({
      color: 0x3a3530,
      roughness: 0.95
    });
    const islandBottom = new THREE.Mesh(islandBottomGeo, islandBottomMat);
    islandBottom.position.y = -9.5;
    islandBottom.rotation.x = Math.PI;
    scene.add(islandBottom);

    // ═══ MASSIVE FOREST ═══
    const treeCount = 120;
    for (let i = 0; i < treeCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 4 + Math.random() * (islandRadius - 6);
      const x = Math.cos(angle) * dist;
      const z = Math.sin(angle) * dist;
      const height = 3 + Math.random() * 4;
      const thickness = 0.1 + Math.random() * 0.15;
      
      // Trunk
      const trunkGeo = new THREE.CylinderGeometry(thickness * 0.7, thickness, height, 8);
      const trunkMat = new THREE.MeshStandardMaterial({ 
        color: new THREE.Color().setHSL(0.08, 0.4, 0.12 + Math.random() * 0.08),
        roughness: 0.95
      });
      const trunk = new THREE.Mesh(trunkGeo, trunkMat);
      trunk.position.set(x, height / 2, z);
      trunk.castShadow = true;
      scene.add(trunk);
      
      // Foliage
      const fLayers = 2 + Math.floor(Math.random() * 2);
      for (let j = 0; j < fLayers; j++) {
        const fSize = (1.2 - j * 0.25) * (0.8 + Math.random() * 0.5);
        const fY = height * 0.75 + j * 0.6;
        const fGeo = new THREE.SphereGeometry(fSize, 8, 6);
        const fMat = new THREE.MeshStandardMaterial({
          color: new THREE.Color().setHSL(0.27 + Math.random() * 0.09, 0.55 + Math.random() * 0.25, 0.11 + Math.random() * 0.09),
          roughness: 0.9
        });
        const foliage = new THREE.Mesh(fGeo, fMat);
        foliage.position.set(x + (Math.random() - 0.5) * 0.3, fY, z + (Math.random() - 0.5) * 0.3);
        foliage.scale.y = 0.7 + Math.random() * 0.3;
        foliage.castShadow = true;
        foliage.userData.baseHSL = { h: 0, s: 0, l: 0 }; fMat.color.getHSL(foliage.userData.baseHSL);
        foliageMeshes.push(foliage);
        scene.add(foliage);
      }
    }

    // ═══ GRASS PATCHES ═══
    for (let i = 0; i < 400; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 2 + Math.random() * (islandRadius - 3);
      const x = Math.cos(angle) * dist;
      const z = Math.sin(angle) * dist;
      
      const grassGeo = new THREE.ConeGeometry(0.04, 0.2 + Math.random() * 0.15, 4);
      const grassMat = new THREE.MeshStandardMaterial({ 
        color: new THREE.Color().setHSL(0.25 + Math.random() * 0.05, 0.5, 0.2 + Math.random() * 0.1)
      });
      const grass = new THREE.Mesh(grassGeo, grassMat);
      grass.position.set(x, 0.1, z);
      grass.rotation.y = Math.random() * Math.PI;
      grassMeshes.push(grass);
      scene.add(grass);
    }

    // ═══ ROCKS ═══
    for (let i = 0; i < 60; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 2 + Math.random() * (islandRadius - 2);
      const rockGeo = new THREE.DodecahedronGeometry(0.15 + Math.random() * 0.3, 0);
      const rockMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color().setHSL(0.1, 0.1, 0.2 + Math.random() * 0.15),
        roughness: 0.9
      });
      const rock = new THREE.Mesh(rockGeo, rockMat);
      rock.position.set(Math.cos(angle) * dist, 0.1, Math.sin(angle) * dist);
      rock.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
      rock.scale.y = 0.5 + Math.random() * 0.5;
      rock.castShadow = true;
      scene.add(rock);
    }

    // ═══ MUSHROOMS ═══
    for (let i = 0; i < 40; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 3 + Math.random() * (islandRadius - 4);
      const x = Math.cos(angle) * dist;
      const z = Math.sin(angle) * dist;
      const scale = 0.5 + Math.random() * 1;
      
      const stemGeo = new THREE.CylinderGeometry(0.03 * scale, 0.04 * scale, 0.12 * scale, 6);
      const stemMat = new THREE.MeshStandardMaterial({ color: 0xf0e8d8 });
      const stem = new THREE.Mesh(stemGeo, stemMat);
      stem.position.set(x, 0.06 * scale, z);
      scene.add(stem);
      
      const capGeo = new THREE.SphereGeometry(0.07 * scale, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2);
      const capMat = new THREE.MeshStandardMaterial({ 
        color: new THREE.Color().setHSL(Math.random() * 0.1, 0.6, 0.35 + Math.random() * 0.15)
      });
      const cap = new THREE.Mesh(capGeo, capMat);
      cap.position.set(x, 0.12 * scale, z);
      scene.add(cap);
    }

    // ═══ COSMIC FIREFLIES ═══
    const ffCount = 200;
    const ffGeo = new THREE.BufferGeometry();
    const ffPos = new Float32Array(ffCount * 3);
    const ffPhases = new Float32Array(ffCount);
    
    for (let i = 0; i < ffCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 2 + Math.random() * (islandRadius - 2);
      ffPos[i * 3] = Math.cos(angle) * dist;
      ffPos[i * 3 + 1] = 0.5 + Math.random() * 8;
      ffPos[i * 3 + 2] = Math.sin(angle) * dist;
      ffPhases[i] = Math.random() * Math.PI * 2;
    }
    ffGeo.setAttribute('position', new THREE.BufferAttribute(ffPos, 3));
    
    const ffMat = new THREE.PointsMaterial({
      color: 0xccff99,
      size: 0.15,
      transparent: true,
      opacity: 0.8,
      sizeAttenuation: true
    });
    const ff = new THREE.Points(ffGeo, ffMat);
    ff.userData.ff = true;
    ff.userData.phases = ffPhases;
    scene.add(ff);

    window.addEventListener('resize', function() {
      camera.aspect = innerWidth / innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(innerWidth, innerHeight);
    });

    renderer.render(scene, camera);
  }

  // ═══ LOAD MODEL ═══
  function loadModel() {
    return new Promise((resolve, reject) => {
      if (window._loadLog) window._loadLog('Loading spirits...');
      
      console.log('[V] loadModel() started');
      
      // Check if GLTFLoader is available
      if (typeof THREE.GLTFLoader === 'undefined') {
        console.error('[V] GLTFLoader not available!');
        reject('GLTFLoader not found');
        return;
      }
      
      console.log('[V] GLTFLoader available, loading assets/kodama.glb...');

      new THREE.GLTFLoader().load(window.KODAMA_GLB_URL || 'assets/kodama.glb', (gltf) => {
        console.log('[V] GLTF loaded successfully!');
        const model = gltf.scene;
        
        const pivot = new THREE.Group();
        pivot.name = 'kodama_root';

        const headGroup = new THREE.Group();
        headGroup.name = 'kodama_head';
        headGroup.position.y = NECK_Y;

        const headMeshes = [], bodyMeshes = [];
        model.traverse(c => {
          if (!c.isMesh) return;
          c.castShadow = true;
          c.receiveShadow = true;
          const box = new THREE.Box3().setFromObject(c);
          const minY = box.min.y;
          if (minY > 1.0) {
            headMeshes.push(c);
          } else {
            bodyMeshes.push(c);
          }
        });

        headMeshes.forEach(m => {
          if (m.parent) m.parent.remove(m);
          m.position.y -= NECK_Y;
          headGroup.add(m);
        });

        bodyMeshes.forEach(m => {
          if (m.parent) m.parent.remove(m);
          pivot.add(m);
        });

        pivot.add(headGroup);
        pivot.userData.headGroupName = 'kodama_head';

        templateModel = pivot;
        ready = true;
        if (window._loadLog) window._loadLog('');
        const ls = document.getElementById('load-status');
        if (ls) ls.style.display = 'none';
        resolve(pivot);
      },
        p => { if (p.total && window._loadLog) window._loadLog('Loading... ' + Math.round(p.loaded / p.total * 100) + '%'); },
        e => { console.error('[V] Load error:', e); reject(e); }
      );
    });
  }

  // ═══ INSTANCE CREATION ═══
  function createKodama(x, z, scale, instanceId = null) {
    if (!templateModel) return null;

    const g = templateModel.clone();
    g.traverse(c => {
      if (c.isMesh && c.material) c.material = c.material.clone();
    });

    g.scale.setScalar(scale);
    g.position.set(x, 0, z);

    let headGroup = null;
    g.traverse(c => {
      if (c.name === 'kodama_head') headGroup = c;
    });

    const id = instanceId || 'kodama_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();

    const k = {
      id: id,
      g: g,
      head: headGroup,
      s: scale,
      ha: 0, ht: 0,
      rt: 2 + Math.random() * 3,
      ir: false, rs: 0,
      bp: Math.random() * 6.28,
      br: Math.random() * 6.28,
      bx: x, bz: z,
      wx: x, wz: z,
      wtx: x, wtz: z,
      wt: Math.random() * 5,
      al: 1,
      persistent: !!instanceId,
      // ═══ AI-DRIVEN VANISH/REAPPEAR BEHAVIOR ═══
      isVanished: false,
      vanishTimer: 15 + Math.random() * 45,  // Initial vanish timer
      reappearTimer: 0,
      currentAlpha: 1,
      // AI Personality traits (0-1)
      personality: {
        shyness: Math.random(),      // High = vanishes more often
        curiosity: Math.random(),    // High = reappears faster
        sociability: Math.random(),  // High = appears near others
        wanderlust: Math.random(),   // High = appears in random spots
        playfulness: Math.random()   // Affects animation speed
      }
    };

    scene.add(g);
    kodamas.push(k);
    playSpawn();
    return k;
  }

  // ═══ AI-DRIVEN VANISH/REAPPEAR SYSTEM ═══
  function updateVanishBehavior(dt) {
    // Get AI state
    const autonomy = S.autonomy_level || 0.1;
    const emotions = S.emotions || { happy: 50, curious: 50, shy: 30, excited: 30 };
    const stage = S.evolution_stage || 0;
    
    // Global mood affects all creatures
    const globalMood = {
      happiness: (emotions.happy || 50) / 100,
      curiosity: (emotions.curious || 50) / 100,
      shyness: (emotions.shy || 30) / 100,
      excitement: (emotions.excited || 30) / 100
    };
    
    // Count visible kodamas for social behavior
    const visibleKodamas = kodamas.filter(k => !k.isVanished && k.currentAlpha > 0.5);
    
    kodamas.forEach(function(k, index) {
      // Prime kodama and Legends never vanish
      if (index === 0 || k.neverVanish) return;
      
      const p = k.personality;
      
      if (k.isVanished) {
        // ═══ VANISHED STATE - Waiting to reappear ═══
        k.reappearTimer -= dt;
        
        // AI affects reappear speed
        // Curious creatures come back faster
        // Happy mood = faster return
        // More autonomy = more unpredictable
        const curiosityBoost = p.curiosity * globalMood.curiosity * 2;
        const happinessBoost = globalMood.happiness * 1.5;
        
        if (k.reappearTimer <= 0) {
          // ═══ REAPPEAR LOGIC ═══
          let newPos;
          
          if (p.sociability > 0.6 && visibleKodamas.length > 0) {
            // Social creature - appear near another visible kodama
            const friend = visibleKodamas[Math.floor(Math.random() * visibleKodamas.length)];
            const angle = Math.random() * Math.PI * 2;
            const dist = 1 + Math.random() * 3;
            newPos = {
              x: friend.wx + Math.cos(angle) * dist,
              z: friend.wz + Math.sin(angle) * dist
            };
            // Clamp to island bounds
            const d = Math.sqrt(newPos.x * newPos.x + newPos.z * newPos.z);
            if (d > 25) {
              newPos.x *= 25 / d;
              newPos.z *= 25 / d;
            }
          } else {
            // Wanderer - appear at random location
            newPos = getRandomIslandPosition();
          }
          
          k.bx = newPos.x;
          k.bz = newPos.z;
          k.wx = newPos.x;
          k.wz = newPos.z;
          k.wtx = newPos.x;
          k.wtz = newPos.z;
          k.g.position.x = newPos.x;
          k.g.position.z = newPos.z;
          
          k.isVanished = false;
          k.currentAlpha = 0;
          
          // Calculate next vanish time based on AI state
          // Happy + high autonomy = stays visible longer
          const baseTime = 20 + Math.random() * 60;
          const moodMultiplier = 1 + globalMood.happiness + (1 - p.shyness);
          const autonomyMultiplier = 1 + autonomy * 2;
          k.vanishTimer = baseTime * moodMultiplier * autonomyMultiplier;
          
          playSpawn();
        }
      } else {
        // ═══ VISIBLE STATE - May vanish ═══
        k.vanishTimer -= dt;
        
        // AI affects vanish behavior
        // Shy creatures vanish more in response to low happiness
        // Excited mood keeps creatures visible
        const shynessFactor = p.shyness * (1 - globalMood.happiness) * (1 - globalMood.excitement);
        
        // Random vanish chance when timer expires
        if (k.vanishTimer <= 0) {
          // Higher evolution = less random vanishing
          const vanishChance = 0.3 + shynessFactor * 0.5 - (stage * 0.05);
          
          if (Math.random() < vanishChance) {
            // Start vanishing
            k.isVanished = true;
            
            // Calculate reappear time based on personality + mood
            // Curious creatures come back fast
            // Low mood = longer absence
            const baseAbsence = 5 + Math.random() * 15;
            const curiosityFactor = 1 - (p.curiosity * 0.6);
            const moodFactor = 1 + (1 - globalMood.happiness) * 0.5;
            k.reappearTimer = baseAbsence * curiosityFactor * moodFactor;
          } else {
            // Decided not to vanish - reset timer
            k.vanishTimer = 10 + Math.random() * 30;
          }
        }
      }
      
      // ═══ ALPHA TRANSITION (Fade in/out) ═══
      const targetAlpha = k.isVanished ? 0 : 1;
      
      if (k.currentAlpha !== targetAlpha) {
        // Playful creatures fade faster
        const fadeSpeed = 1.5 + p.playfulness * 1.5;
        
        if (k.currentAlpha < targetAlpha) {
          k.currentAlpha = Math.min(targetAlpha, k.currentAlpha + dt * fadeSpeed);
        } else {
          k.currentAlpha = Math.max(targetAlpha, k.currentAlpha - dt * fadeSpeed * 1.5);
        }
        
        // Apply to all meshes
        k.g.traverse(function(c) {
          if (c.isMesh && c.material) {
            c.material.transparent = true;
            c.material.opacity = k.currentAlpha;
          }
        });
        
        // Hide when fully invisible
        k.g.visible = k.currentAlpha > 0.01;
      }
      
      // Update al for compatibility with other systems
      k.al = k.currentAlpha;
    });
  }

  // ═══ RANDOM TELEPORT (can be triggered by AI) ═══
  function teleportRandomKodama() {
    const visible = kodamas.filter(function(k, i) {
      return i > 0 && !k.isVanished;
    });
    
    if (visible.length === 0) return;
    
    const k = visible[Math.floor(Math.random() * visible.length)];
    k.vanishTimer = 0;
  }

  // ═══ MASS BEHAVIOR TRIGGERS ═══
  function triggerShyMode() {
    // All creatures become shy temporarily
    kodamas.forEach(function(k, i) {
      if (i > 0 && !k.isVanished && Math.random() < 0.5) {
        k.vanishTimer = Math.random() * 3;
      }
    });
  }

  function triggerCuriousMode() {
    // All vanished creatures reappear faster
    kodamas.forEach(function(k) {
      if (k.isVanished) {
        k.reappearTimer = Math.min(k.reappearTimer, 1 + Math.random() * 2);
      }
    });
  }

  // ═══ RESTORE FROM SERVER STATE ═══
  function restoreInstances(instances) {
    if (!instances || !instances.length) return;
    
    console.log('[V] Restoring', instances.length, 'instances from server');
    
    instances.forEach(inst => {
      const existing = kodamas.find(k => k.id === inst.instance_id);
      if (existing) return;

      createKodama(
        parseFloat(inst.pos_x) || 0,
        parseFloat(inst.pos_z) || 0.5,
        parseFloat(inst.scale) || 1,
        inst.instance_id
      );
    });
  }

  // ═══ SYNC TO SERVER ═══
  function syncToServer() {
    if (!kodamas.length) return;

    const instances = kodamas.map(k => ({
      id: k.id,
      x: k.wx,
      z: k.wz,
      scale: k.s
    }));

    fetch('api/state.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'sync_instances', instances })
    }).catch(e => console.warn('[V] Sync failed:', e));
  }

  // ═══ THOUGHT BUBBLES ═══
  function createThoughtBubble(text, kodama) {
    console.log('[V] Creating thought bubble:', text);
    
    // Create HTML overlay for thought
    const bubble = document.createElement('div');
    bubble.className = 'thought-bubble';
    bubble.innerHTML = '<span class="thought-icon">💭</span> <span class="thought-text">' + text + '</span>';
    
    // Fixed position at top center - CSS handles the rest
    bubble.style.position = 'fixed';
    bubble.style.left = '50%';
    bubble.style.top = '58%';
    bubble.style.zIndex = '300';
    
    document.body.appendChild(bubble);
    
    const bubbleData = {
      el: bubble,
      kodama: kodama,
      life: 8
    };
    
    thoughtBubbles.push(bubbleData);
    
    // Fade in
    requestAnimationFrame(function() {
      bubble.classList.add('visible');
    });
    
    return bubbleData;
  }

  function updateThoughtBubbles(dt) {
    thoughtBubbles = thoughtBubbles.filter(function(b) {
      b.life -= dt;
      
      if (b.life <= 0) {
        b.el.classList.remove('visible');
        setTimeout(function() { b.el.remove(); }, 500);
        return false;
      }
      
      // Fade out near end
      if (b.life < 1) {
        b.el.style.opacity = b.life.toString();
      }
      
      return true;
    });
  }

  function showThought(text) {
    console.log('[V] showThought called:', text);
    
    if (!kodamas.length) {
      console.warn('[V] No kodamas to show thought');
      return;
    }
    if (!text) {
      console.warn('[V] No text for thought');
      return;
    }
    
    // Pick a random kodama
    const k = kodamas[Math.floor(Math.random() * kodamas.length)];
    console.log('[V] Creating bubble for kodama:', k.id);
    createThoughtBubble(text, k);
    lastThoughtTime = Date.now();
  }

  // ═══ UPDATE LOOP ═══
  function update(dt) {
    const emo = S.emotions || {};
    const exc = (emo.excited || 0) > 40;

    kodamas.forEach(k => {
      // Skip if vanished
      if (k.isVanished || k.currentAlpha < 0.1) return;

      // Head rattle
      k.rt -= dt;
      if (k.rt <= 0 && !k.ir) {
        k.ir = true;
        k.ht = (Math.random() < 0.5 ? 1 : -1) * (0.25 + Math.random() * 0.35);
        k.rs = 10 + Math.random() * 8;
        playClick();
      }

      if (k.ir) {
        k.ha += (k.ht - k.ha) * dt * k.rs;
        if (Math.abs(k.ha - k.ht) < 0.02) {
          if (Math.abs(k.ht) > 0.05) {
            k.ht *= -0.4;
            if (Math.abs(k.ht) > 0.04) playClick();
          } else {
            k.ht = 0;
            k.ir = false;
            // Playful creatures rattle more
            const playfulness = k.personality ? k.personality.playfulness : 0.5;
            k.rt = (exc ? 0.5 : 1.5) + Math.random() * (exc ? 1.5 : 4) * (1 - playfulness * 0.5);
          }
        }
      } else {
        k.ha += (0 - k.ha) * dt * 4;
      }

      if (k.head) {
        k.head.rotation.z = k.ha;
      }

      // Breathing
      k.br += dt * 1.1;
      const breath = 1 + Math.sin(k.br) * 0.015;
      k.g.scale.set(k.s * breath, k.s, k.s * breath);

      // Bob
      k.bp += dt * 0.7;
      k.g.position.y = Math.sin(k.bp) * 0.02;

      // Wander - affected by personality
      k.wt -= dt;
      if (k.wt <= 0) {
        const wanderlust = k.personality ? k.personality.wanderlust : 0.5;
        k.wt = 3 + Math.random() * 6 * (1 - wanderlust * 0.5);
        const wanderDist = 0.3 + wanderlust * 0.8;
        k.wtx = k.bx + (Math.random() - 0.5) * wanderDist;
        k.wtz = k.bz + (Math.random() - 0.5) * wanderDist * 0.7;
      }
      k.wx += (k.wtx - k.wx) * dt * 0.2;
      k.wz += (k.wtz - k.wz) * dt * 0.2;
      k.g.position.x = k.wx;
      k.g.position.z = k.wz;

      // Speaking
      if (speaking) {
        k.g.rotation.z = Math.sin(t * 7 + k.bp) * 0.012;
      } else {
        k.g.rotation.z *= 0.95;
      }
    });

    // Update thought bubbles
    updateThoughtBubbles(dt);
  }

  // ═══ DUPLICATION ═══
  let dupTimer = 2 + Math.random() * 5; // Very fast: 2-7 seconds
  const MAX_KODAMAS = 1000; // Massive colony
  let lastDupLog = 0;

  // Island bounds - large floating island
  const ISLAND_RADIUS = 25;
  const ISLAND_INNER = 3; // Keep some in center

  function getRandomIslandPosition() {
    // Random position across the entire island
    const angle = Math.random() * Math.PI * 2;
    const distance = ISLAND_INNER + Math.random() * (ISLAND_RADIUS - ISLAND_INNER);
    return {
      x: Math.cos(angle) * distance,
      z: Math.sin(angle) * distance
    };
  }

  function tryDuplicate(dt) {
    dupTimer -= dt;
    
    const max = MAX_KODAMAS;

    // Log every 15 seconds
    const now = Date.now();
    if (now - lastDupLog > 15000) {
      console.log('[V] Colony: ' + kodamas.length + '/' + max);
      lastDupLog = now;
    }

    if (dupTimer <= 0 && kodamas.length < max && ready) {
      // Spawn 1-3 at a time for faster growth
      const spawnCount = Math.min(3, max - kodamas.length);
      for (let i = 0; i < spawnCount; i++) {
        spawnNew();
      }
      // Dynamic spawn rate
      const growthFactor = Math.max(0.1, 1 - (kodamas.length / max));
      dupTimer = (1 + Math.random() * 4) * growthFactor;
    }
  }

  function spawnNew() {
    if (!ready || !templateModel) return;
    
    const pos = getRandomIslandPosition();
    const scale = 0.3 + Math.random() * 0.7;
    
    const k = createKodama(pos.x, pos.z, scale);
    
    if (k) {
      fetch('api/state.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add_instance',
          x: pos.x, z: pos.z, scale: scale
        })
      }).catch(function(e) {});
    }
  }

  // ═══ FIREFLIES ═══
  function updateFireflies() {
    scene.traverse(c => {
      if (c.userData.ff && c.geometry) {
        const p = c.geometry.attributes.position;
        const phases = c.userData.phases;
        
        for (let i = 0; i < p.count; i++) {
          p.array[i * 3] += Math.sin(t * 0.3 + phases[i]) * 0.002;
          p.array[i * 3 + 1] += Math.sin(t * 0.5 + phases[i] * 1.3) * 0.001;
          p.array[i * 3 + 2] += Math.cos(t * 0.4 + phases[i] * 0.7) * 0.001;
        }
        p.needsUpdate = true;
        
        // Pulsing glow
        c.material.opacity = 0.4 + Math.sin(t * 2) * 0.3;
        c.material.size = 0.06 + Math.sin(t * 1.5) * 0.02;
      }
    });
  }

  // ═══ VISUAL EFFECTS ═══
  function triggerEffect(type, intensity = 1) {
    kodamas.forEach(k => k.rt = 0);
    
    if (type === 'burst' && Math.random() < 0.2 * intensity) {
      spawnNew();
    }
    
    if (type === 'evolve') {
      playEvolution();
      for (let i = 0; i < 2; i++) {
        if (kodamas.length < MAX_KODAMAS) {
          setTimeout(() => spawnNew(), i * 500);
        }
      }
    }
  }


  // ═══════════════════════════════════════════════════════════════
  // v12 — WORLD FX & GUARDIAN HOOKS (used by gameEngine.js)
  // ═══════════════════════════════════════════════════════════════
  const fxParticles = []; // {points, vel, life, type}
  const territories = {};
  let worldTree = null, worldTreeGrow = 0;
  const fragments = [];

  function updateWorldFx(dt) {
    // Sky lerp
    skyCurrent.lerp(skyTarget, Math.min(1, dt * 0.8));
    if (scene.background) scene.background.copy(skyCurrent);
    if (skyDome) { const l = skyCurrent.getHSL({}).l; skyDome.material.color.setScalar(0.35 + l * 6); skyDome.rotation.y += dt * 0.004; }
    if (scene.fog) scene.fog.color.copy(skyCurrent);
    // Shake
    if (shakeAmount > 0.001) {
      camera.position.x += (Math.random() - 0.5) * shakeAmount;
      camera.position.y += (Math.random() - 0.5) * shakeAmount;
      shakeAmount *= Math.pow(0.05, dt);
    }
    // Particles
    for (let i = fxParticles.length - 1; i >= 0; i--) {
      const p = fxParticles[i];
      p.life -= dt;
      const pos = p.points.geometry.attributes.position;
      for (let j = 0; j < pos.count; j++) {
        pos.setX(j, pos.getX(j) + p.vel[j * 3] * dt);
        pos.setY(j, pos.getY(j) + p.vel[j * 3 + 1] * dt);
        pos.setZ(j, pos.getZ(j) + p.vel[j * 3 + 2] * dt);
        if (p.gravity) p.vel[j * 3 + 1] -= p.gravity * dt;
        if (p.type === 'rain' && pos.getY(j) < 0) { pos.setY(j, 30 + Math.random() * 20); }
      }
      pos.needsUpdate = true;
      p.points.material.opacity = Math.max(0, Math.min(1, p.life / 2));
      if (p.life <= 0) { scene.remove(p.points); p.points.geometry.dispose(); fxParticles.splice(i, 1); }
    }
    // Floating fragments bob
    fragments.forEach(function(f) { f.g.userData.bob += dt * 0.4; f.g.position.y += Math.sin(f.g.userData.bob) * 0.004; f.g.rotation.y += dt * 0.02; });
    // World tree growth
    if (worldTree && worldTreeGrow < 1) {
      worldTreeGrow = Math.min(1, worldTreeGrow + dt * 0.15);
      const e = 1 - Math.pow(1 - worldTreeGrow, 3);
      worldTree.scale.setScalar(e);
    }
  }

  function burst(x, y, z, count, color, opts) {
    opts = opts || {};
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3), vel = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = x + (Math.random() - 0.5) * (opts.spread || 0.5);
      pos[i * 3 + 1] = y; pos[i * 3 + 2] = z + (Math.random() - 0.5) * (opts.spread || 0.5);
      const a = Math.random() * Math.PI * 2, sp = (opts.speed || 3) * (0.5 + Math.random());
      vel[i * 3] = Math.cos(a) * sp; vel[i * 3 + 1] = (opts.up || 4) * Math.random(); vel[i * 3 + 2] = Math.sin(a) * sp;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({ color: color, size: opts.size || 0.25, transparent: true, opacity: 1, depthWrite: false });
    const pts = new THREE.Points(geo, mat);
    scene.add(pts);
    fxParticles.push({ points: pts, vel: vel, life: opts.life || 2.5, gravity: opts.gravity != null ? opts.gravity : 4, type: 'burst' });
  }

  function meteorRain(duration, color) {
    const count = 400;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3), vel = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2, d = Math.random() * 40;
      pos[i * 3] = Math.cos(a) * d; pos[i * 3 + 1] = 20 + Math.random() * 40; pos[i * 3 + 2] = Math.sin(a) * d;
      vel[i * 3] = -6; vel[i * 3 + 1] = -18 - Math.random() * 10; vel[i * 3 + 2] = -3;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({ color: color || 0xfff0a0, size: 0.5, transparent: true, opacity: 1, depthWrite: false });
    const pts = new THREE.Points(geo, mat);
    scene.add(pts);
    fxParticles.push({ points: pts, vel: vel, life: duration || 8, gravity: 0, type: 'rain' });
  }

  function tintKodama(k, hex, intensity) {
    const c = new THREE.Color(hex);
    k.g.traverse(function(m) {
      if (m.isMesh && m.material) {
        if (m.material.emissive) { m.material.emissive.copy(c); m.material.emissiveIntensity = intensity; }
        m.material.color.lerp(c, 0.15);
      }
    });
  }

  function spawnGuardian(gd) {
    if (!ready) return null;
    let k = kodamas.find(function(x) { return x.id === gd.instanceId; });
    const rankIntensity = { wisp: 0.15, spirit: 0.35, elder: 0.7, legend: 1.2 }[gd.rank] || 0.3;
    if (!k) {
      k = createKodama(gd.x, gd.z, gd.scale, gd.instanceId);
      if (!k) return null;
      k.currentAlpha = 0; k.al = 0;
      k.g.traverse(function(m) { if (m.isMesh && m.material) { m.material.transparent = true; m.material.opacity = 0; } });
    }
    k.isGuardian = true; k.owner = gd; k.s = gd.scale;
    k.neverVanish = gd.rank === 'legend' || gd.rank === 'elder';
    k.vanishTimer = Math.max(k.vanishTimer || 0, 60);
    tintKodama(k, gd.clanColor, rankIntensity);
    if (gd.rank === 'legend' && !k.crown) {
      const cg = new THREE.TorusGeometry(0.35, 0.04, 8, 24);
      const cm = new THREE.MeshBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0.9 });
      k.crown = new THREE.Mesh(cg, cm); k.crown.rotation.x = Math.PI / 2; k.crown.position.y = 2.2; k.g.add(k.crown);
    }
    return k;
  }

  function jumpKodama(k) { if (k) { k.rt = 0; k.bp = 0; burst(k.wx, 0.5, k.wz, 40, k.owner ? k.owner.clanColor : 0xffffff, { speed: 1.5, up: 3, size: 0.15 }); } }

  function setTerritories(clans) {
    Object.keys(clans).forEach(function(key) {
      const c = clans[key];
      if (!territories[key]) {
        const geo = new THREE.RingGeometry(3, 29, 48, 1, c.quadrant * Math.PI / 2, Math.PI / 2);
        const mat = new THREE.MeshBasicMaterial({ color: c.color, transparent: true, opacity: 0.08, side: THREE.DoubleSide, depthWrite: false });
        const m = new THREE.Mesh(geo, mat); m.rotation.x = -Math.PI / 2; m.position.y = 0.06;
        scene.add(m); territories[key] = m;
      }
      territories[key].material.opacity = 0.04 + (c.influence / 100) * 0.35;
    });
  }

  function setBiome(key) {
    const hue = { grove: 0.30, forge: 0.08, fang: 0.98, veil: 0.72 }[key] || 0.30;
    foliageMeshes.forEach(function(f) { const b = f.userData.baseHSL; f.material.color.setHSL(hue + (b.h - 0.30), b.s, b.l); });
    grassMeshes.forEach(function(g) { g.material.color.setHSL(hue, 0.5, 0.25); });
    if (forestGlow) forestGlow.color.setHSL(hue, 0.6, 0.5);
  }

  function setDayTime(tm) {
    // tm 0..1 : 0=midnight 0.25=dawn 0.5=noon 0.75=dusk
    const day = Math.max(0, Math.sin((tm - 0.25) * Math.PI * 2 * 0.5 + Math.PI / 2)); // crude
    const f = Math.max(0.15, Math.sin(tm * Math.PI * 2 - Math.PI / 2) * 0.5 + 0.5);
    dayFactor = f;
    if (mainLight) mainLight.intensity = 0.35 + f * 1.1;
    if (rimLight) rimLight.intensity = 0.3 + (1 - f) * 0.9;
    scene.children.forEach(function(o) { if (o.isAmbientLight) o.intensity = 0.25 + f * 0.35; if (o.isHemisphereLight) o.intensity = 0.2 + f * 0.3; });
  }

  function setSky(hex) { skyTarget.set(hex); }
  function shake(a) { shakeAmount = Math.max(shakeAmount, a); }

  function growWorldTree() {
    if (worldTree) { scene.remove(worldTree); }
    worldTree = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1.6, 14, 12), new THREE.MeshStandardMaterial({ color: 0x4a3520, roughness: 0.9 }));
    trunk.position.y = 7; trunk.castShadow = true; worldTree.add(trunk);
    for (let i = 0; i < 5; i++) {
      const s = 5 - i * 0.7;
      const fo = new THREE.Mesh(new THREE.SphereGeometry(s, 12, 10), new THREE.MeshStandardMaterial({ color: new THREE.Color().setHSL(0.3 + Math.random() * 0.1, 0.6, 0.35), emissive: 0x204020, emissiveIntensity: 0.4, roughness: 0.8 }));
      fo.position.set((Math.random() - 0.5) * 3, 12 + i * 2.2, (Math.random() - 0.5) * 3); fo.castShadow = true; worldTree.add(fo);
    }
    const glow = new THREE.PointLight(0x90ff90, 3, 40); glow.position.y = 14; worldTree.add(glow);
    worldTree.scale.setScalar(0.001); worldTreeGrow = 0;
    scene.add(worldTree);
    burst(0, 2, 0, 300, 0xa0ffa0, { spread: 4, speed: 4, up: 8, size: 0.3, life: 4 });
  }

  function addFragment(fr) {
    if (fragments.find(function(f) { return f.name === fr.name; })) return;
    const g = new THREE.Group();
    const top = new THREE.Mesh(new THREE.CylinderGeometry(fr.radius, fr.radius * 0.8, 1.5, 32), new THREE.MeshStandardMaterial({ color: 0x2a4020, roughness: 0.9 }));
    top.receiveShadow = true; g.add(top);
    const rock = new THREE.Mesh(new THREE.ConeGeometry(fr.radius * 0.8, 8, 24), new THREE.MeshStandardMaterial({ color: 0x3a3530 }));
    rock.rotation.x = Math.PI; rock.position.y = -4.5; g.add(rock);
    for (let i = 0; i < Math.floor(fr.radius * 2); i++) {
      const a = Math.random() * Math.PI * 2, d = Math.random() * (fr.radius - 1);
      const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 2.5, 6), new THREE.MeshStandardMaterial({ color: 0x3a2a15 }));
      tr.position.set(Math.cos(a) * d, 1.25 + 0.75, Math.sin(a) * d); g.add(tr);
      const fo = new THREE.Mesh(new THREE.SphereGeometry(0.9, 8, 6), new THREE.MeshStandardMaterial({ color: new THREE.Color().setHSL(0.3, 0.6, 0.3) }));
      fo.position.set(Math.cos(a) * d, 3.2, Math.sin(a) * d); g.add(fo);
    }
    g.position.set(Math.cos(fr.angle) * fr.distance, -1 + (Math.random() - 0.5) * 4, Math.sin(fr.angle) * fr.distance);
    g.userData.bob = Math.random() * 6.28;
    scene.add(g); fragments.push({ name: fr.name, g: g });
    burst(g.position.x, 2, g.position.z, 400, 0xc0f0ff, { spread: fr.radius, speed: 5, up: 10, size: 0.35, life: 5 });
  }

  function projectToScreen(x, y, z) {
    const v = new THREE.Vector3(x, y, z).project(camera);
    if (v.z > 1) return null;
    return { x: (v.x + 1) / 2 * innerWidth, y: (1 - v.y) / 2 * innerHeight, depth: v.z };
  }

  function focusOn(k, seconds) {
    if (!k) return;
    autoRotate = false; lastInteraction = Date.now() + (seconds || 4) * 1000 - autoResumeDelay;
    const fx = (typeof k.wx === 'number') ? k.wx : (k.position ? k.position.x : 0), fz = (typeof k.wz === 'number') ? k.wz : (k.position ? k.position.z : 0);
    if (!isFinite(fx) || !isFinite(fz)) return;
    cameraTarget.set(fx, 1, fz); cameraDistance = k.isGuardian || typeof k.wx === 'number' ? 12 : 22; updateCameraPosition();
    setTimeout(function() { cameraTarget.set(0, 0, 0); cameraDistance = 45; updateCameraPosition(); }, (seconds || 4) * 1000);
  }


  // ═══ v13 — BALANCE (forest ↔ forge), RAIN, THE TALL ONE ═══
  let currentBalance = 1, targetBalance = 1;
  const walkers = [];
  let rainPts = null, rainUntil = 0;

  function setBalance(b) { targetBalance = Math.max(-1, Math.min(1, b)); }

  function applyBalance(b) {
    // b = +1 lush Ghibli greens, 0 neutral, -1 iron ash (grey-ochre, dead foliage)
    const t = (1 - b) / 2; // 0 lush … 1 ash
    foliageMeshes.forEach(function(f) {
      const base = f.userData.baseHSL;
      f.material.color.setHSL(base.h * (1 - t) + 0.08 * t, base.s * (1 - t) + 0.15 * t, base.l * (1 - t * 0.5) + 0.02 * t);
    });
    grassMeshes.forEach(function(g) { g.material.color.setHSL(0.27 * (1 - t) + 0.09 * t, 0.5 * (1 - t) + 0.2 * t, 0.25 - 0.08 * t); });
    if (forestGlow) { forestGlow.color.setHSL(0.3 * (1 - t) + 0.07 * t, 0.6, 0.5); forestGlow.intensity = 2 - t; }
    if (islandTop) islandTop.material.color.setHSL(0.27 * (1 - t) + 0.08 * t, 0.35 * (1 - t) + 0.12 * t, 0.2 - 0.05 * t);
    if (scene.fog) scene.fog.density = 0.008 + t * 0.006;
  }

  function startRain(seconds) {
    if (!rainPts) {
      const count = 1500, geo = new THREE.BufferGeometry(), pos = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) { const a = Math.random() * 6.283, d = Math.random() * 40; pos[i * 3] = Math.cos(a) * d; pos[i * 3 + 1] = Math.random() * 40; pos[i * 3 + 2] = Math.sin(a) * d; }
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      rainPts = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xbfe0ff, size: 0.12, transparent: true, opacity: 0.6, depthWrite: false }));
      scene.add(rainPts);
    }
    rainPts.visible = true; rainUntil = performance.now() + seconds * 1000;
  }

  function tallOneWalk(seconds) {
    // An immense, translucent night-walking spirit crosses behind the island (original design)
    const g = new THREE.Group();
    const mat = new THREE.MeshBasicMaterial({ color: 0x9fd0ff, transparent: true, opacity: 0.16, depthWrite: false });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(6, 10, 70, 24, 1, true), mat); body.position.y = 35; g.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(8, 24, 16), mat.clone()); head.position.y = 74; g.add(head);
    const glow = new THREE.PointLight(0x8fc8ff, 4, 220); glow.position.y = 60; g.add(glow);
    const stars = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(Array.from({ length: 900 }, function() { return (Math.random() - 0.5) * 16; })), 3)),
      new THREE.PointsMaterial({ color: 0xffffff, size: 0.5, transparent: true, opacity: 0.8 }));
    stars.position.y = 40; stars.scale.y = 4.5; g.add(stars);
    g.position.set(-140, -30, -90); g.userData = { t: 0, dur: seconds || 24 };
    scene.add(g); walkers.push(g);
  }

  function updateWalkersAndRain(dt) {
    if (Math.abs(currentBalance - targetBalance) > 0.002) { currentBalance += (targetBalance - currentBalance) * Math.min(1, dt * 0.4); applyBalance(currentBalance); }
    if (rainPts && rainPts.visible) {
      const pos = rainPts.geometry.attributes.position;
      for (let j = 0; j < pos.count; j++) { let y = pos.getY(j) - dt * 28; if (y < 0) y = 40; pos.setY(j, y); }
      pos.needsUpdate = true;
      if (performance.now() > rainUntil) rainPts.visible = false;
    }
    for (let i = walkers.length - 1; i >= 0; i--) {
      const w = walkers[i]; w.userData.t += dt / w.userData.dur; const t = w.userData.t;
      w.position.x = -140 + t * 280; w.position.y = -30 + Math.sin(t * Math.PI) * 10 + Math.sin(t * 40) * 1.2;
      w.children[0].material.opacity = 0.16 * Math.sin(t * Math.PI);
      if (t >= 1) { scene.remove(w); walkers.splice(i, 1); }
    }
  }


  // ═══════════════════════════════════════════════════════════════
  // v14 — CINEMATIC VISUALS: bloom, mist, pond, light shafts
  // ═══════════════════════════════════════════════════════════════
  let composer = null, bloomPass = null;
  const mistPlanes = [], shafts = [];
  let pond = null, pondT = 0, embersPts = null;
  const unlocked = {};

  // ═══ v15 — PAINTED SKY (Higgsfield backdrop) ═══
  let skyDome = null;
  function setupPaintedSky() {
    const base = (window.ART_BASE || 'assets/art/');
    new THREE.TextureLoader().load(base + 'backdrop.jpg', function(tex) {
      tex.mapping = THREE.EquirectangularReflectionMapping; tex.wrapS = THREE.RepeatWrapping;
      const geo = new THREE.SphereGeometry(260, 48, 24);
      const mat = new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, transparent: true, opacity: 0.9, depthWrite: false, fog: false });
      skyDome = new THREE.Mesh(geo, mat); skyDome.rotation.y = Math.PI; scene.add(skyDome);
      console.log('[V] Painted sky loaded');
    }, undefined, function() { console.warn('[V] painted sky not available'); });
  }

  function setupPostFX() {
    if (composer || !THREE.EffectComposer || !THREE.UnrealBloomPass) return;
    try {
      composer = new THREE.EffectComposer(renderer);
      composer.addPass(new THREE.RenderPass(scene, camera));
      bloomPass = new THREE.UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.22, 0.5, 0.92);
      composer.addPass(bloomPass);
      window.addEventListener('resize', function() { composer.setSize(innerWidth, innerHeight); });
      console.log('[V] Bloom enabled');
    } catch (e) { composer = null; console.warn('[V] PostFX unavailable', e.message); }
  }

  function makeMistTexture() {
    const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
    const grd = g.createRadialGradient(128, 128, 10, 128, 128, 128); grd.addColorStop(0, 'rgba(255,255,255,0.35)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd; g.fillRect(0, 0, 256, 256); return new THREE.CanvasTexture(c);
  }

  function unlockMist() {
    if (unlocked.mist) return; unlocked.mist = true;
    const tex = makeMistTexture();
    for (let i = 0; i < 18; i++) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(22, 9), new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.22, depthWrite: false, color: 0xbfe6d0 }));
      const a = Math.random() * 6.283, d = 6 + Math.random() * 22;
      m.position.set(Math.cos(a) * d, 0.8 + Math.random() * 2.5, Math.sin(a) * d); m.rotation.y = Math.random() * 6.283;
      m.userData = { speed: 0.2 + Math.random() * 0.4, phase: Math.random() * 6.283 };
      scene.add(m); mistPlanes.push(m);
    }
  }

  function unlockPond() {
    if (unlocked.pond) return; unlocked.pond = true;
    pond = new THREE.Mesh(new THREE.CircleGeometry(4.5, 48), new THREE.MeshStandardMaterial({ color: 0x3a8fb0, emissive: 0x0a3040, emissiveIntensity: 0.6, roughness: 0.15, metalness: 0.6, transparent: true, opacity: 0.85 }));
    pond.rotation.x = -Math.PI / 2; pond.position.set(0, 0.12, 0); scene.add(pond);
    for (let i = 0; i < 3; i++) { const r = new THREE.Mesh(new THREE.RingGeometry(1 + i * 1.2, 1.15 + i * 1.2, 48), new THREE.MeshBasicMaterial({ color: 0xbfe6ff, transparent: true, opacity: 0.25, depthWrite: false })); r.rotation.x = -Math.PI / 2; r.position.y = 0.14; r.userData.i = i; pond.add(r); }
    const glow = new THREE.PointLight(0x6fc8ff, 1.5, 18); glow.position.set(0, 1.5, 0); scene.add(glow);
  }

  function unlockShafts() {
    if (unlocked.shafts) return; unlocked.shafts = true;
    for (let i = 0; i < 7; i++) {
      const sh = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 3.5, 40, 12, 1, true), new THREE.MeshBasicMaterial({ color: 0xfff3c0, transparent: true, opacity: 0.045, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
      const a = Math.random() * 6.283, d = 4 + Math.random() * 18;
      sh.position.set(Math.cos(a) * d, 20, Math.sin(a) * d); sh.rotation.z = 0.35; sh.rotation.y = a; sh.userData.phase = Math.random() * 6.283;
      scene.add(sh); shafts.push(sh);
    }
  }

  function unlockEmbers() {
    if (unlocked.embers) return; unlocked.embers = true;
    const n = 250, geo = new THREE.BufferGeometry(), pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { const a = Math.PI / 2 * 1 + Math.random() * Math.PI / 2, d = 6 + Math.random() * 18; pos[i * 3] = Math.cos(a) * d; pos[i * 3 + 1] = Math.random() * 6; pos[i * 3 + 2] = Math.sin(a) * d; }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    embersPts = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xff9a4a, size: 0.14, transparent: true, opacity: 0.85, depthWrite: false }));
    scene.add(embersPts);
  }

  function applyUnlocks(list) {
    (list || []).forEach(function(u) {
      if (u === 'mist') unlockMist(); if (u === 'pond') unlockPond(); if (u === 'shafts') unlockShafts(); if (u === 'embers') unlockEmbers();
      if (u === 'bloom' && bloomPass) bloomPass.strength = 0.35;
      if (CAST[u]) showCharacter(u, true);
    });
  }

  function updateCinematic(dt) {
    mistPlanes.forEach(function(m) { m.position.x += Math.cos(m.userData.phase) * m.userData.speed * dt; m.position.z += Math.sin(m.userData.phase) * m.userData.speed * dt; m.material.opacity = 0.14 + 0.1 * Math.sin(t * 0.3 + m.userData.phase); if (m.position.length() > 30) m.position.multiplyScalar(0.2); m.lookAt(camera.position.x, m.position.y, camera.position.z); });
    shafts.forEach(function(sh) { sh.material.opacity = (0.03 + 0.03 * Math.sin(t * 0.4 + sh.userData.phase)) * dayFactor; });
    if (pond) { pondT += dt; pond.children.forEach(function(r) { const k = ((pondT * 0.25 + r.userData.i / 3) % 1); r.scale.setScalar(0.4 + k * 1.2); r.material.opacity = 0.3 * (1 - k); }); }
    if (embersPts) { const pos = embersPts.geometry.attributes.position; for (let j = 0; j < pos.count; j++) { let y = pos.getY(j) + dt * (0.8 + (j % 5) * 0.2); if (y > 7) y = 0; pos.setY(j, y); } pos.needsUpdate = true; }
    updateCast(dt);
  }

  // ═══════════════════════════════════════════════════════════════
  // v14 — THE CAST (original characters, procedural low-poly)
  // ═══════════════════════════════════════════════════════════════
  const CAST = {};
  function mat(c, e, ei) { return new THREE.MeshStandardMaterial({ color: c, emissive: e || 0x000000, emissiveIntensity: ei || 0, roughness: 0.85 }); }

  function buildMossback() {
    const g = new THREE.Group();
    const shell = new THREE.Mesh(new THREE.SphereGeometry(4.2, 18, 12, 0, 6.283, 0, 1.6), mat(0x4a6a3a)); shell.position.y = 2.2; shell.scale.y = 0.75; g.add(shell);
    const body = new THREE.Mesh(new THREE.SphereGeometry(3.6, 14, 10), mat(0x6a5a45)); body.position.y = 2; body.scale.y = 0.55; g.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(1.1, 12, 8), mat(0x6a5a45, 0x203010, 0.2)); head.position.set(4.3, 2.2, 0); g.add(head);
    [[-1, 1, 1], [1, 1, 1], [-1, 1, -1], [1, 1, -1]].forEach(function(o) { const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.7, 1.8, 8), mat(0x5a4a38)); leg.position.set(o[0] * 2.4, 0.9, o[2] * 1.8); g.add(leg); });
    for (let i = 0; i < 6; i++) { const a = i / 6 * 6.283, tr = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.14, 2.2, 6), mat(0x3a2a15)); tr.position.set(Math.cos(a) * 1.8, 5.4, Math.sin(a) * 1.8 * 0.75); g.add(tr); const fo = new THREE.Mesh(new THREE.SphereGeometry(0.9, 8, 6), mat(0x4fa04f, 0x1a4a1a, 0.15)); fo.position.set(Math.cos(a) * 1.8, 6.8, Math.sin(a) * 1.8 * 0.75); g.add(fo); }
    const gl = new THREE.PointLight(0x9fdf9f, 1.2, 14); gl.position.y = 6; g.add(gl);
    g.scale.setScalar(0.9); g.userData = { kind: 'mossback', angle: 0, radius: 21, speed: 0.045 }; return g;
  }
  function buildEmberEye() {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.95, 3.2, 12), mat(0x8a8a90)); body.rotation.z = Math.PI / 2; body.position.y = 1.6; g.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.75, 12, 10), mat(0x9a9aa0)); head.position.set(2, 2.1, 0); g.add(head);
    [-1, 1].forEach(function(sgn) { const ear = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.6, 6), mat(0x7a7a80)); ear.position.set(2, 2.85, sgn * 0.4); g.add(ear);
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff8030 })); eye.position.set(2.6, 2.25, sgn * 0.3); g.add(eye); });
    [[-1, 1], [1, 1], [-1, -1], [1, -1]].forEach(function(o) { const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 1.4, 6), mat(0x7a7a80)); leg.position.set(o[0] * 1.1, 0.7, o[1] * 0.55); g.add(leg); });
    const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.16, 1.6, 6), mat(0x7a7a80)); tail.position.set(-2.1, 2.2, 0); tail.rotation.z = -0.8; g.add(tail);
    const gl = new THREE.PointLight(0xff8030, 0.8, 8); gl.position.set(2.6, 2.2, 0); g.add(gl);
    g.userData = { kind: 'ember_eye', angle: Math.PI, radius: 24, speed: 0.12, prowl: 0 }; return g;
  }
  function buildBlightling() {
    const g = new THREE.Group();
    const core = new THREE.Mesh(new THREE.IcosahedronGeometry(1.6, 1), new THREE.MeshStandardMaterial({ color: 0x120306, emissive: 0x6a0016, emissiveIntensity: 0.9, roughness: 0.4 })); core.position.y = 2; g.add(core);
    const tendrils = [];
    for (let i = 0; i < 26; i++) { const tnd = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.16, 3.5 + Math.random() * 2.5, 5), new THREE.MeshStandardMaterial({ color: 0x0a0104, emissive: 0x3a000c, emissiveIntensity: 0.6 })); tnd.position.y = 2; tnd.userData = { a: Math.random() * 6.283, b: Math.random() * 6.283, ph: Math.random() * 6.283 }; g.add(tnd); tendrils.push(tnd); }
    const gl = new THREE.PointLight(0xff1040, 2, 20); gl.position.y = 2.5; g.add(gl);
    g.userData = { kind: 'blightling', angle: Math.PI * 0.5, radius: 15, speed: 0.06, tendrils: tendrils }; return g;
  }
  function buildHuman(color, lantern, kind, side) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.42, 1.5, 10), mat(color)); body.position.y = 1.0; g.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 10), mat(kind === 'wanderer' ? 0xf0f0ff : 0xd8b090)); head.position.y = 2.0; g.add(head);
    if (kind === 'wanderer') { const mask = new THREE.Mesh(new THREE.CircleGeometry(0.26, 16), new THREE.MeshBasicMaterial({ color: 0xffffff })); mask.position.set(0.28, 2.02, 0); mask.rotation.y = Math.PI / 2; g.add(mask); }
    if (lantern) { const l = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), new THREE.MeshBasicMaterial({ color: lantern })); l.position.set(0.5, 1.3, 0.3); g.add(l); const gl = new THREE.PointLight(lantern, 1.4, 9); gl.position.copy(l.position); g.add(gl); }
    g.userData = { kind: kind, angle: side === 'industry' ? Math.PI / 2 * 1.5 : 0, radius: kind === 'wanderer' ? 8 : 20, speed: 0.08, side: side }; return g;
  }

  // ═══ v15 — PAINTED CAST (Higgsfield concept art as billboards) ═══
  const SPRITE_SPEC = { mossback: { h: 7.5, r: 21, speed: 0.045, a: 0 }, ember_eye: { h: 4.2, r: 24, speed: 0.12, a: Math.PI },
                        ironwright: { h: 3.2, r: 20, speed: 0.08, a: Math.PI * 0.75 }, wanderer: { h: 3.4, r: 8, speed: 0.08, a: 0 }, blightling: { h: 4.5, r: 15, speed: 0.06, a: Math.PI * 0.5 } };
  const texLoader = new THREE.TextureLoader();
  function buildSprite(key) {
    const spec = SPRITE_SPEC[key], base = (window.ART_BASE || 'assets/art/');
    const g = new THREE.Group();
    const mat = new THREE.SpriteMaterial({ transparent: true, opacity: 0, depthWrite: false, fog: true });
    const sp = new THREE.Sprite(mat); sp.center.set(0.5, 0); g.add(sp);
    texLoader.load(base + key + '_sprite.png', function(tex) {
      tex.encoding = THREE.sRGBEncoding; tex.minFilter = THREE.LinearMipmapLinearFilter; mat.map = tex; mat.needsUpdate = true;
      const ar = tex.image.width / tex.image.height; sp.scale.set(spec.h * ar, spec.h, 1); g.userData.ready = true;
    }, undefined, function() { console.warn('[V] sprite missing for', key); g.userData.failed = true; });
    // soft contact shadow
    const sh = new THREE.Mesh(new THREE.CircleGeometry(spec.h * 0.28, 24), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false }));
    sh.rotation.x = -Math.PI / 2; sh.position.y = 0.05; g.add(sh);
    const glowColor = { mossback: 0x9fdf9f, ember_eye: 0xff8030, ironwright: 0xffb060, wanderer: 0xc0d0ff, blightling: 0xff1040 }[key];
    const gl = new THREE.PointLight(glowColor, key === 'blightling' ? 2 : 1, 12); gl.position.y = spec.h * 0.5; g.add(gl);
    g.userData = { kind: key, angle: spec.a, radius: spec.r, speed: spec.speed, sprite: sp, mat: mat, isSprite: true, prowl: 0 };
    return g;
  }

  function showCharacter(key, on) {
    if (on && !CAST[key] && SPRITE_SPEC[key] && !window.FORCE_PROCEDURAL_CAST) {
      const g = buildSprite(key); g.userData.alpha = 0; scene.add(g); CAST[key] = g;
      burst(Math.cos(g.userData.angle) * g.userData.radius, 1, Math.sin(g.userData.angle) * g.userData.radius, 200, key === 'blightling' ? 0xff1040 : 0xffffff, { spread: 3, speed: 2, up: 4, size: 0.25, life: 3 });
      return;
    }
    if (on && !CAST[key]) {
      const b = { mossback: buildMossback, ember_eye: buildEmberEye, blightling: buildBlightling,
                  ironwright: function() { return buildHuman(0xb06030, 0xffb060, 'ironwright', 'industry'); },
                  wanderer: function() { return buildHuman(0x505070, 0xc0d0ff, 'wanderer', 'neutral'); } }[key];
      if (!b) return; let g; try { g = b(); } catch (e) { console.warn('[V] cast build failed', key, e.message); return; } g.userData.alpha = 0; g.scale.multiplyScalar(0.001); scene.add(g); CAST[key] = g;
      burst(Math.cos(g.userData.angle) * g.userData.radius, 1, Math.sin(g.userData.angle) * g.userData.radius, 200, key === 'blightling' ? 0xff1040 : 0xffffff, { spread: 3, speed: 2, up: 4, size: 0.25, life: 3 });
    }
    if (!on && CAST[key]) { scene.remove(CAST[key]); delete CAST[key]; }
  }

  function updateCast(dt) {
    Object.keys(CAST).forEach(function(k) {
      const g = CAST[k], u = g.userData;
      if (u.isSprite) {
        if (!u.born) u.born = performance.now();
        if (u.alpha < 1) u.alpha = Math.min(1, (performance.now() - u.born) / 1800);
        u.mat.opacity = u.alpha * (k === 'blightling' ? 0.85 + 0.15 * Math.sin(t * 6) : 1);
        if (k === 'ember_eye') { u.prowl += dt; u.speed = 0.08 + 0.1 * Math.max(0, Math.sin(u.prowl * 0.3)); }
        u.angle += u.speed * dt;
        g.position.set(Math.cos(u.angle) * u.radius, k === 'blightling' ? 0.3 + Math.sin(t * 2) * 0.3 : 0, Math.sin(u.angle) * u.radius);
        u.sprite.position.y = (k === 'mossback' ? Math.abs(Math.sin(t * 0.8)) * 0.12 : (k === 'blightling' ? 0 : Math.abs(Math.sin(t * 4)) * 0.06));
        // face the walking direction: mirror the painting when moving left relative to camera
        const dirx = -Math.sin(u.angle), camx = camera.position.x - g.position.x;
        const flip = (dirx * (camera.position.z - g.position.z) - (Math.cos(u.angle)) * camx) > 0 ? -1 : 1;
        if (u.sprite.scale.x !== 0) u.sprite.scale.x = Math.abs(u.sprite.scale.x) * flip;
        return;
      }
      if (u.alpha < 1) { u.alpha = Math.min(1, u.alpha + dt * 0.5); const sc = (k === 'mossback' ? 0.9 : 1) * (0.001 + 0.999 * u.alpha); g.scale.setScalar(sc); }
      if (k === 'ember_eye') { u.prowl += dt; u.speed = 0.08 + 0.1 * Math.max(0, Math.sin(u.prowl * 0.3)); }
      u.angle += u.speed * dt * (k === 'wanderer' ? 1 : 1) * (k === 'blightling' ? 1 : 1);
      const x = Math.cos(u.angle) * u.radius, z = Math.sin(u.angle) * u.radius;
      g.position.set(x, k === 'blightling' ? 0.4 + Math.sin(t * 2) * 0.3 : 0, z);
      g.rotation.y = -u.angle + (k === 'mossback' || k === 'ember_eye' ? Math.PI : Math.PI);
      if (k === 'mossback') g.position.y = Math.abs(Math.sin(t * 0.8)) * 0.15;
      if (k === 'blightling') u.tendrils.forEach(function(tn, i) { tn.rotation.x = Math.sin(t * 1.5 + tn.userData.ph) * 0.9 + tn.userData.a; tn.rotation.z = Math.cos(t * 1.1 + tn.userData.ph) * 0.9 + tn.userData.b; });
      if (k === 'ironwright' || k === 'wanderer') g.position.y = Math.abs(Math.sin(t * 4)) * 0.05;
    });
  }

  function bossPulse(strength) {
    const b = CAST.blightling; if (!b) return;
    burst(b.position.x, 2, b.position.z, 300, 0xff1040, { spread: 2, speed: 3 + strength * 3, up: 3, size: 0.25, life: 3 });
    shake(0.3 + strength * 0.5);
  }
  function castSpeakFx(key) { const g = CAST[key]; if (!g) return null; const h = (SPRITE_SPEC[key] ? SPRITE_SPEC[key].h : 3); burst(g.position.x, h * 0.6, g.position.z, 60, 0xffffff, { spread: 1, speed: 0.6, up: 1.5, size: 0.15, life: 2 }); return { x: g.position.x, y: h, z: g.position.z }; }

  // ═══ PUBLIC API ═══
  window.VisualEngine = {
    init() {
      console.log('[V] init() called');
      console.log('[V] THREE version: r' + THREE.REVISION);
      
      try {
        initScene();
        setupPostFX();
        setupPaintedSky();
        console.log('[V] Scene initialized');
      } catch(e) {
        console.error('[V] initScene failed:', e);
        return;
      }

      function startAudioOnce() {
        initAudio();
        startMusic();
        document.removeEventListener('click', startAudioOnce);
        document.removeEventListener('touchstart', startAudioOnce);
        document.removeEventListener('keydown', startAudioOnce);
      }
      document.addEventListener('click', startAudioOnce);
      document.addEventListener('touchstart', startAudioOnce);
      document.addEventListener('keydown', startAudioOnce);

      console.log('[V] Loading model...');
      loadModel().then(() => {
        console.log('[V] Model loaded successfully!');
        console.log('[V] ready =', ready);
        
        // Check initial state from window
        if (window.INITIAL_STATE && window.INITIAL_STATE.visual_instances) {
          console.log('[V] Restoring from INITIAL_STATE:', window.INITIAL_STATE.visual_instances.length, 'instances');
          S = Object.assign({}, S, window.INITIAL_STATE);
          restoreInstances(window.INITIAL_STATE.visual_instances);
        }
        
        // If no instances restored, create prime
        if (kodamas.length === 0) {
          console.log('[V] No instances, creating prime kodama');
          createKodama(0, 0.5, 1, 'kodama_prime');
        }
        
        console.log('[V] Kodamas count:', kodamas.length);
      }).catch(e => {
        console.error('[V] Model load FAILED:', e);
      });

      // Sync periodically
      setInterval(syncToServer, 30000);

      // Render loop
      console.log('[V] Starting render loop');
      (function loop() {
        requestAnimationFrame(loop);
        const dt = Math.min(clock.getDelta(), 0.05);
        t += dt;
        updateAutoRotate(dt);
        updateWorldFx(dt);
        updateWalkersAndRain(dt);
        updateCinematic(dt);
        tryDuplicate(dt);
        updateVanishBehavior(dt);
        update(dt);
        updateFireflies();
        if (composer) composer.render(); else renderer.render(scene, camera);
      })();
      
      console.log('[V] init() complete');
    },

    updateState(s) {
      const prevStage = S.evolution_stage;
      S = Object.assign({}, S, s);
      
      // Restore instances if newly received and we have fewer
      if (s.visual_instances && s.visual_instances.length > kodamas.length) {
        restoreInstances(s.visual_instances);
      }
      
      // Show thought if changed
      if (s.last_thought && s.last_thought.text && Date.now() - lastThoughtTime > 10000) {
        showThought(s.last_thought.text);
      }
    },

    triggerEffect,
    setSpeaking(v) { speaking = v; },
    forceDuplicate() { if (ready && kodamas.length < MAX_KODAMAS) spawnNew(); },
    getKodamaCount() { return kodamas.length; },
    showThought,
    getInstances() {
      return kodamas.map(k => ({ id: k.id, x: k.wx, z: k.wz, scale: k.s }));
    },
    // ═══ v12 GAME HOOKS ═══
    spawnGuardian, jumpKodama, tintKodama, burst, meteorRain, setTerritories, setBiome, setDayTime, setSky, shake,
    growWorldTree, addFragment, projectToScreen, focusOn,
    setBalance, startRain, tallOneWalk,
    applyUnlocks, showCharacter, bossPulse, castSpeakFx, getCast() { return CAST; },
    setupPostFX,
    getKodama(id) { return kodamas.find(function(k) { return k.id === id; }) || null; },
    getGuardians() { return kodamas.filter(function(k) { return k.isGuardian; }); },
    spawnSpirits(n, x, z) { for (let i = 0; i < n; i++) { if (kodamas.length >= MAX_KODAMAS) break; const a = Math.random() * 6.28, d = Math.random() * 3; const k = createKodama((x || 0) + Math.cos(a) * d, (z || 0) + Math.sin(a) * d, 0.3 + Math.random() * 0.6); if (k) { k.currentAlpha = 0; } } },
    vanishHalf() { kodamas.forEach(function(k, i) { if (i > 0 && !k.neverVanish && Math.random() < 0.5) k.vanishTimer = Math.random() * 2; }); },
    allDance() { kodamas.forEach(function(k) { k.rt = Math.random() * 0.5; k.bp = 0; }); },
    // ═══ AI BEHAVIOR TRIGGERS ═══
    triggerShyMode,      // Make creatures vanish
    triggerCuriousMode,  // Make creatures reappear faster
    teleportRandomKodama,
    getStats() {
      const visible = kodamas.filter(k => !k.isVanished && k.currentAlpha > 0.5).length;
      const vanished = kodamas.filter(k => k.isVanished).length;
      const fading = kodamas.filter(k => k.currentAlpha > 0.01 && k.currentAlpha < 0.99).length;
      return { total: kodamas.length, visible, vanished, fading };
    }
  };

  console.log('[V] Script loaded');
})();
