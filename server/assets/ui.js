/**
 * SOCIOBEAST GENESIS v11 — UI System
 * Event feed, debug panel, connection status
 */
(function() {
  'use strict';

  const eventFeed = document.getElementById('event-feed');
  const debugContent = document.getElementById('debug-content');
  const statusDot = document.getElementById('status-dot');
  const statusText = document.getElementById('status-text');

  let eventQueue = [];
  const MAX_EVENTS = 6;

  // ═══ EVENT DISPLAY ═══
  function showTikTokEvent(event) {
    if (!eventFeed) return;

    const item = document.createElement('div');
    item.className = 'event-item ' + event.type;

    let icon = '💫';
    let text = '';

    switch (event.type) {
      case 'like':
        icon = '❤️';
        text = `${event.username} × ${event.count || 1}`;
        break;
      case 'gift':
        icon = '🎁';
        text = `${event.username}: ${event.giftName}`;
        break;
      case 'follow':
        icon = '➕';
        text = `${event.username} joined`;
        break;
      case 'comment':
        icon = '💬';
        text = `${event.username}: ${(event.text || '').substring(0, 30)}`;
        break;
      case 'share':
        icon = '🔗';
        text = `${event.username} shared`;
        break;
      default:
        text = event.username || 'Unknown';
    }

    item.innerHTML = `<span>${icon}</span> ${text}`;
    eventFeed.insertBefore(item, eventFeed.firstChild);

    // Remove old events
    while (eventFeed.children.length > MAX_EVENTS) {
      eventFeed.removeChild(eventFeed.lastChild);
    }

    // Auto-remove after delay
    setTimeout(() => {
      if (item.parentNode) {
        item.style.opacity = '0';
        item.style.transform = 'translateX(20px)';
        setTimeout(() => item.remove(), 300);
      }
    }, 8000);
  }

  // ═══ COMMAND DISPLAY ═══
  function showCommand(command, emoji, username) {
    showTikTokEvent({
      type: 'comment',
      username: username || 'Someone',
      text: `${emoji || '⚡'} ${command}`
    });
  }

  // ═══ DEBUG PANEL ═══
  function updateDebug(state) {
    if (!debugContent) return;

    const emo = state.emotions || {};
    const pers = state.personality || {};

    debugContent.innerHTML = `
      <div><b>Evolution:</b> Stage ${(state.evolution_stage || 0) + 1} (${state.total_xp || 0} XP)</div>
      <div><b>Autonomy:</b> ${Math.round((state.autonomy_level || 0) * 100)}%</div>
      <div><b>Kodamas:</b> ${state.kodama_count || 1}</div>
      <div><b>Age:</b> ${state.age || 0} cycles</div>
      <hr style="border-color:rgba(255,255,255,0.1);margin:6px 0">
      <div><b>Energy:</b> ${Math.round(state.energy || 0)}%</div>
      <div><b>Hunger:</b> ${Math.round(state.hunger || 0)}%</div>
      <div><b>Happiness:</b> ${Math.round(state.happiness || 0)}%</div>
      <hr style="border-color:rgba(255,255,255,0.1);margin:6px 0">
      <div><b>Dominant:</b> ${state.dominant_emotion || 'curious'}</div>
      <div><b>Happy:</b> ${emo.happy || 0} | <b>Lonely:</b> ${emo.lonely || 0}</div>
      <div><b>Inspired:</b> ${emo.inspired || 0} | <b>Dreamy:</b> ${emo.dreamy || 0}</div>
      <hr style="border-color:rgba(255,255,255,0.1);margin:6px 0">
      <div><b>Myths:</b> ${state.myth_count || 0} | <b>Dreams:</b> ${state.dream_count || 0}</div>
      <div><b>Sessions:</b> ${state.total_sessions || 0}</div>
    `;
  }

  // ═══ CONNECTION STATUS ═══
  function updateConnection(connected, label) {
    if (statusDot) {
      statusDot.classList.toggle('error', !connected);
    }
    if (statusText && label) {
      statusText.textContent = label;
    }
  }

  // ═══ PUBLIC API ═══
  window.UI = {
    showTikTokEvent,
    showCommand,
    updateDebug,
    updateConnection
  };

  console.log('[UI] System loaded');
})();
