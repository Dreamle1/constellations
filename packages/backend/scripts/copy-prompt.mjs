import { copyFile, mkdir } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(scriptDir, '..');
const sourcePrompt = path.join(backendRoot, 'src', 'services', 'prompt');
const distPrompt = path.join(backendRoot, 'dist', 'services', 'prompt');

await mkdir(path.dirname(distPrompt), { recursive: true });
await copyFile(sourcePrompt, distPrompt);
