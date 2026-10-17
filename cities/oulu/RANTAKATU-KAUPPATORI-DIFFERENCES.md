> Submission update, 17 October 2026: Toripolliisi geometry and collision are excluded pending artwork permission. Statue descriptions below document an earlier local experiment. See [HANDOVER.md](HANDOVER.md) for current status and unfinished landmarks, including Valkea.

# Rantakatu and Kauppatori: photo differences

Reviewed 2026-10-14. The initial game view had a generic grey Market Hall, no Toripolliisi,
generic nearby buildings, incomplete square paving and no reference-guided trees or furniture.
The changes below are implemented locally. **They are photo-guided approximations, not a claim
that every detail now matches exactly.** Oulu remains a draft.

Sources: **O** = your `Oulu police statue.jpg`, 2025-06-24; **B** = your `Oulu new bus color.jpg`,
2026-02-22; **H** = Estormiz's CC0 Market Hall front photograph, 2025-01-16; **S** = CC0 side
photograph, 2025-05-20; **D** = CC0 detail photograph, 2025-03-09; **N** = CC0 Rantakatu photograph,
2024-11-26. Links, licences and map IDs are in [market-sources.json](market-sources.json).
Your original files remain under `data/raw/photos/oulu/own/`; they are not game assets.
The Google Street View attachment was not used to derive these models, following
[BUILD_YOUR_CITY.md](../../docs/BUILD_YOUR_CITY.md).

## Market Hall buildings and colours

| ID | Difference in the initial game | Change and remaining limit |
| --- | --- | --- |
| H01 | Plain grey box rather than red brick (H/S) | Replaced the rendered box with an original landmark on the OSM footprint. |
| H02 | Smooth untextured wall (D) | Added procedural brick courses, staggered joints and brick colour variation; estimated brick dimensions. |
| H03 | Missing pale lower wall panels (S) | Added cream rectangular panels above the base. |
| H04 | Generic rectangular windows (S/D) | Added tall pointed arches. |
| H05 | Wrong dark window/frame palette (S/D) | Green openings with pale mullions; colours are estimates under game lighting. |
| H06 | Generic window spacing (S) | Repeated 14 interpreted bays on the visible long side; the count/proportions still need verification. |
| H07 | Missing horizontal/vertical glazing divisions (D) | Added window mullions and crossbars. |
| H08 | Flat wall without projecting brick piers (S) | Added piers between bays. |
| H09 | Missing pale pier caps and round ornaments (S/D) | Added caps and finials. |
| H10 | Missing floral relief around lamps (D) | Added simplified pale rosettes. Exact carved relief is still different. |
| H11 | Missing wall-bracket lamps (S/N) | Added black brackets and pale round globes. Night illumination remains approximate. |
| H12 | Generic low roof (H/S) | Added dark metal roof slopes; interpreted eaves and pitch. |
| H13 | No standing seams (S) | Added thin roof seams. |
| H14 | No raised glazed roof strip (S) | Added a long green clerestory. |
| H15 | Missing diagonal clerestory glazing (S) | Added pale diagonal glazing bars. |
| H16 | Missing clerestory roof cap (S) | Added its separate dark pitched cap. |
| H17 | Missing ridge railing and curls (H/S) | Added thin railing and repeated half-circle curls. Exact ironwork is simplified. |
| H18 | Missing pale roof vents/finials (S) | Added four simplified vents; dimensions/positions are estimates. |
| H19 | No tall entrance gable or corner piers (H) | Added a raised entrance facade and tall brick piers with pale caps. The curved historic gable profile is still simplified. |
| H20 | No large entrance arch/glazing (H) | Added pointed pale surround, large green window and glazing grid. |
| H21 | No entrance doors (H) | Added dark green doors under the entrance window. Door leaf detailing remains simplified. |
| H22 | Missing hall name sign (H/OSM name) | Added original canvas lettering `KAUPPAHALLI`; exact lettering and curvature remain different. |

## Pink Rantakatu house behind your statue photo

