## What changes for the player

<!-- One or two sentences. Link the issue. -->

## Screenshots / gameplay video (required for game changes)

<!--
Every pull request that changes the game (src/, public/, index.html, cities/, extensions/, scripts/)
needs at least one screenshot or a short gameplay clip. An automatic check fails without one.
Docs-only pull requests can skip this section.

- Show before and after where it makes sense (same spot, same camera, same weather).
- Screenshot: your browser or OS screenshot tool. Press H in the game to hide the HUD,
  V for capture mode (full resolution, no camera shake), T to pick the weather.
- Video: your OS screen recorder (macOS: Cmd+Shift+5, Windows Game Bar: Win+Alt+R,
  Linux: Ctrl+Alt+Shift+R in GNOME, or OBS anywhere). Keep clips short (10–30 s, MP4 or MOV).
- Drag and drop the files into this text box; GitHub uploads them for you.
- Add the ?city=&start= link so reviewers can see the same place.
-->

| Before | After |
| --- | --- |
| <!-- drop image here --> | <!-- drop image here --> |

Link to reproduce: <!-- e.g. https://worldhood.org/?city=tampere&start=keskustori -->

## Type
- [ ] New area (extension)
- [ ] Landmark
- [ ] Gameplay / simulation
- [ ] Rendering / performance
- [ ] Tooling / docs

## Checklist
- [ ] `npm test` and `npm run build` pass
- [ ] Screenshots or a gameplay video above (game changes)
- [ ] New data sources credited in `NOTICE.md` and the area's provenance
- [ ] No Google Street View pixels, panorama IDs or traced data (see docs/EXTENDING.md)
- [ ] Areas: `review.json` updated with `npm run area:review -- <id>`; maintainers in `CODEOWNERS`
- [ ] Rendering or simulation changes: draw calls and frame time before/after
