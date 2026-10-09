# Third-party data and assets

The code is MIT-licensed (see [LICENSE](LICENSE)). The data and assets below keep their own licences.
Redistributions must keep these attributions. The game also shows them in its Sources panel.

## At a glance

| What | Licence | Files |
| --- | --- | --- |
| Source code, scripts, tests, docs | MIT | `src/`, `scripts/`, `tests/`, `docs/` |
| Original procedural models made for this project | MIT | `src/` |
| Senate pavilions model: geometry adapted from City of Helsinki 3D (see `public/models/senate-sources.json`) | CC BY 4.0, © City of Helsinki | `public/models/senate-pavilions.glb` |
| City of Helsinki map, 3D and imagery data | CC BY 4.0 | most of `public/data/` |
| HSL transit data | CC BY 4.0 | `public/data/trams.json`, `buses.json`, `bus-corridors.json` |
| OpenStreetMap-derived route outlines and landmark positions | ODbL 1.0 | `extensions/*/route.json`, `knownFor[].at` in `extensions/*/extension.json` |
| Cities built from OpenStreetMap (`npm run city:build`) | ODbL 1.0, © OpenStreetMap contributors | `public/cities/**`, `cities/*/city.json` |
| Street furniture positions from Mapillary map features (`npm run city:furniture`) | CC BY-SA 4.0, © Mapillary contributors | `public/cities/*/furniture.json` |
| Façade descriptions written from Mapillary street-level photos (`npm run facades:photos`) | CC BY-SA 4.0, © Mapillary contributors | `cities/*/facades.json`, `public/cities/*/facades.json` |
| Place descriptions written from current photos on Wikimedia Commons and Mapillary (`npm run photos:fetch`) | CC BY-SA 4.0 (the photos' licences: CC BY-SA 3.0/4.0) | `cities/*/*-reference.json`, `cities/*/*-sources.json` |
| Rectified photo textures of walls and paving (`npm run place:textures`), derived from the CC BY-SA 4.0 photos listed in the sources file | CC BY-SA 4.0, © the photographers (JIP, kallerna, MOs810 on Wikimedia Commons) | `public/cities/*/places/*/*.jpg` |
| City of Tampere open data (3D building parts, street parts, tree register, stops) used by `npm run place:build` | CC BY 4.0 | `public/cities/tampere/places/*.json` |
| Traffic signs, traffic lights, stops and regulation stretches from Digiroad (Finnish Transport Infrastructure Agency, Väylävirasto), used by `npm run city:furniture` for Finnish cities | CC BY 4.0 | `public/cities/*/furniture.json` |
| City of Tampere open data (pedestrian crossings, signalled junctions, public transport stops) used by `npm run city:furniture` | CC BY 4.0 | `public/cities/tampere/furniture.json` |
| Ground elevation (hills, lake and river levels) from the National Land Survey of Finland's Elevation model 2 m, via Mapterhorn terrain tiles, used by `npm run city:terrain` | CC BY 4.0 | `public/cities/*/terrain.pack` |
| Third-party marks | Not licensed | `public/branding/` |

**Forking for another city?** Keep the MIT notice for the code, replace `public/data` with your own
city's data under its licence, and update this file and the in-game Sources panel.

## Map and city data

- **City of Helsinki open geographic data and Helsinki 3D:** building footprints, textured LOD2 models,
  streets, pavements, parks, trees, coastline, traffic lanes and signals, and 2025 orthophotos.
  © City of Helsinki, City Survey Services / Urban Environment Division, licensed
  [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
  Machine-readable provenance: `public/data/provenance.json` and `public/data/extensions/index.json`.
- **HSL public transport data** (GTFS routes and stops for trams and buses): © HSL, licensed
  [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). See `public/models/tram-sources.json`
  and `public/models/bus-sources.json`.
- **HSL city-bike station positions:** from the public station feed. See
  `src/parked-micromobility.js`.
- **Digiroad** (traffic signs, traffic lights, public transport stops, speed limits, vehicle
  restrictions and bus lanes; `npm run city:furniture`): © Finnish Transport Infrastructure Agency
  (Väylävirasto), licensed [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), from the open
  interface at avoinapi.vaylapilvi.fi. Sign faces are drawn by the game from the sign descriptions; no
  sign artwork is copied.
- **City of Tampere open data** (pedestrian crossings, signalled junctions, bus and tram stops from
  geodata.tampere.fi; `npm run city:furniture`): © City of Tampere, licensed
  [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
- **Elevation** (`npm run city:terrain`; hills, lake and river levels): Finnish cities use the
  [Elevation model 2 m](https://www.maanmittauslaitos.fi/en/maps-and-spatial-data/datasets-and-interfaces/product-descriptions/elevation-model-2-m)
  © National Land Survey of Finland, licensed [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/),
  read from the keyless [Mapterhorn](https://mapterhorn.com) terrain tiles (terrarium encoding; see
  mapterhorn.com/attribution for the source of each area). Resampled to a 3 m grid, smoothed along
  streets and levelled on water.
- **Extension crop outlines and route centrelines:** derived from OpenStreetMap via OSRM and Nominatim.
  © OpenStreetMap contributors, licensed [ODbL](https://opendatacommons.org/licenses/odbl/).
  Used only to choose which municipal data to include.

- **Mapillary street-level imagery**: photos stay on Mapillary (downloads by `npm run photos:fetch` and
  `facades:photos` go to the git-ignored `data/raw/`). Written observations in `extensions/*/reference-notes.json` credit each image ID
  and photographer. Mapillary imagery is licensed
  [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).
- **Mapillary street-level photos for façades** (`npm run facades:photos`): photos are downloaded
  only to the git-ignored `data/raw/mapillary/` for looking at and are never committed. Colours,
  storeys, window rhythm and shop-front types are written in our own words into
  `cities/*/facades.json`, which lists the image ids and capture dates used per building.
  © Mapillary contributors, [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/);
  `facades.json` is shared under the same licence. The city's Sources panel credits Mapillary.
- **Mapillary map features** (cities built with a `MAPILLARY_TOKEN`): positions and types of lamp
  posts, traffic lights, road signs, bins, junction boxes and other street furniture that Mapillary's
  computer vision detected in contributors' street-level photos, filtered and moved off the carriageway
  by `scripts/mapillary-features.mjs`. Each object in `public/cities/*/furniture.json` lists the
  Mapillary map feature ids it came from. © Mapillary contributors, licensed
  [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/); `furniture.json` is shared under
  the same licence. The city's Sources panel credits Mapillary.

- **Reference photos for places** (`npm run photos:fetch`, e.g. Keskustori in Tampere): current
  photos from Wikimedia Commons (each under its own licence, mostly CC BY-SA 4.0) and Mapillary
  (CC BY-SA 4.0) are downloaded only to the git-ignored `data/raw/photos/` for looking at and are
  never committed. A few of them are rectified (perspective-corrected) into wall and paving textures
  (`npm run place:textures`, `public/cities/*/places/<place>/*.jpg`); those textures are derivatives
  of CC BY-SA 4.0 photos and are shared under CC BY-SA 4.0 with the photographer credited (the
  sources file lists which photo each texture comes from). Everything else about the square's paving, trees, tram stop, lamps and landmarks are
  described in our own words in `cities/*/<place>-reference.json`; every photo used is listed with its
  author, licence, capture date and use in `cities/*/<place>-sources.json`. Keskustori credits:
  JIP, Drefer, kallerna, MOs810, Piquito and Tiia Monto (Wikimedia Commons) and jopparn (Mapillary).
  The reference files are shared under CC BY-SA 4.0. Google imagery is never used.
- **City of Tampere open data** for places: 3D building parts (heights), street parts (paving areas),
  the tree register (species, height class, girth) and public transport stops from
  geodata.tampere.fi, © City of Tampere, [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).

- **Cities overview map:** country outlines from [Natural Earth](https://www.naturalearthdata.com), public domain.

## Assets

- **Granite material:** [Poly Haven Granite Tile 03](https://polyhaven.com/a/granite_tile_03), CC0.
- **Route trees:** [EZ-Tree](https://github.com/dgreenheck/ez-tree) by Daniel Greenheck, MIT. See
  `public/models/tree-credits.txt`.
- **Landmark references:** the per-landmark source files in `public/models/*-sources.json` list
  references, licences and what is measured versus interpreted. Reference photographs are not
  embedded in the game.

## Logos

- `public/branding/helsinki-logo-white.svg`: the City of Helsinki logo, from the
  [Helsinki Design System](https://github.com/City-of-Helsinki/helsinki-design-system). It is a
  trademark of the City of Helsinki and is not covered by this project's licence.
- `public/branding/bind-logo.svg`: the Bind wordmark ([bindlegal.com](https://bindlegal.com/)), used for
  fictional in-game advertising with permission. It is a trademark of Bind and is not covered by this
  project's licence.

If you fork this project, replace or remove these logos unless you have your own permission.
