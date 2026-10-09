# Traffic, trams and buses

Cars (`src/mobility.js`), trams (`src/tram-simulation.js`) and buses (`src/bus-simulation.js`) are three
simulations that share one street model, `src/lane-model.js`. It is built once when a city loads, from the
road graph (`mobility.json`), the tram paths (`trams.json`) and the bus corridors (`bus-corridors.json`).

## The model

**Junctions.** A node where three or more streets meet is a junction. Every lane that ends at one gets a
stop line placed so that a waiting car is clear of every other lane through the junction, including the
turning lanes that cut across a skewed or multi-node junction. A car either clears a junction in one go or
waits at the stop line:

- *Keep clear*: it does not enter unless there is room for it beyond the junction, and nothing stands in
  the way it will drive through.
- *Give way*: at a junction without signals it waits for a car already crossing its way, and for a car
  arriving from the right.
- Junction boxes, tram crossings and track joins a few metres apart are merged into one block, so a car is
  never left standing between two of them.

**Signals.** A signal controls the cluster of junction nodes around it (signals closer than 35 m run as one
junction). Only lanes entering the cluster stop at red; lanes inside it are already committed. Approaches
are split into two groups along the junction's own axes, so crossing approaches never share a green.
Signalled pedestrian crossings walk with the parallel traffic. Trams and buses stop at the same signals:
their stop line is where they enter the controlled area, in the group of the direction they leave it in
(a turning tram runs with the street it turns into).

**Tram tracks and lanes.** Each lane is sampled against the tracks every metre:

| Relation | Rule |
| --- | --- |
| Shared: a same-direction track on or beside the lane | The car drives either clear of it (a tram's half width plus its own) or on it, never straddling its edge. Cars follow trams, trams follow cars. |
| Join: the lane meets a track it will share | The car gives way to a tram on or about to reach the joining point. |
| Conflict: a track crosses or swings across the lane | The car enters only when no tram is on that stretch or will reach it before the car is clear, and never stops on the rails. |
| Oncoming track beside the lane | Passed, as trams pass each other (mapped opposite tracks are sometimes closer than a tram is wide). |

Trams give way to a tram already on (or nearer to) a crossing or joining track, and follow trams ahead of
them on a shared track.

**Buses.** Every bus route gets a lane (`npm run bus:lanes -- <city>`, also part of `city:build`): the car
lane of its own direction where there is one, otherwise as far right as the bus fits. Route lines from GTFS
and OpenStreetMap follow the middle of the street, so without this both directions met head-on. Standing
buses (station and tour bays, a bus at the end of its mapped run) are moved to the kerb when there is room;
otherwise cars steer round them.

**Bus stops.** Buses halt at their stops: the stop poles come from the data (`npm run bus:stops -- <city>`:
HSL GTFS for Helsinki, OpenStreetMap elsewhere; an extension's `transit.json` lists each line's own stops).
A bus takes the poles beside its right-hand kerb, eases up to 1.6 m towards the kerb where the whole swept
approach and departure stay on mapped road (otherwise it stops in its lane), stands with its doors open for
four to eight seconds and pulls out again.

**Bodies.** Cars never drive or spawn into a tram section or a bus body, and trams and buses never move
into a car. Cars do not spawn inside a junction box or on a tram conflict.

**Last resort.** Every car, tram and bus records what it waits for (`hold`, `holdBy`). When those links form
a closed loop (a standoff, or a queue that has wrapped round a block), the lowest-id car in the loop that
waits for another car squeezes past that one car; away from the player it is recycled instead. A car and a
tram or bus holding each other resolve the same way. The flow check counts these squeezes separately; they
should stay rare.

## Checking a city

```sh
npm run traffic:check -- tampere                 # every watched spot, 240 s, two seeds
npm run traffic:check -- helsinki --spot kauppa  # one spot
npm run traffic:check -- tampere --seconds 120 --seeds 1 --json
```

The check (`scripts/traffic-harness.mjs`) steps cars, trams and buses headless, seeded, in the same order as
the game, around a parked observer whose camera cone decides what may be recycled. A new city without
curated spots in `FLOW_SPOTS` is checked around its first named start points. It reports:

- **stuck**: a vehicle that has not moved 2 m in 25 s and is not dwelling at a stop. Waiting for a red light
  or behind a tram at its platform (directly or in the queue behind) counts only after 75 s.
- **deadlocks**: stuck vehicles waiting on each other in a loop.
- **overlaps**: bodies inside each other (car, tram, bus), with tight oncoming passes and gridlock squeezes
  listed apart.
- **trams blocked**: the share of time trams stand still because of other traffic.

Each hotspot is listed with local coordinates, street name and cause, e.g.
`car 12 at -769,25 Mannerheimintie t=96s: tram (car ahead)`; the cause is what the vehicle mostly waited
for: `signal`, `tram`, `keep clear`, `give way`, `follow`, `contact` (a body in the way) or `road` (the lane
leaves the mapped carriageway).

`tests/traffic-flow.test.mjs` runs a shortened check for Helsinki and Tampere in CI and fails on any
deadlock, more than 2 stuck per 100 vehicle-minutes, overlapping bodies, or trams held up by traffic.

## When a spot keeps failing

| Cause | Usually |
| --- | --- |
| `road` | The lane leaves the carriageway polygons: a missing road surface or a misplaced way. Cars route round such lanes when they can. |
| `contact` at a junction | A lane drawn through the junction where the surfaces do not match; check the way geometry. |
| `tram` for a long time | Very frequent trams across a lane with no signal; map the `highway=traffic_signals` node. |
| Buses waiting head-on | The route line runs where the road is too narrow for a lane each way; run `npm run bus:lanes -- <city>` after fixing the street. |
| Trams never stopping | Tram stops are taken from `railway=tram_stop`, `tram=yes` and `light_rail=yes` nodes near the track. |
