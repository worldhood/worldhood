# Contributing to worldhood

Build your own corner of the world, or help make the whole game better. City work and engine
work are equally welcome. The [vision](docs/VISION.md) explains what works today and what we
want to explore next. Small fixes, local knowledge, testing and documentation all count.

Full guides: [build your city](docs/BUILD_YOUR_CITY.md) · [extending the map](docs/EXTENDING.md) · [building landmarks](docs/BUILDING_LANDMARKS.md) · [gameplay](docs/GAMEPLAY.md) · [adding a city](docs/ADDING_A_CITY.md).

The map grows one **area** at a time. Areas can list maintainers to coordinate local work; many
still need volunteers. Connected areas can join into one continuous playable map. You can
contribute without claiming an area, and an area claim coordinates work rather than granting
exclusive ownership.

## Your first contribution

New to open source? Work in your own fork and branch so you can experiment:

1. **Pick something:**
   - an issue labelled
     [`good first issue`](https://github.com/worldhood/worldhood/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22),
     anything on the [wishlist](docs/IDEAS.md), or your own city
     ([playbook](docs/BUILD_YOUR_CITY.md));
   - comment on the issue ("I'd like to try this") so others know.
2. **Fork** the repository (the *Fork* button on GitHub). This makes your own copy.
3. **Clone your fork and make a branch:**
   ```sh
   git clone https://github.com/<you>/worldhood && cd worldhood
   git checkout -b weather-director     # any short name
   npm ci && npm run dev                # play at http://localhost:5173
   ```
4. **Make the change.** Keep it small and focused, then run `npm test` and `npm run build`.
5. **Push and open a pull request** from your branch:
   - Fill in the template.
   - Add a screenshot or a short gameplay clip if you changed the game (see below).
   - Write `Closes #<issue>` so the issue closes when it's merged.
6. **Review:**
   - Automated checks run on every pull request.
   - A maintainer (and for city changes, that city's maintainer) reviews, may ask for changes, and
     merges.
   - Git records your contribution under the author identity you choose.

Stuck? Ask on the relevant GitHub issue. Questions are welcome; nobody expects you to know
the whole codebase. Coding agents are optional, and contributions made with them need the
same review, source attribution and testing as other work.

## Show your change

It's a game, so we want to see it! Every pull request that changes the game (anything under
`src/`, `public/`, `cities/`, `extensions/`, `scripts/` or `index.html`) needs **at least one
screenshot or a short gameplay video** in its description. Before/after pictures of the same spot
are the most helpful. Docs-only pull requests don't need one.

- **Screenshot:** your browser's or OS's screenshot tool. In the game, **H** hides the HUD,
  **V** is capture mode (full resolution, no camera shake) and **T** changes the weather.
- **Video:** your OS screen recorder (macOS **Cmd+Shift+5**, Windows Game Bar **Win+Alt+R**, or
  OBS anywhere). 10–30 seconds is plenty.
- **Upload:** drag and drop the file into the pull request description; GitHub hosts it.
- Add the `?city=&start=` link so reviewers can find the same place.

A check called **pr-media** fails until the description has an image or video. Edit the
description and it re-runs by itself.

## Kinds of contribution

| You like… | Start with |
| --- | --- |
| Your own city | [docs/BUILD_YOUR_CITY.md](docs/BUILD_YOUR_CITY.md) |
| Shared engine, gameplay, controls, performance, sound or weather | [docs/IDEAS.md](docs/IDEAS.md) and [docs/GAMEPLAY.md](docs/GAMEPLAY.md) |
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
- **Street-level imagery:** use your own on-site observations and photos, or references whose
  licence and terms permit the intended notes, measurements, processing and redistribution.
  Preserve attribution and applicable share-alike obligations. Do not derive project data from
  Google Street View without permission covering that use; rewording observations does not
  establish permission. See [EXTENDING.md](docs/EXTENDING.md#street-level-imagery).

## Area status

| Status | Meaning |
| --- | --- |
| `draft` | Builds and loads; may have gaps |
| `playable-draft` | Drivable end to end; tests pass |
| `reviewed` | Checked against the real street by its maintainers and one other contributor |

## Code changes

Start with the [engine code map](docs/GAMEPLAY.md). Describe what the player should experience,
keep reusable behaviour independent of city names, and keep local scenery in its city data or
modules. Check another city when changing shared gameplay; check touch input when changing
controls. For loading or rendering work, include what you measured and the browser/device used.

- Keep changes focused, add or update tests in `tests/`, and run `npm test` and `npm run build`
  before opening a pull request.
- Map data uses metres, with X east and Z south, from the origin in `src/geo.js`.
