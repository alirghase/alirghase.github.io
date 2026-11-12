// Builds the site from the notes in content/ (copied from the vault's site/ folder) into public/.
import fs from 'node:fs';
import path from 'node:path';
import { marked } from 'marked';
import YAML from 'yaml';

const SRC = 'content';
const OUT = 'public';
const BRAND = 'Ali';
const SITE = 'https://alirghase.github.io';
const CONTACT = [
  ['LinkedIn', 'https://www.linkedin.com/in/arghasemi/'],
  ['GitHub', 'https://github.com/alirghase'],
];

// ---------- reading notes ----------

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : e.name.endsWith('.md') ? [p] : [];
  });
}

function readNote(file) {
  const raw = fs.readFileSync(file, 'utf8');
  const m = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  const fm = m ? YAML.parse(m[1]) || {} : {};
  const body = m ? m[2] : raw;
  const rel = path.relative(SRC, file).replace(/\.md$/, '');
  const slug = rel === 'index' ? '' : rel.replace(/\/index$/, '');
  return { rel, slug, fm, body, base: path.basename(rel) === 'index' ? path.basename(slug) || 'index' : path.basename(rel) };
}

const notes = walk(SRC).map(readNote).filter(n => !n.fm.draft);
const bySlug = Object.fromEntries(notes.map(n => [n.slug, n]));
const url = slug => '/' + (slug ? slug + '/' : '');

function resolve(target) {
  const t = target.trim().replace(/\.md$/, '').replace(/\/index$/, '');
  if (t === 'index') return '';
  if (t in bySlug) return t;
  const hit = notes.find(n => n.base === path.basename(t));
  if (!hit) throw new Error(`Link to a missing note: [[${target}]]`);
  return hit.slug;
}

