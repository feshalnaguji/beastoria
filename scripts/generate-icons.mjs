// One-time icon/OG rasterizer. Run manually: npm run icons
// Outputs are COMMITTED — npm run build and CI never execute this.
import { copyFile, readFile, writeFile } from 'node:fs/promises';
import pngToIco from 'png-to-ico';
import sharp from 'sharp';

const icon = await readFile('assets/brand/icon.svg');
const maskable = await readFile('assets/brand/icon-maskable.svg');
const og = await readFile('assets/brand/og-image.svg');

const png = (buf, size, out) => sharp(buf).resize(size, size).png().toFile(out);

await png(icon, 180, 'public/apple-touch-icon.png');
await png(icon, 192, 'public/icon-192.png');
await png(icon, 512, 'public/icon-512.png');
await png(maskable, 192, 'public/icon-maskable-192.png');
await png(maskable, 512, 'public/icon-maskable-512.png');
await sharp(og).resize(1200, 630).png().toFile('public/og-image.png');
await copyFile('assets/brand/icon.svg', 'public/favicon.svg');

const icoSources = await Promise.all(
  [16, 32, 48].map((s) => sharp(icon).resize(s, s).png().toBuffer()),
);
await writeFile('public/favicon.ico', await pngToIco(icoSources));
console.log('icons written to public/');
