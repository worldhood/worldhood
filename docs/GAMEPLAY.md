# Improving gameplay: code map, workflow and pull requests

The game is plain JavaScript modules on three.js, bundled by Vite. There's no framework or
backend. Most logic is pure functions with unit tests; rendering modules turn their state into
meshes.

## Where things are

| Area | Modules | Notes |
| --- | --- | --- |
| Boot, game loop, HUD, input | `src/main.js`, `index.html`, `src/style.css` | `boot()` loads data and builds the world; `frame()` runs each tick |
| Cities, start points, URL | `src/cities.js` | `?city=` and `?start=`; `dataUrl()` for every data file |
| Map extensions | `src/extensions.js`, `src/geo.js` | Merging areas, playable outlines, water clip lines |
| Car physics | `src/physics.js`, `src/vehicles.js`, `src/vehicle-damage.js`, `src/battery.js` | Arcade model; `driveStep()` is pure and tested at 10/20/60 FPS |
| Camera | `src/driving-camera.js` | Pure pose function shared with tests |
| Road feel | `src/road-surface.js` | Cobblestone rumble from mapped sett polygons |
| Traffic | `src/mobility.js`, `src/traffic-driving.js`, `src/traffic-renderer.js`, `src/crash-physics.js`, `src/angry-drivers.js` | Cars follow the city's lane network and signals |
| Trams and buses | `src/tram-simulation.js`, `src/tram-model.js`, `src/trams.js`, `src/bus-*.js` | HSL route shapes; stops and dwell times |
| Pedestrians and life | `src/street-life.js`, `src/person-model.js`, `src/*-life.js`, `src/cyclists.js` | Walk mapped pavements; flee from a car on a collision course |
| Police and wanted level | `src/police.js`, `src/police-renderer.js`, `src/roadblock.js`, `src/finale.js` | Heat → stars → search and roadblock |
| Things you can hit | `src/knockables.js`, `src/breakable-signs.js`, `src/parked-micromobility.js`, `src/impacts.js` | |
| Look and performance | `src/sky.js`, `src/weather.js`, `src/environment.js`, `src/post.js`, `src/adaptive-quality.js`, `src/tile-lod.js`, `src/tile-streaming.js` | Dynamic resolution; tiles stream by distance and heading |
| Audio | `src/audio-math.js` (pure, tested), `src/police-siren.js` | Synthesised, no audio files |

## Workflow

```sh
npm ci
npm run dev                # http://localhost:5173/?start=<place>
npm test                   # node:test, about a minute
npm run build              # must pass before a PR
```

Debug tools exist in dev builds only (`window.openCityDrive` in the browser console):

| Call | What it does |
| --- | --- |
| `getState()` | Car, camera, traffic, trams, police, loaded tiles, draw calls |
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
5. Gameplay changes to someone's area are reviewed by that area's maintainers (`CODEOWNERS`).

## Ideas

See [IDEAS.md](IDEAS.md) for the full list, each with the modules it touches.
