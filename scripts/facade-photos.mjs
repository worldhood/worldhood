// npm run facades:photos -- <city> "<street name>" [--from=x0 --to=x1] [--spacing=35] [--refresh]
// Street-level reference photos for façades: recent Mapillary images (CC BY-SA 4.0) along one
// street, roughly every `spacing` metres in each direction plus side-facing shots. Saves them under
// data/raw/mapillary/<city>/<street>/ (git-ignored, never committed) together with photos.json
// (camera position in game coordinates, heading, date, author) and buildings.json: every building
// fronting the street with the photos that show it. Your coding agent then opens the photos,
// describes each building in cities/<city>/facades.json and compares with `npm run facades:compare`.
// Google imagery is never used. Needs MAPILLARY_TOKEN (environment or .env.local).
import fs from 'node:fs';
import path from 'node:path';
import {gunzipSync} from 'node:zlib';
import proj4 from 'proj4';
import {env} from './env.mjs';
import {readPoints,tileOf} from './mvt.mjs';
import {slugify,streetLine,alongStreet,frontingBuildings,photosShowing,pickPhotos} from '../src/facade-photos.js';

const args=process.argv.slice(2),flag=(k,d)=>{const a=args.find(a=>a.startsWith(`--${k}=`));return a?+a.split('=')[1]:d;};
const [cityId,street]=args.filter(a=>!a.startsWith('--'));
if(!cityId||!street)throw Error('Usage: npm run facades:photos -- <city> "<street name>" [--from=x --to=x] [--spacing=35]');
const token=env('MAPILLARY_TOKEN');if(!token)throw Error('Set MAPILLARY_TOKEN in .env.local (free: https://www.mapillary.com/dashboard/developers)');
const registry=JSON.parse(fs.readFileSync('public/cities/index.json')).cities.find(c=>c.id===cityId);if(!registry)throw Error(`No built city "${cityId}"`);
const root=path.join('public',registry.dataRoot),city=JSON.parse(gunzipSync(fs.readFileSync(path.join(root,'city.pack'))));
const parts=JSON.parse(fs.readFileSync(path.join(root,'buildings3d-index.json'))).tiles.flatMap(t=>t.parts);
const toLocal=proj4('EPSG:4326',registry.projection),toWgs=proj4(registry.projection,'EPSG:4326');
const local=(lon,lat)=>{const [x,y]=toLocal.forward([lon,lat]);return [+x.toFixed(2),+(-y).toFixed(2)];};

const line=streetLine(city.roads.filter(r=>r.name===street),{from:flag('from',-Infinity),to:flag('to',Infinity)});
if(line.length<2)throw Error(`No carriageway named "${street}" in ${cityId}`);
const dir=path.join('data','raw','mapillary',cityId,slugify(street));fs.mkdirSync(dir,{recursive:true});

// Every image near the street from Mapillary's coverage tiles (zoom 14); the Graph API bbox
// search only returns a sample. Cached per tile; --refresh fetches again.
const near=new Map(),[minX,maxX]=[Math.min(...line.map(p=>p[0]))-60,Math.max(...line.map(p=>p[0]))+60],[minZ,maxZ]=[Math.min(...line.map(p=>p[1]))-60,Math.max(...line.map(p=>p[1]))+60];
const [t0,t1]=[tileOf(...toWgs.forward([minX,-maxZ]),14),tileOf(...toWgs.forward([maxX,-minZ]),14)];
for(let tx=t0[0];tx<=t1[0];tx++)for(let ty=t1[1];ty<=t0[1];ty++){
 const cache=path.join(dir,`coverage-14-${tx}-${ty}.pbf`);
 if(!fs.existsSync(cache)||args.includes('--refresh')){const r=await fetch(`https://tiles.mapillary.com/maps/vtp/mly1_public/2/14/${tx}/${ty}?access_token=${token}`);if(!r.ok)throw Error(`Mapillary tiles ${r.status}`);fs.writeFileSync(cache,Buffer.from(await r.arrayBuffer()));}
 for(const m of readPoints(fs.readFileSync(cache),'image',14,tx,ty)){
  if(m.is_pano||!Number.isFinite(m.compass_angle))continue;const [x,z]=local(m.lon,m.lat),st=alongStreet(line,x,z,m.compass_angle);if(st.offset>45)continue;
  near.set(String(m.id),{id:String(m.id),x,z,heading:+m.compass_angle.toFixed(1),captured:new Date(m.captured_at).toISOString().slice(0,10),hourUtc:new Date(m.captured_at).getUTCHours(),sequence:m.sequence_id,...st});
 }
}
const photos=[...near.values()];
const fronting=frontingBuildings(city.buildings,line,{parts});
// Along-street views every `spacing` metres, plus the best few photos of each building front.
const chosen=new Map(pickPhotos(photos.filter(p=>p.offset<16),{spacing:flag('spacing',35)}).map(p=>[p.id,p]));
for(const b of fronting)for(const v of photosShowing(b,photos).slice(0,3))chosen.set(v.id,near.get(v.id));
// Positions and headings from the Graph API (computed, i.e. corrected by structure from motion).
for(const p of chosen.values()){
 const meta=path.join(dir,`${p.id}.json`);
 if(!fs.existsSync(meta)){const url=new URL(`https://graph.mapillary.com/${p.id}`);url.search=new URLSearchParams({access_token:token,fields:'id,captured_at,computed_compass_angle,computed_geometry,thumb_1024_url,creator'});const r=await fetch(url);if(!r.ok)throw Error(`Mapillary ${r.status} for image ${p.id}`);fs.writeFileSync(meta,JSON.stringify(await r.json()));}
 const m=JSON.parse(fs.readFileSync(meta));
 if(m.computed_geometry){[p.x,p.z]=local(...m.computed_geometry.coordinates);}if(Number.isFinite(m.computed_compass_angle))p.heading=+m.computed_compass_angle.toFixed(1);
 p.author=m.creator?.username||'unknown';p.url=m.thumb_1024_url;Object.assign(p,alongStreet(line,p.x,p.z,p.heading));
}
const picked=[...chosen.values()].filter(p=>p.url).sort((a,b)=>a.s-b.s);
for(const p of picked){const file=path.join(dir,`${p.id}.jpg`);if(!fs.existsSync(file))fs.writeFileSync(file,Buffer.from(await (await fetch(p.url)).arrayBuffer()));}
const keep=picked.map(({url,...p})=>({...p,file:`${p.id}.jpg`}));
const buildings=fronting.map(b=>({...b,photos:photosShowing(b,keep).slice(0,6)}));
fs.writeFileSync(path.join(dir,'photos.json'),JSON.stringify({city:cityId,street,licence:'CC BY-SA 4.0',source:'Mapillary (mapillary.com)',fetchedAt:new Date().toISOString().slice(0,10),line,photos:keep},null,1));
fs.writeFileSync(path.join(dir,'buildings.json'),JSON.stringify(buildings,null,1));
console.log(`${photos.length} photos on ${street}; kept ${keep.length} in ${dir}\n${buildings.length} buildings front the street (${buildings.filter(b=>b.photos.length).length} with photos): see ${dir}/buildings.json`);
console.log(`Next: open the photos, describe each building in cities/${cityId}/facades.json, then npm run facades:compare -- ${cityId} "${street}"`);
