# Adding a city

> **Quick path:** `npm run city:new` + `npm run city:build` builds any city from OpenStreetMap. See the
> [playbook](BUILD_YOUR_CITY.md). This page covers the deeper route: official city data and
> city-specific scenery.

The URL selects a city: `?city=helsinki&start=seurasaari-bridge` or `?city=tampere`.

## Step 1: register the city

`npm run city:build -- <id>` writes the city's entry to `public/cities/index.json`, which the game
reads at startup. Helsinki is the one built-in exception, listed in `src/cities.js`. The entry's
`defaultStart` is `"defaultStart"` from `cities/<id>/city.json`, else the first start (see
[start points](BUILD_YOUR_CITY.md#stage-1-a-drivable-city-about-10-minutes)).

| Field | Meaning |
| --- | --- |
| `dataRoot` | Where the city's runtime files live (`/cities/<id>`). Every load goes through `dataUrl()` |
| `origin` | `[lon, lat]` of local (0, 0), the city centre |
| `projection` | A transverse Mercator centred on the origin, so local metres stay accurate |
| `radius` | Playable circle in metres |

## Step 2: produce the runtime files

A city needs the same files Helsinki has under `public/data`:

| File | Minimum content |
| --- | --- |
| `city.pack` | `buildings`, `roads`, `pavement`, `parks`, `water`, `trees`, `landmarks` (start points); optional `collision` (below) |
| `buildings3d-index.json` + tiles | 3D buildings; may be footprint extrusions where no 3D model exists |
| `surface-index.json` + chunks | Pre-coloured ground surfaces |
| `mobility.json` | Road and walking graph, signals |
| `trams.json`, `bus-corridors.json` | May be empty lists |
| `extensions/index.json` | `{"schemaVersion":1,"extensions":[]}` when the city has no extra regions; always ship the file because static hosts may return HTML for missing paths |

Data sources:
- **Official open data first.** Many cities publish footprints, street areas and 3D models,
  e.g. CityGML or 3D Tiles; use them under their licence.
- **OpenStreetMap otherwise.** Buildings (with `height` / `building:levels`), roads, footways,
  water, parks and trees all work. ODbL applies; see [EXTENDING.md](EXTENDING.md#openstreetmap).
- **Street level only.** `city:build` keeps building passages (`tunnel=building_passage`) and covered
  streets or arcades (`covered=yes|arcade`) as ground you can drive and walk through; tunnels below
  street level (`tunnel=yes`, negative `layer`) are left out.
- **Collision footprints.** The car collides with the mapped footprints, except where `city.pack`
  `collision` (`{replaced: [ids], buildings: [...]}`) gives trimmed ones: passages are cut through,
  and footprints straying up to 3 m onto the carriageway are trimmed back to it, unless that would
  remove half the building (a kiosk on a square stays solid). 3D buildings keep the mapped shape
  (`scripts/city-footprints.mjs`, `collisionBuildings` in `src/geo.js`).
- **Formats:** reuse `scripts/build-extension.mjs` (formats, de-duplication) and
  `scripts/prepare-world.mjs` (surface colours) as the reference implementations.

## Step 3: separate Helsinki's hand-built scenery

`src/main.js` uses the city's `scenery` setting to select Helsinki's landmarks and street details
or the generic scenery builder. Add place-specific models through that boundary. Shared systems
such as walking, riding, traffic, conversations, police and weather work across cities; keep their
rules in the shared engine. See [GAMEPLAY.md](GAMEPLAY.md).

## Step 4: police and transit liveries

Police, buses and trams default to Helsinki's look: Finnish `POLIISI` cars and uniforms, blue HSL
buses, green Artic trams. A city in another country sets its own in `cities/<id>/city.json`;
`npm run city:build` copies both blocks into `public/cities/index.json`. Every field is optional,
colours are `#rrggbb`, and unknown keys or malformed values fall back to the defaults
(`src/city-liveries.js`).

```json
"police": {
  "label": "POLICE",
  "emergency": "999",
  "siren": "hi-lo",
  "car": {"body": "#f4f5f2", "band": "#1b3f94", "accent": "#e8d21d", "lettering": "#f4f5f2", "bar": "#2448a6"},
  "lights": ["#1f5cff", "#1f5cff"],
  "uniform": {"jacket": "#141a26", "trousers": "#161b26", "vest": "#d9e021", "reflective": "#c8ccd0"}
},
"liveries": {
  "bus": {"paint": "#1f4e9c", "white": "#f4f5f6", "display": "#101918", "displayText": "#f8cd67"},
  "tram": {"green": "#b3372a", "yellow": "#b3372a", "operator": ["CITY", "TRAM"], "logo": false}
}
```

| Field | Meaning |
| --- | --- |
| `police.label` | Word on doors, bonnet, light bar, rear and uniform backs (up to 16 characters) |
| `police.emergency` | Number on the rear door, `""` for none (default `112`) |
| `police.website` | Small rear-door address on vans; only Finland's is inherited, `""` hides it |
| `police.emblem` | The game's own stylised badge. Defaults to `false` once you change `label` |
| `police.siren` | `wail-yelp` (slow wail far away, fast yelp up close) or `hi-lo` (two-tone) |
| `police.car` | Body, door band, chevron accents, lettering and light bar housing colours |
| `police.lights` | Beacon colours, left and right side (e.g. `["#ff2020", "#1f5cff"]`) |
| `police.uniform` | Jacket (also the vest's text panel), trousers, hi-vis vest and reflective bands |
| `liveries.bus` | City bus colours: `paint`, `white`, `glass`, `black`, `alloy`, `roof`, `head`, `tail`, `amber`, `display`, `displayText` |
| `liveries.tram` | Any `ARTIC_COLOURS` key in `src/tram-model.js`, plus `operator` (one or two short lines, `[]` for none), `logo`, `marks` and `fleet` lettering colours |

Use plain text and colours only. Do not copy a police force's crest, badge, coat of arms or an
operator's logotype: they are usually protected marks. The label, colour scheme and a generic
chevron pattern are enough to read as the local police. Base colours on your own photos or on
permitted references, and note the source in `liveries.note`.

## Step 5: review

Use the same area workflow ([EXTENDING.md](EXTENDING.md)): starts, `knownFor`, permitted reference
notes and a visual review of each checkpoint. Optional review tools can help, but are not required.
