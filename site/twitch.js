'use strict';
// Works out what the Twitch player should show: the live stream, or the latest VOD when offline.
// Uses the official Helix API, which needs a free app from https://dev.twitch.tv/console/apps:
//   TWITCH_CLIENT_ID, TWITCH_CLIENT_SECRET
// Without them (or if Twitch is unreachable) it falls back to the channel player, which plays
// the stream when live and shows the channel's offline screen otherwise.
const CLIENT_ID = process.env.TWITCH_CLIENT_ID || '';
const CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET || '';
const CACHE_MS = 60 * 1000;

let token = null; // { value, expires }
const userIds = new Map();
const cache = new Map(); // login -> { at, status }

async function getToken() {
  if (token && token.expires > Date.now() + 60_000) return token.value;
  const body = new URLSearchParams({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET, grant_type: 'client_credentials' });
  const res = await fetch('https://id.twitch.tv/oauth2/token', { method: 'POST', body });
  if (!res.ok) throw new Error(`token HTTP ${res.status}`);
  const j = await res.json();
  token = { value: j.access_token, expires: Date.now() + j.expires_in * 1000 };
  return token.value;
}

async function helix(path) {
  const res = await fetch(`https://api.twitch.tv/helix/${path}`, {
    headers: { 'Client-Id': CLIENT_ID, Authorization: `Bearer ${await getToken()}` },
  });
  if (res.status === 401) token = null;
  if (!res.ok) throw new Error(`helix ${path.split('?')[0]} HTTP ${res.status}`);
  return (await res.json()).data || [];
}

async function lookup(login) {
  if (!userIds.has(login)) {
    const [u] = await helix(`users?login=${encodeURIComponent(login)}`);
    if (!u) throw new Error(`no Twitch user ${login}`);
    userIds.set(login, u.id);
  }
  const id = userIds.get(login);
  const [live] = await helix(`streams?user_id=${id}`);
  if (live) return { mode: 'live', title: live.title, game: live.game_name, viewers: live.viewer_count };
  const [vod] = await helix(`videos?user_id=${id}&type=archive&first=1`);
  if (vod) return { mode: 'vod', videoId: vod.id, title: vod.title, publishedAt: vod.published_at, url: vod.url };
  return { mode: 'channel' };
}

async function getTwitchStatus(login) {
  if (!login) return null;
  login = login.toLowerCase();
  if (!CLIENT_ID || !CLIENT_SECRET) return { mode: 'channel' };
  const hit = cache.get(login);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.status;
  let status;
  try {
    status = await lookup(login);
  } catch (err) {
    console.warn(`[twitch] ${err.message}; falling back to channel player`);
    status = hit ? hit.status : { mode: 'channel' };
  }
  cache.set(login, { at: Date.now(), status });
  return status;
}

module.exports = { getTwitchStatus };
