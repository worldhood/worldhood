# Contributing

Full guides: [build your city](docs/BUILD_YOUR_CITY.md) · [extending the map](docs/EXTENDING.md) · [building landmarks](docs/BUILDING_LANDMARKS.md) · [gameplay](docs/GAMEPLAY.md) · [adding a city](docs/ADDING_A_CITY.md).

The map grows one **area** at a time. Each area has named maintainers who are responsible for it.
Areas that touch join into one continuous drivable map.

## Your first contribution

New to open source? This is the usual flow, and you can't break anything by trying:

1. **Pick something:**
   - an issue labelled
     [`good first issue`](https://github.com/opencitydrive/open-city-drive/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22),
     anything on the [wishlist](docs/IDEAS.md), or your own city
     ([playbook](docs/BUILD_YOUR_CITY.md));
   - comment on the issue ("I'd like to try this") so others know.
2. **Fork** the repository (the *Fork* button on GitHub). This makes your own copy.
3. **Clone your fork and make a branch:**
   ```sh
   git clone https://github.com/<you>/open-city-drive && cd open-city-drive
   git checkout -b weather-director     # any short name
   npm ci && npm run dev                # play at http://localhost:5173
   ```
4. **Make the change.** Keep it small and focused, then run `npm test` and `npm run build`.
5. **Push and open a pull request** from your branch:
   - Fill in the template.
   - Write `Closes #<issue>` so the issue closes when it's merged.
6. **Review:**
   - Automated checks run on every pull request.
   - A maintainer (and for city changes, that city's maintainer) reviews, may ask for changes, and
     merges.
   - Your name appears in the history and the release notes.

Stuck? Ask in [Discussions](https://github.com/opencitydrive/open-city-drive/discussions) or on the issue. Questions are
welcome; nobody expects you to know the codebase.

## Kinds of contribution

| You like… | Start with |
| --- | --- |
| Your own city | [docs/BUILD_YOUR_CITY.md](docs/BUILD_YOUR_CITY.md) |
| Gameplay, sound, weather | [docs/IDEAS.md](docs/IDEAS.md) and [docs/GAMEPLAY.md](docs/GAMEPLAY.md) |
| Modelling famous buildings | [docs/BUILDING_LANDMARKS.md](docs/BUILDING_LANDMARKS.md) |
| Maps and data | Fix OpenStreetMap at the source, then rebuild the city |
| Testing and feedback | Play, then open a **Bug** issue with the `?city=&start=` link |
| Docs | Anything unclear is a bug; improve it |

## Claiming an area

1. Open an issue using the **Area claim** template. Name the area, the streets it covers, and the
   existing area it connects to.
2. Once the claim is accepted, add `extensions/<id>/extension.json`, with yourself in `maintainers`,
   and add your GitHub handle for that folder in `.github/CODEOWNERS`.
3. Build it:
   ```sh
   npm run extension:route -- <id>
   npm run extension:fetch -- <id>
   npm run extension:build -- <id>
   npm run area:links -- <id>    # reference notes file + photo links for each spot
   npm run area:review -- <id>   # Jev review (needs TYPESAFE_API_KEY in .env.local)
   npm test
   ```
4. Open a pull request with the generated `extensions/<id>/route.json`,
   `public/data/extensions/<id>/` and the updated `public/data/extensions/index.json`, plus a few
   in-game screenshots.

## What every area must do

- **Connect:** the area's drivable outline must touch an existing area, so the car can drive in. Road
  graph nodes at the seam snap together automatically.
- **Use municipal data first:** use official open data where it exists. Anything interpreted or inferred
  is flagged in the data (for example `inferred: true`), never presented as surveyed.
- **No duplicates:** source feature IDs de-duplicate against areas already in the map. Never
  hand-edit another area's files.
- **Credit sources:** add new sources to the area's provenance and, if new, to `NOTICE.md`.
- **Street-level imagery:** look at Google Street View only in Google's own viewer, and write
  observations in your own words. Never scrape, screenshot, store or feed it to tools. Use Mapillary
  or your own photos for anything processed. See [EXTENDING.md](docs/EXTENDING.md#5-look-at-the-real-place-using-openstreetmap-and-street-level-imagery-wisely).

## Area status

| Status | Meaning |
| --- | --- |
| `draft` | Builds and loads; may have gaps |
| `playable-draft` | Drivable end to end; tests pass |
| `reviewed` | Checked against the real street by its maintainers and one other contributor |

## Code changes

- Keep changes focused, add or update tests in `tests/`, and run `npm test` and `npm run build`
  before opening a pull request.
- Map data uses metres, with X east and Z south, from the origin in `src/geo.js`.
