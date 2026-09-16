#!/usr/bin/env node
/**
 * SocioBeast — rig the biped forms with Meshy and bake animation clips.
 *   MESHY_API_KEY=msy_xxx node scripts/meshy-rig.mjs 08            # one form (uses web/assets/models/meshy-tasks.json)
 *   MESHY_API_KEY=msy_xxx node scripts/meshy-rig.mjs 04 06 08 09 11 10
 * Output: web/assets/models/form-NN-rig.glb (rigged, T/A-pose) and form-NN-<clip>.glb per clip in CLIPS.
 * The game (creature.js) prefers form-NN-idle.glb + the other clips when they exist.
 * Docs: https://docs.meshy.ai/en/api/rigging-and-animation
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(ROOT, 'web/assets/models');
const KEY = process.env.MESHY_API_KEY; if (!KEY) { console.error('Set MESHY_API_KEY'); process.exit(1); }
const TASKS = JSON.parse(readFileSync(resolve(OUT, 'meshy-tasks.json'), 'utf8'));
// Meshy animation library ids (see docs / animation_actions): idle, wave, dance, jump, look around, cheer
const ALL_CLIPS = { idle: 0, wave: 28, dance: 64, jump: 466, cheer: 128, look: 5 };
const CLIPS = Object.fromEntries(Object.entries(ALL_CLIPS).filter(([k]) => !process.env.CLIPS || process.env.CLIPS.split(',').includes(k))); // CLIPS=idle,wave,dance,jump to bake fewer
const forms = process.argv.slice(2);
if (!forms.length) { console.error('Give form numbers, e.g. 08 09 11'); process.exit(1); }

const api = async (path, init) => {
  const r = await fetch('https://api.meshy.ai' + path, { ...init, headers: { Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' } });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(path + ' → ' + r.status + ' ' + JSON.stringify(j));
  return j;
};
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function poll(path) { for (;;) { await sleep(6000); const t = await api(path); process.stdout.write(`\r  ${t.status} ${t.progress ?? 0}%   `); if (['SUCCEEDED', 'FAILED', 'CANCELED'].includes(t.status)) { console.log(); return t; } } }
async function save(url, file) { const b = await fetch(url).then(r => r.arrayBuffer()); writeFileSync(file, Buffer.from(b)); console.log(`  saved ${file} (${Math.round(b.byteLength / 1024)} KB)`); }

for (const nn of forms) {
  const taskId = TASKS['form-' + nn]; if (!taskId) { console.error(`form-${nn}: no Meshy task id in meshy-tasks.json`); continue; }
  const rigFile = resolve(OUT, `form-${nn}-rig.glb`), rigMeta = resolve(OUT, `form-${nn}-rig.json`);
  let rig = existsSync(rigMeta) ? JSON.parse(readFileSync(rigMeta, 'utf8')) : null;
  if (!rig) {
    console.log(`form-${nn}: rigging task ${taskId}…`);
    const { result: id } = await api('/openapi/v1/rigging', { method: 'POST', body: JSON.stringify({ input_task_id: taskId, height_meters: 0.6 }) });
    const t = await poll('/openapi/v1/rigging/' + id);
    if (t.status !== 'SUCCEEDED') { console.error(`form-${nn}: rigging ${t.status} ${JSON.stringify(t.task_error || '')}`); continue; }
    rig = { rigTaskId: id, result: t.result || t }; writeFileSync(rigMeta, JSON.stringify(rig, null, 1));
    const glbUrl = t.result?.rigged_character_glb_url || t.rigged_character_glb_url;
    if (glbUrl) await save(glbUrl, rigFile);
  }
  for (const [name, actionId] of Object.entries(CLIPS)) {
    const file = resolve(OUT, `form-${nn}-${name}.glb`); if (existsSync(file)) { console.log(`  ${name}: exists`); continue; }
    console.log(`form-${nn}: animation "${name}" (action ${actionId})…`);
    try {
      const { result: id } = await api('/openapi/v1/animations', { method: 'POST', body: JSON.stringify({ rig_task_id: rig.rigTaskId, action_id: actionId }) });
      const t = await poll('/openapi/v1/animations/' + id);
      const url = t.result?.animation_glb_url || t.animation_glb_url;
      if (t.status === 'SUCCEEDED' && url) await save(url, file); else console.error(`  ${name}: ${t.status} ${JSON.stringify(t.task_error || t)}`.slice(0, 300));
    } catch (e) { console.error('  ' + name + ': ' + e.message.slice(0, 300)); }
  }
}
console.log('done');
