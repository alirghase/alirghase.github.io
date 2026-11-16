// Builds the site from the notes in content/ (copied from the vault's site/ folder) into public/.
// Layout is newsletter-style: one reading column, every write-up a post in a section, an archive.
import fs from 'node:fs';
import path from 'node:path';
import { Marked } from 'marked';
import { markedHighlight } from 'marked-highlight';
import markedKatex from 'marked-katex-extension';
import markedFootnote from 'marked-footnote';
import hljs from 'highlight.js';
import YAML from 'yaml';

const SRC = 'content';
const OUT = 'public';
const BRAND = 'Ali';
const SITE = 'https://alirghase.github.io';
const LINKEDIN = 'https://www.linkedin.com/in/arghasemi/';
const CONTACT = [
  ['LinkedIn', LINKEDIN],
  ['GitHub', 'https://github.com/alirghase'],
];
const KATEX = JSON.parse(fs.readFileSync('node_modules/katex/package.json', 'utf8')).version;
const MERMAID = '11.6.0';
const IMAGE = /\.(png|jpe?g|gif|svg|webp|avif)$/i;

// ---------- reading notes ----------

function walk(dir, keep) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p, keep) : keep(e.name) ? [p] : [];
  });
}

function readNote(file) {
  const raw = fs.readFileSync(file, 'utf8');
  const m = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  let fm = {};
  try { fm = m ? YAML.parse(m[1]) || {} : {}; }
  catch (e) { throw new Error(`The properties of ${file} don't parse (${e.message.split('\n')[0]}). A value with ": " in it needs quotes.`); }
  const body = m ? m[2] : raw;
  const rel = path.relative(SRC, file).replace(/\.md$/, '');
  const slug = rel === 'index' ? '' : rel.replace(/\/index$/, '');
  return { rel, slug, fm, body, base: path.basename(rel) === 'index' ? path.basename(slug) || 'index' : path.basename(rel) };
}

const notes = walk(SRC, n => n.endsWith('.md')).map(readNote).filter(n => !n.fm.draft);
const bySlug = Object.fromEntries(notes.map(n => [n.slug, n]));
const url = slug => '/' + (slug ? slug + '/' : '');

// Images anywhere in content/ are served from /assets/, found by file name the way Obsidian finds them.
const assets = {};
for (const f of walk(SRC, n => IMAGE.test(n))) {
  const name = path.basename(f);
  if (assets[name]) throw new Error(`Two images are called "${name}". Rename one.`);
  assets[name] = f;
}
const assetUrl = name => {
  const base = path.basename(decodeURIComponent(String(name).replace(/^\[\[|\]\]$/g, '').split('|')[0]));
  if (!assets[base]) throw new Error(`Missing image: ${base}`);
  return '/assets/' + encodeURIComponent(base);
};

function resolve(target) {
  const t = target.trim().replace(/\.md$/, '').replace(/\/index$/, '');
  if (t === 'index') return '';
  if (t in bySlug) return t;
  const hit = notes.find(n => n.base === path.basename(t));
  if (!hit) throw new Error(`Link to a missing note: [[${target}]]`);
  return hit.slug;
}

