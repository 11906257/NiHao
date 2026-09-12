import {readFile,access} from 'node:fs/promises';
import assert from 'node:assert/strict';
const base=process.env.BASE_PATH||'/';
const html=await readFile('dist/index.html','utf8');
const manifest=JSON.parse(await readFile('dist/manifest.webmanifest','utf8'));
assert.equal(manifest.scope,base);assert.equal(manifest.start_url,base);assert.equal(manifest.display,'standalone');
for(const path of [...manifest.icons.map(i=>i.src),...Array.from(html.matchAll(/(?:src|href)="([^"]+)"/g),m=>m[1])]){
 assert(path.startsWith(base),`Asset außerhalb des Basispfads: ${path}`);await access(`dist/${path.slice(base.length)}`);
}
const sw=await readFile('dist/sw.js','utf8');assert(sw.includes(`${base}index.html`),'Offline-Navigation verwendet falschen Pfad');assert(sw.includes('index.html'),'App Shell fehlt im Precache');
console.log(`PWA-Build geprüft: ${base} · Manifest, lokale Assets, Icons und Offline-Navigation.`);
