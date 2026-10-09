# Improving gameplay: code map, workflow and pull requests

The game is plain JavaScript modules on three.js, bundled by Vite. There's no framework or
backend. Most logic is pure functions with unit tests; rendering modules turn their state into
meshes.

## Where things are

| Area | Modules | Notes |
| --- | --- | --- |
| Boot, game loop, HUD, input | `src/main.js`, `index.html`, `src/style.css` | `boot()` loads data and builds the world; `frame()` runs each tick |
| Mobile input and menu | `src/mobile-controls.js`, `src/mobile-input.js`, `src/mobile-controls.css` | Thumb steering, pedals, button/tilt alternatives, pointer ownership and cancellation |
| Cities, start points, URL | `src/cities.js` | `?city=` and `?start=`; `dataUrl()` for every data file |
| Map extensions and startup | `src/extensions.js`, `src/graph-extension.js`, `src/spatial-streaming.js`, `src/surface-streaming.js`, `src/geo.js` | Nearby surfaces and regions stream in; existing actors and graph edges remain in place |
| Shared travel and vehicle entry | `src/player-travel.js`, `src/player-travel-renderer.js`, `src/player-car-renderer.js`, `src/player-travel-ui.js` | Walk/run, bikes, scooters, stopped car entry; shared by every city |
| Pedestrian interaction | `src/people-interaction.js`, `src/people-interaction-ui.js` | Nearby scripted conversations; no network service |
| Car physics | `src/physics.js`, `src/vehicles.js`, `src/vehicle-damage.js`, `src/battery.js` | Arcade model; `driveStep()` is pure and tested at 10/20/60 FPS |
| Camera | `src/driving-camera.js` | Pure pose function shared with tests |
| Road feel | `src/road-surface.js` | Cobblestone rumble from mapped sett polygons |
| Traffic | `src/mobility.js`, `src/traffic-driving.js`, `src/traffic-renderer.js`, `src/crash-physics.js`, `src/angry-drivers.js` | Cars follow the city's lane network and signals |
| Trams and buses | `src/tram-simulation.js`, `src/tram-model.js`, `src/trams.js`, `src/bus-*.js` | HSL route shapes; stops and dwell times |
| Pedestrians and life | `src/street-life.js`, `src/person-model.js`, `src/*-life.js`, `src/cyclists.js` | Walk mapped pavements; flee from a car on a collision course |
| Police and wanted level | `src/police.js`, `src/police-renderer.js`, `src/roadblock.js`, `src/roadblock-planning.js`, `src/finale.js` | Heat → stars → search and roadblock |
| Things you can hit | `src/knockables.js`, `src/breakable-signs.js`, `src/parked-micromobility.js`, `src/impacts.js` | |
| Look and performance | `src/sky.js`, `src/weather.js`, `src/environment.js`, `src/post.js`, `src/adaptive-quality.js`, `src/tile-lod.js`, `src/tile-streaming.js` | Dynamic resolution; tiles stream by distance and heading |
| Audio | `src/audio-math.js` (pure, tested), `src/police-siren.js` | Synthesised, no audio files |

## Shared player gameplay

These mechanics belong to the engine, not to a particular city. Every new city uses the same
`PlayerTravel` controller and `PeopleInteraction` system with its own collision map and actors.
Do not add city-name checks to the movement, mounting, input or conversation code.

- **F** gets out of a stopped car or off a stopped ride. The vehicle remains where it was left.
- **WASD / arrows** move; hold **Shift** to run. Touch players can toggle **Run**.
- **Enter** uses a nearby stopped car, bicycle or scooter; **Space** brakes.
- **G** greets a nearby person; choose a short reply or walk away to end the conversation.
- On a phone, small context buttons provide the same actions. Hints fade and do not cover the player.

One usable bicycle and scooter are placed on clear ground near each start. They are gameplay
objects, not claims about real rental availability. A city kit exposes parked cars through
`enterableCars` descriptors; the generic controller handles taking, driving, parking and resetting them.
Traffic cars can also be entered when stopped. Original models/colliders are hidden while a car is
in use, so a second copy does not remain behind. Public buses and trams remain simulated transport.

Bicycle and scooter riders share the pedestrian model. Check rider hands, feet, seat/deck contact
and vehicle ground contact from the side as well as from the chase camera when changing these models.

## Mobile controls

