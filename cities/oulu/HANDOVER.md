# Oulu contributor handover

Checkpoint: 17 October 2026. **Playable draft, not a finished reconstruction.**
Development is paused for contribution and review. No street has completed the
photo-by-photo recognisability review or independent local sign-off. The map includes
generic OSM-derived buildings; their presence does not mean their appearance is finished.

## Landmarks and streets still to finish

| Place | Current state | Next work |
| --- | --- | --- |
| **Valkea shopping centre** | No dedicated, reference-validated Valkea landmark treatment completed in this contribution. Any mapped shell is provisional. | Identify the complete building complex and entrances from permitted references; check footprint, heights, facade materials, glazing, signs and pedestrian connections. Record sources before modelling. |
| **Oulu Cathedral** | Mapped shell; bespoke landmark reconstruction incomplete. | Model and validate tower stages, clock, spire, columns, entrance and steps. |
| **Railway station** | Provisional mapped building. | Validate roof, facade, entrance, platform-facing details and surroundings. |
| **City Hall** | Custom facade, twin roof pavilions, stairs and garden furniture; municipal main-height reference; foundation contact fixed. | Check fine relief, roof profiles, side/rear elevations and the complete garden. Detailed proportions remain estimates. See CITY-HALL-REVIEW.md. |
| **Market Hall and Kauppatori** | Custom hall and fifteen mapped square structures, representative seasonal stalls, paving and waterfront detail. | Validate exact ornament, dimensions, unseen elevations, sign placement, trees, furniture and the seasonal market layout. This is an approximation. See KAUPPATORI-SQUARE-REVIEW.md. |
| **Theatre and Library Saari** | Municipal LOD1 shells with photo-guided facade additions. | Check current glazing, entrances, lettering, steps, quay/garden and finer elevations. Legacy shell data do not establish current detailed roof measurements. See WATERFRONT-IMPORT.md. |
| **Isokatu 37** | Owner-photo-backed colour/material guidance only. | Check full geometry, window rhythm, height and ground-floor frontage. |
| **Central streets** | No completed street-level appearance review. | Start with Saaristonkatu, Torikatu, Kirkkokatu, Aleksanterinkatu, Hallituskatu and Kaarlenvayla: both sides and both directions, with permitted references. |

This list is a starting backlog, not an inventory of every unfinished building.
Most building heights and local facade details still need verification. Pink bus paint
and some front details are implemented; full fleet/body accuracy remains unfinished.

## Why Toripolliisi is absent

**The Toripolliisi 3D reconstruction and its collision obstacle are deliberately excluded
from the submitted code. This is not a missing download or rendering bug.**

The statue is an artwork by Kaarlo Mikkonen. Permission to use the owner's photographs,
or a CC0 licence on a reference photograph, does not by itself establish permission to
redistribute a recreation of the underlying sculpture. Our source review did not establish
that permission; it does not claim that every possible depiction is prohibited.
See `market-sources.json` under `sculptureRights`.

Before adding a recreation, establish permission or another applicable legal basis for
the intended 3D use and distribution. A practical starting point is Oulu Art Museum to
identify the rights holder. Document permission, licence, attribution and any reuse
conditions; check compatibility with an openly distributed game, including modification
and commercial reuse. Do not assume that the photograph's licence clears the sculpture.
Do not restore an invisible collision at the omitted model's location.

The previous implementation is preserved only in the original contributor's **local,
unpushed** `backup/oulu-with-statue-local` branch. Earlier difference checklists and review
captures describe that historical experiment, not what this contribution ships.
The submission branch is based directly on the original upstream checkpoint so that
the omitted model is also absent from its new Git history.

## Simulation, validation and remaining review

- Recorded traffic check: **4.45 stalled episodes per 100 vehicle-minutes**, above the
  passing threshold of 2; zero deadlocks and one overlap. Hotspots and the reproduction
  command are in `gaps.json`. This result remains unresolved; it is not a passing check.
- Automated recognisability review and independent local sign-off remain pending.
- Shared rendering changes need cross-city visual/performance review. Passing unit tests
  does not establish frame-time or visual parity with other cities.
- Detailed reference photos/comparison outputs under `data/raw/` are ignored local files,
  not supplied assets. Owner originals were authorised for reference use, not relicensed
  as freely redistributable photos. Source catalogues and acquisition scripts are included.
- Use municipal/open data or permitted photos for new work. Do not derive game assets,
  measurements or notes from Google Street View without permission covering that use.

For build/run commands and source credits, see README.md. For structured gaps, see
gaps.json. The project maintainer decides submission scope and when Oulu can be published.
