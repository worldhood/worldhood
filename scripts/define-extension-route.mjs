// node scripts/define-extension-route.mjs <id> [--refresh]
// Turns extensions/<id>/extension.json (waypoints, anchors) into route.json:
// centrelines, optional island outline and snapped checkpoints. OSRM/Nominatim
// (© OpenStreetMap contributors, ODbL) only shape the CROP; shipped geometry
// is municipal data from fetch-extension.mjs.
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {local,simplify,simplifyRing,readExtension,extensionDir} from './extension-geometry.mjs';

const id=process.argv[2],ext=readExtension(id),def=ext.definition,RAW=path.join('data/raw/extensions',id);fs.mkdirSync(RAW,{recursive:true});
const UA='worldhood/0.1 (local build; extension crop definition)';
function get(url,file){const dest=path.join(RAW,file);if(!fs.existsSync(dest)||process.argv.includes('--refresh'))execFileSync('curl',['-f','-L','--retry','3','--max-time','90','-sS','-A',UA,url,'-o',dest],{stdio:'inherit'});return JSON.parse(fs.readFileSync(dest));}
const centrelines=[],steps=[];
for(const leg of def.legs){
 const reply=get(`https://router.project-osrm.org/route/v1/driving/${leg.via.map(p=>p.join(',')).join(';')}?overview=full&geometries=geojson&steps=true`,`osrm-${leg.id}.json`);
 if(reply.code!=='Ok')throw Error(`Routing failed for ${leg.id}`);const r=reply.routes[0];
 centrelines.push({id:leg.id,label:leg.label,lengthMetres:Math.round(r.distance),points:simplify(r.geometry.coordinates.map(local),1.5)});
 for(const l of r.legs)for(const s of l.steps)steps.push({leg:leg.id,street:s.name,maneuver:[s.maneuver.type,s.maneuver.modifier].filter(Boolean).join(' '),metres:Math.round(s.distance),at:local(s.maneuver.location)});
}
let island=null;
if(def.island){
 const places=get(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(def.island.query)}&format=json&limit=1&polygon_geojson=1`,`nominatim-${id}.json`);
 const place=places.find(p=>p.geojson?.type==='Polygon');if(!place)throw Error('Island outline unavailable');
 island={name:place.display_name.split(',')[0],ring:simplifyRing(place.geojson.coordinates[0].map(local),2)};
}
// Named circles widen the crop around district centres (e.g. a campus or a town centre).
const areas=(def.areas||[]).map(a=>{const c=local(a.center),ring=[];for(let k=0;k<=32;k++){const t=k%32/32*Math.PI*2;ring.push([+(c[0]+Math.cos(t)*a.radiusMetres).toFixed(2),+(c[1]+Math.sin(t)*a.radiusMetres).toFixed(2)]);}return {name:a.name,ring};});
const segments=centrelines.flatMap(c=>c.points.slice(1).map((b,i)=>({a:c.points[i],b,line:c.id})));
function nearest(q){let best={d:Infinity};for(const {a,b,line} of segments){const dx=b[0]-a[0],dz=b[1]-a[1],l=dx*dx+dz*dz,t=l?Math.max(0,Math.min(1,((q[0]-a[0])*dx+(q[1]-a[1])*dz)/l)):0,p=[+(a[0]+dx*t).toFixed(2),+(a[1]+dz*t).toFixed(2)],d=Math.hypot(p[0]-q[0],p[1]-q[1]);if(d<best.d)best={d,p,line,heading:[dx,dz]};}return best;}
const checkpoints=def.anchors.map(([name,ll])=>{const q=local(ll),best=nearest(q);
 // Landmarks set well back from the road stay at their own position.
 if(best.d>120||island&&name.includes('Open-Air'))return {name,position:[q[0],0,q[1]],onRoute:false,nearestRouteMetres:+best.d.toFixed(1)};
 return {name,position:[best.p[0],0,best.p[1]],onRoute:true,line:best.line,snapMetres:+best.d.toFixed(1)};});
const route={schemaVersion:1,name:ext.title,sourceAxes:'metres: X east, Y up, Z south; origin = src/geo.js ORIGIN (ETRS-GK25)',buffers:def.buffers,centrelines,island,areas,checkpoints,steps,
 provenance:{routing:{service:'OSRM demo server on OpenStreetMap data',licence:'ODbL — © OpenStreetMap contributors',use:'Centreline only defines which municipal data to crop'},island:def.island?{service:'Nominatim',licence:'ODbL — © OpenStreetMap contributors',use:'Outline only extends the crop'}:undefined},
 limitations:ext.limitations};
fs.writeFileSync(path.join(extensionDir(id),'route.json'),JSON.stringify(route,null,1));
console.log(JSON.stringify({centrelines:centrelines.map(c=>`${c.id} ${c.lengthMetres} m`),checkpoints:checkpoints.length},null,1));
