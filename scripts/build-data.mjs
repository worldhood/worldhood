import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import proj4 from 'proj4';
import { Matrix4, Vector3 } from 'three';
import { bounds, WORLD_EXTENT } from '../src/geo.js';
const gk25='+proj=tmerc +lat_0=0 +lon_0=25 +k=1 +x_0=25500000 +y_0=0 +ellps=GRS80 +units=m +no_defs';
const origin=proj4('EPSG:4326',gk25,[24.9522,60.1701]);
const round=n=>Math.round(n*100)/100;
const local=(p,native=false)=>{const c=native?p:proj4('EPSG:4326',gk25,p.slice(0,2));return [round(c[0]-origin[0]),round(origin[1]-c[1])];};
const read=n=>JSON.parse(readFileSync(`data/raw/${n}.json`));
const intersect=b=>b[2]>=-WORLD_EXTENT&&b[0]<=WORLD_EXTENT&&b[3]>=-WORLD_EXTENT&&b[1]<=WORLD_EXTENT;
const clean=r=>r.filter((p,i)=>!i||Math.hypot(p[0]-r[i-1][0],p[1]-r[i-1][1])>.02);
function polygons(name,native=false) {
 const d=read(name);
 if(d.numberMatched!==undefined&&d.features.length<d.numberMatched) throw Error(`Incomplete ${name} download`);
 return d.features.flatMap(f=>{
   const polys=f.geometry.type==='MultiPolygon'?f.geometry.coordinates:f.geometry.type==='Polygon'?[f.geometry.coordinates]:[];
   return polys.map(poly=>{
     const rings=poly.map(r=>clean(r.map(p=>local(p,native)))).filter(r=>r.length>=3);
     if(!rings.length) return null;
     const b=bounds(rings); if(!intersect(b)) return null;
     const p=f.properties;
     return {id:f.id,rings,bbox:b,name:p.alueen_nimi||p.puiston_nimi||p.katunimi_suomi||'',address:[p.katunimi_suomi,p.osoitenumero].filter(Boolean).join(' '),kind:p.alatyyppi||p.tyyppi||'',material:p.materiaali||'',ratu:p.ratu};
   }).filter(Boolean);
 });
}
const data={origin:[24.9522,60.1701],originGK25:origin,radius:2000,extent:WORLD_EXTENT,fetchedAt:'2026-09-16',buildings:polygons('buildings'),roads:polygons('roads'),pavement:polygons('pavement'),parks:polygons('parks'),water:polygons('water-native',true),trees:read('trees').features.map(f=>({p:local(f.geometry.coordinates),species:f.properties.suomenknimi,size:f.properties.kokoluokka})).filter(t=>Math.abs(t.p[0])<WORLD_EXTENT&&Math.abs(t.p[1])<WORLD_EXTENT)};
mkdirSync('public/data',{recursive:true});
writeFileSync('public/data/city.json',JSON.stringify(data));
console.log(Object.fromEntries(Object.entries(data).filter(([,v])=>Array.isArray(v)).map(([k,v])=>[k,v.length])));

