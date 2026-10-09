// Paged, cached WFS 2.0 GetFeature for national and municipal open data (Digiroad, city geoservers).
// Raw responses go to data/raw/cities/<id>/<dir>/ (git-ignored); features stay in the server's native CRS
// and are projected with projector() so every layer lands in the city's local frame.
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import proj4 from 'proj4';

// Finnish national grids used by the open-data servers; any other code proj4 knows works too.
export const CRS={
 'EPSG:4326':'+proj=longlat +ellps=WGS84 +datum=WGS84 +no_defs',
 'EPSG:3067':'+proj=utm +zone=35 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs', // ETRS-TM35FIN (Digiroad)
 ...Object.fromEntries([19,20,21,22,23,24,25,26,27,28,29,30,31].map(z=>[`EPSG:${3854+z}`,`+proj=tmerc +lat_0=0 +lon_0=${z} +k=1 +x_0=${z}500000 +y_0=0 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs`])), // ETRS-GK19…31 (gk24 = EPSG:3878)
};
export const crsCode=s=>{const m=/EPSG:+(\d+)/i.exec(String(s||''));return m?`EPSG:${m[1]}`:'EPSG:4326';};
// Native coordinates → WGS84 → the city's local frame ({local(lon,lat)} from mapillary-features.mjs).
export function projector(crs,local){
 const code=crsCode(crs),def=CRS[code]||code,t=code==='EPSG:4326'?null:proj4(def,'EPSG:4326');
 return ([x,y])=>{const [lon,lat]=t?t.forward([x,y]):[x,y];return local(lon,lat);};
}
// Every vertex of a GeoJSON geometry as lists of points (Point → [[p]], LineString → [[…]], Multi* → several).
export function parts(g){
 if(!g)return [];
 if(g.type==='Point')return [[g.coordinates]];
 if(g.type==='MultiPoint')return g.coordinates.map(p=>[p]);
 if(g.type==='LineString')return [g.coordinates];
 if(g.type==='MultiLineString')return g.coordinates;
 if(g.type==='Polygon')return [g.coordinates[0]];
 if(g.type==='MultiPolygon')return g.coordinates.map(p=>p[0]);
 return [];
}

const curl=url=>JSON.parse(execFileSync('curl',['-sS','-f','--retry','4','--retry-delay','5','--max-time','300','-A','open-city-drive/0.1 (city build)',url],{encoding:'utf8',maxBuffer:1<<30}));
// bbox: [west,south,east,north] in WGS84. Returns {features,crs}.
export function fetchWfs({url,layer,bbox,file,refresh=false,page=5000}){
 if(fs.existsSync(file)&&!refresh)return JSON.parse(fs.readFileSync(file));
 const [w,s,e,n]=bbox,features=[];let total=Infinity,crs=null;
 for(let start=0;start<total;start+=page){
  const d=curl(`${url}?service=WFS&version=2.0.0&request=GetFeature&typeNames=${layer}&count=${page}&startIndex=${start}&outputFormat=application/json&bbox=${s},${w},${n},${e},urn:ogc:def:crs:EPSG::4326`);
  total=d.numberMatched??d.totalFeatures??d.features.length;crs=crs||d.crs?.properties?.name;features.push(...d.features);if(!d.features.length)break;
 }
 if(features.length<total*.99)throw Error(`Incomplete ${layer}: ${features.length}/${total}`);
 const out={layer,crs:crsCode(crs),fetchedAt:new Date().toISOString().slice(0,10),numberMatched:total,features};
 fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify(out));
 console.log(`  ${layer}: ${features.length} features (${out.crs})`);
 return out;
}
