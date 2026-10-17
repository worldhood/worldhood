# Oulu Cathedral visual pass

17 October 2026. Original procedural geometry replaces the generic 20 m extrusion
of `osm-way-28849152`. The mapped cruciform outline is retained for the main walls
and existing building collision. This is an implemented approximation, not a completed
recognisability review or a surveyed reconstruction.

## Sources inspected

- Leonhard Lenz, CC0, 5 January 2026: `commons/199558409.jpg`, frontal tower/entrance.
- Estormiz, CC0, 2 September 2025: `commons/174237270.jpg` and `174237272.jpg`,
  aerial massing, roof/dome, tower proportions, sides and entrance.
- Estormiz, CC0, 16 August 2022: `commons/124611181.jpg`, side view of the upper tower.
- City of Oulu [high-rise report](https://www.ouka.fi/media/8025/download), 2014:
  reported tower height **56.5 m**. Used as the total base-to-cross height reference;
  individual stages and other dimensions remain photo-based estimates.
- OpenStreetMap mapped footprint, ODbL 1.0. Photo authors, individual URLs and
  interpretation limits are recorded in `cathedral-sources.json`.

The cached municipal tile 212221 component 216 matches the footprint within about
0.41 m but has only 5.89 m vertical extent. It was rejected as a complete building/tower
height reference. No municipal Cathedral mesh was shipped as an accurate tower.
Reference photos remain local inputs, not runtime textures or redistributed source pixels.

## Changes from the generic shell

| Feature | Implemented |
| --- | --- |
| Massing | Mapped cruciform walls, ochre plaster and grey stone plinth |
| Nave/transept | Curved copper-coloured roofs, standing seams and pale curved end mouldings |
| Crossing | Octagonal raised drum, visible framed windows and shallow copper dome |
| Tower | Lower entrance block, stepped cornices, pilastered belfry and louvred arches |
| Clocks | Four outward-facing geometric faces, hour/minute strokes and static hands |
| Spire | Taller tapered square upper part, flared skirt and seam lines |
| Finial | Gilded ball and cross |
| Openings | Tall round-headed nave windows and framed tower windows |
| Entrance | Dark door, two white columns, capitals and triangular pediment |
| Ground contact | Masonry extends below the lowest boundary terrain; stairs and landing meet terrain |
| Obstacles | Separate projecting-stair footprint, alongside retained building collision |

## Remaining work for contributors

Fine clock numerals and hands, belfry louvre profiles, capitals, roof patina and exact
curvatures are simplified. Window placement/counts, rear/side ornament and smaller
entrances need a fuller survey. The fence, detailed boundary stairs, accessible route,
paths, lamps, trees and landscaping are not reconstructed as a finished churchyard.
The model is opaque and contains no interior. Colours depend on game lighting.
No independent local sign-off or full street-level review has been completed.
Valkea and the other city gaps remain in HANDOVER.md and gaps.json.

## Rebuild and verification

```sh
npm run place:build -- oulu cathedral
node --test tests/oulu-cathedral.test.mjs
npm test
npm run build
npm run dev
```

Open `http://localhost:5173/?city=oulu&start=oulun-tuomiokirkko`.

The model has **20,376 triangles and two merged meshes**. Regression tests cover the
source footprint, 56.5 m total height, finite bounded geometry, four exposed clock faces,
visible dome/drum glazing, actual-terrain wall contact and entrance-step collision.
The full suite has 690 tests. Build and browser results are recorded in the PR.
The visual/performance budget is a geometry count, not a measured cross-device benchmark.

Committed before/after captures in `docs/screenshots/oulu/` use identical camera poses;
the baseline omits this place registration to show the previous generic mapped shell.
The final browser check drives the Cathedral start about 24 m with no JavaScript or
console errors. Those checks do not establish accuracy of every street or traffic flow.
