/**
 * SocioBeast — TikTok Live bridge (in-process). Normalises tiktok-live-connector events into the game's contract
 * { type: like|comment|gift|follow|share|join, username, displayName, count, text, giftName, coins }
 * and offers a demo crowd when there is no live to watch. Likes are aggregated per viewer every 800 ms.
 */
import { EventEmitter } from 'node:events';

export class Bridge extends EventEmitter {
  constructor() { super(); this.conn = null; this.username = ''; this.status = 'off'; this.lastError = ''; this.demoTimer = null; this.likes = new Map(); this.flushTimer = setInterval(() => this.flushLikes(), 800); this.count = 0; this.startedAt = 0; }

  push(ev) { if (ev.type === 'like') { this.likes.set(ev.username, { ...ev, count: (this.likes.get(ev.username)?.count || 0) + (ev.count || 1) }); return; } this.count++; this.emit('event', ev); }
  flushLikes() { for (const ev of this.likes.values()) { this.count++; this.emit('event', ev); } this.likes.clear(); }

  async start(username, sessionId) {
    this.stop();
    this.username = String(username || '').replace(/^@/, '').trim();
    if (!this.username) { this.status = 'error'; this.lastError = 'No TikTok username'; this.emit('status'); return; }
    this.status = 'connecting'; this.lastError = ''; this.emit('status');
    // v1 exports WebcastPushConnection; v2 renamed it TikTokLiveConnection and keeps the v1 class (flat v1 event shape) under /legacy
    let WebcastPushConnection;
    try { ({ WebcastPushConnection } = await import('tiktok-live-connector')); if (!WebcastPushConnection) ({ WebcastPushConnection } = await import('tiktok-live-connector/legacy')); }
    catch (e) { this.status = 'error'; this.lastError = 'tiktok-live-connector not installed (npm install in server/)'; this.emit('status'); return; }
    const opts = { enableExtendedGiftInfo: true, processInitialData: false };
    if (sessionId) opts.sessionId = sessionId;
    let conn;
    try { conn = this.conn = new WebcastPushConnection(this.username, opts); }
    catch (e) { this.status = 'error'; this.lastError = 'bridge init: ' + String(e?.message || e).slice(0, 160); this.emit('status'); return; } // never take the server down with the bridge
    const user = d => ({ username: d.uniqueId || d.user?.uniqueId || 'anonymous', displayName: d.nickname || d.user?.nickname || d.uniqueId || 'anonymous' });
    conn.on('member', d => this.push({ type: 'join', ...user(d) }));
    conn.on('like', d => this.push({ type: 'like', ...user(d), count: d.likeCount || 1 }));
    conn.on('chat', d => this.push({ type: 'comment', ...user(d), text: String(d.comment || '').slice(0, 300) }));
    conn.on('follow', d => this.push({ type: 'follow', ...user(d) }));
    conn.on('share', d => this.push({ type: 'share', ...user(d) }));
    conn.on('gift', d => { if (d.giftType === 1 && !d.repeatEnd) return; this.push({ type: 'gift', ...user(d), giftName: d.giftName, count: d.repeatCount || 1, coins: d.diamondCount || 1 }); });
    conn.on('streamEnd', () => { this.status = 'ended'; this.emit('status'); this.retry(30000); });
    conn.on('disconnected', () => { if (this.status !== 'off') { this.status = 'disconnected'; this.emit('status'); this.retry(10000); } });
    conn.on('error', e => { this.lastError = String(e?.info || e?.message || e).slice(0, 200); this.emit('status'); });
    try { const st = await conn.connect(); this.status = 'connected'; this.startedAt = Date.now(); this.roomId = st.roomId; this.emit('status'); }
    catch (e) { this.status = 'error'; this.lastError = String(e?.message || e).slice(0, 200); this.emit('status'); this.retry(15000); }
  }
  retry(ms) { clearTimeout(this.retryTimer); if (this.status === 'off') return; this.retryTimer = setTimeout(() => { if (this.status !== 'off' && this.username) this.start(this.username, this.sessionId); }, ms); }
  stop() { clearTimeout(this.retryTimer); if (this.conn) { try { this.conn.disconnect(); } catch (e) {} this.conn = null; } this.stopDemo(); this.status = 'off'; this.emit('status'); }

  // ── demo crowd (no TikTok needed): bursts and lulls, so hunger and loneliness actually happen ──
  startDemo() {
    this.stopDemo(); this.status = 'demo'; this.startedAt = Date.now(); this.emit('status');
    const names = ['luna_qc', 'maxou3d', 'sakura.dev', 'kodama_fan', 'elise_mtl', 'nova_star', 'pixel_pierre', 'zoe.ai', 'mira_ubmaker', 'felix_lab', 'ambre_x', 'yuki_san', 'tom.prints', 'nina.wav'];
    const comments = ['so cute!!', 'hello!', 'dance', 'sing for us', 'what are you?', 'feed him!!', 'spin', 'he is glowing', 'omg the tail', 'sleep little one', 'play!', 'hi from Montréal', 'is it hungry?', 'I love you beast', 'evolve!!', 'do you dream?', '1', '2'];
    const gifts = [['Rose', 1], ['Rose', 1], ['Rose', 1], ['Finger Heart', 5], ['Ice Cream', 1], ['GG', 1], ['Hand Hearts', 100]];
    const pick = a => a[Math.floor(Math.random() * a.length)];
    let energy = 1;
    const loop = () => {
      energy = Math.max(0.15, Math.min(1.6, energy + (Math.random() - 0.5) * 0.4));
      const u = pick(names), r = Math.random(); let ev;
      if (r < 0.58) ev = { type: 'like', username: u, displayName: u, count: Math.random() < 0.15 ? 15 + Math.floor(Math.random() * 30) : 1 + Math.floor(Math.random() * 6) };
      else if (r < 0.86) ev = { type: 'comment', username: u, displayName: u, text: pick(comments) };
      else if (r < 0.93) { const g = Math.random() < 0.025 ? ['Galaxy', 1000] : pick(gifts); ev = { type: 'gift', username: u, displayName: u, giftName: g[0], coins: g[1], count: 1 }; }
      else if (r < 0.97) ev = { type: 'follow', username: u, displayName: u };
      else if (r < 0.99) ev = { type: 'share', username: u, displayName: u };
      else ev = { type: 'join', username: pick(names), displayName: pick(names) };
      this.push(ev);
      this.demoTimer = setTimeout(loop, (600 + Math.random() * 2400) / energy);
    };
    loop();
  }
  stopDemo() { clearTimeout(this.demoTimer); this.demoTimer = null; if (this.status === 'demo') this.status = 'off'; }

  info() { return { status: this.status, username: this.username, error: this.lastError, events: this.count, since: this.startedAt, roomId: this.roomId || null }; }
}
