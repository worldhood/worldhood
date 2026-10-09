# Wishlist: things to build

**None of these exist yet.** Each one is an open GitHub issue labelled
[`idea`](../../../issues?q=is%3Aissue+is%3Aopen+label%3Aidea) and `help wanted`. The issue is where
people claim the idea, discuss it, and link their pull request. Small ones are also
[`good first issue`](../../../issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22).

To take one: comment on its issue, build it following [GAMEPLAY.md](GAMEPLAY.md), and open a
pull request with `Closes #<number>`. New ideas: open a **Gameplay or feature idea** issue.

Size: **S** = a weekend · **M** = a few weeks · **L** = a bigger project.
Live status is on each issue: open, claimed (someone commented), or closed (built).

## To-do board

| Idea | Issue | Size | Start from |
| --- | --- | --- | --- |
| Changing weather over time | [#1](../../../issues/1) | M | `src/weather.js` |
| Live weather from the real city | [#2](../../../issues/2) | M | `src/weather.js` + a free weather API |
| Snow and winter | [#3](../../../issues/3) | M | `src/weather.js`, `src/sky.js` |
| Wet roads that reflect | [#4](../../../issues/4) | S–M | `WEATHER_UNIFORMS` in `src/weather.js` |
| City soundscape | [#5](../../../issues/5) | M | `src/audio-math.js` (maths ready) |
| Seagulls in Helsinki | [#6](../../../issues/6) | S–M | `gullRatePerSecond` in `src/audio-math.js` |
| Tram bells and stop announcements | [#7](../../../issues/7) | S | `src/tram-simulation.js` |
| Car radio | [#8](../../../issues/8) | M | `getLocation()` in `src/main.js` |
| Step out of the car and walk | [#9](../../../issues/9) | L | `src/person-model.js`, walking network |
| Things to do on foot | [#10](../../../issues/10) | M each | on-foot mode |
| Change car / garage | [#11](../../../issues/11) | M | `src/vehicle-models.js` (7 body types) |
| Drive a tram or bus on the real line | [#12](../../../issues/12) | L | `src/tram-simulation.js`, `src/bus-simulation.js` |
| Hop on a city bike or e-scooter | [#13](../../../issues/13) | M | `src/parked-micromobility.js` |
| Ferry to Suomenlinna | [#14](../../../issues/14) | L | harbour ferry in `src/harbour.js` |
| EV charging stations | [#15](../../../issues/15) | S | `src/battery.js` + OSM `amenity=charging_station` |
| Day and night with lights | [#16](../../../issues/16) | M | `src/sky.js`, OSM `highway=street_lamp` |
| Hills from real elevation | [#17](../../../issues/17) | L | city builder + physics |
| City events | [#18](../../../issues/18) | M | street life modules |
| Animals | [#19](../../../issues/19) | S–M | `src/person-model.js` patterns |
| Taxi and delivery missions | [#20](../../../issues/20) | M | start points + mobility graph |
| Landmark photo hunt | [#21](../../../issues/21) | S | `knownFor` lists |
| Drive together (multiplayer) | [#22](../../../issues/22) | L | needs a small relay server |
| City-to-city road trips | [#23](../../../issues/23) | L | extensions / city registry |
| Building colours and roof shapes | [#24](../../../issues/24) | M | `scripts/city-build.mjs` |
| Local tram and bus liveries | [#25](../../../issues/25) | S each | `src/tram-model.js`, `src/bus-renderer.js` |
| Faster first load (start area first) | — | M | `src/main.js` boot, tile streaming |

## Weather

What exists: five looks (midday, golden hour, white night, overcast, rain). Each sets the whole
image (sky, sun, fog, water tint, exposure, rain streaks and road wetness) and blends smoothly
when switched with **T**. Other shaders can read `WEATHER_UNIFORMS.wetness` and `.rain`.

- **Changing weather over time (M).** A small weather "director": clouds build, rain starts and
  passes, the sun comes out, and wetness dries slowly after rain. It's a pure function of time
  and a seed, so it's testable and the same for everyone on the same day. Blend between the
  existing looks rather than adding new rendering.
- **Live weather from the real city (M).** At startup, fetch the city's current conditions and
  pick the matching look: Finnish Meteorological Institute open data for Finland, or a keyless
  worldwide API such as Open-Meteo. Make it optional (a toggle), cache the result, and fall back
  to the director when offline. Credit the source in the Sources panel.
- **Snow and winter (M).** Snowfall particles, white-tinted ground and roofs, slush on roads,
  grip that changes car handling in `src/physics.js`, and early dark. In Helsinki: a frozen
  harbour edge.
- **Wet roads that reflect (S–M).** Hook `WEATHER_UNIFORMS.wetness` into the road material for
  darker, glossier asphalt and puddles in dips. Cobblestones stay shiny longer.
- **Wind and fog banks (S).** Trees sway with wind strength; sea fog rolls in over the harbour.

## Sound

- **City soundscape (M, good first big task).** `src/audio-math.js` already has:
  - the engine model (speed and throttle);
  - rolling noise per surface (cobblestones sound different);
  - tyre squeal, impacts, distance fade and stereo panning;
  - sea and market ambience;
  - tram departure cues.

  What's missing is `src/audio.js`, the WebAudio layer that plays it. Use synthesised sounds or
  CC0/CC BY samples, credited in `NOTICE.md`.
- **Seagulls in Helsinki (S–M).** Calls near water from `gullRatePerSecond`. Add gulls flying and
  perched on quays and market stalls that scatter when you drive close.
- **Tram bells and stop announcements (S).** A bell on departure or when you block the tracks;
  stop names come from the tram data.
- **Car radio (M).** Original or openly licensed music, plus a "local news" voice that mentions
  the street you're on.
- **Per-city sound packs (M).** Church bells, a harbour, the Tammerkoski rapids.

## On foot

- **Step out of the car and walk (L).** Press **F** to park and walk. Reuse the pedestrian model
  and walk/run poses in `src/person-model.js`, walk on the mapped pavements and crossings, and
  use a walking camera. The parked car stays where you left it.
- **Things to do on foot (M each):**
  - buy something at Kauppatori
  - ride a tram a few stops
  - climb a viewpoint
  - photo mode at landmarks
- **Enter a few landmarks (L).** Simple interiors, e.g. a market hall or the Cathedral.

## Vehicles

- **Change car (M).** Seven body types already exist in `src/vehicle-models.js`. Add a garage
  menu, or take over a parked car.
- **Drive a tram or bus (L).** Follow the real line, stop at the real stops, keep to time.
- **Hop on a city bike or e-scooter (M).** Ride a scooter from a parked cluster or a bike from a
  real city-bike station; both are already placed in the world.
- **Ferry to Suomenlinna (L).** Board at Kauppatori.
- **EV charging (S).** The battery already drains; add chargers from OpenStreetMap.

## World and play

- **Day and night (M):** lit windows, street lamps, headlights.
- **Hills (L):** real terrain from open elevation data; the ground is flat today.
- **City events (M):** market day, an ice-hockey night in Tampere, a midsummer bonfire on Seurasaari.
- **Animals (S–M):** gulls, pigeons, ducks on Töölönlahti, a Seurasaari squirrel.
- **Missions (M):** taxi rides, deliveries, tourist routes past `knownFor` landmarks, time trials.
- **Landmark photo hunt (S).**
- **Drive together (L):** multiplayer via a small relay server, the only non-static idea here.
- **City-to-city road trips (L).**

## Making cities better

- **Building colours and roof shapes (M):** the biggest visual win for OpenStreetMap-built cities.
- **Local tram and bus liveries (S each).**
- **Street signs in the local style (M).**
- **Faster first load (M):** load the start area first.

Have another idea? Open a **Gameplay or feature idea** issue. Maintainers add it here.
