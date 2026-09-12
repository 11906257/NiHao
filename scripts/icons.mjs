import sharp from 'sharp';
import {readFile} from 'node:fs/promises';
const svg = await readFile('public/favicon.svg', 'utf8');
for (const [name,size] of [['icon-192.png',192],['icon-512.png',512],['apple-touch-icon.png',180],['icon-maskable.png',512]]) {
  const source = name === 'icon-maskable.png' ? svg.replace('rx="112"', 'rx="0"') : svg;
  await sharp(Buffer.from(source)).resize(size,size).png().toFile(`public/${name}`);
}
