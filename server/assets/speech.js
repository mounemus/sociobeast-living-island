/**
 * SOCIOBEAST GENESIS v11 — Speech System
 * Web Speech API with emotional modulation
 */
(function() {
  'use strict';

  const CFG = window.SOCIOBEAST_CONFIG || {};
  let enabled = CFG.voiceEnabled !== false;
  let speaking = false;
  let synth = null;
  let voices = [];
  let preferredVoice = null;

  // Emotion-based voice parameters
  const EMOTION_PARAMS = {
    happy: { rate: 1.05, pitch: 1.15, volume: 0.95 },
    excited: { rate: 1.15, pitch: 1.2, volume: 1.0 },
    sleepy: { rate: 0.85, pitch: 0.9, volume: 0.7 },
    curious: { rate: 0.95, pitch: 1.05, volume: 0.9 },
    annoyed: { rate: 1.0, pitch: 0.95, volume: 0.95 },
    lonely: { rate: 0.88, pitch: 0.92, volume: 0.75 },
    inspired: { rate: 1.0, pitch: 1.1, volume: 0.95 },
    nostalgic: { rate: 0.9, pitch: 0.95, volume: 0.8 },
    dreamy: { rate: 0.82, pitch: 1.0, volume: 0.7 },
    philosophical: { rate: 0.9, pitch: 0.98, volume: 0.85 },
    default: { rate: 0.92, pitch: 1.0, volume: 0.85 }
  };

  function init() {
    if (!('speechSynthesis' in window)) {
      console.warn('[Speech] Web Speech API not supported');
      return false;
    }
    
    synth = window.speechSynthesis;
    
    // Load voices
    function loadVoices() {
      voices = synth.getVoices();
      
      // Find a good voice (prefer soft female voices)
      const preferred = [
        'Samantha', 'Karen', 'Victoria', 'Moira', 'Fiona',
        'Google UK English Female', 'Microsoft Zira',
        'en-GB', 'en-US'
      ];
      
      for (const pref of preferred) {
        const found = voices.find(v => 
          v.name.includes(pref) || v.lang.includes(pref)
        );
        if (found) {
          preferredVoice = found;
          console.log('[Speech] Using voice:', found.name);
          break;
        }
      }
      
      // Fallback to first English voice
      if (!preferredVoice) {
        preferredVoice = voices.find(v => v.lang.startsWith('en')) || voices[0];
        if (preferredVoice) {
          console.log('[Speech] Fallback voice:', preferredVoice.name);
        }
      }
    }

    loadVoices();
    if (synth.onvoiceschanged !== undefined) {
      synth.onvoiceschanged = loadVoices;
    }

    return true;
  }

  function speak(text, options = {}) {
    if (!enabled || !synth || !text) return;

    // Cancel any ongoing speech
    if (speaking) {
      synth.cancel();
    }

    const emotion = options.emotion || 'default';
    const params = EMOTION_PARAMS[emotion] || EMOTION_PARAMS.default;

    const utterance = new SpeechSynthesisUtterance(text);
    
    if (preferredVoice) {
      utterance.voice = preferredVoice;
    }
    
    utterance.rate = params.rate;
    utterance.pitch = params.pitch;
    utterance.volume = params.volume;

    // Event handlers
    utterance.onstart = () => {
      speaking = true;
      if (window.VisualEngine) {
        VisualEngine.setSpeaking(true);
      }
      console.log('[Speech] Started:', text.substring(0, 30) + '...');
    };

    utterance.onend = () => {
      speaking = false;
      if (window.VisualEngine) {
        VisualEngine.setSpeaking(false);
      }
      console.log('[Speech] Ended');
    };

    utterance.onerror = (e) => {
      speaking = false;
      if (window.VisualEngine) {
        VisualEngine.setSpeaking(false);
      }
      console.warn('[Speech] Error:', e.error);
    };

    // Speak!
    synth.speak(utterance);
  }

  function stop() {
    if (synth) {
      synth.cancel();
      speaking = false;
      if (window.VisualEngine) {
        VisualEngine.setSpeaking(false);
      }
    }
  }

  function toggle() {
    enabled = !enabled;
    if (!enabled) stop();
    console.log('[Speech] Enabled:', enabled);
    return enabled;
  }

  function isEnabled() {
    return enabled;
  }

  function isSpeaking() {
    return speaking;
  }

  // Initialize
  const supported = init();

  // Public API
  window.SpeechSystem = {
    speak,
    stop,
    toggle,
    isEnabled,
    isSpeaking,
    supported
  };

  console.log('[Speech] System loaded, supported:', supported);
})();
