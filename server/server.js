#!/usr/bin/env node
/**
 * SocioBeast — home server (Raspberry Pi friendly, Node 18+, no build step)
 *   serves the creature page from ../web          http://<ip>:8420/          (OBS browser source, any screen on the LAN)
 *   admin panel                                   http://<ip>:8420/admin     (password in config.json)
 *   WebSocket /ws : TikTok events → pages, page state → disk (data/state.json), admin commands → pages
 *   /api/think : the LLM voice (keys stay on the Pi) · /api/state : last saved creature state
 *   mDNS: http://sociobeast.local:8420
 * The display page remains the game authority (rules run in the browser); this server relays, remembers and configures.
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { Bridge } from './bridge.js';
import { think } from './think.js';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const WEB = process.env.WEB_DIR ? path.resolve(process.env.WEB_DIR) : path.resolve(DIR, '../web'), DATA = path.resolve(DIR, 'data'); // WEB_DIR: serve the page from elsewhere (dev)
const CONFIG_FILE = path.resolve(DIR, 'config.json'), STATE_FILE = path.resolve(DATA, 'state.json');
fs.mkdirSync(DATA, { recursive: true });

// ── config ──
const DEFAULTS = JSON.parse(fs.readFileSync(path.resolve(DIR, 'config.example.json'), 'utf8'));
let cfg = { ...DEFAULTS, ai: { ...DEFAULTS.ai } };
function loadConfig() { try { const c = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')); cfg = { ...DEFAULTS, ...c, ai: { ...DEFAULTS.ai, ...(c.ai || {}) } }; } catch (e) {} }
function saveConfig() { fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2)); }
loadConfig();
if (process.argv.includes('--demo')) cfg.demo = true;
const PORT = +(process.env.PORT || cfg.port || 8420);

// ── state (the display page owns the rules, the server keeps the save) ──
let state = null; try { state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); } catch (e) {}
let stateDirty = false;
setInterval(() => { if (stateDirty && state) { stateDirty = false; fs.writeFile(STATE_FILE, JSON.stringify(state), () => {}); } }, 3000);

// ── bridge ──
const bridge = new Bridge();
const recent = []; // last events for the admin feed
bridge.on('event', ev => { ev.id = ++eventId; ev.ts = Date.now(); recent.push(ev); if (recent.length > 60) recent.shift(); broadcast({ type: 'event', ev }, 'display'); broadcast({ type: 'event', ev }, 'admin'); });
bridge.on('status', () => broadcast({ type: 'bridge', bridge: bridge.info() }));
let eventId = 0;
function startBridge() { if (cfg.demo) bridge.startDemo(); else if (cfg.tiktokUsername) bridge.start(cfg.tiktokUsername, cfg.tiktokSessionId); }

// ── websocket ──
const clients = new Set(); // { ws, role }
function broadcast(msg, role) { const s = JSON.stringify(msg); for (const c of clients) if ((!role || c.role === role) && c.ws.readyState === 1) c.ws.send(s); }
function publicConfig() { return { mode: 'live', name: cfg.creatureName, voice: !!cfg.voice, ai: !!((cfg.ai.provider === 'anthropic' && cfg.ai.anthropicKey) || (cfg.ai.provider === 'openai' && cfg.ai.openaiKey)), demo: !!cfg.demo }; }
function adminView() { return { config: { ...cfg, adminPassword: undefined, ai: { ...cfg.ai, anthropicKey: cfg.ai.anthropicKey ? '••••' + cfg.ai.anthropicKey.slice(-4) : '', openaiKey: cfg.ai.openaiKey ? '••••' + cfg.ai.openaiKey.slice(-4) : '' } }, bridge: bridge.info(), state, displays: [...clients].filter(c => c.role === 'display').length, urls: urls(), recent: recent.slice(-20) }; }

const wss = new WebSocketServer({ noServer: true });
wss.on('connection', (ws, req) => {
  const u = new URL(req.url, 'http://x'); const role = u.searchParams.get('role') === 'admin' && u.searchParams.get('key') === adminToken() ? 'admin' : 'display';
  const c = { ws, role }; clients.add(c);
  ws.send(JSON.stringify(role === 'admin' ? { type: 'admin', ...adminView() } : { type: 'hello', config: publicConfig(), bridge: bridge.info(), state }));
  ws.on('message', raw => {
    let m; try { m = JSON.parse(raw); } catch (e) { return; }
    if (role === 'display' && m.type === 'state' && m.state && typeof m.state === 'object') { state = m.state; stateDirty = true; broadcast({ type: 'state', state }, 'admin'); }
    if (role === 'admin') handleAdmin(m);
  });
  ws.on('close', () => clients.delete(c));
});
function handleAdmin(m) {
  switch (m.type) {
    case 'config': {
      const c = m.config || {};
      for (const k of ['creatureName', 'tiktokUsername', 'tiktokSessionId', 'mdnsName']) if (typeof c[k] === 'string') cfg[k] = c[k].trim().slice(0, 80);
      for (const k of ['autoStartBridge', 'demo', 'voice']) if (typeof c[k] === 'boolean') cfg[k] = c[k];
      if (typeof c.adminPassword === 'string' && c.adminPassword.length >= 4) cfg.adminPassword = c.adminPassword;
      if (c.ai && typeof c.ai === 'object') { for (const k of ['provider', 'anthropicModel', 'openaiModel']) if (typeof c.ai[k] === 'string') cfg.ai[k] = c.ai[k].trim(); for (const k of ['anthropicKey', 'openaiKey']) if (typeof c.ai[k] === 'string' && !c.ai[k].startsWith('••••')) cfg.ai[k] = c.ai[k].trim(); }
      saveConfig(); broadcast({ type: 'config', config: publicConfig() }, 'display'); break;
    }
    case 'bridge': if (m.action === 'start') { cfg.demo = false; saveConfig(); startBridge(); } else if (m.action === 'demo') { cfg.demo = true; saveConfig(); bridge.startDemo(); } else bridge.stop(); break;
    case 'inject': if (m.ev && typeof m.ev === 'object' && ['like', 'comment', 'gift', 'follow', 'share', 'join'].includes(m.ev.type)) bridge.push({ displayName: m.ev.username, ...m.ev, username: String(m.ev.username || 'admin').slice(0, 40) }); break;
    case 'cmd': if (['reset', 'evolve', 'beat', 'say', 'dance', 'sing', 'wave', 'sleep'].includes(m.cmd)) { if (m.cmd === 'reset') { state = null; try { fs.unlinkSync(STATE_FILE); } catch (e) {} } broadcast({ type: 'cmd', cmd: m.cmd, text: m.text ? String(m.text).slice(0, 200) : undefined }, 'display'); } break;
  }
  broadcast({ type: 'admin', ...adminView() }, 'admin');
}
function adminToken() { return crypto.createHash('sha256').update('sociobeast:' + cfg.adminPassword).digest('hex').slice(0, 32); }

// ── http ──
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.glb': 'model/gltf-binary', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.ico': 'image/x-icon' };
function send(res, code, body, type) { res.writeHead(code, { 'Content-Type': type || 'application/json', 'Cache-Control': 'no-store' }); res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body)); }
function readBody(req) { return new Promise(r => { let b = ''; req.on('data', d => { b += d; if (b.length > 200000) req.destroy(); }); req.on('end', () => { try { r(JSON.parse(b || '{}')); } catch (e) { r({}); } }); }); }
function serveFile(req, res, file) {
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) return send(res, 404, 'Not found', 'text/plain');
    const type = MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';
    const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
    if (range) { const start = range[1] ? +range[1] : 0, end = range[2] ? Math.min(+range[2], st.size - 1) : st.size - 1; res.writeHead(206, { 'Content-Type': type, 'Content-Range': `bytes ${start}-${end}/${st.size}`, 'Content-Length': end - start + 1, 'Accept-Ranges': 'bytes', 'Cache-Control': 'public, max-age=3600' }); return fs.createReadStream(file, { start, end }).pipe(res); }
    res.writeHead(200, { 'Content-Type': type, 'Content-Length': st.size, 'Accept-Ranges': 'bytes', 'Cache-Control': file.endsWith('.html') ? 'no-store' : 'public, max-age=3600' });
    fs.createReadStream(file).pipe(res);
  });
}

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x'); const p = decodeURIComponent(u.pathname);
  if (p === '/' || p === '/index.html') { // the game page, in live mode, configured by this server
    const html = fs.readFileSync(path.join(WEB, 'index.html'), 'utf8').replace('<script>', '<script>window.BEAST_CONFIG = ' + JSON.stringify({ ...publicConfig(), voice: u.searchParams.get('voice') === '1' || !!cfg.voice, name: u.searchParams.get('name') || cfg.creatureName }) + ';');
    return send(res, 200, html, MIME['.html']);
  }
  if (p === '/admin' || p === '/admin/') return serveFile(req, res, path.join(DIR, 'admin.html'));
  if (p === '/api/login' && req.method === 'POST') { const b = await readBody(req); return b.password === cfg.adminPassword ? send(res, 200, { key: adminToken() }) : send(res, 403, { error: 'wrong password' }); }
  if (p === '/api/state') return send(res, 200, state || null);
  if (p === '/api/think' && req.method === 'POST') { const b = await readBody(req); return send(res, 200, await think({ ...b, name: b.name || cfg.creatureName }, cfg.ai)); }
  if (p === '/api/status') return send(res, 200, { bridge: bridge.info(), config: publicConfig(), displays: [...clients].filter(c => c.role === 'display').length, urls: urls() });
  if (p === '/api/events' && req.method === 'POST') { // same contract as the old PHP relay, for an external bridge if ever needed
    const b = await readBody(req); if (cfg.adminPassword && b.secret !== cfg.adminPassword) return send(res, 403, { error: 'bad secret' });
    for (const ev of (b.events || []).slice(0, 200)) if (['like', 'comment', 'gift', 'follow', 'share', 'join'].includes(ev.type)) bridge.push(ev);
    return send(res, 200, { success: true });
  }
  const safe = path.normalize(p).replace(/^(\.\.[\/\\])+/, ''); const file = path.join(WEB, safe);
  if (!file.startsWith(WEB)) return send(res, 403, 'Forbidden', 'text/plain');
  serveFile(req, res, file);
});
server.on('upgrade', (req, socket, head) => { if (new URL(req.url, 'http://x').pathname !== '/ws') return socket.destroy(); wss.handleUpgrade(req, socket, head, ws => wss.emit('connection', ws, req)); });

function urls() { const out = []; for (const list of Object.values(os.networkInterfaces())) for (const n of list || []) if (n.family === 'IPv4' && !n.internal) out.push(`http://${n.address}:${PORT}/`); if (cfg.mdnsName) out.push(`http://${cfg.mdnsName}.local:${PORT}/`); return out; }

server.listen(PORT, '0.0.0.0', async () => {
  if (cfg.autoStartBridge || cfg.demo) startBridge();
  console.log(`SocioBeast server · creature "${cfg.creatureName}" · ${cfg.demo ? 'DEMO crowd' : cfg.tiktokUsername ? '@' + cfg.tiktokUsername : 'no TikTok username yet (set it in /admin)'}`);
  for (const x of urls()) console.log('  display  ' + x);
  console.log('  admin    ' + urls()[0] + 'admin   (password: ' + (cfg.adminPassword === DEFAULTS.adminPassword ? 'default "beast" — change it' : 'set') + ')');
  try { const { Bonjour } = await import('bonjour-service'); new Bonjour().publish({ name: cfg.mdnsName || 'sociobeast', type: 'http', port: PORT, host: (cfg.mdnsName || 'sociobeast') + '.local' }); } catch (e) { console.log('  (mDNS off: ' + e.message + ')'); }
});
