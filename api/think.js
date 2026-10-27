// SocioBeast — the creature's voice on Vercel (demo). Set ANTHROPIC_API_KEY (or OPENAI_API_KEY) in the project env;
// without a key the game uses its scripted lines. The prompts live in server/think.js (shared with the home server).
import { think } from '../server/think.js';

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  if (req.method !== 'POST') return res.status(405).end('{"text":null}');
  const ai = process.env.ANTHROPIC_API_KEY ? { provider: 'anthropic', anthropicKey: process.env.ANTHROPIC_API_KEY, anthropicModel: process.env.ANTHROPIC_MODEL }
    : process.env.OPENAI_API_KEY ? { provider: 'openai', openaiKey: process.env.OPENAI_API_KEY, openaiModel: process.env.OPENAI_MODEL } : {};
  const body = typeof req.body === 'object' && req.body ? req.body : {};
  try { res.status(200).end(JSON.stringify(await think(body, ai))); } catch (e) { res.status(200).end('{"text":null}'); }
}
