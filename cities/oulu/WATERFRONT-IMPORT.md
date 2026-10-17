# Theatre and library municipal import

Imported locally on 2026-10-15. The game now uses actual municipal mesh triangles for Oulu Theatre
and Central Library Saari, replacing their generic OSM renderings. This is a legacy LOD1 import with
photo-guided additions, not a detailed scan or completed street reconstruction.

## Downloaded sources

- [City of Oulu download and licence page](https://api.ouka.fi/3d/index_en.html): CC BY 4.0.
  Its notice says the material is no longer updated; last listed update is 2017-08-10.
- [Tile 212221 SketchUp archive](https://api.ouka.fi/3d/Mallit/212221.skp.zip): 55,899,030 bytes.
  Retained in `data/raw/cities/oulu/municipal-3d/212221.skp.zip`.
- [The same tile's browser preview](https://api.ouka.fi/3d/Mallit/212221.html): mesh literals are
  converted without executing any downloaded JavaScript. Original SketchUp data is retained locally.
- Full URLs, file sizes and SHA-256 hashes: `data/raw/cities/oulu/municipal-3d/download-manifest.json`.
- The neighbouring 212134/212143 tiles were inspected while identifying coverage. They are not
  imported into the game. No aerial photo textures are bundled in this import.

## Geometry and registration

`scripts/oulu-municipal-import.mjs` extracts components 240 (theatre) and 508 (library).
The SKP georeference supplies the origin. Centimetre coordinates in the GK26 grid are transformed
to the game's local projection. Matching the imported geometry to the separately mapped OSM
footprints provides a registration check, rather than manually placing an unrelated model.

| Building | Imported vertices / triangles | Source shell height | Largest bounding-edge difference from OSM |
| --- | --- | --- | --- |
| Theatre | 30 / 43 | 14.3844 m | 3.016 m |
| Library | 8 / 10 | 14.0533 m | 0.312 m |

The library's front is 54.27 m wide, consistent with the city's
[54 m architectural description](https://www.ouka.fi/en/libraries/history-and-architecture-central-library-saari).
These heights belong to the old LOD1 shells; they are not new measurements of current roof structures.
The legacy page does not explicitly establish the vertical datum. Source base elevations are retained,
and small differences from the game's terrain remain possible.

Base edges of the municipal meshes form the collision rings, including the theatre's concave outline.
The originals are hidden and their gameplay collision footprints replaced. This prevents using a
different footprint for the visible municipal shell and collisions. Municipal elevation groups are
excluded from terrain draping so their measured vertical shape is preserved.

## Photo-guided additions

The downloaded [CC0 theatre photo from 2026-04-03](https://commons.wikimedia.org/wiki/File:Oulu_City_Theatre_20260403.jpg)
and [CC0 library photo from 2026-01-06](https://commons.wikimedia.org/wiki/File:Oulu_Central_Library_Saari_20260106.jpg),
both by Estormiz, guide original facade geometry. Two CC0 theatre photographs from 2021-10-31 provide
additional SW/rear views. See [waterfront-sources.json](waterfront-sources.json).

- Library: transparent glazing grid, metal framing, recessed ground floor, columns and visible floor plates.
- Theatre: SW ribbon-window facade, small-window annex and stair glazing; NE entrance curtain wall,
  recessed colonnades and SE concrete panel joints and ventilation fins.
- Theatre stage-house roof: curved outline and an additional **estimated** 6 m volume, because the
  municipal LOD1 mesh omits it. This addition is not claimed as municipal or measured geometry.

Window counts, facade colours, door positions and stage-house proportions are estimates.
Additional CC0 photographs were downloaded and inspected locally: Estormiz's 2018-10-07 exterior
and 2023-12-10 colonnade photographs, and Leonhard Lenz's 2026-01-05 entrance and concrete-facade
views (04/05). Their URLs and licences are recorded in waterfront-sources.json. The rounded stage
uses 48 short curve segments with a continuous pale band. Selected blank source facade triangles
are omitted at render time to expose recessed glazing; source data and collision outlines remain
unchanged. Glass materials are local to these additions, so other city buildings are unaffected.

Unobserved elevations, precise interior details, entrance lettering, terrace steps, quay detailing,
the library garden and modern furniture still need further matching. Event lighting in the night
photographs is not treated as permanent facade colour. Original photos are not copied into game textures.

## Reproduce and review

```powershell
node scripts/oulu-municipal-download.mjs
node scripts/oulu-municipal-import.mjs
npm run place:build -- oulu waterfront
npm run place:compare -- oulu waterfront --label=municipal --look=Overcast
npm run place:compare -- oulu waterfront --label=cc0-refined --look=Overcast
```

Normal `city:build` rebuilds the registered waterfront place from the committed model description;
it does not require re-downloading the original archives.

Tests check geographic registration, known facade width, metre scale, finite geometry, valid triangles,
closed collision outlines and a rendering budget. The production build and all **682 tests** pass.
Browser checks and visual comparisons are stored under:

- `data/raw/oulu-review/waterfront-browser-check.json`
- `data/raw/oulu-review/waterfront-start-3.png` and `waterfront-start-4.png`
- `data/raw/place-compare/oulu/waterfront/municipal-Oulu_Central_Library_Saari_20260106.jpg`
- `data/raw/place-compare/oulu/waterfront/municipal-Oulu_City_Theatre_20260403.jpg`

Comparison cameras are approximate. The source photos are winter/spring views; the game has no
matching snow reconstruction. Oulu remains a draft. No GitHub push or deployment was performed.
