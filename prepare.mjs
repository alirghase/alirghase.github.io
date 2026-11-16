// Runs before every publish (see publish.sh) to make content/ self-contained and safe to commit:
// 1. removes %% comments %% (Obsidian's private comments), outside code;
// 2. copies every image the notes use (![[plot.png]], ![](plot.png), cover:) from the vault into content/assets/;
// 3. stops on a [[link]] to a note that isn't published (its name would leak).
// Usage: node prepare.mjs <vault folder>
import fs from 'node:fs';
import path from 'node:path';

const SRC = 'content';
const VAULT = process.argv[2];
const IMAGE = /\.(png|jpe?g|gif|svg|webp|avif)$/i;
// Code, inline code and maths are left alone: `df[["a"]]` is not a link.
const PROTECT = /^(`{3,}|~{3,})[^\n]*\n[\s\S]*?^\1[ \t]*$|(`+)[^\n]*?\2|\$\$[\s\S]+?\$\$|\$[^$\n]+?\$/gm;

function walk(dir, keep) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => {
    if (e.name.startsWith('.') || e.name === 'node_modules') return [];
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p, keep) : keep(e.name) ? [p] : [];
  });
}
const outside = (src, fn) => {
  let out = '', last = 0;
  for (const m of src.matchAll(PROTECT)) { out += fn(src.slice(last, m.index)) + m[0]; last = m.index + m[0].length; }
  return out + fn(src.slice(last));
};
const plain = src => src.replace(PROTECT, '');
const fail = msg => { console.error(`STOP: ${msg}`); process.exit(1); };

const mdFiles = walk(SRC, n => n.endsWith('.md'));
const published = new Set(mdFiles.map(f => path.basename(f, '.md')));
const have = new Set(walk(SRC, n => IMAGE.test(n)).map(f => path.basename(f)));
const wanted = new Set();
const errors = [];

for (const file of mdFiles) {
  let text = fs.readFileSync(file, 'utf8');
  const stripped = outside(text, s => s.replace(/%%[\s\S]*?%%/g, ''));
  if (stripped !== text) fs.writeFileSync(file, text = stripped);

  const rel = path.relative(SRC, file);
  const body = plain(text);
  for (const [, t] of body.matchAll(/!\[\[([^\]|#]+)/g)) if (IMAGE.test(t)) wanted.add(path.basename(t.trim()));
  for (const [, t] of body.matchAll(/!\[[^\]]*\]\(<?([^)>"]+?)>?(?:\s+"[^"]*")?\)/g)) {
    if (!/^(https?:|data:)/.test(t) && IMAGE.test(t)) wanted.add(path.basename(decodeURIComponent(t.trim())));
  }
  const cover = text.match(/^cover:[ \t]*["']?(?:\[\[)?([^"'\]\n]+)/m);
  if (cover) wanted.add(path.basename(cover[1].trim()));
  for (const [, t] of body.matchAll(/(?<!!)\[\[([^\]|#\\]+)/g)) {
    const base = path.basename(t.trim().replace(/\.md$/, ''));
    if (base !== 'index' && !published.has(base)) errors.push(`[[${t}]] in ${rel} links to a note that isn't published.`);
  }
  for (const [, t] of body.matchAll(/!\[\[([^\]|#]+)/g)) {
    if (!IMAGE.test(t) && !published.has(path.basename(t.trim().replace(/\.md$/, '')))) errors.push(`![[${t}]] in ${rel} embeds a note that isn't published.`);
  }
}

// Find the missing images in the vault, by file name, the way Obsidian does.
const missing = [...wanted].filter(n => !have.has(n));
if (missing.length) {
  if (!VAULT || !fs.existsSync(VAULT)) fail('the vault folder was not given.');
  const index = {};
  for (const f of walk(VAULT, n => IMAGE.test(n))) (index[path.basename(f)] ||= []).push(f);
  fs.mkdirSync(path.join(SRC, 'assets'), { recursive: true });
  for (const name of missing) {
    const hits = index[name] || [];
    if (!hits.length) { errors.push(`image "${name}" isn't in the vault. If it's in iCloud, open it in Obsidian once so it downloads.`); continue; }
    if (hits.length > 1) { errors.push(`${hits.length} images in the vault are called "${name}". Rename one.`); continue; }
    fs.copyFileSync(hits[0], path.join(SRC, 'assets', name));
  }
}

if (errors.length) fail('\n  ' + errors.join('\n  '));
console.log(`Checked ${mdFiles.length} notes; ${wanted.size} images used, ${missing.length} copied from the vault.`);
