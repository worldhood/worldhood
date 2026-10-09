# Adding a city

> **Quick path:** `npm run city:new` + `npm run city:build` builds any city from OpenStreetMap. See the
> [playbook](BUILD_YOUR_CITY.md). This page covers the deeper route: official city data and
> city-specific scenery.

The URL selects a city: `?city=helsinki&start=seurasaari-bridge` or `?city=tampere`.

## Step 1: register the city

`npm run city:build -- <id>` writes the city's entry to `public/cities/index.json`, which the game
reads at startup. Helsinki is the one built-in exception, listed in `src/cities.js`.

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
| `city.pack` | `buildings`, `roads`, `pavement`, `parks`, `water`, `trees`, `landmarks` (start points) |
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
- **Formats:** reuse `scripts/build-extension.mjs` (formats, de-duplication) and
  `scripts/prepare-world.mjs` (surface colours) as the reference implementations.

## Step 3: separate Helsinki's hand-built scenery

`src/main.js` uses the city's `scenery` setting to select Helsinki's landmarks and street details
or the generic scenery builder. Add place-specific models through that boundary. Shared systems
such as walking, riding, traffic, conversations, police and weather work across cities; keep their
rules in the shared engine. See [GAMEPLAY.md](GAMEPLAY.md).

## Step 4: review

Use the same area workflow ([EXTENDING.md](EXTENDING.md)): starts, `knownFor`, permitted reference
notes and a visual review of each checkpoint. Optional review tools can help, but are not required.
