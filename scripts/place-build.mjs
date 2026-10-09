// npm run place:build -- <city> <place> [--refresh]
// Builds one photo-matched place (a square with its tram stop, trees and landmarks) from the city's
// official open data plus cities/<city>/<place>-reference.json, the description written from current
// photos (npm run photos:fetch). Map data gives positions and shapes; the reference gives materials,
// colours and dimensions. Output: public/cities/<city>/places/<place>.json, registered in
// public/cities/index.json and drawn by src/place-scene.js. city:build re-runs this for every
// cities/<city>/*-reference.json, from the cached downloads in data/raw/cities/<city>/places/.
import fs from 'node:fs';
import path from 'node:path';
import {gunzipSync} from 'node:zlib';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import proj4 from 'proj4';
import {SpatialIndex,bounds} from '../src/geo.js';
import {checkPanel} from '../src/photo-panels-data.js';
import {matchPaving,speciesFamily,registerHeight,platformsFor,polesAlong,shelterFrom,ringArea,centroid,pointInRing,validatePlace} from '../src/place-data.js';

export function buildPlace(cityId,place,{refresh=false,registry='public/cities/index.json'}={}){
 const ref=JSON.parse(fs.readFileSync(path.join('cities',cityId,`${place}-reference.json`)));
 const reg=JSON.parse(fs.readFileSync(registry)),city=reg.cities.find(c=>c.id===cityId);if(!city)throw Error(`No built city "${cityId}"`);
 const root=path.join('public',city.dataRoot),data=JSON.parse(gunzipSync(fs.readFileSync(path.join(root,'city.pack'))));
 const trams=fs.existsSync(path.join(root,'trams.json'))?JSON.parse(fs.readFileSync(path.join(root,'trams.json'))):{paths:[]};
 const toLocal=proj4('EPSG:4326',city.projection),toWgs=proj4(city.projection,'EPSG:4326');
 const local=(lon,lat)=>{const [x,y]=toLocal.forward([lon,lat]);return [+x.toFixed(2),+(-y).toFixed(2)];};
 const [cx,cz]=ref.centreLocal,R=ref.radiusMetres||180,inside=([x,z],m=0)=>Math.hypot(x-cx,z-cz)<R+m;
 const off=ref.official,F=off.fields,RAW=path.join('data/raw/cities',cityId,'places',place);fs.mkdirSync(RAW,{recursive:true});

 // ---------- Official layers inside the place's box (cached) ----------
 const [w,s]=toWgs.forward([cx-R-40,-(cz+R+40)]),[e,n]=toWgs.forward([cx+R+40,-(cz-R-40)]);
 const wfs=key=>{const layer=off.layers[key];if(!layer)return [];const file=path.join(RAW,`${key}.json`);
  if(!fs.existsSync(file)||refresh){const url=`${off.wfs}?service=WFS&version=2.0.0&request=GetFeature&typeNames=${layer}&count=10000&outputFormat=application/json&srsName=EPSG:4326&bbox=${[s,w,n,e].map(v=>v.toFixed(5)).join(',')},urn:ogc:def:crs:EPSG::4326`;
   fs.writeFileSync(file,execFileSync('curl',['-sS','-f','--max-time','300','-A','open-city-drive/0.1 (place build)',url],{maxBuffer:1<<28}));}
  return JSON.parse(fs.readFileSync(file)).features||[];};
 const polys=g=>!g?[]:(g.type==='Polygon'?[g.coordinates]:g.type==='MultiPolygon'?g.coordinates:[]).map(p=>p.map(r=>r.map(c=>local(c[0],c[1]))));
 const clean=v=>String(v||'').replace(/^\d+/,'');

 // ---------- Paving: official street parts, look from the reference rules ----------
 const paving=[];
 for(const layer of ['paths','streets'])for(const f of wfs(layer)){const p=f.properties||{};
  for(const rings of polys(f.geometry)){if(!inside(centroid(rings[0])))continue;
   const kind=matchPaving(ref.paving.rules,{layer,street:clean(p[F.street]),type:String(p[F.type]||''),material:String(p[F.material]||'')},rings[0]);
   if(kind)paving.push({kind,rings});}}

 // ---------- Building heights from the 3D layer (roof minus base of the tallest part inside each footprint) ----------
 // The largest part sets the wall height: towers and stair houses on the roof stay with the roof.
 const near=data.buildings.filter(b=>inside(centroid(b.rings[0]),20)),heights={},best={};
 for(const f of wfs('buildings3d')){const p=f.properties||{},h=(+p[F.roof])-(+p[F.base]);if(!(h>1&&h<150))continue;
  for(const rings of polys(f.geometry)){const c=centroid(rings[0]),b=near.find(b=>pointInRing(c,b.rings[0]));
   // A part far taller than its footprint is wide is a chimney or mast standing in a yard, not the building.
   if(b&&h<5*Math.sqrt(ringArea(b.rings[0]))){const a=ringArea(rings[0]);if(!best[b.id]||a>best[b.id]){best[b.id]=a;heights[b.id]=+h.toFixed(1);}}}}

 // Small mapped roofs with no measured height are shelters and kiosks, not ten-metre towers.
 for(const b of near)if(!heights[b.id]&&ringArea(b.rings[0])<ref.tramStop.shelter.maxArea&&b.height>=5)heights[b.id]=ref.tramStop.shelter.height;

 // ---------- Trees from the register, with species family and height ----------
 const trees=[];
 for(const f of wfs('trees')){const p=f.properties||{};if(!f.geometry||f.geometry.type!=='Point'||!/puu/i.test(p[F.group]||''))continue;
  const at=local(...f.geometry.coordinates);if(!inside(at))continue;
  const conifer=/havu/i.test(p[F.group]||''),family=speciesFamily(p[F.species],conifer),girth=+p[F.girth]||0;
  trees.push({p:at,species:String(p[F.species]||''),family,height:+registerHeight(p[F.heightClass],girth,family).toFixed(1),girth,...(p[F.planted]>1900?{planted:p[F.planted]}:{})});}

 // ---------- Tram stop: platforms on the tram paths, shelters from the small mapped roofs on them ----------
 const ts=ref.tramStop,stops=wfs('stops').filter(f=>f.properties?.[F.stopType]===ts.stopType&&String(f.properties?.[F.stopName]||'').startsWith(ts.name))
  .map(f=>{const [x,z]=local(...f.geometry.coordinates);return {name:f.properties[F.stopName],x,z};}).filter(st=>inside([st.x,st.z]));
 const platforms=platformsFor(stops,trams.paths,{...ts.platform,anchor:'middle'}).map(p=>({...p,height:ts.platform.height}));
 // Unit vector from the nearest carriageway point (within 12 m) to p: the side a shelter turns its back to.
 const roadIdx=new SpatialIndex(data.roads.filter(r=>!/muu|Pysäköinti/.test(r.kind))),roadsNear=([x,z])=>{let best=null;for(let a=0;a<6.28;a+=.26)for(let d=1;d<12;d+=.5){if(roadIdx.at(x+Math.cos(a)*d,z+Math.sin(a)*d)){if(!best||d<best.d)best={d,a};break;}}return best?[-+Math.cos(best.a).toFixed(3),-+Math.sin(best.a).toFixed(3)]:null;};
 const hide=new Set(),shelters=[];
 for(const b of near){if(ringArea(b.rings[0])>ts.shelter.maxArea)continue;const c=centroid(b.rings[0]);
  const on=platforms.find(p=>pointInRing(c,p.ring)||p.ring.some(q=>Math.hypot(q[0]-c[0],q[1]-c[1])<2.5));
  if(on){shelters.push({id:b.id,...shelterFrom(b.rings[0]),height:ts.shelter.height,base:on.height,back:on.side});hide.add(b.id);continue;}
  // Other small roofs on the pavement are bus shelters of the same glass-and-steel kind, backs to the street.
  const sh=shelterFrom(b.rings[0]);if(sh.length<2.5||sh.length>16||sh.depth>3)continue;
  const r=roadsNear(c);shelters.push({id:b.id,...sh,height:ts.shelter.height,base:0,...(r?{back:r}:{})});hide.add(b.id);}

 // ---------- Overhead-line masts along the tram corridor, on clear pavement ----------
 const pave=new SpatialIndex(data.pavement),roads=new SpatialIndex(data.roads),blds=new SpatialIndex(data.buildings);
 const clear=(x,z)=>!!pave.at(x,z)&&!roads.at(x,z)&&!blds.at(x,z)&&!blds.at(x+.6,z)&&!blds.at(x-.6,z);
 const om=ref.overheadMasts,masts=[];
 if(om)for(const path of trams.paths){const pts=path.points.filter(q=>q[0]>=om.fromX&&q[0]<=om.toX&&inside(q,60));if(pts.length<2)continue;
  for(const m of polesAlong(pts,clear,{spacing:om.spacing}))if(!masts.some(o=>Math.hypot(o.x-m.x,o.z-m.z)<om.spacing*.45))masts.push(m);}

 // ---------- Landmarks: footprints from the map, everything else from the reference ----------
 const landmarks=ref.landmarks.map(l=>{const b=data.buildings.find(b=>b.id===l.building);if(!b)throw Error(`${place}: no building ${l.building}`);hide.add(b.id);return {...l,ring:b.rings[0]};});
 // Photo panels: rectified photo textures (npm run place:textures) on landmark fronts and other walls.
 const panelErrors=(ref.photoPanels||[]).flatMap(checkPanel);if(panelErrors.length)throw Error(`${place}: ${panelErrors.join('; ')}`);
 const panels=(ref.photoPanels||[]).map(p=>{const lm=landmarks.find(l=>l.type===p.landmark),b=lm?null:data.buildings.find(b=>b.id===p.building);
  const ring=lm?.ring||b?.rings[0];if(!ring)throw Error(`${place}: panel ${p.name} has no building`);if(lm)lm.photoFront=true;
  const texture=`places/${place}/${p.copyOf||p.name}.jpg`;if(!fs.existsSync(path.join(root,texture)))throw Error(`${place}: missing ${texture} (npm run place:textures -- ${cityId} ${place})`);
  const {corners,patches,note,ppm,quality,...keep}=p;return {...keep,ring,texture};});

 const out={schemaVersion:1,gridAngle:ref.gridAngle||0,city:cityId,place,name:ref.name,builtAt:new Date().toISOString().slice(0,10),centre:[cx,cz],radius:R,
  source:`${off.attribution}; OpenStreetMap contributors (ODbL); appearance from current photos listed in cities/${cityId}/${place}-sources.json`,
  colours:ref.colours,paving,heights,trees,platforms,shelters,masts,mastHeight:om?.height||10,
  lamps:(ref.lamps?.positions||[]).map(([x,z])=>({x,z})),lampHeight:ref.lamps?.height||10,fountain:ref.fountain,flagpoles:ref.flagpoles,busCanopies:ref.busCanopies,landmarks,photoPanels:panels,groundTextures:(ref.groundTextures||[]).map(g=>({kind:g.kind,size:g.size,texture:`places/${place}/${g.name}.jpg`})),hideBuildings:[...hide],
  // Mapped lamps replaced by the square's own masts, and posts standing where a landmark now is.
  dropFurniture:[...(ref.lamps?.positions||[]).map(([x,z])=>[x,z,3]),...masts.map(m=>[m.x,m.z,2])]};
 const errors=validatePlace(out);if(errors.length)throw Error(`${place}: ${errors.join('; ')}`);
 fs.mkdirSync(path.join(root,'places'),{recursive:true});fs.writeFileSync(path.join(root,'places',`${place}.json`),JSON.stringify(out));
 city.places=[...new Set([...(city.places||[]),place])];
 const srcFile=path.join('cities',cityId,`${place}-sources.json`),photos=fs.existsSync(srcFile)?JSON.parse(fs.readFileSync(srcFile)).photos:[];
 const by=k=>[...new Set(photos.filter(p=>p.source===k).map(p=>p.author))].join(', ');
 const credit=`${ref.name} described from current photos: Wikimedia Commons (${by('commons')||'none'}; CC BY-SA) and Mapillary (${by('mapillary')||'none'}; CC BY-SA 4.0); wall and paving photo textures CC BY-SA 4.0 (${[...new Set(photos.filter(p=>p.textures).map(p=>p.author))].join(', ')}); ${off.attribution}.`;
 city.attribution=city.attribution.replace(new RegExp(` ${ref.name}(?: described|: appearance)[^]*?CC BY 4\\.0\\.`,"g"),'');
 if(!city.attribution.includes(credit))city.attribution=`${city.attribution} ${credit}`;
 fs.writeFileSync(registry,JSON.stringify(reg,null,1));
 return {paving:paving.length,heights:Object.keys(heights).length,trees:trees.length,platforms:platforms.length,shelters:shelters.length,masts:masts.length,landmarks:landmarks.length};
}
// Every place a city describes: cities/<id>/<place>-reference.json.
export const placesOf=id=>fs.existsSync(path.join('cities',id))?fs.readdirSync(path.join('cities',id)).filter(f=>f.endsWith('-reference.json')).map(f=>f.replace(/-reference\.json$/,'')):[];

if(import.meta.url===pathToFileURL(process.argv[1]).href){
 const [id,place]=process.argv.slice(2).filter(a=>!a.startsWith('--'));if(!id)throw Error('Usage: npm run place:build -- <city> [place]');
 for(const p of place?[place]:placesOf(id))console.log(p,buildPlace(id,p,{refresh:process.argv.includes('--refresh')}));
}
