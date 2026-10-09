// npm run bus:lanes -- <city>: gives every bus route a lane (see busLaneOffsets in src/bus-simulation.js):
// the car lane of its own direction where there is one, else as far right as the bus fits. Stored in the
// city's bus-corridors.json; run again whenever the corridors or the road graph change.
import {readFileSync,writeFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {SpatialIndex} from '../src/geo.js';
import {prepareGraph,routePoint} from '../src/mobility.js';
import {busLaneOffsets} from '../src/bus-simulation.js';
import {correctHarbourLanes} from '../src/road-safety.js';
// Car lane lines as short directed segments, for "which lane of my direction is beside me".
export function laneIndex(roads){
 const graph=prepareGraph(structuredClone(roads)),parts=[];
 for(const e of graph.edges){let p=routePoint(e,0);for(let s=2;s<e.length+2;s+=2){const q=routePoint(e,Math.min(s,e.length));const l=Math.hypot(q.x-p.x,q.z-p.z);if(l>.1)parts.push({a:[p.x,p.z],dx:(q.x-p.x)/l,dz:(q.z-p.z)/l,l,bbox:[Math.min(p.x,q.x)-6,Math.min(p.z,q.z)-6,Math.max(p.x,q.x)+6,Math.max(p.z,q.z)+6]});p=q;}}
 return new SpatialIndex(parts,32);
}
// Signed sideways offset (positive to the right of travel) from the route line to the nearest same-direction car lane.
export function laneTarget(path,index){
 return s=>{const p=routePoint(path,s,0),ux=-Math.sin(p.heading),uz=-Math.cos(p.heading);let best=null,bestD=4.5;
  for(const g of index.near(p.x,p.z)){if(ux*g.dx+uz*g.dz<.85)continue;const along=Math.max(0,Math.min(g.l,(p.x-g.a[0])*g.dx+(p.z-g.a[1])*g.dz)),ox=g.a[0]+g.dx*along-p.x,oz=g.a[1]+g.dz*along-p.z,d=Math.hypot(ox,oz);if(d<bestD){bestD=d;best=-ox*uz+oz*ux;}}
  return best===null?null:Math.max(-2.5,Math.min(3,best));};
}
export function addBusLanes(paths,world,roads){const index=laneIndex(roads);let lanes=0;
 for(const p of paths){const {lanes:old,...source}=p,path=prepareGraph({nodes:[0,1],edges:[{...source,from:0,to:1,lane:0}]}).edges[0];p.lanes=busLaneOffsets(path,world,p.kind,laneTarget(path,index));if(p.lanes.some(v=>v!==0))lanes++;}
 return lanes;}
if(import.meta.url===`file://${process.argv[1]}`){
 const id=process.argv[2]||'helsinki',root=id==='helsinki'?'public/data':`public/cities/${id}`;
 const city=JSON.parse(gunzipSync(readFileSync(`${root}/city.pack`))),file=`${root}/bus-corridors.json`,data=JSON.parse(readFileSync(file)),mobility=JSON.parse(readFileSync(`${root}/mobility.json`));
 const world={buildings:new SpatialIndex(city.buildings),roads:new SpatialIndex(city.roads.filter(r=>!/Koroke/.test(r.kind))),trafficForbidden:new SpatialIndex(city.roads.filter(r=>/Koroke/.test(r.kind)))};
 const shifted=addBusLanes(data.paths,world,(id==='helsinki'?correctHarbourLanes(mobility):mobility).roads);writeFileSync(file,JSON.stringify(data));
 console.log(`${id}: ${shifted} of ${data.paths.length} bus routes follow a lane off their route line`);
}