const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const slugify = s => String(s).toLowerCase().replace(/<[^>]+>/g, '').replace(/&[a-z#0-9]+;/g, '').replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '');

// ---------- Obsidian markdown ----------

// Code, inline code and maths are left exactly as written; Obsidian syntax is converted everywhere else.
const PROTECT = /^(`{3,}|~{3,})[^\n]*\n[\s\S]*?^\1[ \t]*$|(`+)[^\n]*?\2|\$\$[\s\S]+?\$\$|\$[^$\n]+?\$/gm;
function outsideCode(src, fn) {
  let out = '', last = 0;
  for (const m of src.matchAll(PROTECT)) { out += fn(src.slice(last, m.index)) + m[0]; last = m.index + m[0].length; }
  return out + fn(src.slice(last));
}

function obsidian(src) {
  return outsideCode(src, s => s
    // %% comments %% never reach the page
    .replace(/%%[\s\S]*?%%/g, '')
    // ![[plot.png]], ![[plot.png|caption]], ![[plot.png|600]]: a figure. ![[a note]] becomes a link.
    .replace(/!\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\\?\|([^\]]*))?\]\]/g, (_, file, opt = '') => {
      if (!IMAGE.test(file)) return `[[${file}]]`;
      const width = /^\d+(x\d+)?$/.test(opt.trim()) ? opt.trim().split('x')[0] : '';
      const cap = width ? '' : opt.trim();
      return `![${cap}](<asset:${file.trim()}${width ? '#w=' + width : ''}>${cap ? ` "${cap.replace(/"/g, '&quot;')}"` : ''})`;
    })
    // [[note]], [[note|label]], [[note#heading|label]] (and [[note\|label]] inside tables)
    .replace(/\[\[([^\]|#\\]*)(#[^\]|\\]*)?(?:\\?\|([^\]]+))?\]\]/g, (_, t, h, label) => {
      const anchor = h ? '#' + slugify(h.slice(1)) : '';
      return `[${label || t || (h ? h.slice(1) : '')}](${t ? url(resolve(t)) : ''}${anchor})`;
    })
    // ==highlight==
    .replace(/==([^=\n]+)==/g, '<mark>$1</mark>'));
}

// Callout types, grouped into four looks.
const CALLOUT = { note: 'key', info: 'key', abstract: 'key', summary: 'key', tldr: 'key', important: 'key',
  tip: 'good', hint: 'good', success: 'good', check: 'good', done: 'good',
  warning: 'warn', caution: 'warn', attention: 'warn', danger: 'warn', error: 'warn', bug: 'warn', failure: 'warn', fail: 'warn', missing: 'warn' };

let toc = [];
let ids = new Set();
const marked = new Marked(
  markedHighlight({
    emptyLangClass: 'hljs',
    langPrefix: 'hljs language-',
    highlight: (code, lang) => lang && lang !== 'mermaid' && hljs.getLanguage(lang) ? hljs.highlight(code, { language: lang }).value : code,
  }),
  markedKatex({ throwOnError: false }),
  markedFootnote(),
);
marked.use({
  renderer: {
    heading(text, level, raw) {
      let id = slugify(raw) || 'section', n = 2;
      while (ids.has(id)) id = `${slugify(raw)}-${n++}`;
      ids.add(id);
      if (level === 2) toc.push({ id, text: text.replace(/<[^>]+>/g, '') });
      return `<h${level} id="${id}">${text}</h${level}>\n`;
    },
    image(href, title, text) {
      const local = !/^(https?:|data:)/.test(href || '');
      const [file, frag = ''] = String(href).replace(/^asset:/, '').split('#');
      const src = local ? assetUrl(file) : href;
      const w = (frag.match(/^w=(\d+)$/) || [])[1];
      return `<figure><img src="${src}" alt="${esc(text || title || '')}" loading="lazy"${w ? ` width="${w}"` : ''}>${title ? `<figcaption>${marked.parseInline(title)}</figcaption>` : ''}</figure>`;
    },
    blockquote(quote) {
      // > [!type] Title   (add - or + after ] to make it fold)
      const m = quote.match(/^<p>\[!([\w-]+)\]([+-]?)(.*?)(\n|<\/p>\n?)/);
      if (!m) return `<blockquote>\n${quote}</blockquote>\n`;
      const [all, type, fold, title, end] = m;
      const look = CALLOUT[type.toLowerCase()] || 'plain';
      const name = title.trim() || type[0].toUpperCase() + type.slice(1).toLowerCase();
      const body = (end === '\n' ? '<p>' : '') + quote.slice(all.length);
      const inner = body.trim() ? `<div class="callout-body">${body}</div>` : '';
      return fold
        ? `<details class="callout ${look}"${fold === '+' ? ' open' : ''}><summary class="callout-title">${name}</summary>${inner}</details>\n`
        : `<div class="callout ${look}"><div class="callout-title">${name}</div>${inner}</div>\n`;
    },
  },
});

