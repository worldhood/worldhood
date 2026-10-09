# Playbook: build your city

> Read [RECOGNISABILITY.md](RECOGNISABILITY.md) first: what made Helsinki look like Helsinki, and the
> order to work in.

From nothing but a city's name to a drivable city in the game, then refined until locals recognise it.
Every step is a command plus a check. You can follow it yourself, or hand the agent prompt at the
end to your coding agent.

## The publishing bar: Helsinki is the minimum

A city is published (shown on the cities map and in the game as a finished city) only when it looks
**as good as Helsinki or better**. Until then it stays a `draft`: playable by link, labelled as a
preview, not promoted.

**OpenStreetMap is the starting skeleton, not the city.** Map data gives positions and shapes. It
doesn't tell you what a street looks like. That only comes from looking at the real place, street
by street.

### The method: every street's unique character

Work through the city street by street (start with the 10–20 streets people know best). For each
street, collect **real reference photos** first:
- your own photos, uploaded to Mapillary so others can use them too;
- Mapillary, Panoramax or KartaView open imagery;
- the city's own open imagery.

Check that each reference's licence and provider terms permit your intended use, including
measurements, processing and redistribution. Use your own on-site observations or permitted
photos for the project's notes and assets. Then match the game to those references:

| Characteristic | What to match | Not acceptable |
| --- | --- | --- |
| Buildings | Height, storeys, roof shape, façade colour and material, window rhythm, shop fronts, landmark details | Uniform grey boxes; invented window grids on real façades |
| Trees | Real positions (city tree register or photos), species shape and size, avenue spacing, bare vs green | Generic trees scattered by default |
| Street surface | Asphalt vs cobblestones, tram tracks, lane markings, crossings, kerbs | One asphalt colour everywhere |
| Signs and signals | Street-name signs, traffic signs, signal poles where they really are, local sign style | Missing or generic signs |
| Street furniture | Shelters, benches, lamps, bins, bike stations in the local style | Nothing, or another city's style |
| Public transport | Real lines and stops, **local vehicle liveries** (e.g. Tampere's red trams, Nysse buses) | Another city's vehicles |
| Light and mood | Typical sky and sun for the latitude | Default look without checking |
| Physical world | Every pole, sign, signal, lamp, bin, bench, bike rack, scooter and parked car is **hittable**: solid (blocks the car) or knockable (bends, flies, scatters), like in Helsinki | Objects the car drives straight through |

### Where to find reference images

| Source | Good for | How to use it |
| --- | --- | --- |
| **Your own phone photos** | Exactly the streets you're building, today | Walk or ride the street; photograph both sides and both directions every 50–100 m, plus signs, stops, lamps and trees. Upload them to Mapillary so the next builder can use them too. |
| **[Mapillary](https://www.mapillary.com)** | Most cities; free; CC BY-SA | Browse on the map, or let `npm run photos:fetch` download recent photos of a place (free `MAPILLARY_TOKEN`). Credit image IDs. |
| **[Panoramax](https://panoramax.fr)** / **[KartaView](https://kartaview.org)** | Open street-level imagery, strong in some countries | Look on the map; credit the photographer when you use a photo as a reference. |
| **Your city's own open data** | Orthophotos, building photos, tree and street registers | Check the city's open-data portal (e.g. Helsinki's and Tampere's GeoServers). Many publish aerial photos you can measure from. |
| **Wikimedia Commons** | Landmarks and famous façades | Each photo has its own licence. Use as a reference, credit in the landmark's sources file. |
| **Google Street View** | Viewing on Google's service | Viewing access does not grant permission to derive this project's assets, measurements or map data. Do not use it as an asset-building source without permission covering that use. Rewording observations is not a permission workaround; see Google's [Geo Guidelines](https://about.google/brand-resource-center/products-and-services/geo-guidelines/). |

What to note from each permitted reference photo: storeys and roof shapes, façade colours and materials, shop fronts, tree
species, size and spacing, street surface (asphalt vs setts), tram tracks, kerbs, crossings, sign
texts and styles, lamp and shelter styles, and bus and tram liveries.

### Terrain and aerial imagery

- **Terrain (hills, slopes):** [Mapterhorn](https://mapterhorn.com) publishes open elevation tiles
  for the whole world, built from national lidar where available and Copernicus elsewhere. Check and
  credit the licence of each underlying source for your area. National lidar or elevation models
  from your country's mapping agency are often better still.
- **Aerial photos:** use your city's or country's open orthophotos (many are CC BY 4.0).
- **Proprietary imagery:** do not use Esri, Google, Bing or Apple imagery as project data, textures
  or tracing references without permission covering that use. Prefer municipal or national open
  orthophotos with a documented licence.

### Proving it

For each published street, the pull request includes:
- 2–3 **side-by-side pairs**: your own or open reference photo next to the same view in the game
  (`?city=<id>&start=<place>`);
- `reference-notes.json` entries for the street (what the photos show);
- a passing `npm run area:review` for the street's checkpoints;
- sign-off from someone who knows the street.

A maintainer compares the pairs. If a local wouldn't recognise the street at a glance, it isn't
done.

## 0. Set up (once)

```sh
git clone <this repo> && cd worldhood
npm ci
cp .env.example .env.local   # optional keys for the review steps (stage 3)
```

## Stage 1: a drivable city (about 10 minutes)

```sh
npm run city:new   -- <id> "<City, Country>" [radiusMetres]   # e.g. tampere "Tampere, Finland" 1500
npm run city:build -- <id>
npm run dev
```

Open `http://localhost:5173/?city=<id>`.

| Command | What it does |
| --- | --- |
| `city:new` | Finds the city by name (OpenStreetMap Nominatim) and writes `cities/<id>/city.json`: centre, radius, empty `starts` and `maintainers` |
| `city:build` | Downloads OpenStreetMap data around the centre and builds the game data in `public/cities/<id>/`, registering it in `public/cities/index.json` |

What `city:build` produces:
- **Buildings:** 3D, at their tagged height or `building:levels`, otherwise a typical height for the building type.
- **Streets:** road and pavement surfaces. Cobblestone streets get the cobblestone rumble.
- **Nature:** water, parks, forests and mapped trees.
- **Traffic:** a routable network with one-way streets and traffic lights; AI traffic and pedestrians use it.
- **Public transport:** tram and bus lines from OSM `route=tram|bus` relations, with stops, rails and
  overhead wires.
- **Start points:** up to 8, chosen from the best-known named places (squares, stations, museums, landmarks).

Check:
- [ ] It loads with no errors in the browser console.
- [ ] You can drive from every start point (**M** opens the map).
- [ ] Water, the main streets and the centre look roughly right from above (**C** cycles cameras; *High*
      is an overview).

If a start lands somewhere odd, add your own in `cities/<id>/city.json` and rebuild:

```json
"starts": [{"name": "Keskustori", "at": [23.7608, 61.4980]}]
```

## Stage 2: make the data right

Most problems are missing or wrong OpenStreetMap data, so fix them at the source. Edit
[openstreetmap.org](https://www.openstreetmap.org) (your fixes help everyone), wait a few minutes,
then run `npm run city:build -- <id> --refresh`.

| You see | Usually fixed by |
| --- | --- |
| A building far too low or tall | Add `height=*` or `building:levels=*` in OSM |
| A missing street or wrong one-way | Fix the `highway=*` way or the `oneway=*` tag |
| A lake or river missing | Check `natural=water` / riverbank multipolygons |
| Cobblestones missing | Add `surface=sett` on the street |
| No trees | Map `natural=tree` along the street |

**Use your city's own open data where it exists.** It beats OpenStreetMap every time. Many cities
publish a street register (street parts with their real shapes and surfaces), a tree register
(every tree with species and height) and green areas over WFS. Add them to `cities/<id>/city.json`
under `"official"` and rebuild; see `cities/tampere/city.json` for a working example using the City
of Tampere's GeoServer. The build then uses the real street shapes and registered trees, and keeps
OpenStreetMap only where the register has nothing. Credit the city in `official.attribution`.

Official 3D city models (CityGML or 3D Tiles), where they exist, are the next big step; see
[ADDING_A_CITY.md](ADDING_A_CITY.md). Helsinki uses its city data; see
[EXTENDING.md](EXTENDING.md) and [ADDING_A_CITY.md](ADDING_A_CITY.md) for how such sources plug in.

### Traffic that keeps flowing

Cars, trams and buses share one lane model: junction stop lines, signals, tram crossings and shared tram
lanes, bus lanes (see [TRAFFIC.md](TRAFFIC.md)). After a build, run `npm run traffic:check -- <id>`. It
drives the city headless for a few minutes and lists every spot where a vehicle gets stuck, with the street
name and the cause; most fixes are in the map data (a missing traffic signal node, a misplaced way).

### Terrain

Every city can have its real hills. `city:build` ends with `npm run city:terrain -- <id>`, which you
can also run on its own after any rebuild:

- It reads [Mapterhorn](https://mapterhorn.com) terrain tiles (no key; national lidar where available,
  Copernicus 30 m elsewhere; check [mapterhorn.com/attribution](https://mapterhorn.com/attribution) and
  credit your area's source). In Finland that is the National Land Survey's 2 m elevation model, CC BY 4.0.
- It writes `public/cities/<id>/terrain.pack`: a 3 m height grid over the city square (under 1 MB),
  smoothed so streets drive well (each carriageway follows its own profile, kerbs and unmapped dips
  removed), bridges spanned as straight decks between their banks, every mapped water body levelled at its
  own surface (a river keeps its steps at the dams), and large flat water the map leaves out (lakes) found
  in the elevation model itself.
- Interchanges are one height field too, so roads on different levels (OSM `bridge`, `layer`) are made to
  agree: where a bridge crosses a street the two meet halfway with ramps no steeper than 12 %, and a foot or
  cycle bridge never lifts the street below it. Streets that really are steeper keep their grade. The build
  prints any carriageway still steeper than that (`road grade spikes`); fix the OSM tags or report them.
- The game then puts everything on the ground: streets, kerbs, water, buildings (each on its lowest
  corner), trees, furniture, tram tracks and wires, traffic, people and the player's car, which climbs
  and rolls with the slope and slows uphill. Walking, cycling and scooting slow down uphill too; bicycles
  and scooters roll a little faster downhill. Lakes show on the minimap.

Check: drive the steepest street you know, look at the main bridge from the water, and see that lakes
sit at their own levels. Put `"terrain": false` in `cities/<id>/city.json` to keep a city flat.

### Street furniture from Mapillary detections

Lamp posts, traffic lights, road signs, bins, junction boxes, benches and roadworks barriers can be
placed using positions extracted by Mapillary from street-level photos ("map features"). These
features are provided under the [Mapillary Terms of Use](https://www.mapillary.com/terms);
the CC BY-SA licence for imagery does not establish a CC BY-SA licence for extracted features.
The current dataset's downstream redistribution rights still need confirmation before public
release; see [NOTICE.md](../NOTICE.md). Keep the visible linked Mapillary logo when displaying
these features. Attribution alone does not resolve the redistribution question.

- **Turn it on:** get a free client token at
  [mapillary.com/dashboard/developers](https://www.mapillary.com/dashboard/developers) and put
  `MAPILLARY_TOKEN=...` in `.env.local` (never commit it). `city:build` then adds the furniture
  automatically. To redo only this step: `npm run city:furniture -- <id>` (add `--refresh` to
  download again).
- **What it does:** downloads every detection inside the playable circle, then keeps only the
  trustworthy ones. It drops things seen in a single photo, very old detections, temporary barriers and
  roadworks signs missing from the latest photos, and objects that newer photos of the same spot
  missed. Doubles (the same lamp found twice, or a traffic light the city already places) are merged.
  Anything inside a building is dropped; a post that lands on the road is moved to the nearest
  pavement edge, or dropped if it is in the middle of the street (usually a lamp hanging on wires).
- **In the game:** lamp, sign and signal posts bend or snap when you hit them, bins and barriers
  fall over, junction boxes and benches stop the car. Signs get Finnish-style faces for the common
  types; unknown ones get a plain plate of the right shape.
- **Result:** `public/cities/<id>/furniture.json`, with the Mapillary ids behind every object. The
  build adds Mapillary to the city's credits; keep that line.
- **Missing furniture?** Coverage follows where people have taken photos. Walk, cycle or drive the
  streets with the free Mapillary app (a phone on a mount is enough), upload, wait a few days for
  processing, then run `npm run city:furniture -- <id> --refresh`.
- **Check it:** with `npm run dev` running, `npm run furniture:check -- <id>` drives the car into a
  few lamps, a sign, a bin and a junction box and reports whether they react.

### Signs, signals and stops from official registers

Photos only show what someone photographed. For Finnish cities `npm run city:furniture -- <id>` also
reads **Digiroad**, the national road database (Väylävirasto, CC BY 4.0, no key needed): its traffic
signs with code, value, extra plates and direction, its traffic-light points, its stops (bearing,
shelter) and where speed limits, vehicle restrictions and bus lanes begin. A city can add its own
WFS registers of pedestrian crossings, signalled junctions and stops under `official` in
`cities/<id>/city.json` (see Tampere's). OpenStreetMap `traffic_sign=FI:…`, `give_way` and `stop`
nodes fill single gaps. Every sign is mounted kerbside facing the traffic it governs; one seen in
photos as well keeps the official code and facing, stands where the photos put it and lists both
sources (`src`, `mly`, `ref` in `furniture.json`). Junctions that already get generated signal posts
are left alone. Code: `scripts/digiroad-signs.mjs`, sign faces in `src/sign-faces.js`.

**Other countries:** add an adapter that turns your national road database (or city register) into
the same records (code, value, position, travel direction) and a code table in `src/sign-faces.js`
mapping your sign codes to faces; the kerbside mounting, merging with Mapillary and runtime are shared.

### Façades from street-level photos

OSM gives a building's outline and sometimes its height, not what it looks like. For the streets
people know, describe each front in `cities/<id>/facades.json` from open street-level photos; the
game then draws coloured walls with real window rows per storey, shop glazing at street level,
cornices and the right roof colour. Buildings without a description keep the plain look.

1. **Fetch photos for one street:** `npm run facades:photos -- <id> "<street name>"` (free
   `MAPILLARY_TOKEN`). It saves recent Mapillary photos along the street, both directions and side
   views, to `data/raw/mapillary/` (git-ignored, never committed), plus `buildings.json`: every
   building fronting the street with the photos that show it.
2. **Describe what you see:** open the photos and fill `facades.json` per building id: storeys,
   wall colour (hex), material, window shape and spacing, ground floor (shops, arcade, glass),
   awnings, cornice, roof colour, and the photo ids and dates you used with a confidence. Use your
   own words and numbers; no logos, shop names or image pieces. Your coding agent can do this step:
   it views the photos itself, so no extra service or API key is needed. Phone compass headings in
   Mapillary are sometimes wrong; judge by what the photo shows.
3. **Render and compare:** with `npm run dev` running, `npm run facades:compare -- <id>` puts the
   game camera where each photo in `views` was taken and saves game and photo side by side in
   `data/raw/facade-compare/<id>/`.
4. **Repeat:** fix colours, storey counts, window rhythm and shop fronts until each block reads as
   the real one. `npm run facades:ship -- <id>` checks the file and publishes it with the city
   (`npm run city:build` does this too) and adds the Mapillary credit.

### Squares, trees and landmarks from current photos

For a famous square (Tampere's Keskustori is the worked example) map data gives only positions and
shapes; everything you see comes from photos taken after the place last changed.

1. **Collect:** describe the search in `cities/<id>/<place>-reference.json` → `photoSearch` (centre,
   radius, `since` date, Wikimedia Commons categories) and run `npm run photos:fetch -- <id> <place>`.
   It saves current Commons, Mapillary and Panoramax photos (plus any of your own you drop in the
   folder) to the git-ignored `data/raw/photos/<id>/<place>/` with `catalog.json`. List what you used,
   with author, licence, date and use, in `<place>-sources.json`.
2. **Describe:** look at every photo and write the place in your own words in the reference file:
   paving per street-part rule (the city's street-part polygons give the areas), tram stop, lamps,
   furniture, landmark dimensions and colours. `npm run place:build -- <id> <place>` joins it with the
   city's open data (3D building heights, street parts, tree register, stops) into
   `public/cities/<id>/places/<place>.json`; `city:build` reruns it.
3. **Use unobstructed photo detail.** For walls and paving seen straight on, give the four corners
   of the area in the photo and its size in metres under `photoPanels` / `groundTextures`;
   `npm run place:textures -- <id> <place>` rectifies them into textures (CC BY-SA photos stay
   CC BY-SA: credit them). Cars, people, trees and bus shelters in front of a wall must not become
   part of its texture in the game. Use a clear photo or restrict a panel with `visibleY: [min, max]`
   in wall metres, leaving its original `y` range unchanged so the image keeps its scale. Keep
   modelled windows and shop fronts behind excluded areas; use geometry for depth and unseen sides.
4. **Trees:** every registered tree gets its species family's model (`src/tree-species.js`) at its
   register height. Check species against the photos tree by tree and record the result in
   `<place>-trees.json`; flag trees no photo shows instead of guessing.
5. **Compare:** `npm run place:compare -- <id> <place>` renders the game from each photo's position
   in `views` and saves the pair side by side. Fix and repeat until a local recognises every view.

## Stage 3: compare with the real streets

1. **Pick 6–12 spots people know.** Add them as `knownFor` items with a real position and
   `mustHave` for the essentials (same format as `extensions/seurasaari/extension.json`).
2. **Get reference notes:**
   - **Open photos:** `npm run photos:fetch -- <city> <place>` downloads current Commons, Mapillary
     and Panoramax photos (needs the free `MAPILLARY_TOKEN`). Look at them and write short facts,
     crediting each image.
   - **By hand:** write notes from your own on-site observations or appropriately licensed photos,
     recording each source and its licence. `npm run area:links -- <id>` provides viewer links,
     but those links do not grant permission to derive project data.
   - **Check permission before using a reference.** Do not derive project notes, measurements,
     textures or other assets from Google Street View without permission covering that use.
     Having a person reword an observation does not replace permission.
3. **Review:** `npm run area:review -- <id>` (needs `TYPESAFE_API_KEY`). Jev answers per spot: how
   recognisable, demo-ready or not, what's missing, and what kind of work fixes it.

> Stage 3 runs today on extension areas such as `seurasaari`; running it on a whole city uses the same
> files (`knownFor`, `reference-notes.json`, `review.json`) under `cities/<id>/`.

## Stage 4: fine-tune what matters

Work through `review.json`, starting with `mustHave` gaps:

| `nextStep` | Do this |
| --- | --- |
| `reference_observations` | Better notes (stage 3) |
| `municipal_data` | Fix OSM or add official data (stage 2) |
| `procedural_detail` | Generic detail from data: signs, lamps, markings, stops ([GAMEPLAY.md](GAMEPLAY.md)) |
| `bespoke_landmark` | Model the landmark in code ([BUILDING_LANDMARKS.md](BUILDING_LANDMARKS.md)) |
| `gameplay` | Fix driving or blockers ([GAMEPLAY.md](GAMEPLAY.md)) |

Re-run `area:review` after each fix. A spot is done when Jev signs it off and a human who knows
the place agrees.

## Stage 5: share it

1. Put your handle in `maintainers` (in `city.json`) and in `.github/CODEOWNERS` for `cities/<id>/`
   and `public/cities/<id>/`.
2. Open a pull request. The template asks for:
   - screenshots;
   - the `?city=<id>&start=<place>` links;
   - the data sources, all credited in the game's Sources panel.
3. The city gets its own channel and status, starting at `draft`, then `playable-draft`, then
   `reviewed`.

---

## Agent prompt (copy into your coding agent)

> You are helping build **<City>** for Worldhood, an open-source browser driving game. Work in
> this repository and follow `docs/BUILD_YOUR_CITY.md`, including **the publishing bar: Helsinki
> is the minimum**.
>
> 1. Run `npm ci`, `npm run city:new -- <id> "<City, Country>" 1500` and `npm run city:build -- <id>`.
>    Start `npm run dev`, open `http://localhost:5173/?city=<id>`, and fix only build problems.
> 2. **OpenStreetMap is only the skeleton.** Before changing how anything looks, gather real
>    street-level reference photos for each street you work on: my photos (I'll give you a folder),
>    and open imagery from Mapillary, Panoramax or KartaView (`npm run photos:fetch`). Write what
>    the photos show into `reference-notes.json`: building colours and storeys, roof shapes, trees,
>    signs, surfaces, furniture, vehicles.
> 3. Use only references whose licence and terms permit the intended work. If photos are missing
>    for a street, ask me for my own photos, on-site observations or another permitted source.
>    Do not ask me to extract Google Street View observations on your behalf.
> 4. Match each street to its photos, using the characteristics table in the playbook. No generic
>    stand-ins: trees, buildings, signs and vehicles must follow the real place. If you can't
>    match something yet, list it as a gap instead of inventing it.
> 5. For each street, make side-by-side pairs (reference photo + same game view), and run
>    `npm run area:review` if a `TYPESAFE_API_KEY` is set.
> 6. Run `npm test` and `npm run build`. Give me the pairs, the gaps list and the `?city=` links.
>    The city stays `draft` until I and a local agree it meets the bar. Don't open a pull request
>    before that.