// [[target]], [[target|label]] and [[target\|label]] (inside tables) become normal links.
const wikilinks = md =>
  md.replace(/\[\[([^\]|#\\]+)(?:#[^\]|\\]*)?(?:\\?\|([^\]]+))?\]\]/g, (_, t, label) => `[${label || t}](${url(resolve(t))})`);
const md = s => marked.parse(wikilinks(s || ''));
const inline = s => marked.parseInline(wikilinks(String(s || '')));
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const minutes = body => Math.max(1, Math.round(body.split(/\s+/).filter(Boolean).length / 220));
const fmtDate = d => { const x = new Date(d); return isNaN(x) ? String(d ?? '') : x.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }); };

// ---------- data ----------

const home = bySlug[''];
const projects = notes.filter(n => n.rel.startsWith('projects/') && n.base !== 'projects')
  .sort((a, b) => (a.fm.order ?? 99) - (b.fm.order ?? 99));
const posts = notes.filter(n => n.rel.startsWith('writing/') && n.base !== 'writing')
  .sort((a, b) => String(b.fm.date).localeCompare(String(a.fm.date)));
// Build log: one note per work session, in log/<project>/, listed on the project's page.
const logs = notes.filter(n => n.rel.startsWith('log/'))
  .sort((a, b) => String(b.fm.date).localeCompare(String(a.fm.date)));
// Learning notes: concepts, labs, system design and coding problems, in notes/<kind>/, grouped on /notes/.
const KINDS = [['concept', 'Concepts'], ['lab', 'Labs'], ['system-design', 'System design'], ['coding', 'Coding']];
const kindName = k => (KINDS.find(([id]) => id === k) || [, 'Notes'])[1];
const learn = notes.filter(n => n.rel.startsWith('notes/') && n.base !== 'notes')
  .sort((a, b) => String(b.fm.date).localeCompare(String(a.fm.date)));
// Public repos: a link and one line each, from `repos:` in projects/index.md.
const repos = bySlug['projects']?.fm.repos || [];

// ---------- pieces ----------

const pill = st => `<span class="pill ${/^(now|live|shipped)$/i.test(st) ? 'now' : ''}">${esc(st)}</span>`;
const contact = () => `<div class="contact">${CONTACT.map(([t, u]) => `<a href="${u}">${t}</a>`).join('')}</div>`;

const projectRow = p => `<a class="row" href="${url(p.slug)}">
  <h3>${esc(p.fm.title)}</h3><span class="meta">${pill(p.fm.status || 'Planned')}${p.fm.launch ? `<span>Launch ${esc(p.fm.launch)}</span>` : ''}</span>
  <p><span class="sub">${esc(p.fm.name)}</span> · ${esc(p.fm.what)}</p></a>`;

// A project's skills box: the core skills it builds, from `skills:` in its properties.
const skillsBox = fm => fm.skills?.length ? `<section class="skills" id="skills"><h2>${esc(fm.skills_title || "Skills I'm building")}</h2>
  ${fm.skills_intro ? `<p class="small">${inline(fm.skills_intro)}</p>` : ''}
  <ul>${fm.skills.map(k => `<li><div class="skill-head"><h3>${esc(k.skill)}</h3>${k.level ? `<span class="pill ${/main/i.test(k.level) ? 'finding-tag' : ''}">${esc(k.level)}</span>` : ''}</div>
  ${k.learn ? `<p>${inline(k.learn)}</p>` : ''}</li>`).join('')}</ul></section>` : '';

const repoRow = r => `<a class="row" href="${esc(r.url)}">
  <h3>${esc(r.name)}</h3><span class="meta"><span>GitHub ↗</span></span>
  <p>${esc(r.what)}</p></a>`;

const postRow = p => `<a class="row" href="${url(p.slug)}">
  <h3>${esc(p.fm.title)}</h3><span class="meta"><span>${esc(fmtDate(p.fm.date))}</span><span>${minutes(p.body)} min read</span></span>
  ${p.fm.summary ? `<p>${esc(p.fm.summary)}</p>` : ''}</a>`;

const finding = p => !p.fm.number ? '' : p.fm.result
  ? `<div class="finding"><div class="num">${esc(p.fm.result)}<small>${esc(p.fm.result_label || 'Measured')}</small></div>
      <div><h3>The number</h3><p>${inline(p.fm.number)}</p></div></div>`
  : `<div class="finding"><div class="num">[N]<small>Not measured yet</small></div>
      <div><h3>The number it will publish</h3><p>${inline(p.fm.number)}</p></div></div>`;

// ---------- pages ----------

function homePage() {
  return `<div class="col">
    <div class="eyebrow">${esc(home.fm.eyebrow)}</div>
    <h1>${esc(home.fm.headline)}</h1>
    <p class="lede">${esc(home.fm.lede)}</p>
    ${contact()}
    ${home.body.trim() ? `<div class="prose">${md(home.body)}</div>` : ''}
    ${projects.length || repos.length ? `<section><div class="sec-head"><h2>Projects</h2><a href="/projects/">All projects →</a></div>
      ${projects.map(projectRow).join('')}${repos.map(repoRow).join('')}</section>` : ''}
    ${posts.length ? `<section><div class="sec-head"><h2>Writing</h2><a href="/writing/">All writing →</a></div>
      ${posts.slice(0, 5).map(postRow).join('')}</section>` : ''}
    ${learn.length ? `<section><div class="sec-head"><h2>Notes</h2><a href="/notes/">All notes →</a></div>
      ${learn.slice(0, 5).map(postRow).join('')}</section>` : ''}
  </div>`;
}

function projectsPage(note) {
  return `<div class="col">
    <div class="eyebrow">Projects</div>
    <h1>${esc(note.fm.headline || note.fm.title)}</h1>
    <div class="prose lede">${md(note.body)}</div>
    ${projects.length ? `<section><div class="sec-head"><h2>Building now</h2></div>
      ${projects.map(projectRow).join('')}</section>` : ''}
    ${repos.length ? `<section><div class="sec-head"><h2>On GitHub</h2></div>
      ${repos.map(repoRow).join('')}</section>` : ''}
  </div>`;
}

function projectPage(p) {
  const fm = p.fm;
  const write = posts.filter(x => x.fm.project && resolve(String(x.fm.project)) === p.slug);
  const log = logs.filter(x => x.fm.project && resolve(String(x.fm.project)) === p.slug);
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

function logPage(p) {
  const proj = p.fm.project ? bySlug[resolve(String(p.fm.project))] : null;
  return `<article class="col post">
    <a class="back" href="${proj ? url(proj.slug) : '/projects/'}">← ${esc(proj ? proj.fm.name : 'Projects')}</a>
    <div class="eyebrow" style="margin-top:22px">Build log · ${proj ? esc(proj.fm.name) + ' · ' : ''}${esc(fmtDate(p.fm.date))}</div>
    <h1>${esc(p.fm.title)}</h1>
    ${p.fm.summary ? `<p class="lede">${esc(p.fm.summary)}</p>` : ''}
    <div class="prose">${md(p.body)}</div>
  </article>`;
}

function writingPage(note) {
  return `<div class="col">
    <div class="eyebrow">Writing</div>
    <h1>${esc(note.fm.headline || note.fm.title)}</h1>
    <div class="prose lede">${md(posts.length ? note.body.split('\n\n')[0] : note.body)}</div>
    <p class="small"><a class="from" href="/feed.xml">RSS feed</a></p>
    ${posts.length ? `<section>${posts.map(postRow).join('')}</section>` : ''}
  </div>`;
}

function postPage(p) {
  const proj = p.fm.project ? bySlug[resolve(String(p.fm.project))] : null;
  return `<article class="col post">
    <a class="back" href="${proj ? url(proj.slug) : '/writing/'}">← ${esc(proj ? proj.fm.name : 'Writing')}</a>
    <div class="eyebrow" style="margin-top:22px">${proj ? esc(proj.fm.name) + ' · ' : ''}${esc(fmtDate(p.fm.date))} · ${minutes(p.body)} min read</div>
    <h1>${esc(p.fm.title)}</h1>
    ${p.fm.summary ? `<p class="lede">${esc(p.fm.summary)}</p>` : ''}
    <div class="prose">${md(p.body)}</div>
    <div class="pager"><a href="/writing/">← All writing</a><a href="/feed.xml">RSS</a></div>
  </article>`;
}

function notesPage(note) {
  const groups = KINDS.map(([id, name]) => [name, learn.filter(n => n.fm.kind === id)]).filter(([, list]) => list.length);
  return `<div class="col">
    <div class="eyebrow">Notes</div>
    <h1>${esc(note.fm.headline || note.fm.title)}</h1>
    <div class="prose lede">${md(note.body)}</div>
    ${groups.map(([name, list]) => `<section><div class="sec-head"><h2>${esc(name)}</h2></div>${list.map(postRow).join('')}</section>`).join('')}
  </div>`;
}

function notePage(p) {
  return `<article class="col post">
    <a class="back" href="/notes/">← Notes</a>
    <div class="eyebrow" style="margin-top:22px">${esc(kindName(p.fm.kind))} · ${esc(fmtDate(p.fm.date))} · ${minutes(p.body)} min read</div>
    <h1>${esc(p.fm.title)}</h1>
    ${p.fm.summary ? `<p class="lede">${esc(p.fm.summary)}</p>` : ''}
    <div class="prose">${md(p.body)}</div>
    <div class="pager"><a href="/notes/">← All notes</a></div>
  </article>`;
}

function plainPage(note) {
  return `<div class="col about">
    <div class="eyebrow">${esc(note.fm.title)}</div>
    <h1>${esc(note.fm.headline || note.fm.title)}</h1>
    <div class="prose">${md(note.body)}</div>
    ${note.slug === 'about' ? contact() : ''}
  </div>`;
}

// ---------- layout ----------

const CSS = fs.readFileSync('style.css', 'utf8');
// Writing and Notes stay out of the menu until something in them is published.
const NAV = [['Writing', '/writing/', posts.length], ['Notes', '/notes/', learn.length], ['Projects', '/projects/', 1], ['About', '/about/', 1]]
  .filter(([, , n]) => n);

function layout(title, active, main, description) {
  return `<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title === BRAND ? BRAND : `${title} · ${BRAND}`)}</title>
<meta name="description" content="${esc(description || home.fm.lede)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description || home.fm.lede)}">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ctext y='.9em' font-size='90'%3E%E2%97%90%3C/text%3E%3C/svg%3E">
<link rel="alternate" type="application/rss+xml" title="${BRAND}" href="/feed.xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600&family=Lora:ital,wght@0,400;0,500;1,400&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<script>try{const t=localStorage.getItem('theme');if(t)document.documentElement.dataset.theme=t}catch(e){}</script>
<style>${CSS}</style>
</head>
<body>
<header><div class="wrap">
  <a class="brand" href="/">${BRAND}</a>
  <nav>${NAV.map(([t, u]) => `<a href="${u}"${active === u ? ' class="active"' : ''}>${t}</a>`).join('')}
    <button class="theme" id="theme" aria-label="Toggle dark mode">◐</button></nav>
</div></header>
<main><div class="wrap">${main}</div></main>
<footer><div class="wrap"><span>© ${new Date().getFullYear()} ${BRAND} · Public data only.</span><span>Written in Obsidian.</span></div></footer>
<script>
document.getElementById('theme').onclick = () => {
  const r = document.documentElement;
  const dark = r.dataset.theme ? r.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
  r.dataset.theme = dark ? 'light' : 'dark';
  try { localStorage.setItem('theme', r.dataset.theme); } catch (e) {}
};
</script>
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
  let page, active = '';
  if (n.slug === '') page = homePage();
  else if (n.slug === 'projects') { page = projectsPage(n); active = '/projects/'; }
  else if (n.rel.startsWith('projects/')) { page = projectPage(n); active = '/projects/'; }
  else if (n.slug === 'writing') { page = writingPage(n); active = '/writing/'; }
  else if (n.rel.startsWith('writing/')) { page = postPage(n); active = '/writing/'; }
  else if (n.rel.startsWith('log/')) { page = logPage(n); active = '/projects/'; }
  else if (n.slug === 'notes') { page = notesPage(n); active = '/notes/'; }
  else if (n.rel.startsWith('notes/')) { page = notePage(n); active = '/notes/'; }
  else { page = plainPage(n); active = `/${n.slug}/`; }
  const title = n.slug === '' ? BRAND : n.fm.name || n.fm.title;
  emit(n.slug, layout(title, active, page, n.fm.summary || n.fm.what || n.fm.lede));
}
fs.writeFileSync(path.join(OUT, '404.html'),
  layout('Not found', '', `<div class="col"><div class="eyebrow">404</div><h1>Nothing here.</h1><p class="lede"><a href="/">Back to the start →</a></p></div>`));
fs.writeFileSync(path.join(OUT, '.nojekyll'), '');

// RSS feed of the posts
const x = s => esc(s).replace(/'/g, '&apos;');
fs.writeFileSync(path.join(OUT, 'feed.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel><title>${BRAND}</title><link>${SITE}/</link><description>${x(home.fm.lede)}</description>
${posts.map(p => `<item><title>${x(p.fm.title)}</title><link>${SITE}${url(p.slug)}</link><guid>${SITE}${url(p.slug)}</guid>
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
console.log(`Built ${notes.length} notes into ${OUT}/.`);
