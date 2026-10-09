// npm run extension:transit -- <id> [<id>…] [--date YYYYMMDD]: HSL buses, and the Raide-Jokeri light rail
// (line 15), for map extensions (default: lansivayla espoo). Run after the area itself is built
// (scripts/build-extension.mjs / build-espoo.mjs); writes public/data/extensions/<id>/transit.json and
// lists it in the area's catalog entry. Source: HSL GTFS (scripts/hsl-gtfs.mjs), CC BY 4.0.
//  - every bus line through the area: its most frequent shape per direction on the snapshot weekday, cut to
//    the area (the Helsinki snapshot square keeps its own buses), then the full bus body clearance and lane
//    checks Helsinki's corridors get (src/bus-simulation.js, scripts/bus-lanes.mjs), with the line's own stops;
//  - line 15 the same way as a light rail line, with its stops, run like the trams (src/tram-simulation.js).
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {SpatialIndex} from '../src/geo.js';
import {usableBusPaths} from '../src/bus-simulation.js';
import {routePoint} from '../src/mobility.js';
import {pointInMulti} from './extension-geometry.mjs';
import {addBusLanes} from './bus-lanes.mjs';
import {rows,stopTimes,toLocal,activeServices,feedDate} from './hsl-gtfs.mjs';
const args=process.argv.slice(2),flag=k=>{const i=args.indexOf('--'+k);return i<0?null:args[i+1];},date=flag('date')||'20261014';
const ids=args.filter((a,i)=>!a.startsWith('--')&&!args[i-1]?.startsWith('--'));if(!ids.length)ids.push('lansivayla','espoo');
const INDEX='public/data/extensions/index.json',index=JSON.parse(readFileSync(INDEX)),areas=ids.map(id=>{const e=index.extensions.find(e=>e.id===id);if(!e)throw Error(`No built extension ${id}`);return e;});
const CORE=2300,core=([x,z])=>Math.abs(x)<CORE&&Math.abs(z)<CORE,LIGHT_RAIL='15';
// Clearance against every mapped street: Helsinki's and every built area's, so a line crossing a seam is judged on both sides.
const packs=[JSON.parse(gunzipSync(readFileSync('public/data/city.pack'))),...index.extensions.map(e=>JSON.parse(gunzipSync(readFileSync(`public/data/${e.dir}/city.pack`))))];
const roads=packs.flatMap(p=>p.roads),world={buildings:new SpatialIndex(packs.flatMap(p=>p.buildings)),roads:new SpatialIndex(roads.filter(r=>!/Koroke/.test(r.kind))),trafficForbidden:new SpatialIndex(roads.filter(r=>/Koroke/.test(r.kind)))};
// Lines, the most frequent shape per line and direction, its trips.
const routes=new Map(),active=activeServices(date),choices=new Map();
rows('routes.txt',r=>{const t=+r.route_type;if(t===3||t>=700&&t<800||r.route_short_name===LIGHT_RAIL&&(t===0||t===900))routes.set(r.route_id,r);});
rows('trips.txt',r=>{if(!routes.has(r.route_id)||!active.has(r.service_id)||!r.shape_id)return;const k=r.route_id+':'+r.direction_id;if(!choices.has(k))choices.set(k,new Map());const m=choices.get(k);if(!m.has(r.shape_id))m.set(r.shape_id,{...r,count:0});m.get(r.shape_id).count++;});
const selected=[...choices.values()].map(m=>[...m.values()].sort((a,b)=>b.count-a.count)[0]).filter(s=>s.count>=6),shapes=new Map(selected.map(s=>[s.shape_id,[]]));
rows('shapes.txt',r=>{const s=shapes.get(r.shape_id);if(s)s.push({n:+r.shape_pt_sequence,p:toLocal(r.shape_pt_lon,r.shape_pt_lat)});});
for(const s of shapes.values())s.sort((a,b)=>a.n-b.n);
const touches=new Set(selected.filter(s=>shapes.get(s.shape_id).some(({p})=>areas.some(a=>pointInMulti(p[0],p[1],a.playable)))).map(s=>s.trip_id));
const tripStops=new Map();await stopTimes(touches,r=>{if(!tripStops.has(r.trip_id))tripStops.set(r.trip_id,[]);tripStops.get(r.trip_id).push([+r.stop_sequence,r.stop_id]);});
const allStops=new Map();rows('stops.txt',r=>{if(r.location_type==='0'){const [x,z]=toLocal(r.stop_lon,r.stop_lat);allStops.set(r.stop_id,{id:r.stop_id,name:r.stop_name,x,z});}});
const feed=feedDate(),compact=p=>{const from=Math.max(0,p.start-8),to=Math.min(p.length,p.end+8),a=routePoint(p,from,0),b=routePoint(p,to,0),points=[[a.x,a.z],...p.points.filter((_,i)=>p.cumulative[i]>from&&p.cumulative[i]<to),[b.x,b.z]].map(q=>q.map(v=>+v.toFixed(2)));const {cumulative,...rest}=p;return {...rest,points,start:+(p.start-from).toFixed(2),end:+(p.end-from).toFixed(2),length:+(to-from).toFixed(2)};};
for(const area of areas){
 const inside=([x,z])=>pointInMulti(x,z,area.playable),buses=[],trams=[],busStops=new Map(),tramStops=new Map();
 for(const s of selected){if(!touches.has(s.trip_id))continue;const route=routes.get(s.route_id),rail=route.route_short_name===LIGHT_RAIL,own=(tripStops.get(s.trip_id)||[]).sort((a,b)=>a[0]-b[0]).map(([,id])=>allStops.get(id)).filter(st=>st&&inside([st.x,st.z])&&(rail||!core([st.x,st.z])));
  let run=[],part=0;const finish=()=>{let length=0;for(let i=1;i<run.length;i++)length+=Math.hypot(run[i][0]-run[i-1][0],run[i][1]-run[i-1][1]);
   if(length>(rail?150:100)&&run.length>3){const path={id:`${s.shape_id}:${area.id}:${part++}`,line:route.route_short_name,destination:s.trip_headsign,routeName:route.route_long_name,points:run};
    if(rail){trams.push({...path,vehicle:'jokeri',length:+length.toFixed(2)});for(const st of own)tramStops.set(st.id,st);}
    else{buses.push({...path,kind:/^5\d\d$/.test(route.route_short_name)?'trunk':'city',stopIds:own.map(st=>st.id)});for(const st of own)busStops.set(st.id,st);}}run=[];};
  for(const {p} of shapes.get(s.shape_id)){if(inside(p)&&(rail||!core(p))){if(!run.length||Math.hypot(p[0]-run.at(-1)[0],p[1]-run.at(-1)[1])>.1)run.push(p);}else finish();}finish();}
 // Most bus lines share Länsiväylä and the Tapiola streets: every clear section is kept, the game spawns a few near the player.
 const usable=buses.flatMap(p=>usableBusPaths({paths:[p]},world)).map(compact),mobility=JSON.parse(readFileSync(`public/data/${area.dir}/mobility.json`));
 const shifted=addBusLanes(usable,world,mobility.roads);
 for(const p of usable)p.stopIds=p.stopIds.filter(id=>{const st=busStops.get(id);return p.points.some(q=>Math.hypot(q[0]-st.x,q[1]-st.z)<40);});
 const used=new Set(usable.flatMap(p=>p.stopIds));
 const transit={source:`HSL GTFS, feed ${feed}; weekday ${date}`,url:'https://www.hsl.fi/en/hsl/open-data',license:'CC BY 4.0',date,
  selection:'Most frequent scheduled shape per line and direction on the snapshot weekday (at least 6 trips), cut to the area; buses only on stretches that pass the full bus body road clearance check. Line 15 (Raide-Jokeri) is light rail.',
  limitations:'Route shapes, not surveyed lane or rail centres; stops from the dated feed; timetables and headways simulated, not live HSL tracking.',
  buses:{paths:usable,stops:[...busStops.values()].filter(s=>used.has(s.id))},trams:{paths:trams,stops:[...tramStops.values()]}};
 writeFileSync(`public/data/${area.dir}/transit.json`,JSON.stringify(transit));area.transit='transit.json';
 console.log(`${area.id}: ${usable.length} clear bus sections of ${buses.length} (${[...new Set(usable.map(p=>p.line))].sort((a,b)=>parseInt(a)-parseInt(b)).join(' ')}), ${shifted} on a lane, ${transit.buses.stops.length} bus stops; light rail ${trams.length} sections, ${tramStops.size} stops`);
}
writeFileSync(INDEX,JSON.stringify(index));
