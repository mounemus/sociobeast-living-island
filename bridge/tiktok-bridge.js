/**
 * SOCIOBEAST — TikTok Live Bridge
 * ─────────────────────────────────────────────────────────────
 * Connects to a TikTok LIVE via tiktok-live-connector, normalises
 * every interaction and pushes batches to  <SOCIOBEAST_URL>/api/tiktok.php  (web/api/tiktok.php)
 *
 *   npm install
 *   cp .env.example .env   (fill it)
 *   npm start              → real TikTok live
 *   npm run demo           → simulated audience (no TikTok needed)
 *
 * Runs anywhere with Node 18+ (streamer PC, Hetzner VPS, Raspberry Pi).
 */
import 'dotenv/config';
import { WebcastPushConnection } from 'tiktok-live-connector';

const USERNAME   = process.env.TIKTOK_USERNAME || '';
const BASE_URL   = (process.env.SOCIOBEAST_URL || 'http://localhost:8090').replace(/\/$/, '');
const SECRET     = process.env.BRIDGE_SECRET || '';
const FLUSH_MS   = parseInt(process.env.FLUSH_MS || '800', 10);
const DEMO       = process.argv.includes('--demo');

// ─── Batch queue ────────────────────────────────────────────────
let queue = [];
let likeBuffer = new Map(); // username → count (likes are aggregated)

function push(ev) {
  if (ev.type === 'like') {
    likeBuffer.set(ev.username, (likeBuffer.get(ev.username) || 0) + (ev.count || 1));
    return;
  }
  queue.push(ev);
}

async function flush() {
  for (const [username, count] of likeBuffer) queue.push({ type: 'like', username, count });
  likeBuffer.clear();
  if (!queue.length) return;
  const events = queue.splice(0, 100);
  try {
    const res = await fetch(`${BASE_URL}/api/tiktok.php`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret: SECRET, events })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) console.error('[bridge] server error', res.status, data);
    else {
      const g = data.game || {};
      process.stdout.write(`[bridge] sent ${events.length} | energy ${g.energy}/${g.energyThreshold} | chaos ${g.chaos} | guardians ${g.guardianCount}\n`);
    }
  } catch (e) {
    console.error('[bridge] push failed:', e.message);
    queue.unshift(...events); // retry next flush
  }
}
setInterval(flush, FLUSH_MS);
// heartbeat so the admin panel shows the bridge as connected even in quiet moments
setInterval(function() { fetch(`${BASE_URL}/api/tiktok.php`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ secret: SECRET, events: [], heartbeat: { username: USERNAME, demo: DEMO, queued: queue.length, ts: Date.now() } }) }).catch(function() {}); }, 30000);

// ─── Normalisers ────────────────────────────────────────────────
const user = d => ({
  username: d.uniqueId || d.user?.uniqueId || 'anonymous',
  displayName: d.nickname || d.user?.nickname || d.uniqueId || 'anonymous'
});

function connectTikTok() {
  if (!USERNAME) { console.error('TIKTOK_USERNAME missing in .env'); process.exit(1); }
  const opts = { enableExtendedGiftInfo: true, processInitialData: false };
  if (process.env.TIKTOK_SESSION_ID) opts.sessionId = process.env.TIKTOK_SESSION_ID;
  const conn = new WebcastPushConnection(USERNAME, opts);

  conn.connect().then(state => {
    console.log(`[bridge] Connected to @${USERNAME} (roomId ${state.roomId})`);
  }).catch(err => {
    console.error('[bridge] Connect failed:', err.message, '— retrying in 15s');
    setTimeout(connectTikTok, 15000);
  });

  conn.on('member',  d => push({ type: 'join',   ...user(d) }));
  conn.on('like',    d => push({ type: 'like',   ...user(d), count: d.likeCount || 1 }));
  conn.on('chat',    d => push({ type: 'comment',...user(d), text: d.comment || '' }));
  conn.on('follow',  d => push({ type: 'follow', ...user(d) }));
  conn.on('share',   d => push({ type: 'share',  ...user(d) }));
  conn.on('gift', d => {
    // For streakable gifts, only count when the streak ends
    if (d.giftType === 1 && !d.repeatEnd) return;
    push({ type: 'gift', ...user(d), giftName: d.giftName, count: d.repeatCount || 1,
           coins: d.diamondCount || 1 });
  });
  conn.on('streamEnd', () => { console.log('[bridge] Stream ended'); setTimeout(connectTikTok, 30000); });
  conn.on('disconnected', () => { console.log('[bridge] Disconnected — reconnecting'); setTimeout(connectTikTok, 10000); });
  conn.on('error', e => console.error('[bridge] error', e?.info || e?.message || e));
}

// ─── Demo audience (no TikTok) ──────────────────────────────────
function runDemo() {
  const names = ['luna_qc','maxou3d','sakura.dev','kodama_fan','elise_mtl','tiktoker42','nova_star','pixel_pierre',
                 'zoe.ai','ghost_rider','mira_ubmaker','felix_lab','ambre_x','yuki_san','rayan_mtl','celeste_v'];
  const gifts = [['Rose',1],['Ice Cream Cone',1],['Finger Heart',5],['Hand Hearts',100],['Galaxy',1000],['TikTok Universe',34999]];
  const comments = ['!clan ember','!clan tide','!me','!top','!dance','!feed','!1','!2','!calm','so cute','wow 😍','!quest','!lore','!summon','!hide','!seek',
                    'hello from Montreal','les kodamas 😭','!clan umbra','!3'];
  console.log('[bridge] DEMO mode — simulating an audience');
  setInterval(() => {
    const u = names[Math.floor(Math.random() * names.length)];
    const r = Math.random();
    if (r < 0.55)      push({ type: 'like', username: u, displayName: u, count: 1 + Math.floor(Math.random() * 15) });
    else if (r < 0.85) push({ type: 'comment', username: u, displayName: u, text: comments[Math.floor(Math.random() * comments.length)] });
    else if (r < 0.92) { const g = gifts[Math.floor(Math.random() * gifts.length)];
                         push({ type: 'gift', username: u, displayName: u, giftName: g[0], coins: g[1], count: 1 }); }
    else if (r < 0.96) push({ type: 'follow', username: u, displayName: u });
    else if (r < 0.98) push({ type: 'share', username: u, displayName: u });
    else               push({ type: 'join', username: 'new_' + Math.floor(Math.random() * 9999), displayName: 'Newcomer' });
  }, 250);
}

DEMO ? runDemo() : connectTikTok();
