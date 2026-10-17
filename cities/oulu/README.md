# Oulu — draft city

Local preview: http://localhost:5173/?city=oulu

See [the review report](REVIEW.md) for the owner-photo colour pass, comparison
images and remaining draft gaps. Owner originals are archived in
`data/raw/photos/oulu/own/`, with provenance in `own-photo-sources.json`.

The playable circle has a 1,500 m radius around the centre returned by
Nominatim: 25.47020 E, 65.01179 N. Buildings, mapped streets and surfaces,
water, parks, trees, traffic signals and transport routes come from
OpenStreetMap. Heights without mapped values are estimates, not measurements.
The city remains `draft` until a local checks it against the publishing bar
in [BUILD_YOUR_CITY.md](../../docs/BUILD_YOUR_CITY.md).

## Rebuild and check

```sh
npm run city:build -- oulu
npm run dev
npm run traffic:check -- oulu
npm test
npm run build
```

The six requested landmark starts are snapped onto nearby drivable surfaces.
The build can add two more automatically. Press **M** to select another start,
**C** for the overview camera, and **R** to reset the car.

## Reference work

```sh
npm run photos:fetch -- oulu market
npm run photos:fetch -- oulu cathedral
npm run photos:fetch -- oulu city-hall
```

The `*-reference.json` files marked `referenceOnly` are photo acquisition plans,
not finished place models. They remain excluded from `place:build` until actual
reference observations and the required modelling fields are supplied.
Downloads and their author/licence catalogues are in the ignored
`data/raw/photos/oulu/` folder. Do not commit raw downloads.

## Sources and remaining gaps

- Map data: [OpenStreetMap contributors](https://www.openstreetmap.org/copyright), ODbL 1.0.
- Geocoding: Nominatim / OpenStreetMap; landmark coordinates come from the
  OSM objects linked in `city.json`.
- Elevation: National Land Survey of Finland, Elevation model 2 m, CC BY 4.0,
  through Mapterhorn, if the terrain build succeeds. The runtime registry records
  whether terrain is present.
- Reference photographs: Wikimedia Commons and any available Panoramax coverage;
  each used photograph must retain its catalogue's author and individual licence.
- [Oulu's official model](https://api.ouka.fi/3d/index_en.html) offers legacy
  SketchUp/DWG models under CC BY 4.0. Tile 212221 now supplies the theatre and library
  shell geometry, converted into `waterfront-model.json` and used by the game.
  The download page says the material is no longer updated. See [WATERFRONT-IMPORT.md](WATERFRONT-IMPORT.md).
- Street façades, roof details, tree species, local bus appearance and street
  furniture still need reference validation. No invented local appearance has
  been added to fill those gaps.
- Start the street survey with Saaristonkatu, Torikatu, Kirkkokatu,
  Aleksanterinkatu, Hallituskatu and the Kaarlenväylä waterfront. Collect both
  directions and both sides before modelling fronts or furniture.
- No `MAPILLARY_TOKEN` or `TYPESAFE_API_KEY` is configured. The current
  `area:review` command also reads extension areas rather than city definitions.
  Automated recognisability review and human/local sign-off are pending.

The Rantakatu/Kauppatori pass now adds original models of the Market Hall and
Jurveliuksen talo, mapped plaza paving, photo-guided trees/furniture/signs, and bus-front details.
The [difference checklist](RANTAKATU-KAUPPATORI-DIFFERENCES.md) records 63 items and the
remaining limits. Architectural proportions and furniture placement are estimates.

This is a playable draft, not a Helsinki-quality reconstruction or a published city.

[Oulun kaupungintalo](CITY-HALL-REVIEW.md) now has a custom model with the twin roof pavilions,
central facade, stairs and garden furniture, anchored by the municipal LOD1 height reference.
The detailed roof and facade proportions remain photo-based estimates.

The [whole Kauppatori square pass](KAUPPATORI-SQUARE-REVIEW.md) replaces fifteen mapped
warehouse/kiosk/boat structures, adds a representative twelve-stall summer market and granite
slab paving, and retains the Market Hall and stepped waterfront refinements.
Its measured outlines, interpreted details and remaining gaps are recorded separately.

[Oulu Cathedral visual pass](CATHEDRAL-REVIEW.md) replaces the generic shell with curved
roofs/dome, staged clock tower and spire, white entrance columns and supported stairs.
Fine details and the churchyard remain provisional; no local sign-off is claimed.