// Renders a note's body; returns the HTML and its section headings.
function render(src) {
  toc = []; ids = new Set();
  const html = marked.parse(obsidian(src || ''))
    // a figure on its own line shouldn't sit inside a paragraph
    .replace(/<p>((?:<figure>[\s\S]*?<\/figure>\s*)+)<\/p>/g, '$1')
    // wide tables scroll sideways on a phone instead of squashing
    .replace(/<table>/g, '<div class="table"><table>').replace(/<\/table>/g, '</table></div>')
    // code blocks get a language label and a copy button; ```mermaid blocks become diagrams
    .replace(/<pre><code class="hljs(?: language-([^"]+))?">([\s\S]*?)<\/code><\/pre>/g, (_, lang, code) =>
      lang === 'mermaid' ? `<pre class="mermaid">${code}</pre>`
        : `<div class="code"><div class="code-head"><span>${esc(lang || '')}</span><button type="button" class="copy">Copy</button></div><pre><code class="hljs">${code}</code></pre></div>`);
  return { html, toc: [...toc] };
}
const md = s => render(s).html;
const inline = s => marked.parseInline(obsidian(String(s || '')));

const minutes = body => Math.max(1, Math.round(body.replace(/```[\s\S]*?```/g, '').split(/\s+/).filter(Boolean).length / 220));
const fmtDate = d => { const x = new Date(d); return isNaN(x) ? String(d ?? '') : x.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }); };

