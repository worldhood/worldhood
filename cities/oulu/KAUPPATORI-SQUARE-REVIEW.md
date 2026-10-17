> Submission update, 17 October 2026: Toripolliisi geometry and collision are excluded pending artwork permission. Statue descriptions below document an earlier local experiment. See [HANDOVER.md](HANDOVER.md) for current status and unfinished landmarks, including Valkea.

# Kauppatori whole-square pass — 2026-10-15

This pass treats the Market Hall, Toripolliisi, trading square, warehouse fronts and Torinranta
as one area. Oulu remains a draft; this is original procedural geometry guided by reference
photographs, not an exact scan or a finished reconstruction.

## Changes and evidence

| Area | Difference addressed | Reference and qualification |
| --- | --- | --- |
| Food kiosks | Default 10 m blocks made the square look walled in | Five mapped kiosks replaced by approximately 3 m serving counters and low roofs; 2023/2026 CC0 square photos |
| Torin Kippari | Generic rectangular building | Simplified white/black boat, cabin glazing, red trim, rail and mast on its mapped footprint; CC0 2026-06-23 |
| Aittatori warehouses | Generic flat walls and roofs | Five timber warehouse models with pitched roofs, log courses, shutters and dark doors; 2024 corridor photos and 2026 Kemppainen front |
| Kemppainen | Missing identifying front | Blue glazed door, upper shutter and original plain-text shop sign; CC0 2026-09-02 |
| Southern restaurant warehouses | Generic blocks | Suola-Aitta, Tervasoihtu, Aitta 22 and the yellow front warehouse receive gables, timber fronts and shutters; CC0 2017/2020 photos |
| Square surface | Generic ground between the narrow mapped paths | Rose/warm-grey granite slab fields with grey dividing strips; CC0 2023-06-29 square views |
| Trading activity | Empty plaza | Twelve fabric canopies, produce counters and clothing displays in a representative summer layout |
| Market Hall detail | Opaque green arch infills and simple clerestory crosses | Darker inset glazing and double diagonal glazing bars; CC0 2025-08-05 detail |
| Photo comparisons | Wide game lens made telephoto reference buildings appear disproportionately large | Optional development inspection-camera FOV; warehouse 82 mm full-frame and quay 69 mm-equivalent EXIF used as initial lens estimates |

Fifteen mapped structures are replaced. Their ground outlines come from OSM, retained exactly in
the generated place JSON. Eaves, roof rises, colours, shutter dimensions, signs and unseen facades
are estimates. Corridor photographs only support partial observations of the western warehouse
group; the shared facade treatment is provisional. Some buildings have changed operators since the
older photos; signs are only added where the model has an identifying reference.

Entrance bases use the adjacent front pavement elevation, so a low terrain sample beneath the
back of a long warehouse does not bury its doorway. The seven projecting kiosk counters and
warehouse stair sets have additional collision outlines outside the main mapped buildings.

The square surface extent is authored from the visible core square, then clipped against mapped
building interiors, carriageways and existing place paving. It is not claimed to be a surveyed
paving boundary. Slab dimensions and grey-band spacing are estimates.

Summer stalls are movable. Their number, arrangement and merchandise are representative, not a
claim about permanent positions or the exact stalls in a particular photo. Every stall has a
matching closed gameplay collision footprint. The build checks a clearance margin against mapped
buildings, carriageways and other stalls. Setting `season` to `winter` in `market-square.json`
omits the summer trading stalls and their obstacles.

## Sources and reproduction

Individual URLs, authors and licences are in [market-sources.json](market-sources.json).
Twelve additional CC0 images were downloaded for this pass under
`data/raw/photos/oulu/market/commons/`; they are not copied into shipped textures. Original signs,
timber grain, paving, clothing and produce are drawn in code. The previously recorded unresolved
Toripolliisi sculpture-rights question remains unchanged by this pass.

```powershell
npm run place:build -- oulu market
npm run place:compare -- oulu market --label=square-final --look=Overcast
node --test tests/oulu-market.test.mjs
```

The optional `fov` field in a reference view is the camera's vertical field of view in degrees.
EXIF helps but does not establish an exact camera pose: cropping, geotag accuracy, eye height,
weather and date differences remain. Inspection controls are available only in development.

## Remaining differences

The larger surrounding city blocks and hotel still have provisional facades. The modern Market
Hall annex canopy, exact warehouse side/back elevations, cafe terraces, complete furnishings,
lighting positions, drainage, plants and entire rebuilt shoreline need further work. Toripolliisi
is still stylised. The square is less dense than the busiest event photos. These remaining gaps
are not marked complete, and this pass does not resolve Oulu's existing traffic-stall failures.

Browser review artifacts: `data/raw/oulu-review/square-browser-check.json` and
`square-overview.png`, `square-stalls.png`, `square-warehouses.png`, `square-quay.png`.

Validation: the full 684-test suite passed; all four focused Oulu tests passed again after the
final facade and entrance adjustments. The final production build passed, and four live browser
views reported no JavaScript or console errors. The build retains its existing large-chunk warning.
