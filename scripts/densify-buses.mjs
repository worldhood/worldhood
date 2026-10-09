// Demo traffic density, not a live timetable. Preserve original dated routes.
import {readFileSync,writeFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {SpatialIndex} from '../src/geo.js';
import {busFitsRoad,busOverlaps,usableBusPaths} from '../src/bus-simulation.js';
import {prepareGraph,routePoint} from '../src/mobility.js';
import {correctHarbourLanes} from '../src/road-safety.js';
const city=JSON.parse(gunzipSync(readFileSync('public/data/city.pack'))),data=JSON.parse(readFileSync('public/data/bus-corridors.json'));
const world={buildings:new SpatialIndex(city.buildings),roads:new SpatialIndex(city.roads.filter(r=>!/Koroke/.test(r.kind))),trafficForbidden:new SpatialIndex(city.roads.filter(r=>/Koroke/.test(r.kind)))};
const bays=data.stationBays.filter(b=>!b.demoStaging);
for(const stop of data.stationStops){
 if(bays.some(b=>b.stopId===stop.id))continue;
 const candidates=[];
 for(let dx=-7;dx<=7;dx+=.5)for(let dz=-5;dz<=5;dz+=.5){
  const p={x:stop.x+dx,z:stop.z+dz,heading:-3.047,kind:'city',stopId:stop.id,platform:stop.platform,line:'',destination:'RAUTATIENTORI',demoStaging:true,reference:'Occupied mapped HSL terminal bay; approximate standing position and fictional occupancy, no invented service number'};
  if(busFitsRoad(p,world)&&!bays.some(b=>busOverlaps(p,b,1)))candidates.push({p,cost:dx*dx+dz*dz});
 }
 candidates.sort((a,b)=>a.cost-b.cost);if(candidates[0])bays.push(candidates[0].p);
}
// Charter coaches use directed, measured road segments, not fictional HSL lines.
const graph=prepareGraph(correctHarbourLanes(JSON.parse(readFileSync('public/data/mobility.json'))).roads);
const additions=[];
for(const [from,to] of [[1056,752],[649,1417]]){
 const edge=graph.edges.find(e=>e.from===from&&e.to===to),points=[];
 for(let s=0;s<edge.length;s+=2){const p=routePoint(edge,s);points.push([p.x,p.z]);}
 const end=routePoint(edge,edge.length);points.push([end.x,end.z]);
 const id=`demo-harbour-coach-${from}-${to}`;
 const paths=usableBusPaths({paths:[{id,kind:'coach',line:'',destination:'TILAUSAJO',points,speedLimitKmh:30,demoStaging:true,reference:'Charter traffic on a measured directed road, not a scheduled HSL service'}]},world);
 for(const p of paths){const {cumulative,...rest}=p;additions.push(rest);}
}
data.stationBays=bays;data.paths=[...data.paths.filter(p=>!p.demoStaging),...additions];
data.demoDensityNote='Mapped terminal bays occupied for the demo; two charter corridors earlier on the harbour route. Not current service or live bus occupancy.';
writeFileSync('public/data/bus-corridors.json',JSON.stringify(data));
console.log(JSON.stringify({stationBays:bays.map(b=>({platform:b.platform,x:b.x,z:b.z})),coachSections:additions.map(p=>({id:p.id,start:p.start,end:p.end}))},null,2));
