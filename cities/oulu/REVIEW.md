# Oulu draft review

Built locally on 14 October 2026, following the city playbook. The map is playable;
the photo-matching, recognisability review and local sign-off stages are pending.
This remains unfinished and is submitted only as a draft for maintainer feedback, not publication.

## Owner-photo visual pass

The photographer confirmed ownership and authorised project-reference use. All 30
originals were hash-verified and archived in `data/raw/photos/oulu/own/`; the copies
formerly in the generated public folder are preserved in its `public-originals/`
subfolder. Camera dates and positions were recovered from EXIF and recorded in
[own-photo-sources.json](own-photo-sources.json). Fourteen camera locations fall
inside the current circle and sixteen outside it. Only three selected photographs
were visually interpreted in this first pass; the rest are catalogued for follow-up.

- City buses now use approximate pink paint observed in `Oulu new bus color.jpg`,
  with the shared HSL-style circle motif disabled. The body remains the generic
  shared bus model: [bus comparison](../../data/raw/oulu-review/bus-owner-comparison.jpg).
- City Hall now has an owner-photo-backed ochre wall colour:
  [comparison](<../../data/raw/place-compare/oulu/own/owner-update-Oulu city hall.jpg>).
- Isokatu 37 now has an owner-photo-backed tan-brick wall colour:
  [comparison](<../../data/raw/place-compare/oulu/own/owner-update-Isokatu infront of veripalvelu Oulu.jpg>).
  Its source geotag is inside the mapped Isokatu 32 shell, so the game capture camera
  was moved approximately 9 m toward the street to clear the unmodelled interior.

These are colour/material observations, not claims of measured heights or exact
window placement. Existing placeholder bays remain explicitly provisional, and
colours are retained across source shells and distance levels. No photo pixels,
faces, vehicle number plates or shop logos were turned into runtime textures.

Regenerate the owner-photo pairs with:

```sh
npm run facades:ship -- oulu
npm run place:compare -- oulu own --label=owner-update
```

The raw originals are not bundled by the production build. The user's permission
has not been represented as a Creative Commons licence.

## Play

