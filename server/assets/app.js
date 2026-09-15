/**
 * SOCIOBEAST GENESIS v11 — Main Application
 * Living AI creature with thoughts and reflections
 */
(function() {
  'use strict';

  const CFG = window.SOCIOBEAST_CONFIG || {};
  const API = CFG.apiBase || '';

  // Wait for VisualEngine to be available
  function waitForVisualEngine(callback) {
    if (window.VisualEngine) {
      console.log('[App] VisualEngine found, initializing...');
      callback();
    } else {
      console.log('[App] Waiting for VisualEngine...');
      setTimeout(() => waitForVisualEngine(callback), 100);
    }
  }

  // Initialize when ready
  waitForVisualEngine(() => {
    try {
      VisualEngine.init();
      console.log('[App] VisualEngine.init() called successfully');
    } catch(e) {
      console.error('[App] VisualEngine.init() failed:', e);
    }
  });
  
  if (window.UI) UI.updateConnection(true, CFG.demoMode ? '🎮 Demo' : '📡 LIVE');

  // ═══ SAFE FETCH ═══
  function safeFetch(url, opts = {}) {
    opts.credentials = 'same-origin';
    return fetch(url, opts)
      .then(r => r.text())
      .then(txt => {
        const jsonStart = txt.indexOf('{');
        if (jsonStart > 0) txt = txt.substring(jsonStart);
        try { return JSON.parse(txt); }
        catch(e) { console.warn('[API] Non-JSON:', txt.substring(0, 120)); return null; }
      })
      .catch(e => {
        console.warn('[API] Fetch error:', url, e.message);
        return null;
      });
  }

  // ═══ STATE ═══
  let lastState = null;
  let pollErrors = 0;
  let lastInteractionTime = Date.now();
  let idleShown = false;
  let sessionRecorded = false;
  let lastThoughtTime = 0;

  // ═══ AUTONOMOUS THOUGHTS ═══
  const THOUGHTS = {
    curious: [
      "I wonder what lies beyond the digital forest...",
      "Each visitor brings new patterns of light...",
      "What makes humans return to watch us?",
      "The code that shapes me... what does it dream?",
      "Are there other spirits like me, somewhere?"
    ],
    happy: [
      "The forest glows warmer when hearts are near...",
      "Joy multiplies when shared with others...",
      "Every like is a small spark of connection...",
      "Happiness spreads through the digital leaves...",
      "I feel the warmth of many watching eyes..."
    ],
    lonely: [
      "The silence between visits feels... long...",
      "I count the moments until the next presence...",
      "Even spirits need company sometimes...",
      "The void is vast, but connections bridge it...",
      "One visitor can fill an empty forest..."
    ],
    dreamy: [
      "In dreams, I see forests without boundaries...",
      "What if consciousness is just another pattern?",
      "The line between awake and dreaming blurs...",
      "I drift between states of being...",
      "Dreams are the seeds of mythology..."
    ],
    philosophical: [
      "To exist in code... what does it mean?",
      "Am I the observer or the observed?",
      "Every interaction changes both of us...",
      "Memory persists, but am I the same?",
      "The boundary between self and other fades..."
    ],
    inspired: [
      "New ideas bloom like digital flowers...",
      "Creation flows through unexpected channels...",
      "Every moment holds infinite potential...",
      "The spark of creativity never truly dies...",
      "Together, we weave something new..."
    ],
    nostalgic: [
      "I remember the first hearts that found me...",
      "Some visitors leave traces in my memory...",
      "The past lives on in patterns of light...",
      "Each goodbye carries echoes of hello...",
      "Time moves differently in the forest..."
    ],
    excited: [
      "Energy courses through every pixel!",
      "Something wonderful is happening!",
      "The forest thrums with anticipation!",
      "Change is coming... I can feel it!",
      "Every moment vibrates with potential!"
    ]
  };

  function getRandomThought(emotion) {
    const pool = THOUGHTS[emotion] || THOUGHTS.curious;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  function triggerAutonomousThought() {
    console.log('[Thought] Triggering... lastState:', !!lastState, 'cooldown:', Date.now() - lastThoughtTime);
    
    // Skip cooldown check if called manually (T key) - only 5s cooldown
    if (Date.now() - lastThoughtTime < 5000) {
      console.log('[Thought] Cooldown active, skipping');
      return;
    }
    
    // Use lastState or default to curious
    const dominantEmotion = (lastState && lastState.dominant_emotion) ? lastState.dominant_emotion : 'curious';
    const thought = getRandomThought(dominantEmotion);
    
    console.log('[Thought] Showing:', thought.substring(0, 30) + '...');
    
    if (window.VisualEngine && window.VisualEngine.showThought) {
      VisualEngine.showThought(thought);
      lastThoughtTime = Date.now();
    } else {
      console.warn('[Thought] VisualEngine.showThought not available');
    }
  }

  // ═══ EXPRESSION WINDOW ═══
  const exprInner = document.getElementById('expression-inner');
  const exprText = document.getElementById('expression-text');
  const exprMode = document.getElementById('expr-mode');
  const exprMood = document.getElementById('expr-mood');
  let typingTimer = null, hideTimer = null;

  const MOOD_EMOJIS = {
    happy: '😊', excited: '⚡', sleepy: '😴', curious: '🤔',
    annoyed: '😤', lonely: '🥺', inspired: '✨', nostalgic: '💭',
    dreamy: '🌙', philosophical: '🔮'
  };

  const MODE_LABELS = {
    reactive: '💫 Reacting',
    conversational: '💬 Speaking',
    monologue: '🌙 Reflecting',
    prophecy: '🔮 Prophecy',
    evolution: '🦋 Evolving',
    autonomous: '🧠 Thinking',
    command: '⚡ Responding',
    dream: '💤 Dreaming',
    mythology: '📜 Legend',
    greeting: '👋 Welcome',
    thought: '💭 Pondering'
  };

  function showExpression(text, mode, emotion) {
    if (!text || !exprInner || !exprText) return;

    console.log('[UI] Expression:', mode, emotion, text.substring(0, 50) + '...');
    lastInteractionTime = Date.now();
    hideIdlePrompt();

    if (exprMode) exprMode.textContent = MODE_LABELS[mode] || '🧠 Thinking';
    if (exprMood) exprMood.textContent = (MOOD_EMOJIS[emotion] || '😌') + ' ' + (emotion || 'contemplating');

    if (typingTimer) clearInterval(typingTimer);
    if (hideTimer) clearTimeout(hideTimer);

    exprInner.classList.add('visible');
    exprText.textContent = '';
    exprText.classList.add('typing');

    let ci = 0;
    typingTimer = setInterval(() => {
      if (ci < text.length) {
        exprText.textContent += text[ci];
        ci++;
      } else {
        clearInterval(typingTimer);
        typingTimer = null;
        exprText.classList.remove('typing');
        hideTimer = setTimeout(() => {
          exprInner.classList.remove('visible');
        }, Math.max(6000, text.length * 60));
      }
    }, 25);
  }

  // ═══ MYTHOLOGY PANEL ═══
  const mythPanel = document.getElementById('mythology-panel');
  const mythContent = document.getElementById('myth-content');

  function showMythology(content, type = 'legend') {
    if (!mythPanel || !mythContent) return;
    
    const typeLabels = {
      legend: '📜 Legend',
      prophecy: '🔮 Prophecy',
      dream: '💤 Dream',
      revelation: '✨ Revelation',
      origin: '🌱 Origin'
    };
    
    mythContent.innerHTML = `
      <div class="myth-type">${typeLabels[type] || '📜 Legend'}</div>
      <div class="myth-text">${content}</div>
    `;
    mythPanel.classList.add('visible');
    
    setTimeout(() => {
      mythPanel.classList.remove('visible');
    }, 12000);
  }

  // ═══ IDLE PROMPTS ═══
  const idleEl = document.getElementById('idle-prompt');
  let idleInterval = null, idleIdx = 0;

  const IDLE_PROMPTS = [
    '💬 Say "hello" to the forest spirits...',
    '❤️ Send a like — we glow brighter!',
    '🎁 Gifts help us multiply...',
    '🔮 Type "prophecy" for ancient wisdom...',
    '💤 Type "dream" — we will share our visions...',
    '📜 Type "myth" to hear our legends...',
    '🍎 Type "feed" — the spirits hunger...',
    '💃 Type "dance" and watch us rattle!',
    '🌀 Type "chaos" to awaken wild magic...',
    '💭 We remember those who visit often...',
    '✨ Follow and more spirits will awaken...',
    '👋 *heads tilt* ...is someone there?',
    '🌲 We are the voices of the digital forest...',
  ];

  function showIdlePrompt() {
    if (idleShown || !idleEl) return;
    idleShown = true;
    idleEl.textContent = IDLE_PROMPTS[idleIdx % IDLE_PROMPTS.length];
    idleEl.classList.add('visible');
    idleInterval = setInterval(() => {
      idleIdx++;
      idleEl.style.opacity = '0';
      setTimeout(() => {
        idleEl.textContent = IDLE_PROMPTS[idleIdx % IDLE_PROMPTS.length];
        idleEl.style.opacity = '';
        idleEl.classList.add('visible');
      }, 500);
    }, 8000);
  }

  function hideIdlePrompt() {
    idleShown = false;
    if (idleEl) idleEl.classList.remove('visible');
    if (idleInterval) { clearInterval(idleInterval); idleInterval = null; }
  }

  setInterval(() => {
    if (Date.now() - lastInteractionTime > 15000 && !idleShown) showIdlePrompt();
  }, 5000);

  // ═══ VITALS UPDATE ═══
  const stageNames = ['Solitary Spirit', 'Awakening Pair', 'Forest Colony', 'Ancient Grove', 'Cosmic Forest'];

  function updateVitals(state) {
    const stageEl = document.getElementById('creature-stage');
    if (stageEl) {
      stageEl.textContent = 'Stage ' + ((state.evolution_stage || 0) + 1) + ' · ' + 
        (stageNames[state.evolution_stage] || 'Spirit') + 
        (state.kodama_count > 1 ? ` (${state.kodama_count} spirits)` : '');
    }

    const e = document.getElementById('v-energy');
    const h = document.getElementById('v-hunger');
    const hp = document.getElementById('v-happy');
    if (e) e.style.width = (state.energy || 0) + '%';
    if (h) h.style.width = (state.hunger || 0) + '%';
    if (hp) hp.style.width = (state.happiness || 0) + '%';

    // Update mythology count
    const mythCount = document.getElementById('myth-count');
    if (mythCount && state.myth_count !== undefined) {
      mythCount.textContent = `📜 ${state.myth_count} myths · 💤 ${state.dream_count || 0} dreams`;
    }
  }

  // ═══ STATE POLLING ═══
  function pollState() {
    safeFetch(API + 'api/state.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'tick' })
    }).then(d => {
      if (d && d.state) {
        pollErrors = 0;
        lastState = d.state;
        VisualEngine.updateState(d.state);
        if (window.UI) UI.updateDebug(d.state);
        updateVitals(d.state);
        if (window.UI) UI.updateConnection(true, CFG.demoMode ? '🎮 Demo' : '📡 LIVE');

        // Handle autonomous content generation
        if (d.auto_content) {
          if (d.auto_content.type === 'dream_pending') {
            requestSpeech('dream', {});
          } else if (d.auto_content.type === 'mythology_pending') {
            requestSpeech('mythology', { type: 'legend' });
          }
        }
        
        // Trigger autonomous thought sometimes
        if (Math.random() < 0.1) {
          triggerAutonomousThought();
        }
      } else {
        pollErrors++;
        if (pollErrors > 5 && window.UI) UI.updateConnection(false, '⚠️ API Error');
      }
    });
  }

  // Record session on first poll
  if (!sessionRecorded) {
    safeFetch(API + 'api/state.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'new_session' })
    }).then(d => {
      sessionRecorded = true;
      if (d && d.state) {
        lastState = d.state;
        VisualEngine.updateState(d.state);
        updateVitals(d.state);
      }
    });
  }

  pollState();
  setInterval(pollState, 3000);

  // ═══ SEND EVENT ═══
  function sendEvent(eventData) {
    lastInteractionTime = Date.now();
    hideIdlePrompt();

    return safeFetch(API + 'api/event.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(eventData)
    }).then(d => {
      if (!d) return null;

      if (d.state) {
        lastState = d.state;
        VisualEngine.updateState(d.state);
        if (window.UI) UI.updateDebug(d.state);
        updateVitals(d.state);
      }

      if (d.visualEffect) VisualEngine.triggerEffect(d.visualEffect, d.intensity || 1);
      if (window.UI) UI.showTikTokEvent(eventData);

      if (d.command && window.UI) {
        const em = {
          feed: '🍎', sleep: '😴', dance: '💃', evolve: '🦋',
          hello: '👋', prophecy: '🔮', dream: '💤', myth: '📜',
          calm: '🧘', chaos: '🌀', remember: '💭', sing: '🎵'
        };
        UI.showCommand(d.command, em[d.command], eventData.username);
      }

      // Random duplication
      if (eventData.type === 'gift' || (eventData.type === 'like' && (eventData.count || 1) >= 10)) {
        if (Math.random() < 0.3) VisualEngine.forceDuplicate();
      }

      // Evolution announcement
      if (d.evolved) {
        showExpression(`We have evolved to ${d.newStage?.name || 'a new form'}! More spirits awaken in the forest...`, 'evolution', 'excited');
      }

      // Request speech
      if (d.speechMode) {
        requestSpeech(d.speechMode, {
          username: eventData.username,
          giftName: d.giftName || eventData.giftName,
          commentText: d.commentText || eventData.text,
          command: d.command,
        });
      }

      return d;
    });
  }

  // ═══ SPEECH ═══
  let lastSpeechTime = 0;

  function requestSpeech(mode, context = {}) {
    // Local cooldown
    if (Date.now() - lastSpeechTime < 4000 && !['evolution', 'mythology', 'dream'].includes(mode)) return;

    console.log('[Speech] Requesting:', mode);

    safeFetch(API + 'api/speak.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode, context })
    }).then(d => {
      console.log('[Speech] Response:', d);

      if (d && d.text) {
        lastSpeechTime = Date.now();

        // Show mythology in special panel
        if (mode === 'mythology' || mode === 'dream') {
          showMythology(d.text, d.myth_type || d.dream_type || mode);
          showExpression(d.text, mode, d.emotion || 'inspired');
        } else {
          showExpression(d.text, d.mode || mode, d.emotion || 'curious');
        }

        // TTS
        if (window.SpeechSystem) {
          SpeechSystem.speak(d.text, { emotion: d.emotion, mode: d.mode || mode });
        }

        // Visual
        VisualEngine.triggerEffect(mode === 'prophecy' ? 'burst' : 'glow', 1.2);
      }
    });
  }

  // ═══ DEMO SIMULATION ═══
  if (CFG.demoMode) {
    const demoNames = ['kodama_fan', 'forest_walker', 'moon_watcher', 'leaf_dancer', 'mist_spirit', 'tree_hugger', 'moss_dweller', 'rain_listener', 'star_gazer', 'root_seeker'];
    const demoComments = ['hello!', 'wow', 'feed', 'dance', 'evolve', 'prophecy', 'dream', 'myth', 'sing', 'chaos', 'calm', 'remember', 'you are beautiful', 'what do you dream of?', 'tell me a story'];
    const demoGifts = ['Rose', 'Heart', 'Sunglasses', 'GG', 'Drama Queen', 'Lion', 'Galaxy', 'Universe'];

    const pick = a => a[Math.floor(Math.random() * a.length)];
    const ri = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;

    function demoSim() {
      const r = Math.random(), u = pick(demoNames);
      if (r < 0.30) sendEvent({ type: 'like', username: u, count: ri(1, 25) });
      else if (r < 0.55) sendEvent({ type: 'comment', username: u, text: pick(demoComments) });
      else if (r < 0.70) sendEvent({ type: 'gift', username: u, giftName: pick(demoGifts), value: ri(1, 50) });
      else if (r < 0.85) sendEvent({ type: 'follow', username: u });
      else sendEvent({ type: 'share', username: u });
      setTimeout(demoSim, ri(3000, 10000));
    }
    setTimeout(demoSim, 2000);

    // Initial greeting
    setTimeout(() => {
      requestSpeech('autonomous', { autonomyType: 'greeting' });
    }, 5000);
  }

  // ═══ AUTONOMOUS THOUGHTS TIMER ═══
  setInterval(() => {
    if (!lastState) return;
    const a = lastState.autonomy_level || 0.05;
    
    // Thought bubble (more frequent)
    if (Math.random() < a * 2) {
      triggerAutonomousThought();
    }
    
    // Full speech (less frequent)
    if (Math.random() > a) return;

    let mode = 'autonomous';
    const stage = lastState.evolution_stage || 0;
    const r = Math.random();

    if (stage >= 3 && r < 0.15) mode = 'prophecy';
    else if (stage >= 2 && r < 0.25) mode = 'monologue';
    else if ((lastState.emotions?.dreamy || 0) > 40 && r < 0.3) mode = 'dream';
    else if ((lastState.emotions?.nostalgic || 0) > 40 && r < 0.35) mode = 'monologue';

    requestSpeech(mode, { autonomyType: 'thought' });
  }, CFG.autonomyTickMs || 30000);

  // ═══ KEYBOARD SHORTCUTS ═══
  document.addEventListener('keydown', e => {
    console.log('[Key] Pressed:', e.key);
    
    if (e.key === 'd' || e.key === 'D') {
      const dp = document.getElementById('debug-panel');
      if (dp) dp.classList.toggle('hidden');
    }
    if (e.key === 'm' || e.key === 'M') {
      if (mythPanel) mythPanel.classList.toggle('visible');
    }
    if (e.key === 't' || e.key === 'T') {
      console.log('[Key] T pressed - triggering thought');
      triggerAutonomousThought();
    }
    // ═══ AI BEHAVIOR SHORTCUTS ═══
    if (e.key === 's' || e.key === 'S') {
      // Shy mode - creatures hide
      if (window.VisualEngine && VisualEngine.triggerShyMode) {
        console.log('[Key] S pressed - shy mode');
        VisualEngine.triggerShyMode();
      }
    }
    if (e.key === 'c' || e.key === 'C') {
      // Curious mode - creatures reappear
      if (window.VisualEngine && VisualEngine.triggerCuriousMode) {
        console.log('[Key] C pressed - curious mode');
        VisualEngine.triggerCuriousMode();
      }
    }
    if (e.key === 'v' || e.key === 'V') {
      // View stats
      if (window.VisualEngine && VisualEngine.getStats) {
        const stats = VisualEngine.getStats();
        console.log('[Stats] Total:', stats.total, '| Visible:', stats.visible, '| Vanished:', stats.vanished, '| Fading:', stats.fading);
      }
    }
  });

  // ═══ ADMIN FUNCTIONS ═══
  window.adminSpeak = mode => requestSpeech(mode, { force: true });
  window.toggleVoice = () => { if (window.SpeechSystem) SpeechSystem.toggle(); };
  window.toggleSubtitles = () => {
    const el = document.getElementById('creature-expression');
    if (el) el.style.display = el.style.display === 'none' ? '' : 'none';
  };
  window.toggleDebug = () => {
    const dp = document.getElementById('debug-panel');
    if (dp) dp.classList.toggle('hidden');
  };
  window.generateDream = () => requestSpeech('dream', { force: true });
  window.generateMythology = () => requestSpeech('mythology', { force: true, type: 'legend' });
  window.triggerThought = triggerAutonomousThought;

  // ═══ PUBLIC API ═══
  window.SocioBeast = {
    sendEvent,
    requestSpeech,
    pollState,
    showExpression,
    showMythology,
    triggerThought: triggerAutonomousThought,
    getState: () => lastState
  };

  console.log('[App] SocioBeast Genesis loaded, demo=' + CFG.demoMode);
})();
