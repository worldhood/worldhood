// node scripts/espoo-ground.mjs [<id>=espoo]
// Ground cover and road attributes for an Espoo extension, on top of what scripts/build-espoo.mjs wrote
// (it runs this last; it can also run alone after scripts/fetch-espoo.mjs):
//  - park register areas (GIS:InfPark: lawns, meadows, woods, plantings; City of Espoo, CC BY 4.0) → city.pack
//    parks and surfaces/parks-*.bin.pack, with forest trees inferred inside its 'Metsä' parts (flagged inferred),
//  - OpenStreetMap land cover where the register has none (campus lawns, private woods, pitches; ODbL) →
//    osm-landcover.json (areas and their inferred forest trees) and surfaces/osm-*.bin.pack, kept apart,
//  - Digiroad speed limits and lane counts (Väylävirasto, CC BY 4.0), else the city's centreline limits, on the
//    mobility road edges: speed (km/h) and laneOffsets (one per lane of a multi-lane carriageway).
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {gzipSync,gunzipSync} from 'node:zlib';
import polygonClipping from 'polygon-clipping';
import earcut from 'earcut';
import {bounds,SpatialIndex,pointInPolygon} from '../src/geo.js';
import {surfaceRecord} from '../src/surface-streaming.js';
import {readRoute,extensionRegions,simplifyRing,boxesOverlap,local as localLL,ORIGIN_GK25} from './extension-geometry.mjs';
import {parseParks,parseCentrelines} from './espoo-citygml.mjs';
import {osmLandcover} from './osm-water.mjs';
import {projector,parts} from './official-wfs.mjs';

// ---------- Ground cover ----------
// Colours as the Helsinki park register's in scripts/build-extension.mjs.
export function parkColor(kind){
 if(/Nurm|Niit|Mets|Kunt|Kosteikko|Kasvimaa|Kenttä|Leikki/.test(kind))return /Mets/.test(kind)?'a9bd90':'b1c397';
 if(/Pensas|Perenn|Köynnös|kukka|Kukka/.test(kind))return '91ad7a';
 if(/Vesi/.test(kind))return 'abc8c9';
 if(/kallio|kivi|Betoni|Asfaltti|Metalli|Kumi|turva/.test(kind))return 'b6b9aa';
 return 'd6d0bd'; // stone dust, gravel, bark mulch, decking, sand
}
// Polygons minus the earlier, overlapping ones (bbox prefilter): each place keeps one cover.
export function layer(list,taken=[]){
 const out=[];
 for(const item of list){const b=bounds(item.rings),over=taken.filter(t=>boxesOverlap(t.bbox,b)).map(t=>t.rings);
  let rest=[item.rings];if(over.length)try{rest=polygonClipping.difference(item.rings,...over);}catch{rest=[];}
  rest.forEach((rings,k)=>{const r=rings.map(x=>simplifyRing(x,.3)).filter(x=>x.length>3);if(r.length&&area(r[0])>=1)out.push({...item,id:k?`${item.id}-${k}`:item.id,rings:r,bbox:bounds(r)});});
  taken.push({rings:item.rings,bbox:b});}
 return out;
}
const area=r=>{let s=0;for(let i=1;i<r.length;i++)s+=r[i-1][0]*r[i][1]-r[i][0]*r[i-1][1];return Math.abs(s)/2;};
function seeded(n){let s=n>>>0;return()=>((s=Math.imul(s^s>>>15,s|1)^(s+Math.imul(s^s>>>7,s|61)),((s^s>>>14)>>>0)/4294967296));}
const hash=s=>[...s].reduce((h,c)=>Math.imul(h^c.charCodeAt(0),16777619),2166136261);
// Deterministic trees on a jittered grid inside woods, never on or within 2 m of paving or buildings, nor next to a registered tree.
export function forestTrees(woods,blocked,{spacing=9,round=v=>Math.round(v*100)/100}={}){
 const out=[];
 for(const w of woods){const random=seeded(hash(w.id));
  for(let x=w.bbox[0];x<w.bbox[2];x+=spacing)for(let z=w.bbox[1];z<w.bbox[3];z+=spacing){
   const p=[round(x+random()*spacing),round(z+random()*spacing)],big=random()<.5;
   if(pointInPolygon(p[0],p[1],w.rings)&&!blocked(p))out.push({p,species:'(inferred forest)',size:big?'30 - 50 cm':'20 - 30 cm',inferred:true});}}
 return out;
}
// Polygons → flat surface chunks (sRGB hex → linear vertex colours), files named <prefix>-<cell>.bin.pack.
export function surfaceChunks(items,{prefix,y,dir,urlDir,color}){
 const chunks=new Map();
 for(const p of items){
  const flat=[],holes=[];for(const [i,r] of p.rings.entries()){if(i)holes.push(flat.length/2);for(const q of r)flat.push(...q);}
  const tri=earcut(flat,holes,2),b=p.bbox,key=`${Math.floor((b[0]+b[2])/600)},${Math.floor((b[1]+b[3])/600)}`;if(!chunks.has(key))chunks.set(key,[]);const v=chunks.get(key);
  const rgb=color(p.kind).match(/\w\w/g).map(x=>parseInt(x,16)/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4);
  for(let i=0;i<tri.length;i+=3)for(const j of [tri[i],tri[i+2],tri[i+1]])v.push(flat[j*2],y,flat[j*2+1],...rgb);
 }
 return [...chunks].map(([key,values])=>{const file=`surfaces/${prefix}-${key}.bin`;fs.writeFileSync(path.join(dir,file+'.pack'),gzipSync(Buffer.from(new Float32Array(values).buffer),{level:9}));return surfaceRecord(`${urlDir}/${file}`,values);});
}