// The picture for a post: `cover:` in its properties, or else its first image.
function picture(n) {
  if (n.fm.cover) return assetUrl(n.fm.cover);
  const m = obsidian(n.body).match(/!\[[^\]]*\]\((?:<(?:asset:)?([^>#]+)|(?:asset:)?([^)\s#]+))/);
  const f = m && (m[1] || m[2]);
  return f && !/^https?:/.test(f) && IMAGE.test(f) && assets[path.basename(decodeURIComponent(f))] ? assetUrl(f) : '';
}

// ---------- data ----------

const home = bySlug[''];
const SUBSCRIBE = home.fm.subscribe; // a newsletter sign-up link, once there is one

// Every write-up is a post in one section, chosen by its folder.
const SECTIONS = [
  ['writing', 'Write-ups', 'writing/'],
  ['labs', 'Labs', 'notes/labs/'],
  ['system-design', 'System design', 'notes/system-design/'],
  ['concepts', 'Concepts', 'notes/concepts/'],
  ['coding', 'Coding', 'notes/coding/'],
  ['notes', 'Notes', 'notes/'],
  ['log', 'Build log', 'log/'],
];
const posts = notes
  .filter(n => path.basename(n.rel) !== 'index')
  .map(n => ({ n, s: SECTIONS.find(([, , dir]) => n.rel.startsWith(dir)) }))
  .filter(x => x.s)
  .map(({ n, s }) => Object.assign(n, { section: s[0], sectionName: s[1], pic: picture(n) }))
  .sort((a, b) => String(b.fm.date).localeCompare(String(a.fm.date)));
// The home page and the feed leave out the build log: it's listed on each project's page and in the archive.
const feed = posts.filter(p => p.section !== 'log');
const logs = posts.filter(p => p.section === 'log');
const usedSections = SECTIONS.filter(([id]) => posts.some(p => p.section === id));

const projects = notes.filter(n => n.rel.startsWith('projects/') && n.base !== 'projects')
  .sort((a, b) => (a.fm.order ?? 99) - (b.fm.order ?? 99));
// Public repos: a link and one line each, from `repos:` in projects/index.md.
const repos = bySlug['projects']?.fm.repos || [];
const projectOf = p => p.fm.project ? bySlug[resolve(String(p.fm.project))] : null;

// ---------- pieces ----------

const pill = st => `<span class="pill ${/^(now|live|shipped)$/i.test(st) ? 'now' : ''}">${esc(st)}</span>`;
const contact = () => `<div class="contact">${CONTACT.map(([t, u]) => `<a href="${u}">${t}</a>`).join('')}</div>`;
const follow = (cls = 'btn') => SUBSCRIBE
  ? `<a class="${cls}" href="${esc(SUBSCRIBE)}">Subscribe</a>`
  : `<a class="${cls}" href="${LINKEDIN}">Follow on LinkedIn</a>`;
const meta = p => `<span>${esc(fmtDate(p.fm.date))}</span><span>${minutes(p.body)} min read</span>`;

const projectRow = p => `<a class="row" href="${url(p.slug)}">
  <h3>${esc(p.fm.title)}</h3><span class="meta">${pill(p.fm.status || 'Planned')}${p.fm.launch ? `<span>Launch ${esc(p.fm.launch)}</span>` : ''}</span>
  <p><span class="sub">${esc(p.fm.name)}</span> · ${esc(p.fm.what)}</p></a>`;

// A public repo: its live app when there is one (`app:`), a screenshot (`image:`) and the code.
const repoRow = r => `<div class="row repo">
  <div><h3><a href="${esc(r.app || r.url)}">${esc(r.name)}</a></h3><p>${esc(r.what)}</p>
  <div class="row-links">${r.app ? `<a href="${esc(r.app)}">Try it ↗</a>` : ''}<a href="${esc(r.url)}">Code ↗</a></div></div>
  ${r.image ? `<a href="${esc(r.app || r.url)}" tabindex="-1"><img class="thumb" src="${assetUrl(r.image)}" alt="" loading="lazy"></a>` : ''}</div>`;

// A post in a list: section, title, subtitle, date, and its picture on the right.
const postRow = p => `<a class="post-row" href="${url(p.slug)}" data-s="${p.section}">
  <div><div class="kicker">${esc(p.sectionName)}</div><h3>${esc(p.fm.title)}</h3>
  ${p.fm.summary ? `<p class="dek">${esc(p.fm.summary)}</p>` : ''}<div class="meta">${meta(p)}</div></div>
  ${p.pic ? `<img class="thumb" src="${p.pic}" alt="" loading="lazy">` : ''}</a>`;

const featured = p => `<a class="featured" href="${url(p.slug)}">
  ${p.pic ? `<img class="cover" src="${p.pic}" alt="">` : ''}
  <div class="kicker">${esc(p.sectionName)}</div><h2>${esc(p.fm.title)}</h2>
  ${p.fm.summary ? `<p class="dek">${esc(p.fm.summary)}</p>` : ''}<div class="meta">${meta(p)}</div></a>`;

// A project's skills box: the core skills it builds, from `skills:` in its properties.
const skillsBox = fm => fm.skills?.length ? `<section class="skills" id="skills"><h2>${esc(fm.skills_title || "Skills I'm building")}</h2>
  ${fm.skills_intro ? `<p class="small">${inline(fm.skills_intro)}</p>` : ''}
  <ul>${fm.skills.map(k => `<li><div class="skill-head"><h3>${esc(k.skill)}</h3>${k.level ? `<span class="pill ${/main/i.test(k.level) ? 'finding-tag' : ''}">${esc(k.level)}</span>` : ''}</div>
  ${k.learn ? `<p>${inline(k.learn)}</p>` : ''}</li>`).join('')}</ul></section>` : '';

const finding = p => !p.fm.number ? '' : p.fm.result
  ? `<div class="finding"><div class="num">${esc(p.fm.result)}<small>${esc(p.fm.result_label || 'Measured')}</small></div>
      <div><h3>The number</h3><p>${inline(p.fm.number)}</p></div></div>`
  : `<div class="finding"><div class="num">[N]<small>Not measured yet</small></div>
      <div><h3>The number it will publish</h3><p>${inline(p.fm.number)}</p></div></div>`;

const subscribeBox = () => `<div class="subscribe"><p>${SUBSCRIBE ? 'New write-ups by email.' : 'Every new write-up goes on LinkedIn.'}</p>${follow()}</div>`;

// ---------- pages ----------

function homePage() {
  return `<div class="col">
    <header class="masthead">
      <div class="banner"><img src="/header.jpg" alt=""></div>
      <img class="avatar big" src="/avatar.jpg" alt="${esc(BRAND)}">
      <div class="eyebrow">${esc(BRAND)}${home.fm.eyebrow ? ` · ${esc(home.fm.eyebrow)}` : ''}</div>
      <h1>${esc(home.fm.headline)}</h1>
      <p class="lede">${esc(home.fm.lede)}</p>
      <div class="cta">${follow()}<a class="btn ghost" href="${CONTACT[1][1]}">GitHub</a></div>
    </header>
    ${home.body.trim() ? `<div class="prose">${md(home.body)}</div>` : ''}
    ${feed.length ? `<section class="latest">${featured(feed[0])}
      ${feed.slice(1, 8).map(postRow).join('')}
      ${posts.length > 8 ? `<a class="more" href="/archive/">See all posts →</a>` : ''}</section>` : ''}
    ${projects.length || repos.length ? `<section><div class="sec-head"><h2>Projects</h2><a href="/projects/">All projects →</a></div>
      ${projects.map(projectRow).join('')}${repos.map(repoRow).join('')}</section>` : ''}
    ${logs.length ? `<section><div class="sec-head"><h2>Build log</h2><a href="/archive/#log">All entries →</a></div>
      ${logs.slice(0, 3).map(postRow).join('')}</section>` : ''}
  </div>`;
}

function archivePage() {
  return `<div class="col">
    <h1>Archive</h1>
    ${usedSections.length > 1 ? `<div class="chips"><button type="button" data-s="" class="on">All</button>${usedSections.map(([id, name]) => `<button type="button" data-s="${id}">${esc(name)}</button>`).join('')}</div>` : ''}
    <div class="list">${posts.map(postRow).join('')}</div>
  </div>
  <script>
  const chips = [...document.querySelectorAll('.chips button')], rows = [...document.querySelectorAll('.list .post-row')];
  function show(s) {
    if (!chips.some(c => c.dataset.s === s)) s = '';
    chips.forEach(c => c.classList.toggle('on', c.dataset.s === s));
    rows.forEach(r => r.hidden = !!s && r.dataset.s !== s);
  }
  chips.forEach(c => c.onclick = () => { history.replaceState(null, '', c.dataset.s ? '#' + c.dataset.s : location.pathname); show(c.dataset.s); });
  show(location.hash.slice(1));
  </script>`;
}

// /writing/ and /notes/: one section's posts, with the intro from its index note.
function sectionPage(note, ids) {
  const list = posts.filter(p => ids.includes(p.section));
  return `<div class="col">
    <h1>${esc(note.fm.headline || note.fm.title)}</h1>
    ${note.body.trim() ? `<div class="prose lede">${md(note.body)}</div>` : ''}
    <div class="list">${list.map(postRow).join('')}</div>
    <p class="small more"><a href="/archive/">All posts →</a></p>
  </div>`;
}

function projectsPage(note) {
  return `<div class="col">
    <h1>${esc(note.fm.headline || note.fm.title)}</h1>
    <div class="prose lede">${md(note.body)}</div>
    ${projects.length ? `<section><div class="sec-head"><h2>Building now</h2></div>
      ${projects.map(projectRow).join('')}</section>` : ''}
    ${repos.length ? `<section><div class="sec-head"><h2>Small apps</h2></div>
      ${repos.map(repoRow).join('')}</section>` : ''}
  </div>`;
}

function projectPage(p) {
  const fm = p.fm;
  const mine = posts.filter(x => x.fm.project && resolve(String(x.fm.project)) === p.slug);
  const write = mine.filter(x => x.section !== 'log'), log = mine.filter(x => x.section === 'log');
  return `<div class="col">
    <a class="back" href="/projects/">← Projects</a>
    <div class="eyebrow" style="margin-top:22px">${esc(fm.name)}</div>
    <h1>${esc(fm.title)}</h1>
    <p class="lede">${esc(fm.what)}</p>
    ${finding(p)}
    <ul class="facts">
      <li><span>Status</span><span>${pill(fm.status || 'Planned')}</span></li>
      ${fm.who ? `<li><span>For</span><span>${esc(fm.who)}</span></li>` : ''}
      ${fm.launch ? `<li><span>Launch</span><span>${esc(fm.launch)}</span></li>` : ''}
      ${fm.ships ? `<li><span>Ships</span><span>${esc(fm.ships)}</span></li>` : ''}
      ${fm.stack ? `<li><span>Built with</span><span class="stack">${[].concat(fm.stack).map(t => `<span>${esc(t)}</span>`).join('')}</span></li>` : ''}
    </ul>
    ${skillsBox(fm)}
    ${fm.app || fm.code ? `<div class="links">${fm.app ? `<a href="${fm.app}">Try it ↗</a>` : ''}${fm.code ? `<a href="${fm.code}">Code ↗</a>` : ''}</div>` : ''}
    <div class="prose">${md(p.body)}</div>
    ${write.length ? `<section><div class="sec-head"><h2>Write-ups</h2></div>${write.map(postRow).join('')}</section>` : ''}
    ${log.length ? `<section><div class="sec-head"><h2>Build log</h2></div>${log.map(postRow).join('')}</section>` : ''}
  </div>`;
}

// One post: write-up, lab, system design, concept, coding problem or build log entry.
function postPage(p) {
  const proj = projectOf(p);
  const { html, toc } = render(p.body);
  const same = posts.filter(x => x.section === p.section);
  const i = same.indexOf(p), newer = same[i - 1], older = same[i + 1];
  return `<article class="col post">
    <div class="kicker">${proj ? `<a href="${url(proj.slug)}">${esc(proj.fm.name)}</a> · ` : ''}<a href="/archive/#${p.section}">${esc(p.sectionName)}</a></div>
    <h1>${esc(p.fm.title)}</h1>
    ${p.fm.summary ? `<p class="subtitle">${esc(p.fm.summary)}</p>` : ''}
    <div class="byline"><img class="avatar" src="/avatar.jpg" alt="">
      <div><div class="author">${BRAND}</div><div class="meta">${meta(p)}</div></div>
      <button type="button" class="share" data-url="${SITE}${url(p.slug)}">Copy link</button></div>
    ${p.fm.cover ? `<figure class="hero"><img src="${p.pic}" alt=""></figure>` : ''}
    ${toc.length >= 4 && minutes(p.body) >= 5 && p.fm.toc !== false ? `<details class="toc"><summary>Contents</summary><ol>${toc.map(h => `<li><a href="#${h.id}">${h.text}</a></li>`).join('')}</ol></details>` : ''}
    <div class="prose">${html}</div>
    ${subscribeBox()}
    ${newer || older ? `<nav class="pager">${older ? `<a href="${url(older.slug)}"><small>← Older</small>${esc(older.fm.title)}</a>` : '<span></span>'}${newer ? `<a href="${url(newer.slug)}"><small>Newer →</small>${esc(newer.fm.title)}</a>` : ''}</nav>` : ''}
  </article>`;
}

function plainPage(note) {
  return `<div class="col about">
    <h1>${esc(note.fm.headline || note.fm.title)}</h1>
    <div class="prose">${md(note.body)}</div>
    ${note.slug === 'about' ? contact() : ''}
  </div>`;
}

// ---------- layout ----------

const CSS = fs.readFileSync('style.css', 'utf8');
// Archive stays out of the menu until something is published.
const NAV = [['Archive', '/archive/', posts.length], ['Projects', '/projects/', 1], ['About', '/about/', 1]]
  .filter(([, , n]) => n);

function layout({ title, active, main, description, image, article, path: here }) {
  const desc = description || home.fm.lede;
  const math = main.includes('class="katex');
  const code = main.includes('class="code"');
  const diagram = main.includes('class="mermaid"');
  return `<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title === BRAND ? BRAND : `${title} · ${BRAND}`)}</title>
<meta name="description" content="${esc(desc)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:type" content="${article ? 'article' : 'website'}">
<meta property="og:image" content="${SITE}${image || '/avatar.jpg'}"><meta name="twitter:card" content="${image ? 'summary_large_image' : 'summary'}">
<link rel="icon" href="/avatar.jpg">
<link rel="alternate" type="application/rss+xml" title="${BRAND}" href="/feed.xml">
${here !== undefined ? `<link rel="canonical" href="${SITE}${here}"><meta property="og:url" content="${SITE}${here}">` : ''}
${home.fm.google_site_verification ? `<meta name="google-site-verification" content="${esc(home.fm.google_site_verification)}">` : ''}
${home.fm.goatcounter ? `<script data-goatcounter="https://${esc(home.fm.goatcounter)}.goatcounter.com/count" async src="https://gc.zgo.at/count.js"></script>` : ''}
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600&family=Lora:ital,wght@0,400;0,500;1,400&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
${math ? `<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@${KATEX}/dist/katex.min.css">` : ''}
<script>try{const t=localStorage.getItem('theme');if(t)document.documentElement.dataset.theme=t}catch(e){}</script>
<style>${CSS}</style>
</head>
<body>
<header class="top"><div class="wrap">
  <a class="brand" href="/"><img class="avatar tiny" src="/avatar.jpg" alt="">${BRAND}</a>
  <nav>${NAV.map(([t, u]) => `<a href="${u}"${active === u ? ' class="active"' : ''}>${t}</a>`).join('')}
    <button class="theme" id="theme" aria-label="Toggle dark mode">◐</button>${follow('btn small-btn')}</nav>
</div></header>
<main><div class="wrap">${main}</div></main>
<footer><div class="wrap"><span>© ${new Date().getFullYear()} ${BRAND} · Public data only.</span><span><a href="/feed.xml">RSS</a> · Written in Obsidian.</span></div></footer>
<script>
document.getElementById('theme').onclick = () => {
  const r = document.documentElement;
  const dark = r.dataset.theme ? r.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
  r.dataset.theme = dark ? 'light' : 'dark';
  try { localStorage.setItem('theme', r.dataset.theme); } catch (e) {}
};
document.querySelectorAll('.share').forEach(b => b.onclick = () =>
  navigator.clipboard.writeText(b.dataset.url).then(() => { b.textContent = 'Copied'; setTimeout(() => b.textContent = 'Copy link', 1500); }));
${code ? `document.querySelectorAll('.code .copy').forEach(b => b.onclick = () =>
  navigator.clipboard.writeText(b.closest('.code').querySelector('pre').innerText).then(() => { b.textContent = 'Copied'; setTimeout(() => b.textContent = 'Copy', 1500); }));` : ''}
</script>
${diagram ? `<script type="module">
import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@${MERMAID}/dist/mermaid.esm.min.mjs';
const r = document.documentElement;
const dark = r.dataset.theme ? r.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
mermaid.initialize({ startOnLoad: false, theme: dark ? 'dark' : 'neutral' });
await mermaid.run();
</script>` : ''}
</body>
</html>`;
}

// ---------- write ----------

fs.rmSync(OUT, { recursive: true, force: true });
function emit(slug, html) {
  const dir = path.join(OUT, slug);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), html);
}

for (const n of notes) {
  let main, active = '';
  if (n.slug === '') main = homePage();
  else if (n.slug === 'projects') { main = projectsPage(n); active = '/projects/'; }
  else if (n.rel.startsWith('projects/')) { main = projectPage(n); active = '/projects/'; }
  else if (n.slug === 'writing') { main = sectionPage(n, ['writing']); active = '/archive/'; }
  else if (n.slug === 'notes') { main = sectionPage(n, ['labs', 'system-design', 'concepts', 'coding', 'notes']); active = '/archive/'; }
  else if (n.section) { main = postPage(n); active = '/archive/'; }
  else { main = plainPage(n); active = `/${n.slug}/`; }
  const title = n.slug === '' ? BRAND : n.fm.name || n.fm.title;
  emit(n.slug, layout({ title, active, main, description: n.fm.summary || n.fm.what || n.fm.lede, image: n.pic, article: !!n.section, path: url(n.slug) }));
}
if (posts.length) emit('archive', layout({ title: 'Archive', active: '/archive/', main: archivePage(), path: '/archive/' }));
fs.writeFileSync(path.join(OUT, '404.html'),
  layout({ title: 'Not found', main: `<div class="col"><h1>Nothing here.</h1><p class="lede"><a href="/">Back to the start →</a></p></div>` }));
fs.writeFileSync(path.join(OUT, '.nojekyll'), '');

// Images, the avatar (header, bylines, link previews) and the home page banner
fs.copyFileSync('avatar.jpg', path.join(OUT, 'avatar.jpg'));
fs.copyFileSync('header.jpg', path.join(OUT, 'header.jpg'));
if (Object.keys(assets).length) fs.mkdirSync(path.join(OUT, 'assets'), { recursive: true });
for (const [name, file] of Object.entries(assets)) fs.copyFileSync(file, path.join(OUT, 'assets', name));

// Sitemap and robots.txt, so search engines find every page
const pages = [...notes.map(n => [url(n.slug), n.fm.date]), ...(posts.length ? [['/archive/']] : [])];
fs.writeFileSync(path.join(OUT, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages.map(([u, d]) => `<url><loc>${SITE}${u}</loc>${/^\d{4}-\d{2}-\d{2}/.test(String(d ?? '')) ? `<lastmod>${String(d).slice(0, 10)}</lastmod>` : ''}</url>`).join('\n')}
</urlset>
`);
fs.writeFileSync(path.join(OUT, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${SITE}/sitemap.xml\n`);

// RSS feed of the posts (not the build log)
const x = s => esc(s).replace(/'/g, '&apos;');
fs.writeFileSync(path.join(OUT, 'feed.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel><title>${BRAND}</title><link>${SITE}/</link><description>${x(home.fm.lede)}</description>
${feed.map(p => `<item><title>${x(p.fm.title)}</title><link>${SITE}${url(p.slug)}</link><guid>${SITE}${url(p.slug)}</guid>
<pubDate>${new Date(p.fm.date).toUTCString()}</pubDate><description>${x(p.fm.summary || '')}</description></item>`).join('\n')}
</channel></rss>
`);

// Old addresses forward to their new ones: the preview site (linked from LinkedIn), Invader
// Kitchen (renamed Edulis on 2026-11-03), and the Roadmap and Now pages (removed 2026-11-08).
const REDIRECTS = {
  'site-preview': '/',
  'roadmap': '/projects/',
  'now': '/',
  'projects/invader-kitchen': '/projects/edulis/',
  'log/invader-kitchen/2026-11-01': '/log/edulis/2026-11-01/',
};
for (const [from, to] of Object.entries(REDIRECTS)) {
  fs.mkdirSync(path.join(OUT, from), { recursive: true });
  fs.writeFileSync(path.join(OUT, from, 'index.html'),
    `<!doctype html><meta charset="utf-8"><meta http-equiv="refresh" content="0; url=${to}"><link rel="canonical" href="${SITE}${to}"><title>${BRAND}</title><a href="${to}">${BRAND}</a>`);
}
console.log(`Built ${notes.length} notes and ${Object.keys(assets).length} images into ${OUT}/.`);
