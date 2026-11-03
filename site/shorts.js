'use strict';
// Latest Instagram reels. Instagram has no public feed API, so this reads the public video
// index at quiz.cezz.co.uk (written by the techshorts bot) and groups the videos by Instagram account.
// The feed URL comes from profile.json (shorts.feedUrl); SHORTS_FEED_URL overrides it.
const CACHE_MS = (Number(process.env.SHORTS_REFRESH_MINUTES) || 15) * 60 * 1000;

let cache = { url: '', at: 0, data: {} };

const decode = (s) => s.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'").replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
const pick = (html, re) => { const m = html.match(re); return m ? decode(m[1]) : ''; };

// Returns { [instagramHandle]: { title, videos: [{ date, title, theme, instagram, youtube, reelId }] } }
function parseShorts(html) {
  const out = {};
  const sections = html.split(/<section\b[^>]*class="[^"]*\bchannel\b[^"]*"[^>]*>/i).slice(1);
  for (const raw of sections) {
    const sec = raw.split(/<\/section>/i)[0];
    const handle = (sec.match(/instagram\.com\/([A-Za-z0-9._]+)\/?["']/i) || [])[1];
    if (!handle || handle === 'reel' || handle === 'p') continue;
    const videos = [];
    for (const li of sec.match(/<li\b[\s\S]*?<\/li>/gi) || []) {
      const ig = (li.match(/https:\/\/www\.instagram\.com\/reel\/([A-Za-z0-9_-]+)\/?/i) || []);
      const yt = (li.match(/https:\/\/(?:www\.)?youtube\.com\/shorts\/([A-Za-z0-9_-]+)/i) || []);
      if (!ig[0] && !yt[0]) continue;
      videos.push({
        date: pick(li, /class="date"[^>]*>([\s\S]*?)<\/span>/i),
        title: pick(li, /class="vt"[^>]*>([\s\S]*?)<\/span>/i),
        theme: pick(li, /class="small"[^>]*>([\s\S]*?)<\/span>/i).replace(/^·\s*/, ''),
        instagram: ig[0] || '',
        reelId: ig[1] || '',
        youtube: yt[0] || '',
      });
    }
    out[handle.toLowerCase()] = { title: pick(sec, /<h2[^>]*>([\s\S]*?)<\/h2>/i), videos };
  }
  return out;
}

async function getShorts(feedUrl) {
  const FEED_URL = process.env.SHORTS_FEED_URL || feedUrl;
  if (!FEED_URL) return {};
  if (cache.url === FEED_URL && Date.now() - cache.at < CACHE_MS) return cache.data;
  try {
    const res = await fetch(FEED_URL, { headers: { accept: 'text/html' }, signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    cache = { url: FEED_URL, at: Date.now(), data: parseShorts(await res.text()) };
  } catch (err) {
    console.warn(`[shorts] could not read ${FEED_URL}: ${err.message}`);
    cache = { ...cache, url: FEED_URL, at: Date.now() - CACHE_MS + 60_000 }; // retry in a minute, keep the last good data
  }
  return cache.data;
}

module.exports = { getShorts, parseShorts };
