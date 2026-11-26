import './validate.mjs';
import { mkdir, cp, writeFile, readFile, readdir } from 'node:fs/promises';

await mkdir('dist', { recursive: true });
for (const file of ['index.html', 'umbra_cronicas_del_umbral.html', 'src', 'data', 'assets']) {
  await cp(file, 'dist/' + file, { recursive: true });
}
// Cada publicación obtiene sus propios recursos, sin depender de la caché anterior.
const commit=process.env.GITHUB_SHA||process.env.RENDER_GIT_COMMIT||'local';
const revision=encodeURIComponent(commit);
for(const file of ['index.html','umbra_cronicas_del_umbral.html']){
  const path='dist/'+file,html=await readFile(path,'utf8');
  await writeFile(path,html.replace(/((?:src|href)="[^"?#]+\.(?:js|css|svg))"/g,'$1?v='+revision+'"'));
}
for(const file of await readdir('dist/src'))if(file.endsWith('.js')){
  const path='dist/src/'+file,source=await readFile(path,'utf8');
  await writeFile(path,source.replace(/(from\s+['"]\.\.?\/[^'"?]+\.js)(['"])/g,'$1?v='+revision+'$2'));
}
await writeFile('dist/.nojekyll', '');
await writeFile('dist/version.json', JSON.stringify({
  commit,
  builtAt: new Date().toISOString()
}, null, 2) + '\n');
console.log('OK: sitio listo para GitHub Pages en dist/.');
