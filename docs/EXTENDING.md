# Extending the map: a step-by-step guide

This guide takes you from "I want my street in the game" to a merged, reviewed area.
Each area is owned by named maintainers, and touching areas join into one continuous map.

> **Short version:**
>
> ```sh
> npm ci
> # 1. claim the area (GitHub issue, "Area claim" template)
> # 2. write extensions/<id>/extension.json
> npm run extension:route -- <id>     # route + crop
> npm run extension:fetch -- <id>     # official city data
> npm run extension:build -- <id>     # game data
> npm run area:links -- <id>         # reference notes file + photo links for each spot
> npm run area:review -- <id>         # Jev review → extensions/<id>/review.json
> npm test && npm run build
> ```
>
> Then open `http://localhost:5173/?city=helsinki&start=<a start name>` and drive it.

---

## 1. How the map is put together

| Layer | Where it comes from | Where it lives |
| --- | --- | --- |
| Buildings (3D + photo textures) | City of Helsinki 3D city model, textured LOD2 | `public/data/buildings3d/`, `public/data/extensions/<id>/buildings3d/` |
| Streets, pavements, parks, water, trees | City of Helsinki open data (WFS) | `city.pack` (core and per area) |
| Traffic lanes, crossings, signals | City of Helsinki traffic network | `mobility.json` |
| Trams and buses | HSL GTFS | `trams.json`, `buses.json` |
| Landmarks with real modelled detail | Hand-built code modules | `src/*.js` (see [BUILDING_LANDMARKS.md](BUILDING_LANDMARKS.md)) |
| Which area exists, where you may drive, start points | Per-area build output | `public/data/extensions/index.json` |

- **Coordinates:** everything is in metres in one frame: X east, Z south, Y up. The origin is in
  `src/geo.js`.
- **The core:** the 2 km circle around the Cathedral. Every **area** (extension) adds a drivable
  outline beyond it.
- **Merging:** the game merges all registered areas at startup (`src/extensions.js`). Building
  and road IDs from the city remove duplicates, and road-network nodes at the seam snap together.

## 2. Claim an area

Open an issue with the **Area claim** template. A good first area:
- **Connects:** it touches the core or an existing area, so it can be driven to.
- **Is about 1–3 km of route:** the band defaults to 200 m of streets and 260 m of buildings on each
  side.
- **Has things people know:** at least a few landmarks or street characteristics people would
  recognise.

## 3. Describe the area: `extensions/<id>/extension.json`

```json
{
 "schemaVersion": 1,
 "id": "kallio",
 "title": "Hakaniemi → Hämeentie → Sörnäinen",
 "status": "draft",
 "maintainers": ["your-github-handle"],
 "description": "One sentence for the map and the PR.",
 "definition": {
  "legs": [{"id": "hameentie", "label": "Hakaniemi → Sörnäinen", "via": [[24.9515, 60.1792], [24.9620, 60.1870]]}],
  "buffers": {"surfaceMetres": 200, "buildingMetres": 260, "islandShoreMetres": 60},
  "anchors": [["Hakaniemi market hall", [24.9516, 60.1788]], ["Sörnäinen metro", [24.9617, 60.1872]]],
  "starts": [{"name": "Hakaniemi", "district": "Kallio", "anchor": "Hakaniemi market hall", "line": "hameentie"}]
 },
 "knownFor": [
  {"name": "Hakaniemi market hall", "near": "Hakaniemi market hall", "at": [[24.9516, 60.1788]],
   "description": "Red-brick market hall on the square", "mustHave": true}
 ],
 "limitations": ["Ground is flat; Kallio's hill is not modelled."]
}
```

| Field | What it is |
| --- | --- |
| `legs[].via` | Waypoints as `[lon, lat]`. A router turns them into the route centreline. |
| `anchors` | Named places. They become checkpoints, and each is reviewed separately. |
| `starts` | Spawn points for the city map and for `?start=`. `face` makes a start face another anchor. |
| `knownFor` | What people would expect to see. Jev checks each one; `mustHave` items block sign-off. Give a real position in `at`. |
| `island` | Optional `{"query": "Name, Helsinki"}` to include a whole island outline. |

## 4. Build it

```sh
npm run extension:route -- <id>
npm run extension:fetch -- <id>
npm run extension:build -- <id>
```

- **`extension:route`:** turns waypoints into a centreline and island outline, using cached replies
  under `data/raw/extensions/<id>/`.
- **`extension:fetch`:** downloads only what lies outside the existing data:
  - footprints, streets, pavements, parks, the tree register, the sea, traffic lanes and signals;
  - textured 3D tiles (3D Tiles 1.1 GLB; KTX2 textures are transcoded to JPEG).

  The city's geoserver sometimes resets connections; the script retries.
- **`extension:build`:** writes `public/data/extensions/<id>/` and registers the area in
  `index.json`. Trees inferred inside mapped forest are flagged `inferred: true`.

