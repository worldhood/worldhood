// node scripts/fetch-extension.mjs <id> [--refresh]
// Downloads City of Helsinki open data for the part of an extension that lies
// outside the original ±2400 m snapshot. Read-only public endpoints; raw files
// go to data/raw/extensions/<id> (ignored by git).
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import polygonClipping from 'polygon-clipping';
import {readRoute,extensionRegions,multiBounds,wgs84,SNAPSHOT_SQUARE} from './extension-geometry.mjs';

const id=process.argv[2],refresh=process.argv.includes('--refresh'),RAW=path.join('data/raw/extensions',id);fs.mkdirSync(path.join(RAW,'textured'),{recursive:true});
const {context}=extensionRegions(readRoute(id)),outside=polygonClipping.difference(context,SNAPSHOT_SQUARE);
if(!outside.length)throw Error('Extension lies entirely inside the existing snapshot; nothing to fetch');
const b=multiBounds(outside),m=60,corners=[wgs84(b[0]-m,b[3]+m),wgs84(b[2]+m,b[1]-m),wgs84(b[0]-m,b[1]-m),wgs84(b[2]+m,b[3]+m)];
const bbox=[Math.min(...corners.map(c=>c[0])),Math.min(...corners.map(c=>c[1])),Math.max(...corners.map(c=>c[0])),Math.max(...corners.map(c=>c[1]))].map(v=>+v.toFixed(5));
console.log('Extension bbox (lon/lat):',bbox.join(','));
// The municipal geoserver intermittently resets connections; retry with backoff.
function curl(url,dest,seconds=180){for(let attempt=1;;attempt++){try{execFileSync('curl',['-f','-L','--retry','4','--retry-all-errors','--retry-delay','10','--max-time',String(seconds),'-sS',url,'-o',dest+'.part'],{stdio:'inherit'});fs.renameSync(dest+'.part',dest);return;}catch(error){if(attempt>=3)throw error;console.log(`Retrying ${path.basename(dest)} (${attempt})…`);execFileSync('sleep',[String(20*attempt)]);}}}
const layers={buildings:['Rakennukset_alue','EPSG:4326'],roads:['YLRE_Katu_ja_viherosat_ajorata_alue','EPSG:4326'],pavement:['YLRE_Katu_ja_viherosat_kevytliikenne_alue','EPSG:4326'],parks:['YLRE_Viherosat_alue','EPSG:4326'],trees:['Puurekisteri_piste','EPSG:4326'],'water-native':['Merialue_kantakartasta','EPSG:3879'],'traffic-lines':['Liikennevaylat','EPSG:4326'],'traffic-lights':['Liikennevalot_piste','EPSG:4326']};
for(const [name,[layer,srs]] of Object.entries(layers)){
 const dest=path.join(RAW,`${name}.json`);if(fs.existsSync(dest)&&!refresh)continue;
 const url=new URL('https://kartta.hel.fi/ws/geoserver/avoindata/wfs');
 url.search=new URLSearchParams({service:'WFS',version:'2.0.0',request:'GetFeature',typeNames:`avoindata:${layer}`,outputFormat:'application/json',srsName:srs,bbox:`${bbox.join(',')},EPSG:4326`,count:'50000'});
 console.log(`Downloading ${name}…`);curl(url.href,dest);
 const data=JSON.parse(fs.readFileSync(dest));if(!data.features||data.numberMatched>data.features.length){fs.rmSync(dest);throw Error(`Incomplete ${layer} response`);}
}
// Textured LOD2 is now 3D Tiles 1.1 (GLB, EXT_structural_metadata, KTX2 atlases);
// tile transforms are cumulative and kept per tile.
const base='https://kartta.hel.fi/3d/datasource-data/e5e7158a-52df-45a1-9be0-1be8f2828abd/',tileset=path.join(RAW,'textured-tileset.json');
if(!fs.existsSync(tileset)||refresh)curl(base+'tileset.json',tileset,90);
const tiles=[],used=new Set(),IDENTITY=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
const multiply=(a,c)=>{const o=new Array(16).fill(0);for(let col=0;col<4;col++)for(let r=0;r<4;r++)for(let k=0;k<4;k++)o[col*4+r]+=a[k*4+r]*c[col*4+k];return o;};
function visit(t,parent,inherited=IDENTITY){
 const transform=t.transform?multiply(inherited,t.transform):inherited,r=t.boundingVolume?.region?.map((n,i)=>i<4?n*180/Math.PI:n);
 if(r&&(r[2]<bbox[0]||r[0]>bbox[2]||r[3]<bbox[1]||r[1]>bbox[3]))return;
 const uri=t.content?.uri;
 if(uri){const url=new URL(uri,parent).href;
  if(uri.endsWith('.json')){const p=path.join(RAW,'textured',url.slice(base.length).replaceAll('/','_'));if(!fs.existsSync(p))curl(url,p,90);visit(JSON.parse(fs.readFileSync(p)).root,url,transform);return;}
  const level=Number(url.slice(base.length).split('/')[0]);
  if(level>=16||!t.children?.length){if(!used.has(url)){used.add(url);tiles.push({url,region:r,transform,file:url.slice(base.length).replaceAll('/','_')});}return;}
 }
 t.children?.forEach(c=>visit(c,parent,transform));
}
visit(JSON.parse(fs.readFileSync(tileset)).root,base+'tileset.json');
fs.writeFileSync(path.join(RAW,'textured-index.json'),JSON.stringify({base,bbox,tiles}));
for(const [i,t] of tiles.entries()){const p=path.join(RAW,'textured',t.file);if(!fs.existsSync(p))curl(t.url,p,120);if(i%10===0||i===tiles.length-1)console.log(`${i+1}/${tiles.length} tiles`);}
fs.writeFileSync(path.join(RAW,'fetch-report.json'),JSON.stringify({fetchedAt:new Date().toISOString().slice(0,10),bbox,layers,texturedBase:base,tiles:tiles.length},null,2));
