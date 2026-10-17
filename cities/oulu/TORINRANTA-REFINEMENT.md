> Submission update, 17 October 2026: Toripolliisi geometry and collision are excluded pending artwork permission. Statue descriptions below document an earlier local experiment. See [HANDOVER.md](HANDOVER.md) for current status and unfinished landmarks, including Valkea.

# Torinranta and Toripolliisi visual pass — 2026-10-15

Downloaded ten reference photographs to `data/raw/photos/oulu/market/commons`.
Source URLs, photographers and individual licences are in `market-sources.json`.

## Differences addressed

| Feature | Before | Current local model |
| --- | --- | --- |
| Statue silhouette | Narrow cylindrical trousers and conical coat | Broader trousers, rounded coat and shoulder profile |
| Statue head and cap | Small spherical head and rectangular visor | Fuller face, rounded visor, wider cap crown and badge |
| Statue finish | Uniform green grey | Weathered grey bronze with restrained metal reflection |
| Statue plinth | Undersized base; axis-aligned collider | Two broader plinth layers and rotated footprint collider |
| Torinranta terrace | Flat generic ground | Three timber seating tiers with board seams |
| Access to lower promenade | Missing | Four stair passages registered to OSM ways 1174793830–33 |
| Lower deck | Missing | Timber deck, vertical facing, metal handrails and low bollards |
| Terrace collisions | None | Closed non-drivable terrace footprint |

The figure remains 2.20 m above a 0.34 m plinth. Facial features, materials and dimensions are
interpretations, not a scanned sculpture. The promenade follows the mapped stair points; its
approximately 96 m length, 14 m cross-section and 1.2 m drop are estimates. OSM pier 1174793845
is a line, not a surveyed closed deck polygon. The underlying coastline is unchanged.

## Reference and licence distinctions

- Estormiz, **Oulu Market Square 20260501 01/02**, CC0: timber seating, stairs and promenade.
- Estormiz, **Warehouses Aittatori Oulu 20241005 01/02**, CC0: downloaded and inspected for
  timber and surface context; warehouse geometry is not revised in this pass.
- Earlier 2025 Torinranta photos show construction; temporary works are not permanent scenery.
- **Toripolliisi 2026.jpg**, Alphaios: photographer labels it CC0, but Commons has an active
  deletion nomination concerning the sculpture's underlying copyright. It is downloaded for
  review and is not classified as cleared public-domain artwork. The user's own photo also
  guides the local stylised model; owning that photo does not clear sculpture rights.
- No downloaded photograph pixels, bystanders or poster art are shipped as textures.

## Remaining differences

Statue facial likeness, exact cap/coat contours and surface patina need further sculpture work.
The waterfront's entire rebuilt shoreline, upper stone seating, planting, lamps, seasonal market
stalls, warehouse fronts and exact elevations remain incomplete. The May Day photographs include
temporary tents and crowds; these are not assumed permanent. Oulu remains a draft.

Compare with `npm run place:compare -- oulu market --label=toriranta-refined --look=Overcast`.
Local screenshots are in `data/raw/place-compare/oulu/market/`.

Validation: all 682 tests passed; production build passed (existing large-chunk warning).
Browser inspection found the statue and terrace in the scene and reported no JavaScript or
console errors. Comparison headings are approximate and have been corrected to face each subject.
