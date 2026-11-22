'use strict';
// Renders the site from profile.json plus live data (Twitch status, latest reels).
// Concept: a TV channel guide. Each section is a "channel" styled after the real thing.

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const safeUrl = (u) => (/^https?:\/\//i.test(u || '') ? esc(u) : '');
const bare = (u) => String(u || '').replace(/^https?:\/\//, '').replace(/\/$/, '');

function a(url, inner, cls = '') {
  const href = safeUrl(url);
  const c = cls ? ` class="${cls}"` : '';
  return href ? `<a${c} href="${href}" target="_blank" rel="noopener">${inner}</a>` : `<span${c}>${inner}</span>`;
}

const fmtDate = (iso) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

// Static-wipe overlay played when a channel scrolls into view.
const tuner = '<div class="tuner" aria-hidden="true"><i></i></div>';

// ---------- shared bits ----------

// Versioned URL for a file in site/public (see ASSET_VERSIONS in server.js).
let assetVersions = {};
const asset = (file) => `/${file}${assetVersions[file] ? `?v=${assetVersions[file]}` : ''}`;

const icon = {
  follow: '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
  open: '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>',
  code: '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m8 7-5 5 5 5M16 7l5 5-5 5"/></svg>',
  watch: '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>',
  share: '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 13v6a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-6M12 3v12M7 8l5-5 5 5"/></svg>',
  next: '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>',
  top: '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 15 6-6 6 6"/></svg>',
};

// TikTok-style action rail. Each action: { kind, label, url?, popover? }.
function rail(id, title, actions) {
  const btn = (x) => {
    const inner = `<span class="rail-ico">${icon[x.kind] || icon.open}</span><span class="rail-label">${esc(x.label)}</span>`;
    if (x.kind === 'watch') return `<button type="button" class="rail-btn rail-watch" popovertarget="${esc(x.popover)}">${inner}</button>`;
    if (x.kind === 'share') return `<button type="button" class="rail-btn" data-share="#${esc(id)}" data-title="${esc(title)}">${inner}</button>`;
    if (x.kind === 'next') return `<button type="button" class="rail-btn rail-next" data-next>${inner}</button>`;
    if (x.kind === 'top') return `<a class="rail-btn" href="#top">${inner}</a>`;
    return safeUrl(x.url) ? `<a class="rail-btn" href="${safeUrl(x.url)}" target="_blank" rel="noopener">${inner}</a>` : '';
  };
  return `<aside class="rail" aria-label="${esc(title)} actions">${actions.filter(Boolean).map(btn).join('')}</aside>`;
}

const share = { kind: 'share', label: 'Share' };
const next = { kind: 'next', label: 'Next' };

// The latest reel in a phone frame. On wide screens it sits inline; on narrow screens the same
// element is a popover sheet opened from the rail's Watch button, so the embed loads only on demand.
function reelPhone(video, handle, popId) {
  if (!video || !video.reelId) return '';
  return `
    <figure class="phone" id="${esc(popId)}" popover>
      <button type="button" class="pop-close" popovertarget="${esc(popId)}" popovertargetaction="hide">Close</button>
      <div class="phone-screen">
        <iframe src="https://www.instagram.com/reel/${encodeURIComponent(video.reelId)}/embed/" title="${esc(video.title || 'Latest reel')} on @${esc(handle)}" loading="lazy" scrolling="no" allowtransparency="true"></iframe>
      </div>
      <figcaption>${a(video.instagram, 'Watch on Instagram')}${video.youtube ? ` or ${a(video.youtube, 'YouTube')}` : ''}</figcaption>
    </figure>`;
}

function igRail(s, id, title, latest) {
  return rail(id, title, [
    { kind: 'follow', label: 'Follow', url: s.url },
    latest && latest.reelId ? { kind: 'watch', label: 'Watch', popover: `pop-${id}` } : null,
    share, next,
  ]);
}

// ---------- hero: TV + listings ----------

function guideRows(p, ctx) {
  const rows = [];
  const tw = p.highlights.find((h) => h.theme === 'twitch');
  if (tw) {
    const st = ctx.twitch || { mode: 'channel' };
    rows.push({
      id: 'twitch', sig: 'magenta', name: 'Potato_Cezzbb',
      when: st.mode === 'live' ? '<b class="onair-txt">Live now</b>' : st.mode === 'vod' && st.publishedAt ? esc(fmtDate(st.publishedAt)) : 'Twitch',
      what: st.mode === 'live' ? esc(st.title) : st.mode === 'vod' ? `Last stream: ${esc(st.title)}` : 'Games, chat and homemade stream tools',
    });
  }
  const ras = p.highlights.find((h) => h.theme === 'santa');
  if (ras) {
    rows.push({ id: 'santa', sig: 'red', name: 'Random Acts of Santa', when: '<span data-season-short>Every Christmas</span>', what: 'Anonymous gifts for your team, server or friends' });
  }
  for (const s of p.socials.filter((x) => x.platform === 'Instagram')) {
    const latest = ((ctx.shorts || {})[String(s.handle).toLowerCase()] || {}).videos?.[0];
    const sig = { quiz: 'yellow', dungeon: 'green', speedway: 'cyan', colony: 'blue' }[s.theme] || 'blue';
    rows.push({ id: s.theme || s.handle, sig, name: s.name || '@' + s.handle, when: latest ? esc(latest.date) : 'Soon', what: latest ? esc(latest.title) : 'First episode on its way' });
  }
  rows.push({ id: 'credits', sig: 'white', name: 'The workshop', when: 'Always on', what: `${p.projectGroups.reduce((n, g) => n + g.projects.length, 0)} repos on GitHub` });
  return rows;
}

function hero(p, ctx) {
  const name = esc(p.name);
  return `
  <header class="hero reel" id="top" data-world data-reel="What's on" data-tint="#e4e7ec">
    <div class="wrap hero-grid">
      <div class="tv" aria-label="${name}">
        <div class="tv-screen">
          <canvas class="snow" aria-hidden="true"></canvas>
          <div class="titlecard">
            <p class="handle">@${esc(p.handle)}</p>
            <h1 class="name" data-text="${name}">${name}</h1>
            <p class="tagline">${esc(p.tagline)}</p>
          </div>
          <div class="bars" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div>
        </div>
        <div class="tv-chin" aria-hidden="true"><span class="knob"></span><span class="knob"></span><span class="led"></span></div>
      </div>
      <nav class="guide" aria-label="What's on">
        <div class="guide-head">
          <h2>What's on</h2>
          <time class="clock" data-clock></time>
        </div>
        <ol class="guide-rows">
          ${guideRows(p, ctx).map((r) => `
          <li><a href="#${esc(r.id)}" class="sig-${r.sig}">
            <span class="g-when">${r.when}</span>
            <span class="g-name">${esc(r.name)}</span>
            <span class="g-what">${r.what}</span>
          </a></li>`).join('')}
        </ol>
        <p class="guide-socials">${p.socials.filter((s) => s.platform !== 'Instagram').map((s) => a(s.url, `${esc(s.platform)}: ${esc(s.handle)}`)).join('')}</p>
      </nav>
    </div>
    <button type="button" class="swipe-cue" data-next><span>Swipe for the next channel</span>${icon.next}</button>
  </header>`;
}

// ---------- Random Acts of Santa ----------

function santa(h, p) {
  if (!h) return '';
  const ras = p.projectGroups.flatMap((g) => g.projects).find((x) => /rast3/i.test(x.name));
  const season = h.season || {};
  return `
  <section class="world reel w-santa" id="santa" data-world data-reel="Random Acts of Santa" data-tint="#18264d" data-opens="${esc(season.opens || '')}" data-closes="${esc(season.closes || '')}">
    ${tuner}
    <div class="baubles" aria-hidden="true">
      ${[['red', 8, 120], ['gold', 22, 60], ['sky', 74, 90], ['red', 88, 150], ['gold', 60, 40], ['stamp', 34, 70], ['tag', 48, 110]]
        .map(([k, x, len], i) => `<span class="hang hang-${k}" style="--x:${x}%;--len:${len}px;--d:${(i * 0.37).toFixed(2)}s"></span>`).join('')}
    </div>
    <div class="wrap santa-grid">
      <div class="santa-copy">
        <div class="santa-title">
          <span class="stamp-big" aria-hidden="true"><span class="bauble"></span><b data-year></b></span>
          <h2>Random Acts <small>of</small> Santa</h2>
        </div>
        <p class="santa-lede">${esc(h.description)}</p>
        <p class="santa-actions">
          ${a(h.url, `Visit ${esc(h.label || bare(h.url))}`, 'btn-red')}
          ${ras ? a(ras.url, 'See the code', 'btn-ghost') : ''}
        </p>
      </div>
      <div class="postcard" role="group" aria-label="How a Random Act of Santa is posted">
        <div class="pc-head"><h3>Christmas post</h3><span class="pc-stamp" aria-hidden="true"><span class="bauble"></span></span></div>
        <dl>
          <div><dt>To</dt><dd>Someone two floors up</dd></div>
          <div class="pc-extra"><dt>From</dt><dd>Santa</dd></div>
          <div><dt>Deliver to</dt><dd>Address withheld<small>Sent through their Amazon wishlist</small></dd></div>
          <div class="pc-extra"><dt>Contents</dt><dd>One random act of kindness</dd></div>
          <div><dt>Posting</dt><dd data-season>Opens 15 November<small>Runs until 6 January</small></dd></div>
        </dl>
        <div class="postmark" aria-hidden="true"><span>Random Acts</span><b>Sent</b><span>raosanta.uk</span></div>
      </div>
    </div>
    ${rail('santa', 'Random Acts of Santa', [{ kind: 'open', label: 'Visit', url: h.url }, ras ? { kind: 'code', label: 'Code', url: ras.url } : null, share, next])}
  </section>`;
}

// ---------- Twitch ----------

function twitch(h, p, ctx, parents) {
  const login = p.twitch && p.twitch.channel;
  if (!login) return '';
  const st = ctx.twitch || { mode: 'channel' };
  const parentQs = parents.map((x) => `&parent=${encodeURIComponent(x)}`).join('');
  const src = st.mode === 'vod'
    ? `https://player.twitch.tv/?video=v${encodeURIComponent(st.videoId)}${parentQs}&autoplay=false`
    : `https://player.twitch.tv/?channel=${encodeURIComponent(login)}${parentQs}&autoplay=${st.mode === 'live'}&muted=true`;
  const live = st.mode === 'live';
  const status = live
    ? `Live now: <b>${esc(st.title)}</b>${st.game ? `, playing ${esc(st.game)}` : ''}.`
    : st.mode === 'vod'
      ? `Offline right now. Here's the last stream, <b>${esc(st.title)}</b>${st.publishedAt ? `, from ${esc(fmtDate(st.publishedAt))}` : ''}.`
      : esc(h ? h.description : '');
  return `
  <section class="world reel w-twitch${live ? ' is-live' : ''}" id="twitch" data-world data-reel="${esc(p.twitch.display || login)}" data-tint="#22124a">
    ${tuner}
    <div class="wrap twitch-grid">
      <div class="twitch-copy">
        <p class="onair${live ? ' lit' : ''}"><span>On air</span></p>
        <h2>${esc(p.twitch.display || login)}</h2>
        <p class="twitch-status">${status}</p>
        ${h && st.mode !== 'channel' ? `<p class="twitch-desc">${esc(h.description)}</p>` : ''}
        <p>${a(`https://www.twitch.tv/${encodeURIComponent(login)}`, live ? 'Join the stream on Twitch' : 'Follow on Twitch', 'btn-twitch')}</p>
      </div>
      <div class="crt">
        <div class="crt-glass"><iframe src="${src}" title="Twitch player for ${esc(login)}" allowfullscreen loading="lazy"></iframe></div>
        <div class="crt-base" aria-hidden="true"></div>
        <span class="spud" aria-hidden="true"></span>
      </div>
    </div>
    ${rail('twitch', p.twitch.display || login, [{ kind: 'follow', label: live ? 'Join' : 'Follow', url: `https://www.twitch.tv/${encodeURIComponent(login)}` }, share, next])}
  </section>`;
}

// ---------- Instagram channels ----------

function quiz(s, feed) {
  const vids = feed.videos || [];
  const latest = vids[0];
  let n = 0;
  const tiles = 'MEDIA QUIZ'.split(' ').map((w) => `<span class="word">${w.split('').map((c) => `<span class="tile" style="--i:${n++}">${c}</span>`).join('')}</span>`).join('');
  const count = String(vids.length).padStart(2, '0');
  return `
  <section class="world reel w-quiz" id="quiz" data-world data-reel="${esc(s.name || 'Daily quiz')}" data-tint="#1e44c8">
    ${tuner}
    <div class="sunburst" aria-hidden="true"></div>
    <div class="wrap quiz-grid">
      <div class="marquee">
        <div class="board">
          <p class="handle-tag">@${esc(s.handle)}</p>
          <h2 class="tiles" aria-label="${esc(s.name || 'Daily quiz')}">${tiles}</h2>
          <p class="quiz-desc">${esc(s.description)}</p>
          ${latest ? `
          <div class="cue">
            <p class="round">Today's round</p>
            <p class="cue-q">${esc(latest.title)}</p>
            ${latest.theme ? `<p class="cue-theme">Theme: ${esc(latest.theme)}</p>` : ''}
          </div>` : ''}
          <div class="flip-row">
            <div class="flip" aria-label="${vids.length} quizzes so far">${count.split('').map((d) => `<span>${d}</span>`).join('')}</div>
            <p>quizzes so far, a new one every day</p>
          </div>
          ${vids.length > 1 ? `<ul class="podium">${vids.slice(1, 3).map((v) => `<li>${a(v.instagram || v.youtube, esc(v.title))}<span>${esc(v.date)}</span></li>`).join('')}</ul>` : ''}
        </div>
      </div>
      ${reelPhone(latest, s.handle, 'pop-quiz')}
    </div>
    <div class="confetti" aria-hidden="true">${Array.from({ length: 24 }, (_, i) => `<i style="--i:${i}"></i>`).join('')}</div>
    ${igRail(s, 'quiz', s.name || 'Daily quiz', latest)}
  </section>`;
}

function dungeon(s, feed) {
  const vids = feed.videos || [];
  const latest = vids[0];
  return `
  <section class="world reel w-dungeon" id="dungeon" data-world data-torch data-reel="${esc(s.name || 'Dungeon crawl')}" data-tint="#1a1611">
    ${tuner}
    <div class="wrap dungeon-grid">
      <div class="scroll">
        <h2>${esc(s.name || 'Dungeon crawl')}</h2>
        <p class="dungeon-desc">${esc(s.description)}</p>
        ${vids.length ? `
        <h3>Quest log</h3>
        <ol class="quest" reversed>
          ${vids.slice(0, 5).map((v, i) => `<li class="${i === 0 ? 'current' : ''}">${a(v.instagram, esc(v.title))}<span>${esc(v.date)}</span></li>`).join('')}
        </ol>` : '<p>The first chapter is being written.</p>'}
        <p class="dungeon-cta">Comment on the latest episode to vote, or comment <em>join</em> to be written in.</p>
      </div>
      ${reelPhone(latest, s.handle, 'pop-dungeon')}
    </div>
    ${igRail(s, 'dungeon', s.name || 'Dungeon crawl', latest)}
  </section>`;
}

function speedway(s, feed) {
  const vids = feed.videos || [];
  const latest = vids[0];
  return `
  <section class="world reel w-speedway" id="speedway" data-world data-reel="${esc(s.name || 'Sixel Speedway')}" data-tint="#1f2327">
    ${tuner}
    <div class="kerb" aria-hidden="true"></div>
    <div class="wrap speed-grid">
      <div>
        <div class="gantry" aria-hidden="true">${Array.from({ length: 5 }, (_, i) => `<span style="--i:${i}"><i></i><i></i></span>`).join('')}</div>
        <h2>${esc(s.name || 'Sixel Speedway')}</h2>
        <p class="speed-desc">${esc(s.description)}</p>
        ${vids.length ? `
        <table class="tower">
          <caption>Race results</caption>
          <thead><tr><th scope="col">Race</th><th scope="col">Date</th><th scope="col"><span class="sr">Watch</span></th></tr></thead>
          <tbody>
          ${vids.slice(0, 6).map((v, i) => `<tr style="--i:${i}"><th scope="row"><span class="sector s${i % 3}"></span>${esc(v.title)}</th><td>${esc(v.date)}</td><td>${a(v.instagram, 'Replay')}</td></tr>`).join('')}
          </tbody>
        </table>` : ''}
      </div>
      ${reelPhone(latest, s.handle, 'pop-speedway')}
    </div>
    ${igRail(s, 'speedway', s.name || 'Sixel Speedway', latest)}
  </section>`;
}

function colony(s, feed) {
  const vids = feed.videos || [];
  const latest = vids[0];
  const stars = [[6, 8], [14, 22], [23, 5], [31, 30], [44, 12], [52, 3], [63, 26], [71, 9], [82, 18], [90, 6], [96, 28], [38, 40], [77, 38], [3, 36]];
  return `
  <section class="world reel w-colony" id="colony" data-world data-reel="${esc(s.name || 'Farside colony')}" data-tint="#1d1a4a">
    ${tuner}
    <div class="px-stars" aria-hidden="true">${stars.map(([x, y], i) => `<i style="--x:${x}%;--y:${y}%;--i:${i}"></i>`).join('')}</div>
    <div class="wrap colony-grid">
      <div class="hud">
        <h2><span class="hud-title">${esc((s.name || 'Farside colony').split(' ')[0])}</span><span class="hud-sub">${esc((s.name || 'Farside colony').split(' ').slice(1).join(' ') || 'colony')}</span></h2>
        <p class="hud-desc">${esc(s.description)}</p>
        <div class="hud-bar">
          <p>${latest ? `Latest: ${a(latest.instagram, esc(latest.title))}` : 'Next: first transmission'}</p>
          <div class="bar${latest ? ' full' : ''}" role="img" aria-label="${latest ? 'Transmission received' : 'First transmission on its way'}"><i></i></div>
        </div>
        ${latest && latest.reelId ? `<p class="px-watch"><button type="button" class="px-btn" popovertarget="pop-colony">Watch the latest</button></p>` : ''}
      </div>
      <figure class="px-scene">
        <img src="${asset('farside.png')}" width="90" height="90" alt="Pixel art of the Farside colony: a lander module and a glass habitat dome on a purple moon, under a huge ringed planet at dusk, with a storage bunker underground.">
      </figure>
    </div>
    ${latest ? reelPhone(latest, s.handle, 'pop-colony') : ''}
    <div class="px-land" aria-hidden="true"><div class="px-hills"></div><div class="px-ground"></div></div>
    ${rail('colony', s.name || 'Farside colony', [{ kind: 'follow', label: 'Follow', url: s.url }, share, next])}
  </section>`;
}

function genericChannel(s, feed) {
  const latest = (feed.videos || [])[0];
  return `
  <section class="world reel w-generic" id="${esc(s.handle)}" data-world data-reel="@${esc(s.handle)}" data-tint="#161b2e">
    ${tuner}
    <div class="wrap colony-grid">
      <div><h2>@${esc(s.handle)}</h2><p>${esc(s.description)}</p></div>
      ${reelPhone(latest, s.handle, `pop-${s.handle.replace(/[^a-z0-9_-]/gi, '-')}`)}
    </div>
    ${igRail(s, s.handle, '@' + s.handle, latest)}
  </section>`;
}

function shorts(h, p, ctx) {
  const channels = p.socials.filter((s) => s.platform === 'Instagram');
  if (!channels.length) return '';
  const intro = h ? `
  <section class="interlude reel" id="shorts" data-world data-reel="${esc(h.title)}" data-tint="#e4e7ec">
    <div class="wrap">
      <ul class="channel-stack" aria-hidden="true">${channels.map((c) => `<li class="cs-${esc(c.theme || 'generic')}">${esc(c.name || '@' + c.handle)}</li>`).join('')}</ul>
      <h2>${esc(h.title)}</h2>
      <p>${esc(h.description)}</p>
      <p>${a(h.url, `Every video is listed at ${esc(h.label || bare(h.url))}`)}</p>
    </div>
    ${rail('shorts', h.title, [{ kind: 'open', label: 'All videos', url: h.url }, share, next])}
  </section>` : '';
  const byTheme = { quiz, dungeon, speedway, colony };
  return intro + channels.map((s) => {
    const feed = (ctx.shorts || {})[String(s.handle).toLowerCase()] || { videos: [] };
    return (byTheme[s.theme] || genericChannel)(s, feed);
  }).join('');
}

// ---------- credits ----------

function credits(p) {
  const total = p.projectGroups.reduce((n, g) => n + g.projects.length, 0);
  return `
  <section class="credits reel" id="credits" data-world data-reel="The workshop" data-tint="#161b2e">
    <div class="wrap credits-head">
      <h2>Made in the workshop</h2>
      <p class="credits-lede">${total} repos behind everything above, plus the rest of the bots. Swipe sideways through them.</p>
    </div>
    <div class="repo-track" tabindex="0" role="list" aria-label="Repos">
      ${p.projectGroups.flatMap((g) => g.projects.map((pr) => ({ g, pr }))).map(({ g, pr }, i) => `
      <article class="repo${pr.featured ? ' star' : ''}" role="listitem" style="--i:${i}">
        <p class="repo-group">${esc(g.title)}</p>
        <h3>${a(pr.url, esc(pr.name))}</h3>
        <p class="repo-desc">${esc(pr.description)}</p>
        ${pr.site ? `<p class="repo-site">${a(pr.site, esc(bare(pr.site)))}</p>` : ''}
      </article>`).join('')}
    </div>
    <footer class="foot">
      <div class="wrap">
        <p>This site and my GitHub profile are both built from one file, <code>content/profile.json</code>, in ${a(`https://github.com/${p.handle}/${p.handle}`, `${esc(p.handle)}/${esc(p.handle)}`)}.</p>
        <p class="foot-socials">${p.socials.map((s) => a(s.url, esc(s.platform === 'Instagram' ? '@' + s.handle : `${s.platform}: ${s.handle}`))).join('')}</p>
      </div>
    </footer>
    ${rail('credits', 'The workshop', [{ kind: 'code', label: 'GitHub', url: `https://github.com/${p.handle}` }, share, { kind: 'top', label: 'Top' }])}
  </section>`;
}

// ---------- page ----------

function renderPage(p, ctx = {}) {
  assetVersions = ctx.assets || {};
  const H = (t) => p.highlights.find((h) => h.theme === t);
  const parents = ctx.parents && ctx.parents.length ? ctx.parents : [ctx.host || 'localhost'];
  const fonts = 'https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,400..800&family=Bricolage+Grotesque:opsz,wdth,wght@12..96,75..100,300..800&family=Bungee&family=IM+Fell+English:ital@0;1&family=JetBrains+Mono:wght@400;700&family=Pixelify+Sans:wght@400..700&family=Silkscreen:wght@400;700&display=swap';
  return `<!doctype html>
<html lang="en-GB" class="no-js">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(p.name)}: what's on</title>
<meta name="description" content="${esc(p.tagline)}">
<meta property="og:title" content="${esc(p.name)}">
<meta property="og:description" content="${esc(p.tagline)}">
<meta name="theme-color" content="#e4e7ec">
<link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>📺</text></svg>">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="${fonts}">
<link rel="stylesheet" href="${asset('styles.css')}">
<script src="${asset('app.js')}" defer></script>
</head>
<body>
<a class="skip" href="#santa">Skip to channels</a>
<div class="progress" aria-hidden="true"></div>
<nav class="reel-nav" aria-label="Channels"><ol data-reel-nav></ol></nav>
<p class="toast" role="status" aria-live="polite" data-toast></p>
${hero(p, ctx)}
<main>
${santa(H('santa'), p)}
${twitch(H('twitch'), p, ctx, parents)}
${shorts(H('shorts'), p, ctx)}
${credits(p)}
</main>
</body>
</html>`;
}

module.exports = { renderPage, esc };
