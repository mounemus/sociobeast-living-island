#!/usr/bin/env node
/**
 * SocioBeast — turn the 11 form concept images (web/assets/art/form-NN-*.png) into textured GLB models
 * (web/assets/models/form-NN.glb) with the Meshy Image-to-3D API. The game loads them automatically per form.
 *
 *   MESHY_API_KEY=msy_xxx node scripts/meshy-forms.mjs            # all forms that have no model yet
 *   MESHY_API_KEY=msy_xxx node scripts/meshy-forms.mjs 03 08      # only these forms
 *   FORCE=1 …                                                      # regenerate even if the .glb exists
 *
 * Docs: https://docs.meshy.ai/en/api/image-to-3d  (Node 18+, no dependencies)
 */
import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ART = resolve(ROOT, 'web/assets/art'), OUT = resolve(ROOT, 'web/assets/models');
const KEY = process.env.MESHY_API_KEY;
if (!KEY) { console.error('Set MESHY_API_KEY (https://www.meshy.ai → API keys).'); process.exit(1); }
mkdirSync(OUT, { recursive: true });

const only = process.argv.slice(2);
// form-NN-*.png are the creature forms; any other name (char-pip.png, prop-nest.png…) converts to models/<name>.glb
const forms = readdirSync(ART).filter(f => /\.png$/.test(f)).sort()
  .filter(f => only.length ? only.some(o => f.startsWith('form-' + o + '-') || f === o + '.png' || f.startsWith(o)) : /^form-\d\d-/.test(f));
const outName = f => /^form-\d\d-/.test(f) ? `form-${f.slice(5, 7)}.glb` : f.replace(/\.png$/, '.glb');

const api = async (path, init) => {
  const r = await fetch('https://api.meshy.ai' + path, { ...init, headers: { Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json', ...(init?.headers || {}) } });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(path + ' → ' + r.status + ' ' + JSON.stringify(j));
  return j;
};
const sleep = ms => new Promise(r => setTimeout(r, ms));

for (const f of forms) {
  const nn = f.slice(5, 7), out = resolve(OUT, outName(f));
  if (existsSync(out) && !process.env.FORCE) { console.log(`form-${nn}: model exists, skip`); continue; }
  const dataUri = 'data:image/png;base64,' + readFileSync(resolve(ART, f)).toString('base64');
  console.log(`form-${nn}: creating task from ${f}…`);
  const { result: id } = await api('/openapi/v1/image-to-3d', { method: 'POST', body: JSON.stringify({
    image_url: dataUri, ai_model: 'meshy-5', should_texture: true, enable_pbr: false, should_remesh: true,
    topology: 'triangle', target_polycount: 30000, symmetry_mode: 'auto'
  }) });
  let task;
  for (;;) {
    await sleep(8000);
    task = await api('/openapi/v1/image-to-3d/' + id);
    process.stdout.write(`\r  ${task.status} ${task.progress ?? 0}%   `);
    if (task.status === 'SUCCEEDED' || task.status === 'FAILED' || task.status === 'CANCELED') break;
  }
  console.log();
  if (task.status !== 'SUCCEEDED') { console.error(`form-${nn}: ${task.status} ${task.task_error?.message || ''}`); continue; }
  const glb = await fetch(task.model_urls.glb).then(r => r.arrayBuffer());
  writeFileSync(out, Buffer.from(glb));
  try { const mp = resolve(OUT, 'meshy-tasks.json'); const m = existsSync(mp) ? JSON.parse(readFileSync(mp, 'utf8')) : {}; m[outName(f).replace(/\.glb$/, '')] = id; writeFileSync(mp, JSON.stringify(m, null, 1)); } catch (e) {}
  console.log(`form-${nn}: saved ${out} (${Math.round(glb.byteLength / 1024)} KB)`);
}
console.log('done — commit web/assets/models and push; the game picks the models up per form.');