| ID | Difference in the initial game | Change and remaining limit |
| --- | --- | --- |
| J01 | Generic facade instead of pink timber (O) | Replaced Jurveliuksen talo, OSM way 94507906, with a pink timber landmark. |
| J02 | No horizontal boarding (O) | Added narrow horizontal courses. |
| J03 | Generic windows/frames (O) | Added tall white-trimmed windows with glazing bars. Nine bays are an interpretation, not a verified full count. |
| J04 | Missing pediments and cornice (O) | Added window pediments, white cornice, corner pilasters and capitals. Fine moulding is simplified. |
| J05 | Flat generic roof (O) | Added a grey pitched roof, gable windows and white fascia. Unseen roof sections remain provisional. |
| J06 | Missing roof chimneys (O) | Added two grey chimneys; locations and heights are estimates. |

## Toripolliisi

| ID | Difference in the initial game | Change and remaining limit |
| --- | --- | --- |
| T01 | Statue absent (O/H) | Added an original procedural sculpture at OSM node 576296537. |
| T02 | No known sculpture scale | Used 2.20 m excluding the plinth, supported by OSM and MunOulu. |
| T03 | Missing stone plinth (O) | Added a low grey stone plinth and dark bronze base. Dimensions are estimates. |
| T04 | Missing broad coat/body silhouette (O) | Added a broad tapered coat and stocky proportions; sculpture anatomy remains stylised. |
| T05 | Missing peaked cap and visor (O) | Added cap and projecting visor. |
| T06 | Missing head/face (O) | Added head, ears, nose, eye and mouth relief. It is not an exact sculptural likeness. |
| T07 | Missing shoulder strap/buttons (O) | Added diagonal strap and a button row. |
| T08 | Missing belt/buckle (O) | Added a wraparound belt and buckle. |
| T09 | Missing arms, cuffs, legs and boots (O) | Added hanging arms/hands, short legs and rounded boots. |
| T10 | No bronze finish (O) | Added grey-green bronze colour and metallic response; ageing/patina texture is approximate. |

## Surfaces

| ID | Difference in the initial game | Change and remaining limit |
| --- | --- | --- |
| S01 | Incomplete paved-square coverage | Added OSM pedestrian area 50118176 and Kauppahallinaukio boundary 27690320. |
| S02 | Generic grey paving without rectangular courses (O/S) | Added small grey rectangular pavers in running bond. Stone size is estimated. |
| S03 | Missing rose-coloured paving bands (O) | Added rose bands; 6 m repetition and alignment are estimates, not a surveyed layout. |
| S04 | Missing rose fan-pattern setts at the statue (O) | Added a local rose granite fan-pattern patch. Patch extent is estimated. |
| S05 | Generic Kauppurienkatu surface | Retained mapped sett geometry and applied the sett pattern. |
| S06 | Paving drawn without being in the gameplay pavement index | Added authored paving to the pavement index so inspection/walking checks see it. |
| S07 | Snow, ice, wetness and dirt differ between reference dates (H/N/B) | Kept these as seasonal/weather differences, rather than baking winter conditions into the summer plaza. Exact winter appearance is not implemented. |

## Trees, signs and street furniture

| ID | Difference in the initial game | Change and remaining limit |
| --- | --- | --- |
| F01 | Missing two slender street trees along the hall (S/N) | Added two branched bare trees at photo-estimated positions/heights. Species is unknown. |
| F02 | Missing young leafy tree by the pink house (O) | Added a narrow leafy tree. Height, crown and position are estimates; species is unknown. |
| F03 | Missing tree grates (O/S) | Added dark square grates. Exact guard hardware is not reproduced. |
| F04 | Missing bicycle racks by the hall (S/N) | Added ten black racks with matching collision strips. Exact rack shapes/count/positions remain approximate. |
| F05 | Missing cafe crossbar railings (O) | Added four black crossbar panels with narrow rotated collision footprints. Terrace layout is estimated. |
| F06 | Missing litter bin near the hall (H/N) | Added a grey bin with dark top; placement and dimensions are approximate. |
| F07 | Missing blue/red no-parking sign (O/H) | Added the Finnish no-parking face and metal post. Placement is estimated; small supplementary plates remain unverified. |
| F08 | Missing blue parking sign (N) | Added a blue `P` sign and post; position is estimated. |

