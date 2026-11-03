'use strict';
// Zero-dependency Node.js site rendered from content/profile.json. There is no database.
//
// Ways to update the site:
//  1. Rebuild/redeploy the Docker image after pushing to the repo (the content is baked in), or
//  2. Set CONTENT_URL to the raw GitHub URL of content/profile.json and the running
//     container picks up changes every REFRESH_MINUTES without a rebuild.
const http = require('http');
const fs = require('fs');
const path = require('path');
const { loadLocal, normalise } = require('../scripts/content');

const PORT = Number(process.env.PORT) || 3000;
const CONTENT_URL = process.env.CONTENT_URL || '';
const REFRESH_MINUTES = Number(process.env.REFRESH_MINUTES) || 10;
const PUBLIC_DIR = path.join(__dirname, 'public');

let profile = loadLocal();
let contentSource = 'bundled';

async function refreshRemote() {
  if (!CONTENT_URL) return;
  try {
    const res = await fetch(CONTENT_URL, { headers: { 'cache-control': 'no-cache' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    profile = normalise(await res.text());
    contentSource = 'remote';
  } catch (err) {
    console.warn(`[content] remote refresh failed, keeping current content: ${err.message}`);
  }
}

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const safeUrl = (u) => (/^https?:\/\//i.test(u || '') ? esc(u) : '');
const hexColour = (c) => (/^#[0-9a-f]{3,8}$/i.test(c || '') ? c : '#ff7a45');

function a(url, inner, cls = '') {
  const href = safeUrl(url);
  const c = cls ? ` class="${cls}"` : '';
  return href ? `<a${c} href="${href}" target="_blank" rel="noopener">${inner}</a>` : `<span${c}>${inner}</span>`;
}

function renderPage(p) {
  const socials = p.socials.map((s) =>
    a(s.url, `<span aria-hidden="true">${esc(s.emoji)}</span> ${esc(s.platform)}${s.handle ? ` <b>${esc(s.handle)}</b>` : ''}`, 'chip')
  ).join('');

  const highlights = p.highlights.map((h) => `
      <article class="highlight">
        <div class="emoji" aria-hidden="true">${esc(h.emoji)}</div>
        <h3>${esc(h.title)}</h3>
        <p>${esc(h.description)}</p>
        ${h.url ? a(h.url, `${esc(h.label || h.url)} →`, 'cta') : ''}
      </article>`).join('');

  const insta = p.socials.filter((s) => s.platform === 'Instagram');
  const instaSection = insta.length ? `
    <section id="instagram">
      <h2>📸 On Instagram</h2>
      <div class="grid">${insta.map((s) => `
        <article class="card">
          <h3>${a(s.url, '@' + esc(s.handle))}</h3>
          ${s.description ? `<p>${esc(s.description)}</p>` : ''}
        </article>`).join('')}
      </div>
    </section>` : '';

  const groups = p.projectGroups.map((g) => `
      <div class="group">
        <h3>${esc(g.emoji)} ${esc(g.title)}</h3>
        <div class="grid">${g.projects.map((pr) => `
          <article class="card${pr.featured ? ' featured' : ''}">
            <h4>${a(pr.url, esc(pr.name))}${pr.featured ? ' <span class="star" title="Featured">★</span>' : ''}</h4>
            <p>${esc(pr.description)}</p>
          </article>`).join('')}
        </div>
      </div>`).join('');

  return `<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(p.name)} · ${esc(p.handle)}</title>
<meta name="description" content="${esc(p.tagline)}">
<meta property="og:title" content="${esc(p.name)}">
<meta property="og:description" content="${esc(p.tagline)}">
<link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🥔</text></svg>">
<link rel="stylesheet" href="/styles.css">
<style>:root{--accent:${hexColour(p.site.accent)}}</style>
</head>
<body>
<header class="hero">
  <div class="wrap">
    <p class="kicker">@${esc(p.handle)}</p>
    <h1>Hi, I'm ${esc(p.name)} 👋</h1>
    <p class="tagline">${esc(p.tagline)}</p>
    <nav class="chips">${socials}</nav>
  </div>
</header>
<main class="wrap">
  <section class="about">${p.about.map((t) => `<p>${esc(t)}</p>`).join('')}</section>
  ${highlights ? `<section id="highlights"><h2>✨ What I do</h2><div class="highlights">${highlights}</div></section>` : ''}
  ${instaSection}
  ${groups ? `<section id="projects"><h2>🧰 Core repos</h2>${groups}</section>` : ''}
</main>
<footer class="wrap">
  <p>Built from <code>content/profile.json</code> in ${a(`https://github.com/${p.handle}/${p.handle}`, `${esc(p.handle)}/${esc(p.handle)}`)}. No database, just a repo.</p>
</footer>
</body>
</html>`;
}

const MIME = { '.css': 'text/css; charset=utf-8', '.js': 'text/javascript', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.webp': 'image/webp' };

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); return res.end(); }

  if (url.pathname === '/' || url.pathname === '/index.html') {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=60' });
    return res.end(req.method === 'HEAD' ? undefined : renderPage(profile));
  }
  if (url.pathname === '/profile.json') {
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'access-control-allow-origin': '*' });
    return res.end(JSON.stringify(profile, null, 2));
  }
  if (url.pathname === '/healthz') {
    res.writeHead(200, { 'content-type': 'application/json' });
    return res.end(JSON.stringify({ ok: true, content: contentSource }));
  }

  const file = path.normalize(path.join(PUBLIC_DIR, url.pathname));
  if (file.startsWith(PUBLIC_DIR + path.sep) && fs.existsSync(file) && fs.statSync(file).isFile()) {
    res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream', 'cache-control': 'public, max-age=3600' });
    return req.method === 'HEAD' ? res.end() : fs.createReadStream(file).pipe(res);
  }
  res.writeHead(404, { 'content-type': 'text/plain' });
  res.end('Not found');
});

if (require.main === module) {
  refreshRemote().finally(() => {
    if (CONTENT_URL) setInterval(refreshRemote, REFRESH_MINUTES * 60 * 1000).unref();
    server.listen(PORT, () => console.log(`Site listening on http://localhost:${PORT} (content: ${CONTENT_URL ? 'remote, refresh ' + REFRESH_MINUTES + 'm' : 'bundled'})`));
  });
  for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => server.close(() => process.exit(0)));
}

module.exports = { renderPage, server };