- [Market Hall](http://localhost:5173/?city=oulu&start=kauppahalli)
- [Cathedral](http://localhost:5173/?city=oulu&start=oulun-tuomiokirkko)
- [City Hall](http://localhost:5173/?city=oulu&start=oulun-kaupungintalo)
- [Theatre](http://localhost:5173/?city=oulu&start=oulun-teatteri)
- [Central Library Saari](http://localhost:5173/?city=oulu&start=oulun-keskustakirjasto-saari)
- [Railway station](http://localhost:5173/?city=oulu&start=oulun-rautatieasema)
- [Oulu station automatic start](http://localhost:5173/?city=oulu&start=oulu)
- [Sailor's Home Museum](http://localhost:5173/?city=oulu&start=merimiehenkotimuseo)

The 1.5 km circle contains 3,748 buildings, 44 mapped water areas, 991 mapped trees,
238 traffic signals and 194 transport stops. The terrain grid is 3 m, sampled from
available zoom-14 Mapterhorn tiles at approximately 2.02 m per source pixel.
Source credits are in the game's Sources panel and [README](README.md).

## Validation

- All **677 tests passed**, including regression checks for City Hall and Oulujoki
  multipolygon geometry and Windows traffic-data paths.
- Added coverage for colour-only observations retaining provisional geometry,
  observed colours surviving distance levels, and Oulu buses omitting the shared
  HSL circle motif. The build and owner-photo capture scripts also passed.
- `npm run build` passed. Vite reports the existing large-bundle warning.
- Browser startup completed with no console errors. Every start was selected through
  the map and driven for three seconds, moving approximately 39–41 m without a page
  error. This is a smoke check, not a survey of every road.
- Terrain built successfully: 1251 × 1251 cells, approximately 913 kB compressed,
  elevation −0.8 to 22.9 m inside the playable circle, no road-grade spikes over 12%.
- The four-point traffic simulation **needs work**: 37 stalled episodes over 831.9
  vehicle-minutes, or 4.45 per 100 against a passing threshold of 2; zero deadlocks
  and one car–bus overlap. See [traffic details](../../data/raw/oulu-review/traffic-check.txt)
  and [gaps](gaps.json). No shared gameplay changes were made to hide these findings.

## Reference comparisons

These earlier pairs show the initial OSM draft beside permitted source photos. They are
gap evidence, not a recognisability sign-off. Camera positions use source geotags;
heading, pitch and height above ground are estimated. The draft has provisional
window grids and flat roof extrusions, which still need source-backed replacement.

The images are local, ignored review artifacts. Recreate them with the commands
below after fetching the photos.

### Market Hall

[Comparison image](../../data/raw/place-compare/oulu/market/draft-158320345.jpg).
Reference: [Estormiz, 16 January 2025, CC0](https://commons.wikimedia.org/wiki/File:Oulu_Market_Hall_20250116.jpg).
The red brick, arched openings, entrance gable, roof glazing and Toripolliisi statue
remain absent from the draft's generic shell.

### Cathedral

[Comparison image](../../data/raw/place-compare/oulu/cathedral/draft-199558409.jpg).
Reference: [Leonhard Lenz, 5 January 2026, CC0](https://commons.wikimedia.org/wiki/File:Oulun_tuomiokirkko_Oulun_vanha_monumentaalikeskus_ja_Franz%C3%A9nin_puisto_Oulu_2026-01-05_02.jpg).
The [Cathedral visual pass](CATHEDRAL-REVIEW.md) now implements the stepped tower, four
clocks, square spire, crossing dome/curved roofs, white entrance columns and front steps.
Fine profiles, side/rear details and churchyard validation remain pending. The linked
comparison is the original generic-shell baseline.

### City Hall

[Comparison image](../../data/raw/place-compare/oulu/city-hall/draft-162968278.jpg).
Reference: [Estormiz, 30 March 2025, CC0](https://commons.wikimedia.org/wiki/File:Oulu_City_Hall_20250330_01.jpg).
The [City Hall visual pass](CITY-HALL-REVIEW.md) now supplies paired roof pavilions and finials,
the central pilastered facade, three entrance arches, stairs, lamps and benches. It retains both
mapped courtyards and uses a municipal LOD1 height reference. Fine relief, side/rear ornament
and the full garden remain provisional. The comparison above is the original draft baseline;
current artifacts use the `hall-final` label.

```sh
npm run photos:fetch -- oulu market
npm run photos:fetch -- oulu cathedral
npm run photos:fetch -- oulu city-hall
npm run place:compare -- oulu market --label=draft
npm run place:compare -- oulu cathedral --label=draft
npm run place:compare -- oulu city-hall --label=draft
```

135 recent Commons photos were downloaded across the three acquisition plans;
three selected photos were inspected for the recorded landmark notes. Panoramax
returned no images in these search areas. Mapillary and TypeSafe keys are absent,
and the current automated area-review script only supports extension areas.

## Remaining work

The full [gap list](gaps.json) and source-backed [observations](reference-notes.json)
are saved beside the city definition. Next, validate traffic hotspot geometry and
collect permitted street references for Saaristonkatu, Torikatu, Kirkkokatu,
Aleksanterinkatu, Hallituskatu and Kaarlenväylä before changing street appearance.
Measured heights, local bus liveries, furniture, signage, tree species, landmark
details and lighting still require checks. The city stays `draft` until the
playbook's automated/manual reviews and local sign-off are satisfied.

## Build repairs made while adding Oulu

- Forward city arguments correctly through `npm run city:build`.
- Retry Overpass downloads without a Unix-only `sleep` executable.
- Request and repair missing multipolygon members in old map caches.
- Resolve traffic fixture paths correctly on Windows.
- Allow a city to select an available terrain zoom, and use installed Chrome for
  WebP decoding when the bundled Playwright executable is missing.
- Keep photo-only acquisition plans out of place-model generation.
- Preserve full portrait reference photos and captions in comparison images.
- Keep buildings opaque in fixed reference-camera captures; the normal driving
  camera retains its building fade.

## Rantakatu and Kauppatori follow-up

The [63-item difference checklist](RANTAKATU-KAUPPATORI-DIFFERENCES.md) now records the
Market Hall, pink timber house, Toripolliisi, paving, trees, furniture, signs and bus-front changes.
The models use OSM footprints and permitted reference photos, with estimated proportions explicitly
documented. This is an implemented approximation, not completed recognisability sign-off.
The production build and 680 tests pass; the market browser drive records no JavaScript/shader errors.

## Municipal waterfront import, 2026-10-15

Theatre and Library Saari now use actual municipal shell meshes from tile 212221, with source
collision outlines and separately documented photo-guided details. See [WATERFRONT-IMPORT.md](WATERFRONT-IMPORT.md).
The production build and 682 tests pass. Both waterfront starts drive approximately 40 m in three seconds;
the browser check records no JavaScript/shader/console errors. Importing a place that replaces every
building in one streamed tile also exposed an empty-array `Group.add()` warning; that case is now handled.

All changes are local. No GitHub push, pull request or deployment was created.

## Contribution checkpoint, 17 October 2026

Toripolliisi geometry and its collision obstacle are excluded pending artwork permission.
Earlier review notes describing that model are historical. The local version is retained
in an unpushed backup branch. The draft still needs recognisability and traffic review.

## Cathedral follow-up, 17 October 2026

See CATHEDRAL-REVIEW.md for inspected CC0 sources, the city-reported tower height,
implemented features, remaining limitations and regression checks. The original mapped
outline is retained; a separate stair collision and terrain-supported foundation are included.
The full suite now contains 690 tests. This is still an approximate draft landmark.
