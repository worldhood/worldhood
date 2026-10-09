# The worldhood vision

**Explore the world, and build your own corner of it.**

worldhood is an open-source game about places and the people who make them interesting.
Start somewhere familiar or somewhere you have never been. Drive a few streets, get out,
take a bicycle, meet someone, and find a reason to stay a little longer.

The ambition is global: a world that grows because people bring their own neighbourhoods,
ideas and skills to it. Nobody knows every city. Together, we can make places that their
residents recognise and that other players want to explore.

## What you can do today

The browser game is a single-player playground. Helsinki and Tampere have playable areas,
with different levels of detail. Helsinki also has connected map extensions. You can drive,
walk, run, ride a bicycle or scooter, use stopped cars and have branching conversations
with simulated people and market sellers. Traffic, public transport, weather and police give the streets some life.

City building currently happens in this repository: contributors import open data, model
landmarks, refine street details and submit changes for review. There is no in-game building
editor, multiplayer service or system for owning territory yet. The game does not contain
the whole planet, and its reconstructions are not exact digital copies of real cities.

## Where we want to go

**More places, each with a reason to visit.** A useful city starts with connected streets and
readable landmarks. Local knowledge can give it its character: a square, a market, a tram
stop, the shape of the roofs, the trees along a familiar route. Small, carefully made areas
are welcome; nobody needs to recreate a whole city before contributing.

**More life beyond the car.** Walking, cycling and scooters are part of the shared game.
Activities, encounters, public transport and places to stop can make exploration worth doing
at any speed. New mechanics should work wherever the city's data supports them.

**A corner you can make your own.** In the longer term, we want players to build and personalise
places inside the game, and eventually visit one another. How editing, persistence and shared
spaces should work is an open design problem. "Your corner" means creative participation;
it does not grant rights over a real place or exclusive control over an open-source contribution.

**An engine that improves with every contribution.** Better movement, cameras, rendering,
streaming, accessibility, touch controls, physics and authoring tools should benefit every
city. Someone improving the engine is building worldhood just as much as someone modelling
their local street.

These are directions to explore together, not promises of release dates. Multiplayer and
in-game building will need their own designs, prototypes and careful decisions about player
data and shared spaces before becoming public features.

## How we get there

- **Build in the open.** Keep the code available to run, study, modify and fork. Credit the
  people and data behind the work. Keep source licences and attribution with the assets.
- **Make the first minute good.** A player should understand what the game is, enter a place
  quickly and be able to move comfortably. Keep controls legible and the view clear.
- **Keep the world recognisable.** Prefer measured open data and local observations. Record
  estimates, fictional details and gameplay compromises honestly.
- **Share the engine.** Put reusable behaviour in common modules and local identity in city
  data and scenery. A new city should inherit improvements without copying gameplay code.
- **Grow in tested steps.** Ship useful slices, explain limitations, check other cities and
  slower devices, and avoid making the whole world a prerequisite for loading one street.

## Find your place in the project

| Bring | A useful first contribution |
| --- | --- |
| Local knowledge | Report an incorrect street detail, suggest a start point, or document a small area |
| A place you care about | Build a neighbourhood or improve an existing one using the [city guide](BUILD_YOUR_CITY.md) |
| Modelling or visual skills | Create an original landmark, improve a facade, or check rider and vehicle proportions |
| Programming | Improve a shared system using the [engine code map](GAMEPLAY.md) |
| Testing | Try another browser or phone; report the location, controls used and what happened |
| Writing and teaching | Make setup instructions clearer or document how a contribution works |

Start with a small change or open an issue to discuss a larger one. You do not need to use
AI tools, know the whole engine, or become a city maintainer to help.

Read [CONTRIBUTING.md](../CONTRIBUTING.md) for the workflow and [IDEAS.md](IDEAS.md) for possible
projects. Originally built by [Lasse](https://www.linkedin.com/in/lassesaari/). Contributors welcome.
