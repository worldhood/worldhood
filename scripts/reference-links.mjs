// node scripts/reference-links.mjs <id>
// For each checkpoint of an area: links that open street-level imagery at the
// same spot and heading as the game, and a notes template to fill in by hand.
// Street View is only opened for a person to LOOK at (no download, scraping or
// tracing). Mapillary imagery is openly licensed (CC BY-SA) and can be cited.
import fs from 'node:fs';
import path from 'node:path';
import {readExtension,readRoute,wgs84} from './extension-geometry.mjs';

const id=process.argv[2],ext=readExtension(id),route=readRoute(id);
const segments=route.centrelines.flatMap(c=>c.points.slice(1).map((b,i)=>({a:c.points[i],b,line:c.id})));
// Compass bearing of the route at a point (0 = north, 90 = east; local Z points south).
function bearing([x,z]){
 let best=null;for(const {a,b} of segments){const dx=b[0]-a[0],dz=b[1]-a[1],l=dx*dx+dz*dz;if(!l)continue;const t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/l)),d=Math.hypot(a[0]+dx*t-x,a[1]+dz*t-z);if(!best||d<best.d)best={d,dx,dz};}
 return best?Math.round((Math.atan2(best.dx,-best.dz)*180/Math.PI+360)%360):0;
}
const file=path.join('extensions',id,'reference-notes.json'),notes=fs.existsSync(file)?JSON.parse(fs.readFileSync(file)):{};
const rows=[];
for(const cp of route.checkpoints){
 const [lon,lat]=wgs84(cp.position[0],cp.position[2]).map(v=>+v.toFixed(6)),heading=bearing([cp.position[0],cp.position[2]]);
 const game=`?city=helsinki&start=${encodeURIComponent(cp.name)}`;
 rows.push({place:cp.name,lat,lon,heading,
  streetView:`https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lat},${lon}&heading=${heading}`,
  mapillary:`https://www.mapillary.com/app/?lat=${lat}&lng=${lon}&z=18`,
  game});
 notes[cp.name]??={source:'',observedOn:'',observations:[]};
}
fs.writeFileSync(file,JSON.stringify(notes,null,1));
for(const r of rows)console.log(`\n${r.place}  (${r.lat}, ${r.lon}, heading ${r.heading}°)\n  look:      ${r.streetView}\n  open data: ${r.mapillary}`);
console.log(`\nWrite what you see, in your own words, into ${file} (one short fact per line), then run: npm run area:review -- ${id}`);
