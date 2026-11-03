# How this repo works

One file, two outputs:

```
content/profile.json ──► scripts/build-readme.js ──► README.md   (GitHub profile)
                     └─► site/server.js          ──► website     (Docker, Node.js, no database)
```

## Updating

1. Edit `content/profile.json`: socials, highlights, project groups and repos.
   - Set `"enabled": false` to hide a social link without deleting it.
   - `"featured": true` stars a repo.
2. Push to `main`. GitHub Actions then:
   - regenerates `README.md` (`.github/workflows/readme.yml`)
   - builds and pushes `ghcr.io/stayingfalse/stayingfalse:latest` (`.github/workflows/docker.yml`)

Locally: `npm run readme` rebuilds the README, `npm start` serves the site on :3000, and `npm run check` confirms the README is in sync.

## Hosting

```sh
docker compose up -d --build      # or: docker run -p 3000:3000 ghcr.io/stayingfalse/stayingfalse
```

The site can pick up repo changes in two ways:

- **No rebuild:** set `CONTENT_URL` to the raw GitHub URL of `content/profile.json`. The site re-fetches it every `REFRESH_MINUTES` (default 10) and keeps the bundled copy if the fetch fails. `docker-compose.yml` sets this up already.
- **Rebuild:** pull the new image, or point Watchtower at it.

### Live data (optional, still no database)

| What | How | Env vars |
| --- | --- | --- |
| Twitch player: the live stream when live, the latest VOD when offline | Official Twitch Helix API, cached for 60s | `TWITCH_CLIENT_ID`, `TWITCH_CLIENT_SECRET` (free app at dev.twitch.tv/console/apps), optional `TWITCH_PARENT` |
| Latest Instagram reels for each channel | Reads the public video index at `shorts.feedUrl` (quiz.cezz.co.uk), cached for 15 minutes | optional `SHORTS_FEED_URL`, `SHORTS_REFRESH_MINUTES` |

Without the Twitch keys the page shows the channel player, which plays the stream when you're live and shows Twitch's offline screen otherwise.
Twitch only allows its player on HTTPS pages, so serve the site behind your usual TLS proxy. `parent` is taken from the request's Host header, or from `TWITCH_PARENT`.
To change how many reels each channel shows, set `shorts.perChannel` in `profile.json`.
A project's `site` field adds a 🌐 link to its live site.

### Design

The site is designed as a TV channel guide. The hero is a TV that tunes in from static next to a "What's on" listings card, and each section below is a channel styled after the real thing:

| Theme key | Where it's set | Look |
| --- | --- | --- |
| `santa` | `highlights[].theme` | Random Acts of Santa airmail post: navy, cream postcard, swinging baubles, a postmark that stamps down |
| `twitch` | `highlights[].theme` | A TV with an on-air light that is lit only when you're live, and a potato on top |
| `shorts` | `highlights[].theme` | Plain intro before the channels |
| `quiz` | `socials[].theme` | The quiz videos' game-show set: sunburst, chasing marquee bulbs, letter tiles, a split-flap count, confetti |
| `dungeon` | `socials[].theme` | Torchlight that follows the pointer, and a parchment quest log |
| `speedway` | `socials[].theme` | Pit wall: start lights, then a timing tower |
| `colony` | `socials[].theme` | A starfield and a radar sweep until the first episode lands |

A new Instagram account without a theme still gets a plain section. The browser code is in `site/public/app.js` and the styles in `site/public/styles.css`. All motion is turned off for people who prefer reduced motion.

Endpoints: `/` serves the site, `/profile.json` the content as JSON, and `/healthz` a health check.
Put static assets such as images in `site/public/`.
