// SocioBeast: the rules engine behind the server (the last part of M1). Vercel function, POST /api/event.
// A signed-in player's page sends the events it has just applied: { idToken, events: [{ key, type, at, day, mission? }] }.
// They are applied again here, by the same file as in the page (web/assets/evolution.js), to the engine state kept in the
// player's Firestore document: the field `engine`, which only this function can write (firestore.rules). The answer is that
// state, and the page takes it as the truth. So XP, stage, traits and missions cannot be raised from a browser console.
//
// Needs FIREBASE_SERVICE_ACCOUNT in the Vercel project's environment: the JSON of a service account key of the Firebase
// project. Without it the function answers 503 and the page plays as before. No dependency: node:crypto and fetch.
// Test: node scripts/test-event-function.mjs
import '../web/assets/evolution.js'; // defines globalThis.Evolution
import { createSign } from 'node:crypto';

const WEB_KEY = 'AIzaSyDkRV238ZMjvkWSQjCZAILEcdX3l1CU32k'; // the web app's public key (the one in web/play.html): only used to ask Google whose token this is
const MAX_EVENTS = 30, WINDOW = 15 * 60e3, DAY = 86400e3;
const JSON_HEAD = { 'Content-Type': 'application/json' };

// Applies a batch of events to a stored engine state and returns { engine, results } or { error }. Pure: the tests call it.
// The page's clock is not trusted: an event's day must be today (give or take a time zone) and never before the last one
// applied; its time is brought inside the last 15 minutes, after the last event the server has seen, keeping the gaps
// between the events of the batch (the cooldowns are measured on those).
export function settle(stored, events, now) {
  if (!Array.isArray(events) || !events.length || events.length > MAX_EVENTS) return { error: 'bad_batch' };
  const e = Object.assign(Evolution.fresh(), JSON.parse(JSON.stringify(stored || {}))), results = [];
  let seen = e.lastAt || 0; const floor = Math.max(seen, now - WINDOW), shift = Math.max(0, floor - (Number(events[0] && events[0].at) || 0));
  for (const ev of events) {
    if (!ev || typeof ev.key !== 'string' || !ev.key || ev.key.length > 40 || typeof ev.type !== 'string' || typeof ev.day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(ev.day)) return { error: 'bad_event' };
    const noon = Date.parse(ev.day + 'T12:00:00Z'), at = Math.min(now, Math.max(floor, seen, (Number(ev.at) || 0) + shift));
    const r = !isFinite(noon) || Math.abs(noon - now) > 1.5 * DAY ? { ok: false, reason: 'bad_day' } : e.day && ev.day < e.day ? { ok: false, reason: 'old_day' }
      : Evolution.apply(e, { key: ev.key, type: ev.type, at: at, day: ev.day, mission: typeof ev.mission === 'string' ? ev.mission : undefined });
    if (r.ok) seen = at;
    results.push({ key: ev.key, ok: r.ok, reason: r.reason });
  }
  e.lastAt = seen; e.stage = Evolution.stageOf(e.xp);
  return { engine: e, results: results };
}

// io = { fetch, now(), account() }: the outside world, replaced by fakes in the tests
export function createHandler(io) {
  let token = null; // the service account's Google access token, reused until it is about to expire
  async function access(sa) {
    if (token && token.until > io.now() + 60e3) return token.value;
    const b64 = function(o) { return Buffer.from(JSON.stringify(o)).toString('base64url'); }, t = Math.floor(io.now() / 1000);
    const head = b64({ alg: 'RS256', typ: 'JWT' }) + '.' + b64({ iss: sa.client_email, scope: 'https://www.googleapis.com/auth/datastore', aud: 'https://oauth2.googleapis.com/token', iat: t, exp: t + 3600 });
    const jwt = head + '.' + createSign('RSA-SHA256').update(head).sign(sa.private_key).toString('base64url');
    const r = await io.fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'grant_type=' + encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer') + '&assertion=' + jwt });
    if (!r.ok) throw new Error('token ' + r.status);
    const j = await r.json(); token = { value: j.access_token, until: io.now() + (j.expires_in || 3600) * 1000 }; return token.value;
  }
  return async function handler(req, res) {
    const send = function(code, body) { res.setHeader('Content-Type', 'application/json'); res.status(code).end(JSON.stringify(body)); };
    if (req.method !== 'POST') return send(405, { error: 'method' });
    const sa = io.account(); if (!sa || !sa.private_key || !sa.client_email || !sa.project_id) return send(503, { error: 'not_configured' });
    const body = typeof req.body === 'object' && req.body ? req.body : {};
    if (typeof body.idToken !== 'string' || !Array.isArray(body.events)) return send(400, { error: 'bad_request' });
    try {
      const who = await io.fetch('https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=' + WEB_KEY, { method: 'POST', headers: JSON_HEAD, body: JSON.stringify({ idToken: body.idToken }) });
      const uid = who.ok ? (((await who.json()).users || [])[0] || {}).localId : null; // Google checks the token and says whose it is
      if (!uid) return send(401, { error: 'signed_out' });
      const bearer = { Authorization: 'Bearer ' + await access(sa), 'Content-Type': 'application/json' };
      const doc = 'https://firestore.googleapis.com/v1/projects/' + sa.project_id + '/databases/(default)/documents/pets/' + uid;
      for (let attempt = 0; attempt < 3; attempt++) {
        const g = await io.fetch(doc, { headers: bearer }); if (!g.ok && g.status !== 404) throw new Error('read ' + g.status);
        const d = g.ok ? await g.json() : null, stored = d && d.fields && d.fields.engine ? JSON.parse(d.fields.engine.stringValue) : null;
        const out = settle(stored, body.events, io.now()); if (out.error) return send(400, out);
        // written only if nobody wrote in between (the page saves its own field every 20 s): otherwise read again and reapply
        const guard = d ? 'currentDocument.updateTime=' + encodeURIComponent(d.updateTime) : 'currentDocument.exists=false';
        const p = await io.fetch(doc + '?updateMask.fieldPaths=engine&updateMask.fieldPaths=engineAt&' + guard, { method: 'PATCH', headers: bearer,
          body: JSON.stringify({ fields: { engine: { stringValue: JSON.stringify(out.engine) }, engineAt: { timestampValue: new Date(io.now()).toISOString() } } }) });
        if (p.ok) return send(200, out);
        if (p.status !== 400 && p.status !== 409 && p.status !== 412) throw new Error('write ' + p.status);
      }
      return send(409, { error: 'busy' });
    } catch (err) { return send(502, { error: 'upstream' }); }
  };
}

export default createHandler({
  fetch: function(url, opts) { return fetch(url, opts); }, now: function() { return Date.now(); },
  account: function() { try { return JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT); } catch (err) { return null; } }
});
