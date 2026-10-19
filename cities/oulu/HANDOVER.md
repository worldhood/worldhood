# Oulu handover

Oulu is a **playable draft**, not a finished reconstruction. No street has passed the
photo-by-photo recognisability review or a local sign-off yet. Most of the map is generic
OpenStreetMap buildings; being on the map does not mean a building's appearance is done.
Pick something from the list below or from [issue #68](https://github.com/worldhood/worldhood/issues/68).

## Landmarks and streets still to finish

| Place | Now | Next |
| --- | --- | --- |
| **Kauppahalli and Kauppatori** | Custom hall, fifteen square structures, seasonal stalls, paving, Torinranta steps | Exact ornament, curved gable, window counts, unseen elevations and the modern annex canopy; sign wording, tree species and surveyed furniture positions; the hotel and surrounding blocks still have generic facades. |
| **Oulu Cathedral** | Custom roofs, dome, tower, four clocks, spire, columns, stairs | Clock numerals, belfry louvres, capitals, exact roof curvature, side and rear windows, smaller entrances; the churchyard (fence, paths, lamps, trees) is not built. |
| **City Hall** | Custom front, twin pavilions, stairs, garden lamps and benches | The side and rear walls are blank: give them window bays. Fine relief, cornices and the full garden remain simplified. |
| **Theatre and Library Saari** | Municipal LOD1 shells with photo-guided glazing and colonnades | Lettering, steps, the quay and garden, and finer elevations. The municipal shells are 2017 data, not current roof measurements. |
| **Railway station** | Generic OSM building | Roof, facade, entrances and the platform side. |
| **Valkea shopping centre** | Generic OSM building | Identify the whole complex and its entrances from permitted references before modelling. |
| **Isokatu 37** | Wall colour and material only | Height, window rhythm and the shop fronts. |
| **Central streets** | Generic | Survey Saaristonkatu, Torikatu, Kirkkokatu, Aleksanterinkatu, Hallituskatu and Kaarlenväylä: both sides, both directions. |
| **Kerbs** | | Kerb strips cross the carriageway at Rantakatu, Kajaaninkatu and Hallituskatu. |
| **Buses** | Pink paint, single windscreen, round headlights on the generic body | Body shape and the rest of the fleet are unverified; one bus was photographed. |
| **Trees** | Almost all generic broadleaf | Species and heights from the city tree register, if one is published, or surveys. |

## Traffic

`npm run traffic:check -- oulu --seconds 240 --seeds 1` reports about 4.5 stalled episodes per 100
vehicle-minutes against a passing threshold of 2, with no deadlocks. Hotspots: Kajaaninkatu /
Kirkkokatu by the cathedral (bus queues at the signals), Kaarlenväylä by the theatre, a bus on
Rantakatu and one car-bus overlap on Saaristonkatu. Details in `gaps.json`.

## Toripolliisi is left out on purpose

The police statue on Kauppatori is an artwork by Kaarlo Mikkonen. Owning a photograph of it, or
a CC0 licence on someone else's photograph, does not give permission to redistribute a 3D
recreation of the sculpture. There is no model and no invisible collision at its spot. Before
adding one, establish permission for the intended 3D use (Oulu Art Museum is a good place to
ask who holds the rights) and record it in `market-sources.json` under `sculptureRights`.

## Working with references

- Use City of Oulu open data, OpenStreetMap, permitted photos (Commons, Mapillary, Panoramax)
  or your own photos. Never use Google Street View.
- `npm run photos:fetch -- oulu <place>` saves photos to the git-ignored `data/raw/photos/oulu/`.
  List every photo you used in `<place>-sources.json`.
- `npm run place:compare -- oulu <place>` renders the game next to each reference photo listed in
  `<place>-reference.json`. The contributor photo comparisons in `own-reference.json` expect the
  photos as `data/raw/photos/oulu/own/<id>.jpg`; they are not distributed.
- `*-reference.json` files with `"referenceOnly": true` are acquisition plans and are skipped by
  `place:build`.
