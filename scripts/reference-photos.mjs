// npm run photos:fetch -- <city> <place> [--refresh]
// Current reference photos of one place (a square, its landmarks, its tram stop) from open sources,
// for describing what the place looks like today. Reads `photoSearch` from
// cities/<city>/<place>-reference.json:
//   {"centre":[lon,lat],"radiusMetres":150,"since":"2021-01-01","commons":["Category name@depth",...]}
// and saves, under data/raw/photos/<city>/<place>/ (git-ignored, never committed):
//   commons/    Wikimedia Commons files from the listed categories taken on or after `since`
//   mapillary/  the newest Mapillary images inside the circle, thinned per 12 m cell and heading
//   panoramax/  Panoramax images inside the circle
//   catalog.json  id, source, author, licence, capture date, position (game metres) and heading
// Photos you add yourself go in data/raw/photos/<city>/<place>/ directly (any file name).
// Then look at the photos, describe the place in your own words in <place>-reference.json and list
// what you used in <place>-sources.json. Google imagery is never used.
import fs from 'node:fs';
import path from 'node:path';
import proj4 from 'proj4';
import {env} from './env.mjs';
import {readPoints,tileOf} from './mvt.mjs';
import {commonsDate,isCurrent,pickStreetImages,commonsCategories} from '../src/reference-photos.js';

const [cityId,place]=process.argv.slice(2).filter(a=>!a.startsWith('--')),refresh=process.argv.includes('--refresh');
if(!cityId||!place)throw Error('Usage: npm run photos:fetch -- <city> <place>');
const search=JSON.parse(fs.readFileSync(path.join('cities',cityId,`${place}-reference.json`))).photoSearch;
const registry=JSON.parse(fs.readFileSync('public/cities/index.json')).cities.find(c=>c.id===cityId);if(!registry)throw Error(`No built city "${cityId}"`);
const toLocal=proj4('EPSG:4326',registry.projection),local=(lon,lat)=>{const [x,y]=toLocal.forward([lon,lat]);return [+x.toFixed(1),+(-y).toFixed(1)];};
const [cx,cz]=local(...search.centre),radius=search.radiusMetres||150,since=search.since||'2021-01-01';
const dir=path.join('data/raw/photos',cityId,place);for(const d of ['commons','mapillary','panoramax'])fs.mkdirSync(path.join(dir,d),{recursive:true});
const UA={'User-Agent':'open-city-drive/0.1 (https://opencitydrive.org; reference photos)'};
const get=async(url,opts={})=>{for(let i=0;i<4;i++){try{const r=await fetch(url,{headers:UA,...opts});if(r.ok)return r;if(r.status<500&&r.status!==429)throw Error(`${r.status} ${url.split('?')[0]}`);}catch(e){if(i===3)throw e;}await new Promise(r=>setTimeout(r,1500*(i+1)));}throw Error(`Failed ${url.split('?')[0]}`);};
const save=async(file,url)=>{if(!fs.existsSync(file)||refresh)fs.writeFileSync(file,Buffer.from(await (await get(url)).arrayBuffer()));};
const catalog=[];

// ---------- Wikimedia Commons ----------
const commons=q=>get('https://commons.wikimedia.org/w/api.php?'+new URLSearchParams({format:'json',formatversion:'2',...q})).then(r=>r.json());
const files=new Map(),visited=new Set();
async function walk(cat,depth){if(visited.has(cat))return;visited.add(cat);let cont={};
 do{const d=await commons({action:'query',list:'categorymembers',cmtitle:`Category:${cat}`,cmlimit:'500',...cont});
  for(const m of d.query.categorymembers){if(m.ns===6&&!files.has(m.title))files.set(m.title,cat);else if(m.ns===14&&depth>0)await walk(m.title.replace(/^Category:/,''),depth-1);}
  cont=d.continue||null;}while(cont);}
for(const c of commonsCategories(search.commons))await walk(c.name,c.depth);
const titles=[...files.keys()].filter(t=>/\.(jpe?g|png|tiff?)$/i.test(t)),strip=s=>String(s||'').replace(/<[^>]*>/g,'').replace(/\s+/g,' ').trim();
for(let i=0;i<titles.length;i+=40){
 const d=await commons({action:'query',prop:'imageinfo',titles:titles.slice(i,i+40).join('|'),iiprop:'url|extmetadata|timestamp',iiurlwidth:'1600'});
 for(const p of d.query.pages){const ii=p.imageinfo?.[0];if(!ii)continue;const m=ii.extmetadata||{};
  const captured=commonsDate(m.DateTimeOriginal?.value)||'';if(!isCurrent(captured,since))continue;
  const id=p.pageid,file=`commons/${id}.jpg`,gps=m.GPSLatitude&&m.GPSLongitude?local(+m.GPSLongitude.value,+m.GPSLatitude.value):null;
  await save(path.join(dir,file),ii.thumburl);
  catalog.push({source:'commons',id:String(id),file,title:p.title.replace(/^File:/,''),category:files.get(p.title),url:ii.descriptionurl,author:strip(m.Artist?.value).slice(0,120),licence:strip(m.LicenseShortName?.value),captured,...(gps?{x:gps[0],z:gps[1]}:{})});
 }
}
console.log(`Commons: ${catalog.length} current photos from ${files.size} files in ${visited.size} categories`);

