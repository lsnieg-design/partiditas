import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import sharp from 'sharp';

const publicDir = resolve('public');
const publicLogo = resolve(publicDir, 'logo.png');
const rootLogo = resolve('logo.png');

mkdirSync(resolve(publicDir, 'icons'), { recursive: true });

if (!existsSync(publicLogo)) {
  if (!existsSync(rootLogo)) {
    throw new Error(
      'No se encontró logo.png. Conservá logo.png en la raíz del repositorio o agregalo en public/logo.png.'
    );
  }
  copyFileSync(rootLogo, publicLogo);
  console.log('Copiado logo.png desde la raíz a public/logo.png.');
}

const outDir = resolve(publicDir, 'icons');
const targets = [
  ['partiditas-180.png', 180],
  ['partiditas-192.png', 192],
  ['partiditas-512.png', 512]
];

for (const [filename, size] of targets) {
  await sharp(publicLogo)
    .rotate()
    .resize(size, size, {
      fit: 'contain',
      background: { r: 251, g: 247, b: 238, alpha: 1 }
    })
    .png()
    .toFile(resolve(outDir, filename));
}

console.log('Íconos de Partiditas generados desde logo.png.');
