# Hosting

Open City Drive is a **static site**: HTML, JavaScript and data files, with no server code,
database or accounts. Any static host works, and a CDN carries the traffic.

## What one player downloads

Measured (October 2026), first visit, including a 30-second drive:

| City | Downloaded | Files |
| --- | --- | --- |
| Helsinki | ~48 MB | 523 |
| Tampere (OpenStreetMap build) | ~30 MB | 337 |

- **Why driving adds little:** building tiles stream in by distance, so a short drive adds almost
  nothing; long drives across the city add more.
- **Caching:** a return visit downloads close to nothing if files are cached.
- **Compression:** the numbers come from the dev server without compression; a CDN's gzip/Brotli
  makes the JSON data smaller.

Rule of thumb: **about 40 MB per new player**.

| Players (new) | Traffic |
| --- | --- |
| 1,000 | ~40 GB |
| 10,000 | ~400 GB |
| 100,000 (a viral week) | ~4 TB |

## Recommended: Cloudflare Pages, static only

**Cost: zero, even with billing set up on the account,** as long as the site stays static. Cloudflare
serves static asset requests free and without limits on every plan. Only server code (Pages
Functions / Workers), storage products (R2, KV, D1) and paid add-ons are billed, and this project
uses none of them. `tests/hosting.test.mjs` fails if anyone adds server code (`functions/`,
`_worker.js`, Wrangler config) or outgrows the free file limits, so a pull request can't make
hosting billable by accident.

Optional extra safety: in the Cloudflare dashboard, open **Notifications** and add a billing or
usage alert so you're emailed if anything ever starts accruing.

**Why:** static bandwidth on Cloudflare Pages is unmetered on the free plan. A viral spike costs
nothing and doesn't take the site down. Check the current plan limits before relying on them;
these are the published ones as of 2026:

| Limit | Value | This project |
| --- | --- | --- |
| Files per site | 20,000 | ~1,900 today; each OSM city adds about 300–600 |
| Size per file | 25 MiB | Largest file is about 6 MB |
| Bandwidth | Unmetered | Fine |
| Builds | 500 per month | Fine |

Setup:
1. Push the repository to GitHub.
2. In Cloudflare, go to **Pages**, choose **Connect to Git**, and pick the repository.
3. Build command: `npm ci && npm run build`. Output directory: `dist`.
4. Add a custom domain (e.g. `opencitydrive.org`).
5. Every merged pull request deploys automatically, and pull requests get preview links.

## When there are many cities

At roughly 30+ cities the file count and repository size become the limit, not bandwidth. Then:

1. **Move city data to object storage.** Put `public/cities/<id>/` files on **Cloudflare R2**,
   which has S3-compatible storage and no download fees. Serve them at e.g.
   `data.opencitydrive.org/<id>/<version>/…`. Storage is about $0.015 per GB per month after a
   free 10 GB, so 50 cities cost a dollar or two a month.
2. **Point each city at it.** Set `dataRoot` in `public/cities/index.json` to that URL; the game
   already loads every file through `dataUrl()`.
3. **Cache forever.** Use versioned paths with `Cache-Control: immutable`.
4. **Upload from CI.** Each city's CI uploads its build output with a scoped token, so the main
   repository stays code plus the small registry.

## Other hosts

| Host | Good for | Watch out for |
| --- | --- | --- |
| GitHub Pages | Simplest setup | About 1 GB site and roughly 100 GB per month soft bandwidth limit, so a few thousand players a month |
| Netlify / Vercel (free) | Previews | Bandwidth caps around 100 GB per month; Vercel's free plan is non-commercial |
| Any VPS + nginx | Full control | You pay for and manage the bandwidth; put a CDN in front |

## Can the servers handle it?

Yes. No game logic runs on a server, so there is nothing to overload. Each player's browser runs
the simulation; the host only serves files, which is exactly what CDNs are built for. The real
limits:

- **Players' devices:** the game targets 60 FPS on a recent laptop. Phones work but load more
  slowly, and the adaptive resolution keeps them playable.
- **First-load size:** 30–50 MB is fine on broadband and heavy on mobile data. Shrinking the first
  load (loading the city around the start point first) is on the roadmap.
- **Public map services:** the game never calls OpenStreetMap, Overpass, Nominatim or OSRM at
  runtime. Only the build scripts do, and they cache.

## Run it locally

```sh
npm ci
npm run dev                     # http://localhost:5173/?city=helsinki
npm run build && npm run preview  # production build at http://localhost:4173
```
