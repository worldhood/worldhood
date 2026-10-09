# Building landmarks for real

City photo textures make most buildings recognisable. Famous ones need actual modelled
geometry: columns, cornices, towers, canopies, glazing. They also need it when the city has no
photo texture at all (e.g. Parliament House is a plain grey shell today). This guide shows how
landmarks are built in code, so they render properly at any angle and in any light.

## Principles

- **Measured where possible, interpreted where necessary, and labelled either way.** Footprints,
  wall planes, heights and positions come from municipal data. Bay counts, ornament profiles and
  colours come from reference observations and are marked as estimates in the landmark's sources
  file.
- **Original geometry, not photo pixels.** Landmarks are built from code (three.js geometry +
  materials). Reference photos guide proportions; they are never textures.
- **Cheap enough for a phone:**
  - batch geometry by material (one draw call per material, not per window);
  - keep fine detail out of the far level of detail;
  - keep a landmark within roughly 20–60k triangles.
- **Collisions follow the footprint.** Anything the car shouldn't drive through is returned as an
  obstacle ring.

## Two ways to add a landmark

### A. Replace a façade of a measured building

Use this when the city's 3D shell is right but its façade is smeared, blank or untextured.
Examples: `src/lasipalatsi-building.js`, `src/forum-building.js`, `src/sugar-cube.js`.

1. Find the building's **RATU** (municipal building number). Use the inventory in
   `extensions/<id>/review-request.json`, or drive there in dev mode and use `window.openCityDrive`.
2. Read the measured wall planes from the building's parts in `buildings3d-index.json`. The planes
   (normal `n`, offset `d`, span along the wall, height) go in a constant like `LASIPALATSI_PLANES`.
3. Export two functions:
   - `isXFront(ratu, face)`: true for the faces you replace. `building-detail.js` then skips the
     photo shell for them.
   - `createXFront()`: returns meshes registered to those planes. Pillars, glazing, cornices and
     window reveals are real boxes and extrusions.
4. Hook them into `src/building-detail.js`, next to the existing `isLasipalatsiFront` /
   `createLasipalatsiFront` lines.

### B. A standalone landmark

Use this for structures the city model lacks or represents poorly: towers, canopies, sculptures,
bridges. Example: `src/kamppi-chapel.js` (the curved timber Chapel of Silence).

1. Write `createX()` returning `{group, obstacles}`:
   - `group` is a `THREE.Group` with merged meshes.
   - `obstacles` is a list of `{name, rings}` footprints in local metres.
2. Add it in `boot()` in `src/main.js`, next to `createKamppiChapel()`, and push its obstacles into
   `streetObstacles`.
3. If it replaces a city building, add that RATU to the skip list in `loadRoof()`. For example, the
   Cathedral (211) is skipped there because `cathedral.js` draws it.

## Files a landmark PR includes

| File | Contents |
| --- | --- |
| `src/<landmark>.js` | Geometry and placement. The top comment states what is measured and what is interpreted |
| `public/models/<landmark>-sources.json` | References (URL, licence, what each was used for), measured inputs, interpreted values, limitations |
| `tests/<landmark>.test.mjs` | Geometry is finite and inside the footprint; draw calls and triangles within budget; obstacles match the footprint |
| `extensions/<id>/review.json` | Re-run `npm run area:review -- <id>`; the landmark's `missing` probability should drop |
| Screenshots | Before and after, from the same `?start=` point |

## Getting proportions right without copying

- **Measure first.** Footprint and height come from the data. Bay counts come from your notes:
  count columns and windows on site, on Mapillary, or by looking in Street View's own viewer.
- **Write the numbers into the sources file** as you go ("14 columns, estimated 1.6 m diameter").
  The next contributor can then check them.
- **Keep it plain when unsure.** A plain, correct mass beats invented ornament.

## Good first landmarks (from the Seurasaari corridor review)

| Landmark | Why (Jev "missing" probability) | Approach |
| --- | --- | --- |
| Parliament House, Mannerheimintie 30 | 0.73: the city has no photo texture, so it renders as a plain shell | A: colonnade, stairs and cornice on the measured shell |
| Finlandia Hall, Mannerheimintie 13e | 0.60: white marble mass reads as generic | A: marble façade bands and the sloped auditorium roof |
| Lasipalatsi and Kiasma | 0.54 | Lasipalatsi has an existing front (A); Kiasma's curved metal roof is B |
