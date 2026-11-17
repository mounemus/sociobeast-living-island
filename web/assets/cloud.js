/**
 * SOCIOBEAST — Cloud (accounts and online save of the online game, on Firebase)
 * A guest plays from localStorage. "Save online" = sign in with an emailed link (Firebase Authentication); the creature
 * then also lives in the Firestore document pets/{player id}, which only that player can read or write (firestore.rules).
 * Off while BEAST_CONFIG.firebase is empty: the game is then exactly the guest game. The apiKey in the page is public by
 * design; access is decided by the rules.
 * ponytail: the page is still the authority and the document is a save, last write wins, stored as one JSON string because
 * nothing queries inside it yet. When rankings, trades or rooms arrive, events go through a server function running
 * evolution.js and the page only reads the result.
 * Server rules (cfg.serverRules, off by default): the engine state then lives in the document's field `engine`, written only
 * by the Vercel function api/event (settle), and load() puts it over the page's own copy.
 * window.Cloud = { on, server, init(onUser), user(), signIn(email), signOut(), load(), save(state, now), settle(events), remove(), info }
 */
(function() {
  'use strict';
  const cfg = (window.BEAST_CONFIG || {}).firebase || {}, on = !!(cfg.apiKey && cfg.projectId), server = on && !!cfg.serverRules;
  const SDK = 'https://www.gstatic.com/firebasejs/12.3.0/', MAIL = 'sociobeast.signin.email';
  const EVERY = 20000; // at most one write per 20 s
  const info = { savedAt: 0, error: '' };
  let auth = null, me = null, started = false, lastPush = 0, timer = null;

  // The document is reached over Firestore's REST API with the player's token: one read and one write do not need the
  // Firestore SDK (about 300 KB), only the app and auth libraries are loaded.
  function call(method, body, query) {
    const u = me; if (!u) return Promise.reject(new Error('signed out'));
    return u.getIdToken().then(function(t) {
      return fetch('https://firestore.googleapis.com/v1/projects/' + cfg.projectId + '/databases/(default)/documents/pets/' + u.uid + (query || ''),
        { method: method, headers: { Authorization: 'Bearer ' + t, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined, keepalive: method !== 'GET' });
    });
  }

  // onUser({ id, email } | null) fires once at start, then each time the player signs in or out
  function init(onUser) {
    if (!on) return;
    loadScript(SDK + 'firebase-app-compat.js').then(function() { return loadScript(SDK + 'firebase-auth-compat.js'); }).then(function() {
      firebase.initializeApp(cfg); auth = firebase.auth();
      if (auth.isSignInWithEmailLink(location.href)) { // back from the emailed link: finish the sign-in, then clean the address bar
        const email = localStorage.getItem(MAIL) || prompt('Type your email again to finish signing in');
        if (email) auth.signInWithEmailLink(email, location.href).then(function() { localStorage.removeItem(MAIL); }, function(e) { info.error = e.message; onUser(null); })
          .then(function() { history.replaceState(null, '', location.pathname); });
      }
      auth.onAuthStateChanged(function(u) {
        if (started && (u && u.uid) === (me && me.uid)) return; // token refreshes repeat the same user
        started = true; me = u; onUser(user());
      });
    }).catch(function() { info.error = 'offline'; onUser(null); });
  }
  function user() { return me ? { id: me.uid, email: me.email } : null; }
  function signIn(email) {
    if (!auth) return Promise.reject(new Error('offline'));
    return auth.sendSignInLinkToEmail(email, { url: location.origin + location.pathname, handleCodeInApp: true }).then(function() { localStorage.setItem(MAIL, email); }); // the email is kept to finish the sign-in on return
  }
  function signOut() { clearTimeout(timer); return auth.signOut(); }
  function load() {
    return call('GET').then(function(r) { if (r.status === 404) return null; if (!r.ok) throw new Error('error ' + r.status); return r.json().then(function(d) { const s = JSON.parse(d.fields.state.stringValue); if (server && d.fields.engine) Object.assign(s, JSON.parse(d.fields.engine.stringValue)); return s; }); }); // the server's engine state wins over the page's copy
  }
  // writes the state as it is when the timer fires; `now` skips the wait (first save after signing in, leaving the page)
  function save(state, now) {
    if (!me) return; clearTimeout(timer);
    timer = setTimeout(function() {
      lastPush = Date.now();
      call('PATCH', { fields: { state: { stringValue: JSON.stringify(state) }, updatedAt: { timestampValue: new Date().toISOString() } } }, '?updateMask.fieldPaths=state&updateMask.fieldPaths=updatedAt') // only its own two fields: the server's stay
        .then(function(r) { info.error = r.ok ? '' : 'error ' + r.status; if (r.ok) info.savedAt = Date.now(); }, function(e) { info.error = e.message || 'offline'; });
    }, now ? 0 : Math.max(0, EVERY - (Date.now() - lastPush)));
  }
  // deletes the online save, then the account itself. Resolves true when the account is gone too: Firebase refuses to
  // delete an account whose sign-in is old, in which case only the save is removed.
  function remove() {
    clearTimeout(timer); const u = me;
    return call('DELETE').then(function(r) { if (!r.ok) throw new Error('error ' + r.status); info.savedAt = 0; return u.delete().then(function() { return true; }, function() { return false; }); });
  }

  // sends a batch of events to the server's rules. Resolves with { engine, results }, or { error } when the server refuses the
  // batch for good; rejects when it could not be reached or is not ready (the events are then kept and sent again).
  function settle(events) {
    const u = me; if (!u) return Promise.reject(new Error('signed out'));
    return u.getIdToken().then(function(t) { return fetch('api/event', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken: t, events: events }) }); })
      .then(function(r) { if (r.status >= 500 || r.status === 401 || r.status === 404 || r.status === 409) throw new Error('error ' + r.status); return r.json(); });
  }

  window.Cloud = { on: on, server: server, settle: settle, init: init, user: user, signIn: signIn, signOut: signOut, load: load, save: save, remove: remove, info: info };
})();
