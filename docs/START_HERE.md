# Start here: put your city in the game

No coding experience needed. You bring the local knowledge and the photos; an AI coding agent does
the programming. This page walks you through it in plain words.

## Read this first: the bar is high

**A city only goes live when it looks as good as Helsinki.** Not "roughly right". Someone who lives
there should recognise each street instantly.

That means:
- **Real buildings:** the right heights, shapes, colours and windows, street by street.
- **Real trees:** the species and sizes that actually stand on each street. No generic trees.
- **Real public transport:** your city's own buses and trams, in their real colours, on their real
  routes.
- **Real streets:** the cobblestones, kerbs, tram rails, signs and traffic lights where they really
  are.
- **A solid world:** poles, signs and lights you can hit. Nothing you can drive straight through.

Map data (OpenStreetMap) only gives you the skeleton. **The difference comes from comparing every
street with real photos and fixing what's wrong.** It takes time. That's normal, and it's what
makes the game worth playing.

Not finished? That's fine. Your city can still be shared as a **draft**, and others can help finish
it. It goes live on worldhood.org once it reaches the bar.

## What you need

| | What | Why |
| --- | --- | --- |
| 1 | A computer (Mac, Windows or Linux) | To build and test your city |
| 2 | A free [GitHub](https://github.com/signup) account | To send your city to the project |
| 3 | [Node.js](https://nodejs.org) (the "LTS" download) | Runs the game on your computer |
| 4 | An AI coding agent | Does the programming for you |
| 5 | Photos of your city's streets | The most important part (see below) |

## The steps

### 1. Get your own copy

On the [project page](https://github.com/worldhood/worldhood), press **Fork** to make your
own copy. Then ask your coding agent:

> Clone my fork of worldhood, install it, and start the game so I can open it in my browser.

Drive around Helsinki for a few minutes. **That's the quality you're aiming for.**

### 2. Make the skeleton of your city

Tell your agent:

> Build a new city in this project: **Tampere, Finland**. Follow docs/BUILD_YOUR_CITY.md.

(Use your own city's name.) About ten minutes later you can drive around it. It will look plain and
grey. That's expected: this is the starting point, not the result.

### 3. Collect real photos, street by street

This is where your city starts to look like *your* city. Pick the 5 to 15 places everyone knows
first (the main square, the main street, the station, the famous church), then work outwards.

Where to get photos:
- **Your own phone.** The best source: you own them. Walk the street, photograph the buildings, the
  trees, the bus stops, the signs.
- **[Mapillary](https://www.mapillary.com)** and **[Panoramax](https://panoramax.fr)**: street-level
  photos with reuse licences. Check each source's licence and service terms for the intended work,
  and retain the required credits and any share-alike obligations.
- **Your city's open data portal.** Many cities publish their trees, street areas and 3D buildings.
- **[Wikimedia Commons](https://commons.wikimedia.org)**: openly licensed photos of landmarks.
- **Google Street View:** viewing it on Google's service does not grant permission to build
  project assets or map data from it. Use your own on-site observations or permitted photos for
  notes, measurements and modelling; rewriting restricted references in your own words does not
  establish reuse permission. See the [source guidance](EXTENDING.md#street-level-imagery).

Put your photos in a folder and tell your agent which street each one shows.

### 4. Compare and fix, street by street

For each street, ask your agent:

> Compare **Hämeenkatu** in the game with my photos in photos/hameenkatu. List every difference
> (buildings, colours, trees, signs, surfaces, buses) and fix them one by one.

Then drive it yourself. Repeat until it looks right. Then do the next street.

### 5. Check it against the bar

Ask your agent:

> Run the city checks and the area review for my city, and tell me in plain words what is still
> missing before it meets the publishing bar.

Be honest with yourself: would a local recognise this street from a screenshot without signs? If not,
keep going.

### 6. Send it to the project

Ask your agent:

> Open a pull request with my city, following the "Add your city" guide in the README.

Maintainers review it. If something is missing, they tell you what. When it meets the bar, it goes
live on **worldhood.org**.

## Stuck?

- Ask in the project's [GitHub issues](https://github.com/worldhood/worldhood/issues).
- Already someone working on your city? Check the issues labelled `city` before you start, and team
  up.

For more detail, the full playbook is in [BUILD_YOUR_CITY.md](BUILD_YOUR_CITY.md).
