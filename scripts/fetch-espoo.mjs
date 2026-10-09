// node scripts/fetch-espoo.mjs [<id>=espoo] [--refresh]
// Downloads the City of Espoo open data for an Espoo extension (extensions/<id>/route.json):
//  - CityGML 2.0 LOD2 buildings with their photo textures (WFS bldg:building_lod2, CC BY 4.0),
//  - street areas (tran:road_lod2), street centrelines (GIS:Keskilinjat), trees (kanta:Lehtipuu,
//    kanta:Havupuu) from the same WFS, all in ETRS-GK25 (EPSG:3879) with N2000 heights,
//  - traffic lights from Digiroad (Väylävirasto, CC BY 4.0),
//  - sea and pond outlines from OpenStreetMap (ODbL; kept in their own file).
// Raw files go to data/raw/extensions/<id>/ (ignored by git); every download is cached.
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import polygonClipping from 'polygon-clipping';
import {readRoute,extensionRegions,multiBounds,pointInMulti,rectangle,wgs84,ORIGIN_GK25} from './extension-geometry.mjs';
import {parseBuildings} from './espoo-citygml.mjs';
import {fetchWfs} from './official-wfs.mjs';
import {DIGIROAD} from './digiroad-signs.mjs';

const id=process.argv[2]&&!process.argv[2].startsWith('-')?process.argv[2]:'espoo',refresh=process.argv.includes('--refresh'),RAW=path.join('data/raw/extensions',id);
export const ESPOO_WFS='https://kartat.espoo.fi/teklaogcweb/wfs.ashx';
export const ESPOO_LAYERS={buildings:'bldg:building_lod2',streets:'tran:road_lod2',centrelines:'GIS:Keskilinjat',broadleaf:'kanta:Lehtipuu',conifer:'kanta:Havupuu'};
const CELL=400,UA='worldhood/0.1 (local build; Espoo extension)';
const {context}=extensionRegions(readRoute(id)),b=multiBounds(context),[E0,N0]=ORIGIN_GK25;
// Grid cells (GK25, metres) that touch the area.
const cells=[];
for(let e=Math.floor((E0+b[0])/CELL)*CELL;e<E0+b[2];e+=CELL)for(let n=Math.floor((N0-b[3])/CELL)*CELL;n<N0-b[1];n+=CELL)
 if(polygonClipping.intersection(rectangle([e-E0,N0-n-CELL,e-E0+CELL,N0-n]),context).length)cells.push([e,n]);
console.log(`${cells.length} cells of ${CELL} m`);

// curl's own parallel transfers: one process, a few connections, retries for the busy server.
function download(jobs,parallel){
 const todo=jobs.filter(j=>refresh||!fs.existsSync(j.file));if(!todo.length)return;
 for(const j of todo)fs.mkdirSync(path.dirname(j.file),{recursive:true});
 for(let i=0;i<todo.length;i+=2000){
  const batch=todo.slice(i,i+2000),config=path.join(RAW,'curl-batch.txt');
  fs.writeFileSync(config,batch.map(j=>`url = "${j.url}"\noutput = "${j.file}.part"\n`).join(''));
  try{execFileSync('curl',['-Z','--parallel-max',String(parallel),'-sS','-f','-L','--retry','4','--retry-all-errors','--retry-delay','5','--max-time','600','-A',UA,'-K',config],{stdio:'inherit'});}catch{console.log('some downloads failed; they are retried on the next run');}
  for(const j of batch)if(fs.existsSync(j.file+'.part')&&fs.statSync(j.file+'.part').size)fs.renameSync(j.file+'.part',j.file);
  console.log(`  ${Math.min(i+2000,todo.length)}/${todo.length}`);
 }
}
const wfs=(layer,[e,n])=>`${ESPOO_WFS}?service=WFS&version=1.1.0&request=GetFeature&typeName=${layer}&bbox=${e},${n},${e+CELL},${n+CELL}`;
for(const [key,layer] of Object.entries(ESPOO_LAYERS)){
 console.log(`Downloading ${layer}…`);
 download(cells.map(c=>({url:wfs(layer,c),file:path.join(RAW,key,`${c[0]}_${c[1]}.gml`)})),4);
 for(const c of cells){const f=path.join(RAW,key,`${c[0]}_${c[1]}.gml`);if(!fs.existsSync(f)||!/FeatureCollection/.test(fs.readFileSync(f,'utf8').slice(0,600)))throw Error(`${layer} ${c}: missing or not a feature collection`);}
}