The default is proportional thumb steering with separate Go and Brake/Reverse pedals.
Menu pauses play and holds the map, camera, weather, sound, help, reset and steering settings.
Players can choose directional buttons or opt into tilt steering. Walking and riding use the
same inputs; nearby actions remain contextual.

A contact owns its input until released. Multi-touch, pointer cancellation, loss of focus,
orientation changes, menus and travel-mode changes must not leave a pedal or turn held down.
Check portrait and landscape, including a small viewport and devices with safe-area insets.
Browser emulation covers layout and pointer logic; real-device checks are still needed for
motion sensors, system gestures and sustained frame rate.

## Wanted level and police

Police rules are shared across cities. Sustained reckless driving can earn a first star;
a meaningful collision starts at two. Several distinct incidents in a short interval raise
the response faster. Low-speed parking bumps and repeated contact with the same object are
filtered so they do not instantly fill the meter.

At five stars, a pursuit may get a spike strip on a suitable connected road ahead. The
planner checks road width, buildings, water, traffic, terrain and visibility, warns the player,
and rechecks the site before deploying. There is no fixed Simonkatu trigger. If the route has
no suitable hidden site, the pursuit continues without a roadblock. Arrest scenes work for
cars and for players who get out; continuing clears the response and allows a later pursuit.

## Streaming without losing the world

Startup reads the selected city's core data and the small extension catalog. It waits for a
requested extension only when the starting location needs it. Other regions load on approach;
all catalog starts remain selectable on the map. A map jump waits for its destination before
moving the player, and closing the map cancels that jump.

Surface files contain whole polygons, sometimes extending far beyond their filename's tile.
Their index must contain bounds measured from the packed vertices. Unknown bounds are treated
as required rather than risking missing roads. The startup radius covers the visible fog
range; nearby and forward tiles receive priority with bounded concurrent requests and retries.

Installing a region appends collision geometry, prepared road and walking edges, traffic
signals, street markings, trees and buildings. It preserves existing actor objects, edge IDs,
player-taken cars and police state. Do not reset traffic as a shortcut when changing streaming.
Check both direct extension URLs and repeated jumps, a region seam loaded in either order,
and a failed request followed by a successful retry.

## Workflow

```sh
npm ci
npm run dev                # http://localhost:5173/?start=<place>
npm test                   # node:test, about a minute
npm run build              # must pass before a PR
```

Read-only snapshots are available through `window.openCityDrive` in the browser console.
Mutable inspection helpers are limited to development builds:

| Call | What it does |
| --- | --- |
| `getState()` | Car, camera, traffic, trams, police, region/surface loading counts, loaded tiles, draw calls |
| `getLocation()` | WGS84 coordinates, local X/Z, street name, car and camera bearing |
| `inspectView({x, z, heading})` | Teleport to a mapped road or pavement point (paused) |
| `inspectCamera({eye, target})` | Fixed camera for comparison screenshots |
| `setDetailVisible(name, bool)` | Toggle a named detail group to measure its cost |
| `testPoliceIncident()` | Trigger the police response |

Useful keys: **V** capture mode (full resolution, no shake), **H** hide the HUD, **C** camera,
**T** time of day / weather.

## Rules of thumb

- **Keep simulation pure.** Physics, traffic decisions, police heat and camera poses are plain
  functions over plain data. Test them in Node; render them in the module that owns the meshes.
- **Frame time matters more than features.** Check draw calls and frame time in `getState()`
  before and after your change; aim for 60 FPS on a laptop at 1440×900. Batch by material,
  instance repeated objects, and hide detail by distance.
- **Real-world rules stay real.** Traffic follows mapped one-way streets, lanes and signals. Don't
  invent roads, crossings or restrictions; if gameplay needs a liberty (e.g. driving onto
  Seurasaari), document it where it's defined.
- **Keep it non-graphic.** Crashes, pedestrians and police stay arcade and non-violent.

## Pull requests

1. Open an issue first for anything larger than a fix, describing the player-facing change.
2. Keep the PR focused: one mechanic or fix.
3. Include:
   - tests for the pure logic (a regression test for a bug fix);
   - a short clip or screenshots, with the `?start=` link to reproduce;
   - before/after numbers if it touches rendering or simulation cost (draw calls, frame time, FPS).
4. `npm test` and `npm run build` must pass; CI runs both.
5. Include an area's listed maintainers when a change affects its scenery or data. Shared engine changes need checks across cities.

## Ideas

See [IDEAS.md](IDEAS.md) for the full list, each with the modules it touches.
