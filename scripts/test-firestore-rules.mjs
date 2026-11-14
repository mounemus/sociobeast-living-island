// Real test of firestore.rules against the live project, with two throwaway accounts that are deleted at the end.
// Usage: node scripts/test-firestore-rules.mjs <apiKey> <projectId>   (the public values of BEAST_CONFIG.firebase in web/play.html)
// Needs the Email/Password sign-in provider enabled. Run it after every change to firestore.rules, once deployed.
import { randomBytes } from 'node:crypto';
const [KEY, PROJECT] = process.argv.slice(2);
const IDT = 'https://identitytoolkit.googleapis.com/v1/accounts:';
const DOC = (path) => `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/${path}`;
const post = (url, body) => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(async r => ({ status: r.status, body: await r.json() }));
const signUp = async (tag) => {
  const r = await post(IDT + 'signUp?key=' + KEY, { email: `sociobeast-rules-test-${tag}-${Date.now()}@example.com`, password: randomBytes(18).toString('base64url'), returnSecureToken: true });
  if (r.status !== 200) throw new Error('signUp failed: ' + JSON.stringify(r.body.error && r.body.error.message));
  return { uid: r.body.localId, token: r.body.idToken };
};
const fs = (method, path, token, body) => fetch(DOC(path), { method, headers: Object.assign({ 'Content-Type': 'application/json' }, token ? { Authorization: 'Bearer ' + token } : {}), body: body ? JSON.stringify(body) : undefined }).then(async r => ({ status: r.status, body: await r.json().catch(() => null) }));
const save = (state, extra) => ({ fields: Object.assign({ state: { stringValue: state }, updatedAt: { timestampValue: new Date().toISOString() } }, extra || {}) });

const results = []; const check = (name, ok, got) => { results.push(ok); console.log((ok ? 'PASS' : 'FAIL') + '  ' + name + (ok ? '' : '  -> got ' + got)); };
let a, b;
try {
  a = await signUp('a'); b = await signUp('b');
  const state = JSON.stringify({ species: 'mochi', name: 'Test', xp: 50, born: 1 });
  let r = await fs('PATCH', 'pets/' + a.uid, a.token, save(state)); check('owner writes own save', r.status === 200, r.status);
  r = await fs('GET', 'pets/' + a.uid, a.token); check('owner reads own save back intact', r.status === 200 && r.body.fields.state.stringValue === state, r.status);
  r = await fs('GET', 'pets/' + a.uid, b.token); check('another player cannot read it', r.status === 403, r.status);
  r = await fs('PATCH', 'pets/' + a.uid, b.token, save('{"hacked":true}')); check('another player cannot overwrite it', r.status === 403, r.status);
  r = await fs('DELETE', 'pets/' + a.uid, b.token); check('another player cannot delete it', r.status === 403, r.status);
  r = await fs('GET', 'pets/' + a.uid, null); check('a visitor without account cannot read it', r.status === 403 || r.status === 401, r.status);
  r = await fs('PATCH', 'pets/' + a.uid, null, save(state)); check('a visitor without account cannot write', r.status === 403 || r.status === 401, r.status);
  r = await fs('PATCH', 'pets/' + a.uid, a.token, save(state, { admin: { booleanValue: true } })); check('extra fields are refused', r.status === 403, r.status);
  r = await fs('PATCH', 'pets/' + a.uid, a.token, save('x'.repeat(70000))); check('an oversized save is refused', r.status === 403, r.status);
  r = await fs('PATCH', 'pets/' + a.uid, a.token, { fields: { state: { integerValue: '5' }, updatedAt: { timestampValue: new Date().toISOString() } } }); check('a save that is not text is refused', r.status === 403, r.status);
  r = await fs('PATCH', 'other/' + a.uid, a.token, save(state)); check('any other collection is closed', r.status === 403, r.status);
  r = await fs('GET', 'pets', a.token); check('listing all saves is refused', r.status === 403, r.status);
  r = await fs('GET', 'pets/' + a.uid, a.token); check('the save survived all the refused attempts', r.status === 200 && r.body.fields.state.stringValue === state, r.status);
  r = await fs('DELETE', 'pets/' + a.uid, a.token); check('owner deletes own save', r.status === 200, r.status);
  r = await fs('GET', 'pets/' + a.uid, a.token); check('the save is gone', r.status === 404, r.status);
} catch (e) { console.log('ERROR  ' + e.message); results.push(false); }
finally {
  for (const u of [a, b]) if (u) { const r = await post(IDT + 'delete?key=' + KEY, { idToken: u.token }); console.log('cleanup: test account deleted -> ' + (r.status === 200 ? 'yes' : 'NO (' + r.status + ')')); }
}
console.log(results.every(Boolean) ? `ALL ${results.length} CHECKS PASSED` : 'SOME CHECKS FAILED');
process.exit(results.every(Boolean) ? 0 : 1);
