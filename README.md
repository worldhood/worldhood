# Open City Drive

An open-source browser driving game set in real cities, starting with Helsinki. Streets, buildings, parks, trees and the shoreline come from
the City of Helsinki's open data, and trams follow HSL routes. Drive from the Olympia Terminal past
Kauppatori and the Cathedral, up Mannerheimintie through Töölö, and out to Seurasaari.

**Play it now: [opencitydrive.org](https://opencitydrive.org)**

It runs entirely in the browser (three.js + Vite). No accounts, API keys or backend.

Originally built by [Lasse](https://www.linkedin.com/in/lassesaari/); now open to contributors. Have an idea? [Tell me](https://www.linkedin.com/in/lassesaari/).

## Run

```sh
npm ci
npm run dev
```

Open the URL Vite prints. Requires a modern browser with WebGL2.

| Key | Action |
| --- | --- |
| W / S or ↑ / ↓ | Accelerate / brake and reverse |
| A / D or ← / → | Steer |
| Space | Handbrake |
| R | Back to your starting point |
| M | City map and starting points |
| C | Drive / Follow / High camera |
| Q / E (hold) | Look left / right |
| T | Time of day / weather |
| H | Hide the HUD |
| V | Capture mode (full resolution, no camera shake) |

```sh
npm test          # unit tests
npm run build     # static build in dist/, deployable to any static host
```

## Cities

<!-- CITIES:START -->
| City | Play | Status | Data | Maintainers |
| --- | --- | --- | --- | --- |
| Helsinki, Finland | [`?city=helsinki`](https://opencitydrive.org/?city=helsinki) | playable | City of Helsinki 3D city model + open data, HSL | wanted |
| Tampere, Finland | [`?city=tampere`](https://opencitydrive.org/?city=tampere) | draft | OpenStreetMap | wanted |
<!-- CITIES:END -->

Running it locally? Use `http://localhost:5173/?city=<id>`.

## Build your own city

**Not a programmer?** Start with **[docs/START_HERE.md](docs/START_HERE.md)**: a plain-language,
step-by-step guide. You bring the photos and local knowledge; an AI coding agent writes the code.

Any city works, starting from just its name:

```sh
npm run city:new   -- tampere "Tampere, Finland" 1500   # find it, set the playable radius (m)
npm run city:build -- tampere                            # OpenStreetMap → game data
npm run dev                                              # then open /?city=tampere
```

You get:
- 3D buildings at their mapped heights
- streets with real surfaces (cobblestones rumble)
- water, parks and trees
- a routable traffic network with traffic lights, used by traffic and pedestrians
- tram and bus lines with stops, from OpenStreetMap routes
- start points at the city's best-known places

A fresh build is only the skeleton. **A city is published when it looks as good as Helsinki**: you
refine it street by street against real photos (buildings, trees, signs, surfaces, local buses
and trams) until locals recognise it. The step-by-step **[playbook](docs/BUILD_YOUR_CITY.md)** ends with
a ready-made **agent prompt** you can paste into your own coding agent so it builds your city for
you. ### Add your city to the game

1. **Fork** this repository and create a branch, e.g. `city/tampere`.
2. **Build:**
   - `npm run city:new -- <id> "<City, Country>"`, then `npm run city:build -- <id>`.
   - The build also adds your city to the table above, via `npm run cities:readme`.
3. **Make it yours:**
   - Put your GitHub handle in `maintainers` in `cities/<id>/city.json`.
   - Add these lines to `.github/CODEOWNERS`:
     ```
     /cities/<id>/          @you
     /public/cities/<id>/   @you
     ```
4. **Check:** run `npm test` and `npm run build`. Then drive every start point at
   `/?city=<id>` with no console errors.
5. **Open a pull request** titled `City: <name>`. The template asks for:
   - 3–5 screenshots;
   - the `?city=<id>&start=<place>` links;
   - your data sources.

   Commit `cities/<id>/`, `public/cities/<id>/`, `public/cities/index.json` and the README change.
   Never commit `data/raw/` or `.env.local`.
6. **Review:**
   - An automated check runs the tests and build.
   - A maintainer drives it and merges it as `draft`.
   - It moves to `reviewed` once the [playbook](docs/BUILD_YOUR_CITY.md) stage 3–4 checks pass and
     a local confirms.

Building the data yourself is optional: you can open an **Area claim** / city issue and ask
someone to help.

## The map

- The core area is a 2 km circle around Helsinki Cathedral.
- **Extensions** add more areas; the first is the Mannerheimintie → Töölö → Seurasaari corridor.
- **Pick a city and start point** in the URL: `?city=helsinki&start=seurasaari-bridge` or
  `?city=tampere`.
- Coordinates are local metres (X east, Z south) from 24.9522 E, 60.1701 N, using the municipal
  ETRS-GK25 projection (EPSG:3879).

The game is not a survey-exact digital twin:
- The terrain is flat.
- Some façades and landmark details are approximations.
- Traffic, pedestrians and police are simulated.

## Rebuilding data

All runtime data is bundled in `public/data`. To refresh it from the public sources:

```sh
npm run data:fetch && npm run data:build
npm run data:textured
npm run data:mobility
```

## Contributing

This is a community project, and contributions of every size are welcome.

- **Start here:** [CONTRIBUTING.md](CONTRIBUTING.md) explains your first pull request step by step.
- **Pick a task:**
  - the [wishlist](docs/IDEAS.md), where every idea is an open issue: changing weather, sound,
    seagulls, walking, changing cars, driving trams;
  - [`good first issue`](https://github.com/opencitydrive/open-city-drive/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22)
    for small starters;
  - or build your city.
- **Talk:** [Discussions](https://github.com/opencitydrive/open-city-drive/discussions) for
  questions, ideas and showing off drives.

Guides:
- [docs/RECOGNISABILITY.md](docs/RECOGNISABILITY.md): what makes a city recognisable, learned from Helsinki.
- [docs/BUILD_YOUR_CITY.md](docs/BUILD_YOUR_CITY.md): the playbook and agent prompt for a new city.
- [docs/EXTENDING.md](docs/EXTENDING.md): build and review a new area, and use OpenStreetMap and
  street-level imagery the right way.
- [docs/BUILDING_LANDMARKS.md](docs/BUILDING_LANDMARKS.md): model famous buildings as real geometry.
- [docs/GAMEPLAY.md](docs/GAMEPLAY.md): code map, debug tools and gameplay pull requests.
- [docs/ADDING_A_CITY.md](docs/ADDING_A_CITY.md): official data and city-specific scenery.
- [docs/HOSTING.md](docs/HOSTING.md): hosting the game and city data.

## Licence

- Code is under the [MIT licence](LICENSE).
- Map data, imagery and some assets are under their own licences, mainly CC BY 4.0 from the City of
  Helsinki and HSL. See [NOTICE.md](NOTICE.md). Keep those attributions when you redistribute.
