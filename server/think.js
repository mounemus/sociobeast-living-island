/**
 * SocioBeast — the voice of the show (LLM relay), shared by the home server and the Vercel demo function.
 *   think({ mode?: 'show', prompt, kind, question, who, name, stage, mood, food, joy, energy, keepers, recent, pollOpen }, ai)
 *   ai = { provider: 'anthropic'|'openai'|'', anthropicKey, openaiKey, anthropicModel, openaiModel }
 * Returns { text } for a single line, { show } (JSON beat: lines/action/poll) in show mode, nulls when no provider.
 */
const s = (v, n) => String(v ?? '').slice(0, n);

function beastSystem(b, name) {
  return `You are ${name}, a small living creature raised on a TikTok Live by strangers who feed you with likes, talk to you in the chat and give you gifts so you can evolve. `
    + 'You are gentle, funny, a little cheeky, never mean, never sad for long. You speak in the first person, in English, one or two short sentences (max 140 characters), no hashtags, no emoji spam (one emoji at most). '
    + 'Never mention being an AI or a language model. Never ask for money directly; you may playfully hint that likes taste good and gifts make you grow. '
    + `Current form: ${s(b.stage || 'Hatchling', 30)}. Mood: ${s(b.mood || 'curious', 20)}. Food ${+b.food || 50}/100, joy ${+b.joy || 50}/100, energy ${+b.energy || 50}/100. `
    + `Your best keepers: ${(Array.isArray(b.keepers) ? b.keepers : []).slice(0, 3).map(k => s(k, 30)).join(', ')}.`;
}
function showSystem(b, name) {
  return `You write the next beat of a live TikTok show set around ${name}, a small plush dragon-like creature raised by the chat. Three characters speak, in English: "beast" (${name}: gentle, funny, cheeky, first person, short), "pip" (a tiny pink fairy-light who hosts the show: warm, energetic, addresses the audience directly, explains that likes feed the beast, comments make it happy, gifts make it evolve) and "moss" (a 400-year-old mossy turtle: slow, dry, wise, gently teases Pip, answers deep questions). Never mention AI or language models. No hashtags, at most one emoji per line, each line under 120 characters. Never ask for money directly. `
    + `State: form ${s(b.stage, 30)}, mood ${s(b.mood, 20)}, food ${+b.food || 50}/100, joy ${+b.joy || 50}/100, energy ${+b.energy || 50}/100. Best keepers: ${(Array.isArray(b.keepers) ? b.keepers : []).slice(0, 3).map(k => s(k, 30)).join(', ')}. `
    + `Recent chat: ${(Array.isArray(b.recent) ? b.recent : []).slice(-6).map(c => s(c?.name, 24) + ': ' + s(c?.text, 80)).join(' | ')}. `
    + 'Reply with JSON only: {"lines":[{"who":"pip|moss|beast","text":"..."}], "action": null|"dance"|"sing"|"spin"|"wave"|"play", "poll": null|{"q":"...","options":["a","b"]}} with 1 to 3 lines.';
}
function showUser(b) {
  const q = b.question;
  return b.kind === 'answer' && q
    ? `Viewer ${s(q.name || 'someone', 30)} asked: "${s(q.text, 160)}". Let ${s(b.who || 'pip', 6)} answer them by name in 1-2 lines (a second character may add one line). No poll.`
    : `Write a short natural beat for right now: banter between two characters about the current state, or a question to the audience${b.pollOpen ? ' (a poll is already open: no poll)' : ', optionally as a poll with two options'}.`;
}

async function complete(ai, system, user, maxTokens) {
  const ctrl = new AbortController(); const to = setTimeout(() => ctrl.abort(), 9000);
  try {
    if (ai.provider === 'anthropic' && ai.anthropicKey) {
      const r = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', signal: ctrl.signal, headers: { 'Content-Type': 'application/json', 'x-api-key': ai.anthropicKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: ai.anthropicModel || 'claude-haiku-4-5-20251001', max_tokens: maxTokens, system, messages: [{ role: 'user', content: user }] }) });
      const d = await r.json(); return d?.content?.[0]?.text || '';
    }
    if (ai.provider === 'openai' && ai.openaiKey) {
      const r = await fetch('https://api.openai.com/v1/chat/completions', { method: 'POST', signal: ctrl.signal, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + ai.openaiKey },
        body: JSON.stringify({ model: ai.openaiModel || 'gpt-4o-mini', max_tokens: maxTokens, temperature: 0.9, messages: [{ role: 'system', content: system }, { role: 'user', content: user }] }) });
      const d = await r.json(); return d?.choices?.[0]?.message?.content || '';
    }
    return '';
  } catch (e) { return ''; } finally { clearTimeout(to); }
}

export async function think(b, ai) {
  b = b && typeof b === 'object' ? b : {}; ai = ai || {};
  const name = s(b.name || 'SocioBeast', 40);
  if (b.mode === 'show') {
    const raw = (await complete(ai, showSystem(b, name), showUser(b), 320)).trim();
    let j = null; try { const m = raw.match(/\{[\s\S]*\}/); j = m ? JSON.parse(m[0]) : null; } catch (e) { j = null; }
    return { show: j && Array.isArray(j.lines) && j.lines.length ? j : null };
  }
  const raw = (await complete(ai, beastSystem(b, name), s(b.prompt || 'Say something.', 400), 80)).trim();
  return { text: raw.slice(0, 200) || null };
}