Run `npm test`, start `npm run dev`, then try `?start=<your start>`. Drive the whole route, both
ways.

## 5. Look at the real place: using OpenStreetMap and street-level imagery wisely

Data sources in order of preference:

1. **City of Helsinki open data:** surveyed, CC BY 4.0, and the backbone of the map. Prefer it
   whenever it covers what you need.
2. **OpenStreetMap:** good for routing, place names, points of interest and outlines the city
   doesn't publish.
3. **Street-level imagery:** for *appearance*: what signs say, façade colours, kerbs, shelters,
   trees.

### OpenStreetMap

- **Licence:** ODbL. Credit "© OpenStreetMap contributors" in `NOTICE.md` and in the area's
  provenance.
- **Share-alike:** a file *derived* from OSM data (e.g. `route.json` centrelines) is itself under
  ODbL. Keep OSM-derived data in its own files; don't silently mix it into municipal-derived files.
- **Be polite to the public services:**
  - Nominatim allows at most 1 request per second and needs a descriptive User-Agent.
  - The OSRM demo server and Overpass are shared and rate-limited.
  - The scripts cache every reply; don't remove that.
- **What OSM is for here:** choosing *where* to crop, landmark positions (`knownFor.at`), and routing.
  It is not a replacement for the city's surveyed geometry where both exist.

### Street-level imagery

| Source | Project use |
| --- | --- |
| **Your own photos and on-site observations** | Use material you have the rights to contribute; publish contributed photos under an explicit open licence. |
| **Mapillary imagery** | Check the image licence and service terms; retain image IDs, photographer credit and applicable share-alike obligations. The imagery licence does not establish the licence of extracted Mapillary map features; see [NOTICE.md](../NOTICE.md). |
| **Other openly licensed photos** | Check each photo's licence and the provider's terms for the intended use, including processing, measurement and redistribution. |
| **Google Street View** | Viewing it on Google's service does not grant permission to create project assets or map data from it. Do not use it for this project's measurements, tracing, extracted features, screenshots or model input without permission covering that use. |

