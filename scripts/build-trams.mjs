import {execFileSync} from 'node:child_process';
import {writeFileSync} from 'node:fs';
import proj4 from 'proj4';
const date='20260916',day='wednesday';
function csv(line){const out=[];let s='',quoted=false;for(let i=0;i<line.length;i++){const c=line[i];if(c==='"'){if(quoted&&line[i+1]==='"'){s+='"';i++;}else quoted=!quoted;}else if(c===','&&!quoted){out.push(s);s='';}else if(c!=='\r')s+=c;}out.push(s);return out;}
function rows(file,visit){const text=execFileSync('unzip',['-p','data/raw/hsl-gtfs.zip',file],{maxBuffer:160*1024*1024,encoding:'utf8'}),lines=text.split('\n'),keys=csv(lines[0]);for(let i=1;i<lines.length;i++){if(!lines[i])continue;const values=csv(lines[i]);visit(Object.fromEntries(keys.map((key,j)=>[key,values[j]])));}}
const routes=new Map(),active=new Set(),choices=new Map();
rows('routes.txt',r=>{if(r.route_type==='0'&&['1','2','3','4','5','6','7','9','10B'].includes(r.route_short_name))routes.set(r.route_id,r);});
rows('calendar.txt',r=>{if(r.start_date<=date&&r.end_date>=date&&r[day]==='1')active.add(r.service_id);});
rows('calendar_dates.txt',r=>{if(r.date===date){if(r.exception_type==='1')active.add(r.service_id);else active.delete(r.service_id);}});
rows('trips.txt',r=>{if(!routes.has(r.route_id)||!active.has(r.service_id)||!r.shape_id)return;const key=r.route_id+':'+r.direction_id;if(!choices.has(key))choices.set(key,new Map());const map=choices.get(key);if(!map.has(r.shape_id))map.set(r.shape_id,{...r,count:0});map.get(r.shape_id).count++;});
const selected=[...choices.values()].map(m=>[...m.values()].sort((a,b)=>b.count-a.count)[0]),shapes=new Map(selected.map(s=>[s.shape_id,[]]));
const projection=proj4('EPSG:4326','+proj=tmerc +lat_0=0 +lon_0=25 +k=1 +x_0=25500000 +y_0=0 +ellps=GRS80 +units=m +no_defs'),origin=projection.forward([24.9522,60.1701]);
rows('shapes.txt',r=>{const shape=shapes.get(r.shape_id);if(!shape)return;const p=projection.forward([+r.shape_pt_lon,+r.shape_pt_lat]);shape.push({sequence:+r.shape_pt_sequence,p:[+(p[0]-origin[0]).toFixed(2),+(origin[1]-p[1]).toFixed(2)]});});
const paths=[];
for(const s of selected){const points=shapes.get(s.shape_id).sort((a,b)=>a.sequence-b.sequence).map(p=>p.p),route=routes.get(s.route_id);let run=[],part=0;
 function finish(){if(run.length>5){let length=0;for(let i=1;i<run.length;i++)length+=Math.hypot(run[i][0]-run[i-1][0],run[i][1]-run[i-1][1]);if(length>150)paths.push({id:s.shape_id+':'+part++,line:route.route_short_name,destination:s.trip_headsign,routeName:route.route_long_name,points:run,length:+length.toFixed(2)});}run=[];}
 for(const p of points){if(Math.abs(p[0])<2380&&Math.abs(p[1])<2380){if(!run.length||Math.hypot(p[0]-run.at(-1)[0],p[1]-run.at(-1)[1])>.05)run.push(p);}else finish();}finish();
}
const stops=[];rows('stops.txt',r=>{if(r.vehicle_type!=='0'||r.location_type!=='0')return;const p=projection.forward([+r.stop_lon,+r.stop_lat]),x=+(p[0]-origin[0]).toFixed(2),z=+(origin[1]-p[1]).toFixed(2);if(Math.abs(x)<2380&&Math.abs(z)<2380)stops.push({id:r.stop_id,name:r.stop_name,x,z});});
writeFileSync('public/data/trams.json',JSON.stringify({source:'HSL GTFS, delivered 2026-09-16',url:'https://www.hsl.fi/en/hsl/open-data',license:'CC BY 4.0',date,selection:'Most frequent scheduled shape per line/direction active on the snapshot date; lines 1,2,3,4,5,6,7,9,10B where available (10B is the service actually running through Lasipalatsi on the snapshot date; plain 10 has one scheduled trip)',limitations:'Route shapes, not surveyed rail centres. Rail gauge follows vehicle specification; switches, signals, speed and departure intervals are simplified. Simulation is not live HSL tracking.',paths,stops}));
console.log(paths.map(p=>({line:p.line,destination:p.destination,length:p.length})));console.log('Saved',paths.length,'route sections');
