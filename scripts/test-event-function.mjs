// Self-test of api/event.js (the rules engine behind the server), without Google: `node scripts/test-event-function.mjs`.
// 1. settle(): what the server accepts from a page's batch of events.
// 2. the handler, against fakes of the three Google services it calls (who owns this token, an access token for the
//    service account, the Firestore document), with a throwaway key made on the spot.
// What this cannot tell: that Google accepts the real service account. That is checked once, on the deployed function.
import { generateKeyPairSync, createVerify } from 'node:crypto';
import { settle, createHandler } from '../api/event.js';

const results = []; const check = (name, ok, got) => { results.push(!!ok); console.log((ok ? 'PASS' : 'FAIL') + '  ' + name + (ok ? '' : '  -> got ' + JSON.stringify(got))); };
const NOW = Date.parse('2026-11-17T15:00:00Z'), DAY = '2026-11-17', ev = (i, type, extra) => Object.assign({ key: 'k' + i, type, at: NOW - 60000 + i * 6000, day: DAY }, extra || {});

// ── 1. settle ──
let r = settle(null, [ev(0, 'talk'), ev(1, 'talk'), ev(2, 'play')], NOW);
check('a first batch is applied to a fresh creature', r.engine && r.engine.xp === 12 && r.results.every(x => x.ok), r);
check('the same batch sent twice earns nothing more', settle(r.engine, [ev(0, 'talk'), ev(1, 'talk'), ev(2, 'play')], NOW).engine.xp === 12);
check('the stored state is not modified in place', (() => { const s = settle(null, [ev(0, 'talk')], NOW).engine, xp = s.xp; settle(s, [ev(5, 'talk')], NOW); return s.xp === xp; })());
r = settle(null, [ev(0, 'talk', { day: '2026-11-25' })], NOW); check('a day in the future is refused', r.results[0].reason === 'bad_day' && r.engine.xp === 0, r.results);
r = settle(settle(null, [ev(0, 'talk')], NOW).engine, [ev(1, 'talk', { day: '2026-11-16' })], NOW); check('going back to yesterday is refused', r.results[0].reason === 'old_day', r.results);
r = settle(null, [ev(0, 'play'), ev(1, 'play', { at: NOW - 60000 + 1000 })], NOW); check('the cooldown holds on the server', r.results[1].reason === 'cooldown', r.results);
r = settle(null, Array.from({ length: 14 }, (_, i) => ev(i, 'talk')), NOW); check('the daily cap holds on the server', r.results.filter(x => x.ok).length === 10 && r.engine.xp === 30, r.engine.xp);
r = settle(null, [ev(0, 'talk', { at: NOW + 9e9 })], NOW); check('a clock set ahead cannot date an event in the future', r.engine.lastAt <= NOW && r.engine.last.talk <= NOW, r.engine.lastAt);
r = settle(null, [ev(0, 'talk', { at: 5 }), ev(1, 'play', { at: 6005 }), ev(2, 'play', { at: 12005 })], NOW); check('a batch sent late keeps its gaps (no false cooldown)', r.results.every(x => x.ok), r.results);
const ms = Evolution.missionsOf(DAY); let n = 0; const done = [], mv = (type, extra) => Object.assign({ key: 'm' + n, type, at: NOW - 14 * 60000 + (n++) * 40000, day: DAY }, extra || {}); // 40 s apart: past every cooldown
r = settle(null, [mv('complete_mission', { mission: ms[0].type })], NOW); check('a mission cannot be claimed before it is done', r.results[0].reason === 'mission_not_met' && r.engine.xp === 0, r.results);
ms.forEach(m => { for (let i = 0; i < m.n; i++) done.push(mv(m.type)); }); const claims = ms.map(m => mv('complete_mission', { mission: m.type }));
r = settle(null, done.concat(claims), NOW); check('the three missions of the day are paid once each', claims.every(c => r.results.find(x => x.key === c.key).ok) && r.engine.missionDone.length === 3, r.results);
check('and not a second time', settle(r.engine, [mv('complete_mission', { mission: ms[0].type })], NOW).results[0].ok === false);
check('a malformed batch is refused whole', settle(null, [{ type: 'talk' }], NOW).error === 'bad_event' && settle(null, [], NOW).error === 'bad_batch' && settle(null, Array.from({ length: 31 }, (_, i) => ev(i, 'talk')), NOW).error === 'bad_batch');
check('an unknown event type earns nothing', settle(null, [ev(0, 'free_xp')], NOW).results[0].reason === 'unknown_type');

