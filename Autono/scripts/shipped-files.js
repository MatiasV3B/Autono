// Single source of truth for "what ships in the extension package".
// Used by build-dist.js (copy + forbidden scan), check-csp.js (static checks) and verify-vendor.js.
// Dependency-free node (ESM).
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(here, '..');          // .../Autono
export const REPO_ROOT = path.resolve(ROOT, '..');

// Explicit allowlist. Anything not listed here is NOT shipped.
export const ALLOW_FILES = ['manifest.json', 'background.js', 'buildDomTree.js', 'domExtractor.js'];
export const ALLOW_DIRS = ['assets', 'content', 'options', 'side-panel', 'vendor/whisper'];
export const ALLOW_GLOBS = [{ dir: 'lib', ext: '.js' }];

// Anything matching these must never be present in the output. Build fails if one is found.
export const FORBIDDEN_SEGMENTS = ['node_modules', 'components', 'scripts', 'docs', '.git', '.github'];
const FORBIDDEN_BASENAME = [
  /^package(-lock)?\.json$/i, /^npm-shrinkwrap\.json$/i, /^tsconfig.*\.json$/i,
  /^tailwind\.config\./i, /^postcss\.config\./i, /^components\.json$/i,
  /^readme(\..*)?$/i, /^\.env(\..*)?$/i, /\.map$/i, /\.pem$/i, /\.key$/i, /\.p12$/i,
  /\.tsx?$/i, /\.log$/i, /\.zip$/i, /\.crx$/i, /\.tgz$/i, /^\.ds_store$/i, /^thumbs\.db$/i,
];

export function forbiddenReason(rel) {
  const parts = rel.split('/');
  for (const seg of parts.slice(0, -1)) {
    if (FORBIDDEN_SEGMENTS.includes(seg)) return `forbidden directory "${seg}"`;
  }
  const base = parts[parts.length - 1];
  for (const re of FORBIDDEN_BASENAME) if (re.test(base)) return `forbidden file pattern ${re}`;
  return null;
}

function walk(absDir, relDir, out) {
  for (const e of fs.readdirSync(absDir, { withFileTypes: true })) {
    const abs = path.join(absDir, e.name);
    const rel = relDir ? `${relDir}/${e.name}` : e.name;
    if (e.isDirectory()) walk(abs, rel, out);
    else if (e.isFile()) out.push(rel);
  }
}

/** Relative (posix) paths of every file the allowlist selects, sorted. */
export function collectShipped(root = ROOT) {
  const out = [];
  for (const f of ALLOW_FILES) if (fs.existsSync(path.join(root, f))) out.push(f);
  for (const d of ALLOW_DIRS) {
    const abs = path.join(root, d);
    if (fs.existsSync(abs)) walk(abs, d, out);
  }
  for (const g of ALLOW_GLOBS) {
    const abs = path.join(root, g.dir);
    if (!fs.existsSync(abs)) continue;
    for (const e of fs.readdirSync(abs, { withFileTypes: true })) {
      if (e.isFile() && e.name.endsWith(g.ext)) out.push(`${g.dir}/${e.name}`);
    }
  }
  return [...new Set(out)].sort();
}

/** Vendored third-party code is not scanned as first-party source. */
export function isVendored(rel) {
  return rel.startsWith('vendor/') || rel.includes('/vendor/');
}