// ---------- Speed limits and lanes on the road edges ----------
// lines: [{points [[x,z]], value, dir}] with dir 1 along the drawn direction, -1 against it, 0 both.
// Each edge takes the value most of its length lies on (within `reach` metres, roughly parallel, matching direction).
export function matchLines(edges,lines,{reach=6,align=.85,step=4,cell=25}={}){
 const grid=new Map(),segs=[];
 for(const l of lines)for(let i=1;i<l.points.length;i++){const a=l.points[i-1],b=l.points[i],L=Math.hypot(b[0]-a[0],b[1]-a[1]);if(!L)continue;const s={a,b,L,t:[(b[0]-a[0])/L,(b[1]-a[1])/L],l};segs.push(s);
  for(let x=Math.floor((Math.min(a[0],b[0])-reach)/cell);x<=Math.floor((Math.max(a[0],b[0])+reach)/cell);x++)for(let z=Math.floor((Math.min(a[1],b[1])-reach)/cell);z<=Math.floor((Math.max(a[1],b[1])+reach)/cell);z++){const k=`${x},${z}`;if(!grid.has(k))grid.set(k,[]);grid.get(k).push(s);}}
 return edges.map(e=>{const votes=new Map();
  for(let i=1;i<e.points.length;i++){const a=e.points[i-1],b=e.points[i],L=Math.hypot(b[0]-a[0],b[1]-a[1]);if(!L)continue;const t=[(b[0]-a[0])/L,(b[1]-a[1])/L],n=Math.max(1,Math.round(L/step));
   for(let j=0;j<n;j++){const px=a[0]+(b[0]-a[0])*(j+.5)/n,pz=a[1]+(b[1]-a[1])*(j+.5)/n;let best=null,bd=reach;
    for(const s of grid.get(`${Math.floor(px/cell)},${Math.floor(pz/cell)}`)||[]){const dot=t[0]*s.t[0]+t[1]*s.t[1];if(Math.abs(dot)<align||(s.l.dir>0&&dot<0)||(s.l.dir<0&&dot>0))continue;
     const u=Math.max(0,Math.min(s.L,(px-s.a[0])*s.t[0]+(pz-s.a[1])*s.t[1])),d=Math.hypot(s.a[0]+s.t[0]*u-px,s.a[1]+s.t[1]*u-pz);if(d<bd){bd=d;best=s.l.value;}}
    if(best!==null)votes.set(best,(votes.get(best)||0)+L/n);}}
  let value=null,most=0;for(const [v,w] of votes)if(w>most){most=w;value=v;}
  return most>=Math.min(e.length??Infinity,8)*.5?value:null;});
}
export const LANE_WIDTH=3.2;
// Lateral offsets of n lanes: a one-way carriageway is centred on its line, a two-way road's lanes start at the centre line.
export const laneOffsets=(edge,n)=>Array.from({length:n},(_,k)=>+(edge.lane<1?(k-(n-1)/2)*LANE_WIDTH:edge.lane+k*LANE_WIDTH).toFixed(2));
// Digiroad linear assets: vaik_suunt 1 both directions, 2 along the link's digitising direction, 3 against it.
export const digiroadLines=(json,project)=>(json?.features||[]).flatMap(f=>parts(f.geometry).map(pts=>({points:pts.map(p=>project(p)),value:+f.properties.arvo,dir:{2:1,3:-1}[+f.properties.vaik_suunt]||0}))).filter(l=>l.value>0&&l.points.length>1);

