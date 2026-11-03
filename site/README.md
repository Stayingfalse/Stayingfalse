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

Endpoints: `/` serves the site, `/profile.json` the content as JSON, and `/healthz` a health check.
Put static assets such as images in `site/public/`.
