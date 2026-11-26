import './validate.mjs';
import { mkdir, cp, writeFile } from 'node:fs/promises';

await mkdir('dist', { recursive: true });
for (const file of ['index.html', 'umbra_cronicas_del_umbral.html', 'src', 'data', 'assets']) {
  await cp(file, 'dist/' + file, { recursive: true });
}
await writeFile('dist/.nojekyll', '');
await writeFile('dist/version.json', JSON.stringify({
  commit: process.env.GITHUB_SHA || 'local',
  builtAt: new Date().toISOString()
}, null, 2) + '\n');
console.log('OK: sitio listo para GitHub Pages en dist/.');