// Photo textures of the buildings that stand in the area.
const textures=new Map();
for(const c of cells)for(const bld of parseBuildings(fs.readFileSync(path.join(RAW,'buildings',`${c[0]}_${c[1]}.gml`),'utf8'))){
 const g=bld.polys.find(p=>p.kind==='ground')?.rings[0].points||bld.polys[0].rings[0].points,cx=g.reduce((s,p)=>s+p[0],0)/g.length-E0,cz=N0-g.reduce((s,p)=>s+p[1],0)/g.length;
 if(!pointInMulti(cx,cz,context))continue;
 for(const p of bld.polys)if(p.texture)textures.set(p.texture.uri,path.join(RAW,'textures',p.texture.uri.split('/').pop()));
}
console.log(`Downloading ${textures.size} façade and roof photos…`);
download([...textures].map(([url,file])=>({url,file})),16);

// Traffic lights (Digiroad) for the area's bounding box.
const ll=[wgs84(b[0]-100,b[3]+100),wgs84(b[2]+100,b[1]-100)],bbox=[Math.min(ll[0][0],ll[1][0]),Math.min(ll[0][1],ll[1][1]),Math.max(ll[0][0],ll[1][0]),Math.max(ll[0][1],ll[1][1])];
fetchWfs({url:DIGIROAD.url,layer:DIGIROAD.layers.lights,bbox,file:path.join(RAW,'digiroad-lights.json'),refresh});

// Sea and ponds: OpenStreetMap coastline and water outlines around the area (a wider box, so the
// shoreline continues to the horizon).
const osm=path.join(RAW,'osm-water.json');
if(!fs.existsSync(osm)||refresh){
 const w=[wgs84(b[0]-1200,b[3]+1200),wgs84(b[2]+1200,b[1]-1200)],s=Math.min(w[0][1],w[1][1]),n=Math.max(w[0][1],w[1][1]),west=Math.min(w[0][0],w[1][0]),east=Math.max(w[0][0],w[1][0]);
 const q=`[out:json][timeout:180];(way["natural"="coastline"](${s},${west},${n},${east});way["natural"="water"](${s},${west},${n},${east});relation["natural"="water"](${s},${west},${n},${east}););out geom;`;
 execFileSync('curl',['-f','-sS','--retry','3','--max-time','240','-A',UA,'--data-urlencode',`data=${q}`,'https://overpass-api.de/api/interpreter','-o',osm],{stdio:'inherit'});
}
// Espoo's district polygons (land and sea): Espoo's water is the OSM water inside them, Helsinki's stays Helsinki's.
const districts=path.join(RAW,'districts.gml');
if(!fs.existsSync(districts)||refresh)execFileSync('curl',['-f','-sS','--retry','3','--max-time','300','-A',UA,'-o',districts,`${ESPOO_WFS}?service=WFS&version=1.1.0&request=GetFeature&typeName=GIS:Kaupunginosat&bbox=${Math.floor(E0+b[0]-1200)},${Math.floor(N0-b[3]-1200)},${Math.ceil(E0+b[2]+1200)},${Math.ceil(N0-b[1]+1200)}`],{stdio:'inherit'});
fs.writeFileSync(path.join(RAW,'fetch-report.json'),JSON.stringify({fetchedAt:new Date().toISOString().slice(0,10),wfs:ESPOO_WFS,layers:ESPOO_LAYERS,cell:CELL,cells:cells.length,textures:textures.size,digiroad:DIGIROAD.layers.lights,osm:'Overpass API: natural=coastline, natural=water',districts:'GIS:Kaupunginosat'},null,1));
fs.rmSync(path.join(RAW,'curl-batch.txt'),{force:true});
