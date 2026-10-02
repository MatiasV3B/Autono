import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

const jsFiles = [
  path.join(rootDir, 'side-panel/sidepanel.js'),
  path.join(rootDir, '../dist/side-panel/sidepanel.js'),
  path.join(rootDir, '../../Zylo Browser Agent/Zylo-Browser-Agent/dist/side-panel/sidepanel.js'),
  path.join(rootDir, 'background.js'),
  path.join(rootDir, 'buildDomTree.js'),
  path.join(rootDir, 'domExtractor.js'),
];

const htmlFiles = [
  path.join(rootDir, 'side-panel/index.html'),
  path.join(rootDir, 'options/options.html')
];

const allFiles = [...jsFiles, ...htmlFiles];

const inlineHandlerRegex = /\b(on[a-zA-Z]+)\s*=\s*['"][^'"]*['"]/g;

for (const f of allFiles) {
  if (!fs.existsSync(f)) continue;
  const content = fs.readFileSync(f, 'utf8');
  const lines = content.split('\n');
  lines.forEach((line, idx) => {
    let m;
    while ((m = inlineHandlerRegex.exec(line)) !== null) {
      // ignore variable declarations like `const onOpen = ...`
      const handler = m[1].toLowerCase();
      if ([
        'onclick', 'ondblclick', 'onmousedown', 'onmouseup', 'onmouseover',
        'onmouseout', 'onmouseenter', 'onmouseleave', 'onmousemove',
        'onkeydown', 'onkeyup', 'onkeypress',
        'onload', 'onerror', 'onabort',
        'onchange', 'oninput', 'onsubmit', 'onreset', 'onselect',
        'onfocus', 'onblur', 'onscroll', 'onresize', 'oncontextmenu'
      ].includes(handler)) {
        console.log(`[VIOLATION] ${path.relative(rootDir, f)}:${idx + 1} -> ${m[0]}`);
      }
    }
  });
}
console.log('Check complete.');
