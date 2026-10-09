// node scripts/place-starts.mjs [id ...]   (default: lansivayla espoo)
// Moves the registered start points of map extensions into a traffic lane (src/start-placement.js),
// using the published street areas and road graphs, and rewrites public/data/extensions/index.json.
// The extension builders run this for their own area; `keep` names starts that are aimed on purpose.
import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {pathToFileURL} from 'node:url';
import {pointInPolygon} from '../src/geo.js';
import {startSurfaces,laneStart} from '../src/start-placement.js';

export function placeStarts(ids,{keep=[]}={}){
 const unpack=f=>JSON.parse(gunzipSync(fs.readFileSync(f))),json=f=>JSON.parse(fs.readFileSync(f));
 const indexFile='public/data/extensions/index.json',index=json(indexFile),main=unpack('public/data/city.pack');
 const roads=[...main.roads],pavement=[...main.pavement],edges=[...json('public/data/mobility.json').roads.edges];
 for(const e of index.extensions){const c=unpack(`public/data/${e.dir}/city.pack`);roads.push(...c.roads);pavement.push(...c.pavement);edges.push(...json(`public/data/${e.dir}/mobility.json`).roads.edges);}
 const surfaces=startSurfaces(roads,pavement);
 for(const e of index.extensions.filter(e=>ids.includes(e.id)))e.starts=e.starts.map(s=>{
  if(keep.includes(s.name))return s;
  const p=laneStart(s,edges,surfaces);if(!p){console.warn(`${s.name}: no clear lane nearby, left as is`);return s;}
  const street=roads.find(r=>r.name&&pointInPolygon(p.x,p.z,r.rings))?.name||s.street;
  console.log(`${s.name}: ${s.street} (${s.x},${s.z}) → ${street} (${p.x},${p.z}) heading ${p.heading}`);
  return {...p,street};
 });
 fs.writeFileSync(indexFile,JSON.stringify(index));
}
if(import.meta.url===pathToFileURL(process.argv[1]).href)placeStarts(process.argv.slice(2).length?process.argv.slice(2):['lansivayla','espoo']);
