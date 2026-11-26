import { readFile, stat, readdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { validateGameData } from '../src/data-schema.js';
import { validateExpansion } from '../src/expansion-rules.js';

process.chdir(fileURLToPath(new URL('../', import.meta.url)));
validateGameData(JSON.parse(await readFile('data/game-data.json', 'utf8')));
validateExpansion(JSON.parse(await readFile('data/expansion.json', 'utf8')));
JSON.parse(await readFile('.devcontainer/devcontainer.json', 'utf8'));
const files=[];
for(const folder of ['src','scripts','server','tests']) for(const file of await readdir(folder)) if(/\.(?:js|mjs)$/.test(file)) files.push(folder+'/'+file);
for (const file of files) {
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || file);
}
const entry = await readFile('index.html', 'utf8');
assert.ok(entry.includes('umbra_cronicas_del_umbral.html'), 'La entrada debe abrir el juego.');
const html = await readFile('umbra_cronicas_del_umbral.html', 'utf8');
assert.ok(html.includes('type="module" src="src/game.js"'), 'Falta el módulo del juego.');
for (const match of html.matchAll(/(?:src|href)=["']([^"']+)["']/g)) {
  const url = match[1];
  if (url.startsWith('#')) continue;
  assert.ok(!/^(?:https?:|data:|\/)/.test(url), 'Los recursos deben usar rutas relativas: ' + url);
  assert.ok((await stat(url)).isFile(), 'Falta el recurso ' + url);
}
assert.ok((await stat('assets/audio/forest-ambience.mp3')).size > 0, 'Falta el audio.');
console.log('OK: datos, sintaxis, entrada HTML y recursos del juego.');