Use your own observations or appropriately licensed references for `reference-notes.json` and
asset construction. Rewriting an observation in your own words does not establish permission to
derive project data from a restricted source. Google's
[Geo Guidelines](https://about.google/brand-resource-center/products-and-services/geo-guidelines/)
restrict creating data from Street View imagery, as well as screenshots and extraction tools.

**Notes from permitted photos:** download photos whose licence and terms cover your use, then
write short, checkable observations in `reference-notes.json`. Record each photo's source, ID,
photographer and licence:

```sh
npm run photos:fetch -- <city> <place>   # Wikimedia Commons, Mapillary, Panoramax → data/raw/photos/ (never committed)
npm run facades:photos -- <city>          # street-level photos matched to the buildings along a street
```

Where permitted coverage is missing, take your own photos or make on-site observations. You can
also contribute your own phone or 360° photos to Mapillary under its contribution terms.

**Manual notes:** generate the links and a notes file:

```sh
npm run area:links -- <id>
```

For each checkpoint this prints a Street View link and a Mapillary link at the same spot and
heading as the game. Those links do not grant reuse permission. Fill the generated
`extensions/<id>/reference-notes.json` using your own on-site observations or permitted references:

```json
{
 "Parliament House": {
  "source": "Own on-site observations and own photos, taken 2026-10-09",
  "observedOn": "2026-10-09",
  "observations": [
   "Grey granite façade with 14 tall columns facing Mannerheimintie",
   "Wide stairs up from the pavement; two bronze statues at the sides",
   "Mannerheimintie: two lanes each way plus tram tracks in the middle"
  ]
 }
}
```

- **Phrasing:** one short, checkable fact per line.
- **Accuracy:** don't guess, and write "unclear" when you're not sure.
- **Date:** put the imagery date in `source`.

## 6. Review with Jev

[Jev](https://docs.typesafe.ai) is TypeSafe's text-only decision model. It can't see images, so the
review works on text from two sources:

- **The game inventory:** what the game actually contains at each checkpoint, computed from the same
  data it renders. That covers building counts, which buildings have photo textures, heights,
  streets, surface materials, bridges, trees, signals, crossings and tram lines. It also includes
  what sits at each `knownFor` position.
- **Your reference notes** from step 5.

For each checkpoint Jev answers typed questions:

| Question | Type | Used for |
| --- | --- | --- |
| How recognisable is it? | Score, 4 levels | Sign-off needs "Recognisable" or better, with confidence |
| Demo-ready, without a gap a local would point out? | Yes/no probability | Sign-off needs ≥ 0.8 |
| Is each `knownFor` item missing or only generic? | Yes/no probability each | A `mustHave` item above 0.5 blocks sign-off |
| What work would most improve it? | Choice | Routes the next task (see below) |

Code, not the model, owns the policy (`scripts/area-review.mjs`, `POLICY`):

| Status | Meaning |
| --- | --- |
| `signed-off` | Jev rates it demo-ready and recognisable, with no `mustHave` gap |
| `human-review` | Borderline; a maintainer decides |
| `needs-work` | See `missing` and `nextStep` |

Set up the key once. It's never committed or shipped:

```sh
cp .env.example .env.local   # then put your key after TYPESAFE_API_KEY=
npm run area:review -- <id>              # writes extensions/<id>/review.json
npm run area:review -- <id> --dry-run    # writes the exact requests, no API call
```

How to act on `nextStep`:

| `nextStep` | Do this |
| --- | --- |
| `reference_observations` | Add or improve notes (step 5); Jev can't judge a place it knows nothing about |
| `municipal_data` | Widen the area, refresh data, or report a data gap |
| `procedural_detail` | Generic street detail generated from data: signs, lamps, markings, furniture |
| `bespoke_landmark` | Model the landmark properly; see [BUILDING_LANDMARKS.md](BUILDING_LANDMARKS.md) |
| `gameplay` | Fix driving, routes or blockers; see [GAMEPLAY.md](GAMEPLAY.md) |
| `none` | Ready for a human look and sign-off |

What we learned using it:
- **Jev is only as good as the evidence.** An inventory field called `tramLines` made Jev think trams
  were missing; relabelled as "trams on these lines drive through here" it agreed they were present.
- **Real positions matter.** Listing buildings by address told Jev nothing about which one is
  Parliament House; the building *at Parliament's coordinates* did.
- **Treat thresholds as starting points.** Tune them on reviewed areas and record changes in the PR.

## 7. Open the pull request

Include:
- `extensions/<id>/extension.json`, `route.json`, `reference-notes.json` and `review.json`
- `public/data/extensions/<id>/` and the updated `public/data/extensions/index.json`
- your handle in `.github/CODEOWNERS` for the area folders
- three to five in-game screenshots, plus the `?start=` links to reproduce them
- new sources in `NOTICE.md`

Area status moves `draft` → `playable-draft` (drivable, tests pass) → `reviewed` (Jev sign-offs
plus one human reviewer besides the maintainer).

## 8. Beyond Helsinki: the Espoo area

Helsinki's open data stops at the city border. The `espoo` area continues the map west from
Länsiväylä (area `lansivayla`, Ruoholahti → Lauttasaari → Koivusaari) to Keilaniemi, Otaniemi and
Tapiola on the City of Espoo's own open data. It uses the same runtime formats as the Helsinki areas,
so the game merges it like any other area.

```sh
npm run extension:route -- espoo   # route crop; "areas" circles widen it around Otaniemi and Tapiola
npm run espoo:fetch                # City of Espoo WFS, Digiroad, OpenStreetMap water (cached)
npm run espoo:build                # needs python3 with Pillow for the texture atlases
```

| Layer | Source | Licence |
| --- | --- | --- |
| Buildings (LOD2 + 2024 photo textures) | Espoo WFS `bldg:building_lod2` (CityGML 2.0; per-surface JPEGs under `kartat.espoo.fi/azcm/data/textures/`) | CC BY 4.0, © Espoon kaupunki |
| Street areas | Espoo WFS `tran:road_lod2` (triangulated street parts with their functional class) | CC BY 4.0, © Espoon kaupunki |
| Drivable and walkable network | Espoo WFS `GIS:Keskilinjat` (centrelines; one-way from `Kulkusuunta`) | CC BY 4.0, © Espoon kaupunki |
| Trees | Espoo WFS `kanta:Lehtipuu`, `kanta:Havupuu` | CC BY 4.0, © Espoon kaupunki |
| Traffic lights | Digiroad `dr_liikennevalo` (Väylävirasto) | CC BY 4.0 |
| Sea and ponds | OpenStreetMap coastline and water, clipped to Espoo's districts (`GIS:Kaupunginosat`); shipped separately as `osm-water.json` | ODbL 1.0 |

How the build works (`scripts/build-espoo.mjs`, helpers in `scripts/espoo-citygml.mjs` and
`scripts/osm-water.mjs`):

- **Coordinates:** Espoo publishes ETRS-GK25 (EPSG:3879) with N2000 heights, the game's own grid,
  so only a translation is needed: x = E − E0, z = N0 − N.
- **Levelling:** the game's Helsinki is flat. Each building stands on its lowest ground-surface point;
  Espoo's terrain heights are dropped.
- **Textures:** every wall and roof has its own photo. Per 250 m tile they are resampled to an even
  texel density (finer than 22 cm per pixel, never above the source resolution) and packed into
  1024 px JPEG atlases.
- **Border seam:** dead ends of the Espoo network move onto the nearest dead end of the Länsiväylä
  area's network (within 25 m), so the runtime merge joins the two road graphs.
- **Water:** Helsinki's sea polygons stay Helsinki's; Espoo's water is the OpenStreetMap sea inside
  Espoo's districts, so the two never overlap.
- **Hosting:** the area is about 300 files; `tests/hosting.test.mjs` keeps the site within its limits.

