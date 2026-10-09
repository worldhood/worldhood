// Reproducible, dated HSL path subset. This does NOT infer bus lanes from car roads.
import {execFileSync,spawn} from 'node:child_process';
import {readFileSync,writeFileSync} from 'node:fs';
import {createInterface} from 'node:readline';
import proj4 from 'proj4';
const date='20260916',day='wednesday';
function csv(line){const out=[];let s='',q=false;for(let i=0;i<line.length;i++){const c=line[i];if(c==='"'){if(q&&line[i+1]==='"'){s+='"';i++;}else q=!q;}else if(c===','&&!q){out.push(s);s='';}else if(c!=='\r')s+=c;}return [...out,s];}
function rows(file,visit){const text=execFileSync('unzip',['-p','data/raw/hsl-gtfs.zip',file],{maxBuffer:200*1024*1024,encoding:'utf8'}),lines=text.split('\n'),keys=csv(lines[0]);for(let i=1;i<lines.length;i++)if(lines[i]){const v=csv(lines[i]);visit(Object.fromEntries(keys.map((k,j)=>[k,v[j]])));}}
const routes=new Map(),active=new Set(),choices=new Map();
// These are ordinary (blue fleet) lines, not the orange articulated trunk fleet.
rows('routes.txt',r=>{if((r.route_type==='3'||(+r.route_type>=700&&+r.route_type<800))&&['16','17','18','21','23','24','37','41','42','63','69','70','78','611','600'].includes(r.route_short_name))routes.set(r.route_id,r);});
rows('calendar.txt',r=>{if(r.start_date<=date&&r.end_date>=date&&r[day]==='1')active.add(r.service_id);});
rows('calendar_dates.txt',r=>{if(r.date===date){if(r.exception_type==='1')active.add(r.service_id);else active.delete(r.service_id);}});
rows('trips.txt',r=>{if(!routes.has(r.route_id)||!active.has(r.service_id)||!r.shape_id)return;const k=r.route_id+':'+r.direction_id;if(!choices.has(k))choices.set(k,new Map());const m=choices.get(k);if(!m.has(r.shape_id))m.set(r.shape_id,{...r,count:0});m.get(r.shape_id).count++;});
const selected=[...choices.values()].map(m=>[...m.values()].sort((a,b)=>b.count-a.count)[0]),shapes=new Map(selected.map(s=>[s.shape_id,[]]));
const projection=proj4('EPSG:4326','+proj=tmerc +lat_0=0 +lon_0=25 +k=1 +x_0=25500000 +y_0=0 +ellps=GRS80 +units=m +no_defs'),origin=projection.forward([24.9522,60.1701]);
rows('shapes.txt',r=>{const s=shapes.get(r.shape_id);if(s){const p=projection.forward([+r.shape_pt_lon,+r.shape_pt_lat]);s.push({n:+r.shape_pt_sequence,p:[+(p[0]-origin[0]).toFixed(2),+(origin[1]-p[1]).toFixed(2)]});}});
const paths=[];
for(const s of selected){const route=routes.get(s.route_id);let run=[],part=0;function finish(){let length=0;for(let i=1;i<run.length;i++)length+=Math.hypot(run[i][0]-run[i-1][0],run[i][1]-run[i-1][1]);if(length>100&&run.length>3)paths.push({id:s.shape_id+':'+part++,kind:route.route_short_name==='600'?'trunk':'city',line:route.route_short_name,destination:s.trip_headsign,routeName:route.route_long_name,points:run});run=[];}
 for(const {p}of shapes.get(s.shape_id).sort((a,b)=>a.n-b.n)){if(Math.abs(p[0])<2300&&Math.abs(p[1])<2300){if(!run.length||Math.hypot(p[0]-run.at(-1)[0],p[1]-run.at(-1)[1])>.1)run.push(p);}else finish();}finish();}
// Observed in 2024 street-level photography: southbound three-axle CityTour bus at
// Unioninkatu 32. Only this observed straight street segment, no invented loop.
paths.push({id:'observed-unioninkatu-tourist',kind:'tourist',verified:true,line:'',destination:'HELSINKI TOUR',reference:'2024 street-level photography, Unioninkatu north approach; municipal directed edge 1449→1450',points:[[-67.91,133],[-66.4,177],[-64.09,231]]});
const {signals}=JSON.parse(readFileSync('public/data/mobility.json'));
const stationStops=[];rows('stops.txt',r=>{if(r.stop_name==='Rautatientori'&&r.vehicle_type==='3'&&r.location_type==='0'&&r.platform_code.trim()){const p=projection.forward([+r.stop_lon,+r.stop_lat]);stationStops.push({id:r.stop_id,code:r.stop_code,platform:r.platform_code,x:+(p[0]-origin[0]).toFixed(3),z:+(origin[1]-p[1]).toFixed(3)});}});
const stationIds=new Set(stationStops.map(s=>s.id)),trips=new Map(selected.map(s=>[s.trip_id,s]));
// stop_times can exceed 200 MB; stream and filter before parsing, rather than
// materializing a huge string/array in memory.
const stopReader=spawn('unzip',['-p','data/raw/hsl-gtfs.zip','stop_times.txt']);let stopKeys;
for await(const line of createInterface({input:stopReader.stdout,crlfDelay:Infinity})){
 if(!stopKeys){stopKeys=csv(line.replace(/^\uFEFF/,''));continue;}if(!trips.has(line.slice(0,line.indexOf(','))))continue;
 const v=csv(line),r=Object.fromEntries(stopKeys.map((k,i)=>[k,v[i]])),t=trips.get(r.trip_id);
 if(t&&stationIds.has(r.stop_id)){const stop=stationStops.find(s=>s.id===r.stop_id),number=routes.get(t.route_id).route_short_name;stop.lines??=[];if(!stop.lines.includes(number))stop.lines.push(number);}
}
writeFileSync('public/data/buses.json',JSON.stringify({source:'HSL GTFS snapshot acquired for Helsinki; one separately observed tourist segment',url:'https://www.hsl.fi/en/hsl/open-data',license:'CC BY 4.0',date,limitations:'Dated service shapes, not surveyed lane centres or live timetables. Only road-clear straight/curved segments passing conservative full bus footprint checks are used. No automatic random-road rerouting. Stop poles for dwell are added to bus-corridors.json by scripts/bus-stops.mjs.',stationStops,signals,paths}));
console.log('Bus paths:',paths.length,paths.map(p=>p.line+': '+p.destination));
