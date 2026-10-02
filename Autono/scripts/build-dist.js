import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

const agyDist = path.resolve(rootDir, '../dist');

function copyFolder(src, dest) {
  if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    if (['node_modules', '.git', 'dist', 'scripts'].includes(entry.name)) continue;
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyFolder(s, d);
    } else {
      fs.copyFileSync(s, d);
    }
  }
}

console.log('Building dist packages...');
copyFolder(rootDir, agyDist);
console.log('✓ Antigravity Extension/dist updated');

console.log('Build complete!');