// Convert official 3D Tiles to metre coordinates, preserving measured roof shape.
// Building bases are individually levelled for the flat driving surface.
const index=read('roof-index');
const roofIndex=[];const seen=new Set();const registry=[];
mkdirSync('public/data/roofs',{recursive:true});
const ecef='+proj=geocent +datum=WGS84 +units=m +no_defs';
for(const [ti,t] of index.tiles.entries()) {
 const raw=readFileSync(`data/raw/roofs/${t.uri.replaceAll('/','_')}`);
 const fj=raw.readUInt32LE(12),fb=raw.readUInt32LE(16),bj=raw.readUInt32LE(20),bb=raw.readUInt32LE(24);
 const ft=JSON.parse(raw.toString('utf8',28,28+fj));const bt=JSON.parse(raw.toString('utf8',28+fj+fb,28+fj+fb+bj));
 const off=28+fj+fb+bj+bb;const jl=raw.readUInt32LE(off+12);const gl=JSON.parse(raw.toString('utf8',off+20,off+20+jl));const bin=off+20+jl+8;
 const world=new Matrix4().makeRotationX(Math.PI/2).multiply(new Matrix4().fromArray(gl.nodes[0].matrix));
 const rtc=ft.RTC_CENTER; const ll=proj4(ecef,'EPSG:4326',rtc);const center=proj4('EPSG:4326',gk25,ll.slice(0,2));
 const lon=ll[0]*Math.PI/180,lat=ll[1]*Math.PI/180;
 const east=new Vector3(-Math.sin(lon),Math.cos(lon),0), north=new Vector3(-Math.sin(lat)*Math.cos(lon),-Math.sin(lat)*Math.sin(lon),Math.cos(lat)), up=new Vector3(Math.cos(lat)*Math.cos(lon),Math.cos(lat)*Math.sin(lon),Math.sin(lat));
 function accessor(i){const a=gl.accessors[i],v=gl.bufferViews[a.bufferView];const n={SCALAR:1,VEC2:2,VEC3:3,VEC4:4}[a.type];const bytes={5126:4,5125:4,5123:2,5121:1}[a.componentType];const f={5126:'readFloatLE',5125:'readUInt32LE',5123:'readUInt16LE',5121:'readUInt8'}[a.componentType];return Array.from({length:a.count},(_,k)=>Array.from({length:n},(_,j)=>raw[f](bin+(v.byteOffset||0)+(a.byteOffset||0)+k*(v.byteStride||bytes*n)+j*bytes)));}
 const primitives=[];const bases=new Map(), extents=new Map();
 for(const mesh of gl.meshes) for(const p of mesh.primitives){
   const pos=accessor(p.attributes.POSITION),batch=accessor(p.attributes._BATCHID).map(v=>v[0]),ids=accessor(p.indices).map(v=>v[0]);
   const vertices=pos.map((v,i)=>{
      const a=new Vector3(...v).applyMatrix4(world);const e=a.dot(east),n=a.dot(north),h=a.dot(up);
      // Convert the small ENU offset to GK25 (includes grid convergence).
      const geo=proj4(ecef,'EPSG:4326',[a.x+rtc[0],a.y+rtc[1],a.z+rtc[2]]);
      const q=proj4('EPSG:4326',gk25,geo.slice(0,2));
      const out=[q[0]-origin[0],h,origin[1]-q[1]]; const bid=batch[i];
      bases.set(bid,Math.min(bases.get(bid)??Infinity,h));
      if(!extents.has(bid))extents.set(bid,[Infinity,Infinity,-Infinity,-Infinity]);const b=extents.get(bid);b[0]=Math.min(b[0],out[0]);b[1]=Math.min(b[1],out[2]);b[2]=Math.max(b[2],out[0]);b[3]=Math.max(b[3],out[2]);
      return out;
   });
   primitives.push({vertices,batch,ids,color:gl.materials[p.material].pbrMetallicRoughness.baseColorFactor.slice(0,3)});
 }
 const valid=new Set();for(const [bid,b] of extents){const id=bt.id[bid];if(intersect(b)&&!seen.has(id)){valid.add(bid);seen.add(id);const attr=bt.attributes?.[bid]||{};registry.push({id,bbox:b,ratu:attr.RATU,ground:attr.GroundLevel,height:attr.measuredHeight,address:attr.Address});}}
 const out=[];
 for(const p of primitives)for(let i=0;i<p.ids.length;i+=3){const ids=p.ids.slice(i,i+3);const bid=p.batch[ids[0]];if(!valid.has(bid))continue;const vs=ids.map(j=>p.vertices[j]);
   const a=new Vector3(...vs[1]).sub(new Vector3(...vs[0])),b=new Vector3(...vs[2]).sub(new Vector3(...vs[0]));const normal=a.cross(b).normalize();
   if(normal.y<-.8)continue; // hidden bottom faces
   for(const v of vs)out.push(round(v[0]),round(Math.max(0,v[1]-bases.get(bid)))+.12,round(v[2]),...p.color);
 }
 if(!out.length)continue;
 const name=`roofs/${ti}.bin`;const buf=new Float32Array(out);writeFileSync(`public/data/${name}`,Buffer.from(buf.buffer));
 const b=[Infinity,Infinity,-Infinity,-Infinity];for(let i=0;i<out.length;i+=6){b[0]=Math.min(b[0],out[i]);b[1]=Math.min(b[1],out[i+2]);b[2]=Math.max(b[2],out[i]);b[3]=Math.max(b[3],out[i+2]);}
 roofIndex.push({file:name,bbox:b,vertices:out.length/6});
}
writeFileSync('public/data/roof-index.json',JSON.stringify({tiles:roofIndex,buildings:registry.length,registry}));
writeFileSync('public/data/provenance.json',JSON.stringify({date:data.fetchedAt,provider:'City of Helsinki, City Survey Services; YLRE; Urban Environment Division',license:'CC BY 4.0',licenseUrl:'https://creativecommons.org/licenses/by/4.0/',cityModel:'https://kartta.hel.fi/3d/',sourceWFS:'https://kartta.hel.fi/ws/geoserver/avoindata/wfs',lod2Source:index.base,counts:{footprints:data.buildings.length,lod2Buildings:registry.length,roads:data.roads.length,pavements:data.pavement.length,parks:data.parks.length,trees:data.trees.length},limitations:['Terrain is flattened; building bases are levelled individually. Roof shapes retain measured relative geometry.','LOD2 model and current footprint register may differ in survey date and coverage. Footprints without a matched model use a clearly documented estimated extrusion.','Untextured city-model surface colours are schematic, not individually verified façade colours.','Mapped trees use real positions but schematic canopy sizes. Street furniture, traffic, interiors and pedestrians are not comprehensively modelled.','No building-by-building on-site validation has been performed.']},null,2));
console.log(`Converted ${registry.length} LOD2 buildings in ${roofIndex.length} tiles.`);
