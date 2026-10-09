// npm run bus:stops -- <city>: adds the city's bus stop poles to its bus-corridors.json (`stops`), where buses
// pull in and open their doors (assignBusStops in src/bus-simulation.js). Helsinki: HSL GTFS stops
// (scripts/hsl-gtfs.mjs); other cities: the OpenStreetMap bus stops fetched by scripts/city-build.mjs.
import {readFileSync,writeFileSync} from 'node:fs';
import proj4 from 'proj4';
const id=process.argv[2]||'helsinki',root=id==='helsinki'?'public/data':`public/cities/${id}`,file=`${root}/bus-corridors.json`,data=JSON.parse(readFileSync(file)),stops=[];
if(id==='helsinki'){const {rows,toLocal,feedDate}=await import('./hsl-gtfs.mjs');
 rows('stops.txt',r=>{if(r.vehicle_type!=='3'||r.location_type!=='0')return;const [x,z]=toLocal(r.stop_lon,r.stop_lat);if(Math.abs(x)<2400&&Math.abs(z)<2400)stops.push({id:r.stop_id,name:r.stop_name,x,z});});
 data.stopsSource=`HSL GTFS stops, feed ${feedDate()}, CC BY 4.0`;
}else{const city=JSON.parse(readFileSync('public/cities/index.json')).cities.find(c=>c.id===id),to=proj4('EPSG:4326',city.projection);
 for(const e of JSON.parse(readFileSync(`data/raw/cities/${id}/stops.json`)).elements){const t=e.tags||{};if(e.type!=='node'||!(t.highway==='bus_stop'||t.public_transport==='stop_position'&&t.bus==='yes'))continue;const [x,y]=to.forward([e.lon,e.lat]);stops.push({id:`osm-${e.id}`,name:t.name||'',x:+x.toFixed(2),z:+(-y).toFixed(2)});}
 data.stopsSource='OpenStreetMap bus stops, ODbL';
}
data.stops=stops;writeFileSync(file,JSON.stringify(data));console.log(`${id}: ${stops.length} bus stops`);
