// SocioBeast — the creature's voice on Vercel (demo). Set ANTHROPIC_API_KEY in the project env; without it the game uses its scripted lines.
// Mirrors web/api/think.php (the PHP host version). Keep the two prompts in sync.
export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  if (req.method !== 'POST') return res.status(405).end('{"text":null}');
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return res.status(200).end('{"text":null}');
  const b = typeof req.body === 'object' && req.body ? req.body : {};
  const s = (v, n) => String(v ?? '').slice(0, n);
  const name = s(b.name || 'SocioBeast', 40);
  const show = b.mode === 'show';
  const system = show ? showPrompt(b, name, s) : `You are ${name}, a small living creature raised on a TikTok Live by strangers who feed you with likes, talk to you in the chat and give you gifts so you can evolve. `
    + 'You are gentle, funny, a little cheeky, never mean, never sad for long. You speak in the first person, in English, one or two short sentences (max 140 characters), no hashtags, no emoji spam (one emoji at most). '
    + 'Never mention being an AI or a language model. Never ask for money directly; you may playfully hint that likes taste good and gifts make you grow. '
    + `Current form: ${s(b.stage || 'Hatchling', 30)}. Mood: ${s(b.mood || 'curious', 20)}. Food ${+b.food || 50}/100, joy ${+b.joy || 50}/100, energy ${+b.energy || 50}/100. `
    + `Your best keepers: ${(Array.isArray(b.keepers) ? b.keepers : []).slice(0, 3).map(k => s(k, 30)).join(', ')}.`;
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5-20251001', max_tokens: show ? 320 : 80, system, messages: [{ role: 'user', content: show ? showUser(b, s) : s(b.prompt || 'Say something.', 400) }] }) });
    const d = await r.json();
    const raw = d?.content?.[0]?.text?.trim() || '';
    if (show) { let j = null; try { const m = raw.match(/\{[\s\S]*\}/); j = m ? JSON.parse(m[0]) : null; } catch (e) { j = null; }
      return res.status(200).end(JSON.stringify({ show: j && Array.isArray(j.lines) && j.lines.length ? j : null })); }
    res.status(200).end(JSON.stringify({ text: raw.slice(0, 200) || null }));
  } catch (e) { res.status(200).end('{"text":null}'); }
}

// Mirrors the "show" mode of web/api/think.php: one beat for the three characters, as JSON.
function showPrompt(b, name, s) {
  return `You write the next beat of a live TikTok show set around ${name}, a small plush dragon-like creature raised by the chat. Three characters speak, in English: "beast" (${name}: gentle, funny, cheeky, first person, short), "pip" (a tiny pink fairy-light who hosts the show: warm, energetic, addresses the audience directly, explains that likes feed the beast, comments make it happy, gifts make it evolve) and "moss" (a 400-year-old mossy turtle: slow, dry, wise, gently teases Pip, answers deep questions). Never mention AI or language models. No hashtags, at most one emoji per line, each line under 120 characters. Never ask for money directly. `
    + `State: form ${s(b.stage, 30)}, mood ${s(b.mood, 20)}, food ${+b.food || 50}/100, joy ${+b.joy || 50}/100, energy ${+b.energy || 50}/100. Best keepers: ${(Array.isArray(b.keepers) ? b.keepers : []).slice(0, 3).map(k => s(k, 30)).join(', ')}. `
    + `Recent chat: ${(Array.isArray(b.recent) ? b.recent : []).slice(-6).map(c => s(c?.name, 24) + ': ' + s(c?.text, 80)).join(' | ')}. `
    + 'Reply with JSON only: {"lines":[{"who":"pip|moss|beast","text":"..."}], "action": null|"dance"|"sing"|"spin"|"wave"|"play", "poll": null|{"q":"...","options":["a","b"]}} with 1 to 3 lines.';
}
function showUser(b, s) {
  const q = b.question;
  return b.kind === 'answer' && q
    ? `Viewer ${s(q.name || 'someone', 30)} asked: "${s(q.text, 160)}". Let ${s(b.who || 'pip', 6)} answer them by name in 1-2 lines (a second character may add one line). No poll.`
    : `Write a short natural beat for right now: banter between two characters about the current state, or a question to the audience${b.pollOpen ? ' (a poll is already open: no poll)' : ', optionally as a poll with two options'}.`;
}