export function espooGround(id='espoo'){
 const RAW=path.join('data/raw/extensions',id),OUT=path.join('public/data/extensions',id),URL_DIR=`extensions/${id}`;
 const route=readRoute(id),{context}=extensionRegions(route),[E0,N0]=ORIGIN_GK25,round=v=>Math.round(v*100)/100,L=([e,n])=>[round(e-E0),round(N0-n)];
 const layerFiles=dir=>fs.readdirSync(path.join(RAW,dir)).filter(f=>f.endsWith('.gml')).sort().map(f=>fs.readFileSync(path.join(RAW,dir,f),'utf8'));
 const cityFile=path.join(OUT,'city.pack'),city=JSON.parse(gunzipSync(fs.readFileSync(cityFile)));
 const clip=rings=>{try{return polygonClipping.intersection(rings,context);}catch{return [];}};
 // Official park register first; OSM only where it has nothing, and never over water.
 const parks=new Map();
 for(const p of layerFiles('parks').flatMap(parseParks))if(!parks.has(p.id))parks.set(p.id,p);
 const register=[...parks.values()].flatMap(p=>p.polygons.flatMap((poly,k)=>clip(poly.map(r=>{const q=r.map(L);q.push(q[0]);return q;})).map((rings,j)=>({id:`espoo-park-${p.id}${k||j?`-${k}-${j}`:''}`,rings,name:p.name,kind:p.kind,use:p.use}))));
 const taken=city.water.map(w=>({rings:w.rings,bbox:bounds(w.rings)})),water=JSON.parse(fs.readFileSync(path.join(OUT,'osm-water.json'))).water;
 taken.push(...water.map(w=>({rings:w.rings,bbox:bounds(w.rings)})));
 city.parks=layer(register,taken).map(({id,rings,bbox,name,kind,use})=>({id,rings,bbox,name,address:'',kind,use,material:''}));
 const osmRaw=path.join(RAW,'osm-landcover.json'),osm=fs.existsSync(osmRaw)?layer(osmLandcover(JSON.parse(fs.readFileSync(osmRaw)),ll=>localLL(ll)).flatMap(a=>clip(a.rings).map((rings,k)=>({...a,id:k?`${a.id}-${k}`:a.id,rings}))),taken).map(({id,rings,bbox,kind,tag})=>({id,rings,bbox,name:'',kind,tag})):[];
 // Trees: registered ones stay; inferred forest is rebuilt.
 city.trees=city.trees.filter(t=>!t.inferred);
 const solid=new SpatialIndex([...city.roads,...city.pavement,...city.buildings].map(p=>({rings:p.rings}))),registered=new SpatialIndex(city.trees.map(t=>({rings:[[[t.p[0]-3,t.p[1]-3],[t.p[0]+3,t.p[1]-3],[t.p[0]+3,t.p[1]+3],[t.p[0]-3,t.p[1]+3],[t.p[0]-3,t.p[1]-3]]]})));
 const blocked=p=>[[0,0],[2,0],[-2,0],[0,2],[0,-2]].some(([dx,dz])=>solid.at(p[0]+dx,p[1]+dz))||!!registered.at(...p),inferred=forestTrees(city.parks.filter(p=>/^Metsä/.test(p.kind)),blocked);
 city.trees.push(...inferred);
 const osmTrees=forestTrees(osm.filter(p=>p.kind==='Metsä'),blocked,{spacing:10});
 fs.writeFileSync(cityFile,gzipSync(Buffer.from(JSON.stringify(city)),{level:9}));
 fs.writeFileSync(path.join(OUT,'osm-landcover.json'),JSON.stringify({source:'OpenStreetMap landuse, leisure and natural areas inside the area, where the City of Espoo park register has none; forest trees inferred inside woods',license:'ODbL 1.0 — © OpenStreetMap contributors',parks:osm,trees:osmTrees}));
 // Surface chunks: park register just below Helsinki's park height, OSM cover under it.
 const indexFile=path.join(OUT,'surface-index.json');
 for(const f of fs.readdirSync(path.join(OUT,'surfaces')))if(/^(parks|osm)-/.test(f))fs.rmSync(path.join(OUT,'surfaces',f));
 const surfaces=[...JSON.parse(fs.readFileSync(indexFile)).filter(r=>!/\/surfaces\/(parks|osm)-/.test(r.file)),
  ...surfaceChunks(city.parks,{prefix:'parks',y:.025,dir:OUT,urlDir:URL_DIR,color:parkColor}),...surfaceChunks(osm,{prefix:'osm',y:.02,dir:OUT,urlDir:URL_DIR,color:parkColor})];
 fs.writeFileSync(indexFile,JSON.stringify(surfaces));

 // Speed limits (Digiroad, else the city's own centreline value) and lane counts on the road edges.
 const mobilityFile=path.join(OUT,'mobility.json'),mobility=JSON.parse(fs.readFileSync(mobilityFile)),edges=mobility.roads.edges;
 const read=k=>{const f=path.join(RAW,`digiroad-${k}.json`);return fs.existsSync(f)?JSON.parse(fs.readFileSync(f)):null;};
 const speedJson=read('speed'),laneJson=read('lanes'),project=j=>projector(j?.crs,(lon,lat)=>localLL([lon,lat]));
 const digiroadSpeed=matchLines(edges,digiroadLines(speedJson,project(speedJson)));
 const cityLimits=layerFiles('centrelines').flatMap(parseCentrelines).filter(l=>l.limit>0).map(l=>({points:l.points.map(L),value:l.limit,dir:0}));
 const citySpeed=matchLines(edges,cityLimits,{reach:3});
 const lanes=matchLines(edges,digiroadLines(laneJson,project(laneJson)));
 const counts={digiroad:0,city:0,lanes:0};
 edges.forEach((e,i)=>{delete e.speed;delete e.laneOffsets;
  const v=digiroadSpeed[i]??citySpeed[i];if(v){e.speed=v;counts[digiroadSpeed[i]?'digiroad':'city']++;}
  const n=Math.min(3,lanes[i]||1);if(n>1){e.laneOffsets=laneOffsets(e,n);counts.lanes++;}});
 mobility.source=mobility.source.replace(/; speed limits.*$/,'')+'; speed limits and lane counts: Digiroad (Väylävirasto, CC BY 4.0), else the city centreline limit';
 fs.writeFileSync(mobilityFile,JSON.stringify(mobility));

 // Registry entry: counts, the OSM file, provenance.
 const registryFile='public/data/extensions/index.json',registry=JSON.parse(fs.readFileSync(registryFile)),entry=registry.extensions.find(e=>e.id===id);
 entry.osmLandcover='osm-landcover.json';
 Object.assign(entry.counts,{parks:city.parks.length,osmLandcover:osm.length,inferredForestTrees:inferred.length+osmTrees.length,surfaceChunks:surfaces.length,speedLimitedEdges:counts.digiroad+counts.city,multiLaneEdges:counts.lanes});
 const p=entry.provenance;
 p.note=p.note.replace(/; traffic lights from Digiroad[^;]*/,'; traffic lights, speed limits and lane counts from Digiroad (Väylävirasto, CC BY 4.0)').replace(/ and trees, fetched/,', trees and park register areas, fetched').replace(/; sea outlines © OpenStreetMap contributors \(ODbL\)$/,'; sea outlines and land cover outside the park register © OpenStreetMap contributors (ODbL); forest trees are inferred inside mapped woods');
 Object.assign(p.sources,{parks:'City of Espoo park register GIS:InfPark, CC BY 4.0',signals:'Digiroad dr_liikennevalo, Väylävirasto, CC BY 4.0',speedLimits:'Digiroad dr_nopeusrajoitus (else GIS:Keskilinjat Nopeusrajoitus), Väylävirasto / City of Espoo, CC BY 4.0',lanes:'Digiroad dr_kaistojen_lukumaara, Väylävirasto, CC BY 4.0',landcover:'OpenStreetMap (ODbL), osm-landcover.json'});
 fs.writeFileSync(registryFile,JSON.stringify(registry));
 return {parks:city.parks.length,osm:osm.length,inferredTrees:inferred.length,osmTrees:osmTrees.length,speed:counts,edges:edges.length};
}

if(process.argv[1]===fileURLToPath(import.meta.url))console.log(JSON.stringify(espooGround(process.argv[2]||'espoo'),null,1));
