# Oulu — draft city

Play: `?city=oulu`. Status: **draft**, help wanted. The open to-do list is
[issue #68](https://github.com/worldhood/worldhood/issues/68); what is left is summarised in
[HANDOVER.md](HANDOVER.md) and, in structured form, in [gaps.json](gaps.json).

The playable circle has a 1,500 m radius around 25.47020 E, 65.01179 N. Buildings, streets,
surfaces, water, parks, trees, traffic signals and transport routes come from OpenStreetMap.
Heights without mapped values are estimates. The city stays `draft` until it has been checked
against the publishing bar in [BUILD_YOUR_CITY.md](../../docs/BUILD_YOUR_CITY.md).

## What is modelled

- **Kauppahalli, Kauppatori and Torinranta** (`market`): the Market Hall, the pink Rantakatu house,
  fifteen red and grey storehouses, kiosks and the Torin Kippari boat, granite slab paving, a
  representative summer market and the stepped timber waterfront.
- **Oulu City Hall** (`city-hall`): twin roof pavilions, central facade, entrance stairs and garden
  furniture, with its main height from the City of Oulu municipal model.
- **Oulu Cathedral** (`cathedral`): curved roofs and dome, staged clock tower and spire, columned
  entrance and stairs; 56.5 m tower height.
- **Theatre and Central Library Saari** (`waterfront`): City of Oulu municipal LOD1 shells with
  photo-guided entrance glazing and colonnades.
- **City buses**: pink Oulu paint, single windscreen and round headlights on the generic bus body.

Starts: Kauppahalli (default), the cathedral, City Hall, the theatre, the railway station and
Merimiehenkotimuseo. Each landmark start faces its landmark.

## Rebuild and check

```sh
npm run city:build -- oulu
npm run place:build -- oulu
npm run traffic:check -- oulu
npm test
```

`npm run photos:fetch -- oulu <place>` downloads the reference photos for a place into the
git-ignored `data/raw/photos/oulu/`. Never commit downloaded photos. Every photo used is listed
with its author, licence and use in `<place>-sources.json`.

## Sources

- Map data: © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright), ODbL 1.0.
- Elevation: National Land Survey of Finland, Elevation model 2 m, CC BY 4.0, via Mapterhorn
  (`terrainZoom` 14).
- Municipal 3D model, tile 212221 (2017): © City of Oulu, CC BY 4.0
  ([api.ouka.fi/3d](https://api.ouka.fi/3d/index_en.html)). The data is no longer updated.
- Reference photos: Wikimedia Commons, CC0 (Estormiz, Leonhard Lenz, Alphaios).
- Photographs by zaw-ye-tun: used as a reference for three facade colours and the bus livery;
  originals not distributed ([own-photo-sources.json](own-photo-sources.json)).

See [NOTICE.md](../../NOTICE.md) for the full credits.
