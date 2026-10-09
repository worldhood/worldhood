# What makes a city recognisable

> Publishing bar: a city is published only when it looks as good as Helsinki. OpenStreetMap is the
> skeleton; real photos of every street are what make it right. See
> [BUILD_YOUR_CITY.md](BUILD_YOUR_CITY.md#the-publishing-bar-helsinki-is-the-minimum).

Helsinki is the reference city. This is what makes it read as *Helsinki* rather than "a city", as
layers ranked by how much each one contributed. Use the same layers, in the same order, for your
city. Each layer says what Helsinki has, and how to get it for any city.

| # | Layer | Effect |
| --- | --- | --- |
| 1 | Real footprints, heights and roof shapes | The skyline and street walls are right |
| 2 | Real façade appearance | Colour, materials, windows |
| 3 | Street surfaces and kerbs | Cobblestones, granite kerbs, tram lanes |
| 4 | Public transport | Trams and buses on the real lines |
| 5 | Hero landmarks, modelled properly | The 5–15 places on every postcard |
| 6 | Street furniture and signs | Shelters, poles, signs, lamps |
| 7 | Water and the edges of the city | Shoreline, quays, bridges |
| 8 | Light and sky | Northern light, sun angle |
| 9 | Life | Traffic density, pedestrians, cyclists |

## 1. Real footprints, heights and roof shapes

- **Helsinki:** the city's measured 3D model (LOD2) with real roof shapes. Every building is in its
  surveyed place and size, which already gives the right skyline: towers, domes, church spires.
- **Any city:** OpenStreetMap footprints with `height` / `building:levels` (`npm run city:build`).
  If your country publishes an LOD2/3D model, use it; it's the biggest single upgrade (see
  [ADDING_A_CITY.md](ADDING_A_CITY.md)).
- **Check:** look along the main street from car height. Does the street wall have the right
  rhythm of storeys?

## 2. Real façade appearance

- **Helsinki:** the city's photo-textured façades and roofs. Where the city's photos were smeared,
  an authored façade with real window bays, cornices and colours replaced them (Lasipalatsi,
  Kauppatori fronts, Aleksanterinkatu, Senate Square).
- **Any city:**
  - first, `building:colour`, `building:material`, `roof:colour` in OpenStreetMap;
  - then official textured 3D, if it exists;
  - then authored fronts for the main streets, from reference notes.

  The game adds provisional window bays to untextured walls; they're labelled provisional.
- **Check:** ask a local to name the street from a screenshot without signs.

## 3. Street surfaces and kerbs

- **Helsinki:** the municipal street-area polygons with their material: asphalt, setts
  (`Nupukivi`), stone dust, wood on bridges. Granite kerbstones and the cobblestone rumble when you
  drive over setts. That feel is a big part of "Helsinki".
- **Any city:** OSM `surface=*` (sett, cobblestone, paving_stones, wood) is mapped to the same
  materials; street-area polygons (`area:highway`) beat buffered centrelines where they exist.
- **Check:** the famous cobbled or pedestrian streets feel different to drive on.

## 4. Public transport

- **Helsinki:** HSL route shapes and stops. Articulated green-and-cream trams with destination
  displays, rails in the street, overhead wires, tram stops with shelters, blue city buses.
- **Any city:** `npm run city:build` reads OSM `route=tram|bus` relations and stops. Lines,
  destinations and colours come from the relation tags. A local vehicle model (e.g. a city's
  tram livery) is a strong next step.
- **Check:** the right tram or bus lines pass the right stops.

## 5. Hero landmarks, modelled properly

- **Helsinki:** each of these is a code module, measured from municipal data and reconstructed
  from reference notes:
  - Helsinki Cathedral with stairs and colonnades
  - Uspenski Cathedral
  - the Senate Square pavilions
  - Kauppatori market stalls
  - Havis Amanda
  - Kamppi Chapel
  - the station's lantern carriers
  - the harbour with its ferry and SkyWheel
- **Any city:** pick the 5–15 places on every postcard of your city and build them as described in
  [BUILDING_LANDMARKS.md](BUILDING_LANDMARKS.md). They matter more than anything else after the
  basics.
- **Check:** the review's `knownFor` items. Jev should judge each `mustHave` landmark present.

## 6. Street furniture and signs

- **Helsinki:**
  - bilingual street-name plaques;
  - overhead direction gantries and turn signs read from reference photography;
  - tram-stop shelters, bins, bike racks, city-bike stations and e-scooters;
  - roadworks, a few fictional billboards.
- **Any city:** OSM `highway=street_lamp`, `bus_stop` + `shelter`, `amenity=bench`,
  `traffic_sign=*` and `crossing=*` for placement. Use the local style (sign colours and fonts,
  shelter shape) from reference notes.
- **Check:** at a famous junction, are the signs, lights and crossings where they really are?

## 7. Water and the edges of the city

- **Helsinki:** the real coastline with granite quays below street level, the wooden Seurasaari
  bridge, islands, and boats at the harbour.
- **Any city:** OSM water, riverbanks and coastlines give the shape. Quay walls are generated
  where water meets paved land, and bridges keep their deck material.
- **Check:** does the waterfront look right from the most famous viewpoint?

## 8. Light and sky

- **Helsinki:** a northern late-summer sky (low sun, pale horizon), time of day and weather looks,
  tuned against reference photography of Kauppatori.
- **Any city:** sun latitude matters. Tune `src/sky.js` / `src/weather.js` presets per city; the
  city pack can carry its own palette.
- **Check:** a screenshot at noon looks like the city at noon.

## 9. Life

- **Helsinki:** traffic on the real lane network obeying one-way streets and signals, pedestrians
  on mapped pavements, cyclists on the red cycleways, market crowds, police.
- **Any city:** comes from the routable network in the build (`mobility.json`).
- **Check:** busy streets are busy and quiet ones are quiet.

## The method, in order

1. **Get the shapes right** (layers 1, 3, 7) from the best open data available. Fix the data at its
   source (OSM or official data), not in the game.
2. **Add transport and life** (layers 4, 9). These come from the data automatically.
3. **Choose the 5–15 places people know** (`knownFor`). Get reference notes for each from Mapillary
   or your own photos. People may also look at Street View in Google's own viewer and write notes.
4. **Review:** `npm run area:review` tells you per place what's missing and what kind of work fixes
   it.
5. **Model the heroes** (layer 5), then **façades on the main streets** (layer 2), then **furniture
   and signs** (layer 6), then **light** (layer 8).
6. **A local signs it off.** A place is done when Jev rates it demo-ready and someone who lives
   there agrees.

## Connecting cities and areas

Everything is in local metres from a city origin.
- **Areas within a city** (like Seurasaari in Helsinki) join automatically: shared road nodes snap
  together at the seam, and the drivable outline grows.
- **Neighbouring cities** (Helsinki–Espoo–Vantaa) can share one origin and become one continuous map.
- **Distant cities** are separate worlds you switch between with `?city=`.
