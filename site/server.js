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
const { getTwitchStatus } = require('./twitch');
const { getShorts } = require('./shorts');
const { renderPage } = require('./render');

const PORT = Number(process.env.PORT) || 3000;
const CONTENT_URL = process.env.CONTENT_URL || '';
const REFRESH_MINUTES = Number(process.env.REFRESH_MINUTES) || 10;
const PUBLIC_DIR = path.join(__dirname, 'public');
const TWITCH_PARENT = (process.env.TWITCH_PARENT || '').split(',').map((h) => h.trim()).filter(Boolean);

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

const MIME = { '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.webp': 'image/webp' };

function requestHost(req) {
  const h = String(req.headers['x-forwarded-host'] || req.headers.host || 'localhost').split(',')[0].trim().replace(/:\d+$/, '').toLowerCase();
  return /^[a-z0-9.-]+$/.test(h) ? h : 'localhost';
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); return res.end(); }

  if (url.pathname === '/' || url.pathname === '/index.html') {
    const [twitch, shorts] = await Promise.all([
      getTwitchStatus(profile.twitch && profile.twitch.channel),
      getShorts(profile.shorts && profile.shorts.feedUrl),
    ]);
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=60' });
    return res.end(req.method === 'HEAD' ? undefined : renderPage(profile, { twitch, shorts, host: requestHost(req), parents: TWITCH_PARENT }));
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
