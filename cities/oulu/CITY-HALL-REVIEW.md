# Oulun kaupungintalo — 2026-10-15 visual pass

The old game rendering was a generic 10 m extrusion with a photo-informed wall colour.
The replacement is original geometry on the OSM footprint, including both inner courtyard rings.

## Measured and interpreted geometry

The cached City of Oulu municipal tile **212221**, component **226**, registers against the mapped
City Hall footprint with a maximum bounding-edge difference of **1.759 m**. Its legacy LOD1 shell
is **16.4733 m** high. The converted source vertices/triangles and provenance are retained in
`city-hall-model.json`; `scripts/oulu-city-hall-source.mjs` reproduces the extraction without
executing downloaded JavaScript. The municipal reference is CC BY 4.0 and credited in NOTICE.md
and the game registry. It is a height/registration reference, not a detailed current roof survey.

The custom model uses that shell height for the main mass. Facade proportions, cornice levels,
hip roofs, pavilion drums, rounded square roof caps, skylights, finials and all ornament are
photo-based estimates. The finials reach about 29 m above the model base; that height is not
claimed as a municipal measurement. Detailed source mesh triangles are retained as evidence;
the runtime facade is independently constructed geometry on the OSM outline.

The original foundation/base elevation is retained for provenance, but the source's vertical
datum is unconfirmed. The rendered base uses the shared terrain at the entrance stair foot,
preventing the lower steps being buried beneath the coarse terrain. Garden lamps and benches
use the terrain elevation at their own positions. These are registration choices, not a new
elevation survey.

## Differences addressed

| Feature | Previous rendering | New rendering |
| --- | --- | --- |
| Main mass | Default 10 m block | Municipal-height reference with two preserved courtyard holes |
| Front | Generic repeated windows | Three arched entrances, three tall central window bays, four pale pilasters and distinct wing windows |
| Lower facade | Flat wall colour | Rustication courses and pale horizontal bands |
| Upper window detail | Generic rectangles | White surrounds, segmental hoods, mullions and circular openings |
| Roof silhouette | Generic cap | Hip roof strips and two raised glass courtyard skylights |
| Twin roof pavilions | Missing | Paired square drums, rounded caps, crossed circular glazing, railings and decorative finials |
| Centre roof detail | Missing | Balustrade, mast and deliberately simplified original crest symbol |
| Rooftop services | Missing | Simplified enclosure and fan units visible in the 2025 aerial photo |
| Entrance | Missing broad stair | Thirteen risers with four handrail runs and a matching collision footprint |
| Garden furniture | Missing | Three multi-arm lamps, two entrance planters and two benches with collisions |
| Rear | Uniform generic block | Separately interpreted pink neo-Gothic facade and central gable |

## References and comparison

The 2025-03-30 Estormiz aerial photograph and the user's 2025-04-06 front photograph are the
main references. Five further CC0 views were downloaded, including a 2017 frontal view and
2025 roof aerial. The 2026 pink facade photograph guides the rear elevation, which differs from
the ochre front. Full source URLs, authors and licences are in `city-hall-sources.json`.
No photo pixels, bystanders, temporary window displays or signage artwork are copied into the model.

```powershell
node scripts/oulu-municipal-download.mjs
node scripts/oulu-city-hall-source.mjs
npm run place:build -- oulu city-hall
npm run place:compare -- oulu city-hall --label=hall-final --look=Overcast
node --test tests/oulu-city-hall.test.mjs
```

Comparison camera positions, elevated eye height and lens field of view remain estimates.
The owner's photograph was taken through a cafe window; cafe furniture and glazing are not
part of the City Hall exterior reconstruction. Live screenshots and console report are under
`data/raw/oulu-review/city-hall-*`; side-by-side images are under
`data/raw/place-compare/oulu/city-hall/`.

## Remaining limits

Fine sculpted relief, exact cornice profiles, roof patina, crest details, side elevations and
rear ornament are simplified. Window counts and dimensions are interpreted, not surveyed.
The central lamp is aligned to the centre of the mapped split planting bed; the two smaller
lamps, benches and planters have estimated positions from the front photos. The garden's full
planting, trees, fence, paving and surrounding blocks remain provisional. Oulu remains a draft.

## Validation

The floating-wall correction extends the masonry foundation beneath the lowest sampled
terrain around the exterior and both courtyard boundaries, while keeping the facade level.
Stair and planter supports also continue into the terrain. A regression test raycasts each
wall at one-metre intervals just above the actual Oulu terrain; all three City Hall tests pass.
The production build passes with the existing chunk warning, and the browser loads and drives
without console errors after this correction.

All **686 tests** passed, including source registration, courtyard openings, finite geometry,
paired pavilions, rear-window visibility and projecting stair collisions. The model stays below
60,000 triangles and six meshes. The production build passed with the existing large-chunk warning.
The City Hall start loaded, the car moved about 22 m, and front/entrance/rear browser views reported
no JavaScript or console errors. No GitHub push or deployment was performed.