## Buses from your owner photograph

| ID | Difference in the original city draft | Change and remaining limit |
| --- | --- | --- |
| B01 | Shared blue HSL paint rather than pink (B) | Pink paint was already corrected in the preceding pass and is retained. |
| B02 | Shared HSL circle motif (B) | Removed from Oulu city buses in the preceding pass; retained that correction. |
| B03 | Split windscreen with central divider (B) | Oulu now uses a single front windscreen. |
| B04 | Rectangular front lights (B) | Added three circular lights per side. |
| B05 | Missing black front light strip (B) | Added the dark strip around the front lamps. |
| B06 | Missing operator marking (B) | Added original canvas lettering and a simplified ring mark for `Oulun seudun liikenne`. Typography/mark geometry are approximate. |
| B07 | Missing manufacturer badge (B) | Added original `BYD` lettering in an oval badge. It is a simplified drawing, not a copied logo image. |
| B08 | Generic complete bus body | Still a generic body with a photo-guided front. The photo does not establish the full door layout, side/rear geometry, roof equipment or dimensions. No exact manufacturer model is claimed. |
| B09 | Missing lower round fog lamps (B) | Added round lower lamp fittings with dark surrounds. The unshown side uses a mirrored estimate. |
| B10 | Short upright wipers instead of broad slanted arms (B) | Added wider slanted wipers to the Oulu front. Wiper geometry is simplified. |

## Differences that remain open

- The hall's exact carved masonry, curved gable profile, all window counts, dimensions and unseen annexes.
- Exact stone-band layout, pavement patch boundaries, manholes, drainage grates and road-marking positions.
- Exact tree species, surveyed tree/rack/sign/bin/terrace positions, supplementary sign wording and cafe signs.
- The adjacent cream buildings, hotel/annex, wider market kiosks, warehouse facades, theatre and library.
  The inspected owner/CC0 frames do not establish all of their current elevations. They remain draft buildings.
- Full BYD bus geometry and the rest of Oulu's fleet. The supplied close-up establishes the visible front,
  not the whole vehicle or fleet.
- Temporary scaffolding, parked vehicles, construction barriers, bicycles, cafe chairs and people vary
  with the capture date. The game retains simulated traffic/people; it does not duplicate photographed people.

## Validation and comparisons

The complete test suite passes **680 tests**; production build passes with the existing bundle-size warning.
The market browser check starts successfully, records no JavaScript/shader errors, and drives approximately
41 m from the Rantakatu start. Model tests check finite geometry, a 60,000-triangle budget, a 20-mesh
geometry budget (canvas signs add their own small draws), colliders and invalid paving coordinates.
The mapped building footprints remain the hall/house collision boundaries. Existing mapped trees are preserved.

Local evidence:

- `data/raw/place-compare/oulu/market/draft-158320345.jpg` — initial generic hall.
- `data/raw/place-compare/oulu/market/review-158320345.jpg` — hall/front comparison.
- `data/raw/place-compare/oulu/market/review-165928231.jpg` — hall/side comparison.
- `data/raw/oulu-review/market-statue-owner-comparison.jpg` — game beside your statue photograph.
- `data/raw/oulu-review/bus-owner-comparison.jpg` — bus beside your bus photograph.
- `data/raw/oulu-review/market-browser-check.json` — movement and browser errors.

The comparison cameras have approximate headings and eye heights; the statue camera is adjusted because
the owner geotag does not reproduce the source framing. Overcast is used for the new architecture/statue
comparisons, reducing colour differences caused by the game's sunny lighting. The sources were photographed
in different seasons. These images demonstrate progress and expose remaining differences; they are not sign-off.

Rebuild: `npm run place:build -- oulu market`. A full `city:build` also rebuilds the registered place.
Comparison: `npm run place:compare -- oulu market --label=review --look=Overcast`.
The optional `node scripts/oulu-market-reference.mjs` regenerates reference paving from the cached OSM
XML downloads; it is an authoring tool, not required for an ordinary place rebuild.