// ---------- Mapillary (coverage tiles list every image; the Graph API gives corrected positions) ----------
const token=env('MAPILLARY_TOKEN');
if(token){
 const toWgs=proj4(registry.projection,'EPSG:4326'),[w,n]=toWgs.forward([cx-radius,-(cz-radius)]),[e,s]=toWgs.forward([cx+radius,-(cz+radius)]);
 const [t0,t1]=[tileOf(w,n,14),tileOf(e,s,14)],images=[];
 for(let tx=t0[0];tx<=t1[0];tx++)for(let ty=t0[1];ty<=t1[1];ty++){
  const cache=path.join(dir,'mapillary',`coverage-14-${tx}-${ty}.pbf`);
  if(!fs.existsSync(cache)||refresh)fs.writeFileSync(cache,Buffer.from(await (await get(`https://tiles.mapillary.com/maps/vtp/mly1_public/2/14/${tx}/${ty}?access_token=${token}`)).arrayBuffer()));
  for(const m of readPoints(fs.readFileSync(cache),'image',14,tx,ty)){const [x,z]=local(m.lon,m.lat);images.push({id:String(m.id),x,z,heading:m.compass_angle,pano:!!m.is_pano,captured:new Date(m.captured_at).toISOString().slice(0,10)});}
 }
 const picked=pickStreetImages(images.filter(i=>!i.pano),{x:cx,z:cz,radius,since,max:search.mapillaryMax||160});
 for(const p of picked){
  const meta=path.join(dir,'mapillary',`${p.id}.json`);
  if(!fs.existsSync(meta)||refresh){const url=new URL(`https://graph.mapillary.com/${p.id}`);url.search=new URLSearchParams({access_token:token,fields:'id,captured_at,computed_compass_angle,computed_geometry,thumb_2048_url,creator'});fs.writeFileSync(meta,JSON.stringify(await (await get(url.href)).json()));}
  const m=JSON.parse(fs.readFileSync(meta));if(!m.thumb_2048_url)continue;
  const [x,z]=m.computed_geometry?local(...m.computed_geometry.coordinates):[p.x,p.z],file=`mapillary/${p.id}.jpg`;
  await save(path.join(dir,file),m.thumb_2048_url);
  catalog.push({source:'mapillary',id:p.id,file,url:`https://www.mapillary.com/app/?pKey=${p.id}`,author:m.creator?.username||'',licence:'CC BY-SA 4.0',captured:p.captured,x,z,heading:+(m.computed_compass_angle??p.heading).toFixed(1)});
 }
 console.log(`Mapillary: ${images.length} images in the tiles, ${picked.length} current ones kept`);
}else console.log('Mapillary: skipped (set MAPILLARY_TOKEN in .env.local)');

// ---------- Panoramax (federated open street-level imagery) ----------
{
 const toWgs=proj4(registry.projection,'EPSG:4326'),[w,n]=toWgs.forward([cx-radius,-(cz-radius)]),[e,s]=toWgs.forward([cx+radius,-(cz+radius)]);
 const d=await (await get(`https://api.panoramax.xyz/api/search?bbox=${[w,s,e,n].map(v=>v.toFixed(5)).join(',')}&limit=500`)).json();
 const items=(d.features||[]).map(f=>{const [x,z]=local(...f.geometry.coordinates);return {id:f.id,x,z,heading:f.properties?.['view:azimuth'],captured:String(f.properties?.datetime||'').slice(0,10),f};});
 const picked=pickStreetImages(items,{x:cx,z:cz,radius,since,max:80});
 for(const p of picked){const href=p.f.assets?.sd?.href||p.f.assets?.hd?.href;if(!href)continue;const file=`panoramax/${p.id}.jpg`;await save(path.join(dir,file),href);
  catalog.push({source:'panoramax',id:p.id,file,url:`https://api.panoramax.xyz/#focus=pic&pic=${p.id}`,author:p.f.providers?.[0]?.name||p.f.properties?.['geovisio:producer']||'',licence:p.f.properties?.license||'CC BY-SA 4.0',captured:p.captured,x:p.x,z:p.z,heading:p.heading});}
 console.log(`Panoramax: ${items.length} images in the box, ${picked.length} current ones kept`);
}

// ---------- Your own photos (any images dropped into the folder) ----------
for(const f of fs.readdirSync(dir).filter(f=>/\.(jpe?g|png|heic)$/i.test(f)))catalog.push({source:'own',id:f,file:f,author:'owner',licence:'private reference (not published)',captured:new Date(fs.statSync(path.join(dir,f)).mtime).toISOString().slice(0,10)});
fs.writeFileSync(path.join(dir,'catalog.json'),JSON.stringify({city:cityId,place,centre:[cx,cz],radius,since,fetchedAt:new Date().toISOString().slice(0,10),photos:catalog},null,1));
console.log(`${catalog.length} photos in ${dir}/catalog.json. Next: look at them and describe the place in cities/${cityId}/${place}-reference.json`);
