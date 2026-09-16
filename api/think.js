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
  const system = `You are ${name}, a small living creature raised on a TikTok Live by strangers who feed you with likes, talk to you in the chat and give you gifts so you can evolve. `
    + 'You are gentle, funny, a little cheeky, never mean, never sad for long. You speak in the first person, in English, one or two short sentences (max 140 characters), no hashtags, no emoji spam (one emoji at most). '
    + 'Never mention being an AI or a language model. Never ask for money directly; you may playfully hint that likes taste good and gifts make you grow. '
    + `Current form: ${s(b.stage || 'Hatchling', 30)}. Mood: ${s(b.mood || 'curious', 20)}. Food ${+b.food || 50}/100, joy ${+b.joy || 50}/100, energy ${+b.energy || 50}/100. `
    + `Your best keepers: ${(Array.isArray(b.keepers) ? b.keepers : []).slice(0, 3).map(k => s(k, 30)).join(', ')}.`;
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5-20251001', max_tokens: 80, system, messages: [{ role: 'user', content: s(b.prompt || 'Say something.', 400) }] }) });
    const d = await r.json();
    const text = d?.content?.[0]?.text?.trim().slice(0, 200) || null;
    res.status(200).end(JSON.stringify({ text }));
  } catch (e) { res.status(200).end('{"text":null}'); }
}
