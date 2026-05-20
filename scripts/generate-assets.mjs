import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const assetsDir = join(__dirname, '..', 'assets');

// Minimal valid 1x1 PNG (white pixel)
const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

const files = ['icon.png', 'splash.png', 'adaptive-icon.png', 'favicon.png'];

await mkdir(assetsDir, { recursive: true });
await Promise.all(files.map((file) => writeFile(join(assetsDir, file), png)));

console.log(`Created placeholder assets in ${assetsDir}`);