// ── 2. the handler, with fake Google services ──
const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048, privateKeyEncoding: { type: 'pkcs8', format: 'pem' }, publicKeyEncoding: { type: 'spki', format: 'pem' } });
const ACCOUNT = { project_id: 'test-project', client_email: 'robot@test-project.iam.gserviceaccount.com', private_key: privateKey };
function world() {
  const w = { docs: {}, version: 0, tokens: 0, conflicts: 0, calls: [] };
  const reply = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body });
  w.fetch = async (url, opts = {}) => {
    w.calls.push((opts.method || 'GET') + ' ' + url.split('?')[0]);
    if (url.startsWith('https://identitytoolkit.googleapis.com/')) { const t = JSON.parse(opts.body).idToken; return t.startsWith('token-of-') ? reply(200, { users: [{ localId: t.slice(9) }] }) : reply(400, { error: { message: 'INVALID_ID_TOKEN' } }); }
    if (url === 'https://oauth2.googleapis.com/token') { // the assertion must really be signed by the account's key, for the right scope
      const jwt = new URLSearchParams(opts.body).get('assertion'), parts = jwt.split('.'), claims = JSON.parse(Buffer.from(parts[1], 'base64url'));
      const good = createVerify('RSA-SHA256').update(parts[0] + '.' + parts[1]).verify(publicKey, Buffer.from(parts[2], 'base64url')) && claims.iss === ACCOUNT.client_email && /datastore/.test(claims.scope) && claims.aud === url;
      w.tokens++; return good ? reply(200, { access_token: 'access-' + w.tokens, expires_in: 3600 }) : reply(400, { error: 'invalid_grant' });
    }
    const m = url.match(/^https:\/\/firestore\.googleapis\.com\/v1\/projects\/test-project\/databases\/\(default\)\/documents\/pets\/([^?]+)(\?.*)?$/);
    if (!m || !/^Bearer access-/.test((opts.headers || {}).Authorization || '')) return reply(403, {});
    const uid = m[1], q = new URLSearchParams(m[2] || ''), doc = w.docs[uid];
    if (!opts.method || opts.method === 'GET') return doc ? reply(200, doc) : reply(404, {});
    if (w.conflicts > 0) { w.conflicts--; if (doc) doc.updateTime = 'v' + (++w.version); return reply(400, { error: { status: 'FAILED_PRECONDITION' } }); } // someone wrote in between
    if (q.get('currentDocument.exists') === 'false' ? doc : !doc || q.get('currentDocument.updateTime') !== doc.updateTime) return reply(400, { error: { status: 'FAILED_PRECONDITION' } });
    if (q.getAll('updateMask.fieldPaths').sort().join() !== 'engine,engineAt') return reply(400, { error: { status: 'INVALID_ARGUMENT' } }); // it must touch its two fields only
    w.docs[uid] = { fields: Object.assign({}, doc ? doc.fields : {}, JSON.parse(opts.body).fields), updateTime: 'v' + (++w.version) }; return reply(200, w.docs[uid]);
  };
  return w;
}
const call = async (handler, body, method) => { const out = {}; await handler({ method: method || 'POST', body }, { setHeader() {}, status(c) { out.status = c; return this; }, end(t) { out.body = JSON.parse(t); } }); return out; };
const engineOf = (w, uid) => JSON.parse(w.docs[uid].fields.engine.stringValue);

let w = world(), h = createHandler({ fetch: w.fetch, now: () => NOW, account: () => ACCOUNT });
r = await call(h, { idToken: 'token-of-ana', events: [ev(0, 'talk'), ev(1, 'play')] });
check('a signed-in player\'s events are applied and stored', r.status === 200 && r.body.engine.xp === 9 && engineOf(w, 'ana').xp === 9, r);
w.docs.ana.fields.state = { stringValue: '{"name":"Ana\'s creature"}' }; w.docs.ana.updateTime = 'v' + (++w.version); // the page saved its own field meanwhile
r = await call(h, { idToken: 'token-of-ana', events: [ev(2, 'talk')] });
check('a second batch adds to the stored state and leaves the page\'s field alone', r.status === 200 && engineOf(w, 'ana').xp === 12 && w.docs.ana.fields.state.stringValue.includes('Ana'), r);
check('the access token is asked once and reused', w.tokens === 1, w.tokens);
w.conflicts = 1; r = await call(h, { idToken: 'token-of-ana', events: [ev(3, 'talk')] });
check('a write that collides is read again and applied once', r.status === 200 && engineOf(w, 'ana').xp === 15, r);
r = await call(h, { idToken: 'token-of-ben', events: [ev(0, 'talk')] });
check('each player has their own state', r.status === 200 && engineOf(w, 'ben').xp === 3 && engineOf(w, 'ana').xp === 15, r);
r = await call(h, { idToken: 'forged', events: [ev(9, 'talk')] }); check('a token Google does not know is refused', r.status === 401, r);
r = await call(h, { idToken: 'token-of-ana', events: 'talk' }); check('a request without a list of events is refused', r.status === 400, r);
r = await call(h, { idToken: 'token-of-ana', events: [{ type: 'talk' }] }); check('a malformed event is refused and nothing is stored', r.status === 400 && engineOf(w, 'ana').xp === 15, r);
r = await call(h, {}, 'GET'); check('only POST is served', r.status === 405, r);
r = await call(createHandler({ fetch: w.fetch, now: () => NOW, account: () => null }), { idToken: 'token-of-ana', events: [ev(9, 'talk')] });
check('without the service account it says so and touches nothing', r.status === 503 && r.body.error === 'not_configured' && engineOf(w, 'ana').xp === 15, r);
w = world(); r = await call(createHandler({ fetch: w.fetch, now: () => NOW, account: () => Object.assign({}, ACCOUNT, { client_email: 'someone-else@example.com' }) }), { idToken: 'token-of-ana', events: [ev(0, 'talk')] });
check('a service account Google refuses gives an error, not a save', r.status === 502 && !w.docs.ana, r);

console.log(results.every(Boolean) ? `ALL ${results.length} CHECKS PASSED` : 'SOME CHECKS FAILED');
process.exit(results.every(Boolean) ? 0 : 1);
