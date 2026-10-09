import {surfaceRecord} from '../src/surface-streaming.js';
// node scripts/build-extension.mjs <id>
// Converts data/raw/extensions/<id> into the game's runtime formats under
// public/data/extensions/<id>/ and registers it in public/data/extensions/index.json.
// Same formats as the main snapshot (city.pack, buildings3d, surfaces, mobility);
// municipal feature IDs de-duplicate everything along the ±2400 m seam, so the
// existing public/data files are never rewritten.
import fs from 'node:fs';
import path from 'node:path';
import {gunzipSync,gzipSync} from 'node:zlib';
import polygonClipping from 'polygon-clipping';
import earcut from 'earcut';
import proj4 from 'proj4';
import {Matrix4,Vector3} from 'three';
import {bounds,SpatialIndex,pointInPolygon,registerPlayableArea,WORLD_EXTENT} from '../src/geo.js';
import {nearestRoadPoint} from '../src/physics.js';
import {GK25,readExtension,readRoute,extensionRegions,multiBounds,simplifyRing,boxesOverlap,rectangle,pointInMulti,SNAPSHOT_SQUARE,paveUncovered} from './extension-geometry.mjs';
import {ktx2ToJpeg} from './ktx2.mjs';
import {placeStarts} from './place-starts.mjs';

const id=process.argv[2],ext=readExtension(id),route=readRoute(id),RAW=path.join('data/raw/extensions',id),OUT=path.join('public/data/extensions',id),URL_DIR=`extensions/${id}`;
fs.rmSync(OUT,{recursive:true,force:true});for(const d of ['buildings3d','surfaces'])fs.mkdirSync(path.join(OUT,d),{recursive:true});
const project=proj4('EPSG:4326',GK25),base=JSON.parse(gunzipSync(fs.readFileSync('public/data/city.pack'))),origin=base.originGK25,round=(n,k=100)=>Math.round(n*k)/k;
const local=(p,native=false)=>{const c=native?p:project.forward(p.slice(0,2));return [round(c[0]-origin[0]),round(origin[1]-c[1])];};
const raw=n=>JSON.parse(fs.readFileSync(path.join(RAW,n+'.json')));
const fetchReport=raw('fetch-report');
const clean=r=>r.filter((p,i)=>!i||Math.hypot(p[0]-r[i-1][0],p[1]-r[i-1][1])>.02);
const insideSnapshot=([x,z])=>Math.abs(x)<WORLD_EXTENT&&Math.abs(z)<WORLD_EXTENT;
const {surface,context}=extensionRegions(route),contextBounds=multiBounds(context);
const skipped={};

// ---------- City polygons (same field mapping as scripts/build-data.mjs) ----------
function polygons(name,known,native=false){
 const d=raw(name);if(d.numberMatched!==undefined&&d.features.length<d.numberMatched)throw Error(`Incomplete ${name} download`);
 return d.features.flatMap(f=>{
  if(known.has(f.id)){skipped[name]=(skipped[name]||0)+1;return [];}
  const polys=f.geometry?.type==='MultiPolygon'?f.geometry.coordinates:f.geometry?.type==='Polygon'?[f.geometry.coordinates]:[];
  return polys.map(poly=>{const rings=poly.map(r=>clean(r.map(p=>local(p,native)))).filter(r=>r.length>=3);if(!rings.length)return null;const p=f.properties;
   return {id:f.id,rings,bbox:bounds(rings),name:p.alueen_nimi||p.puiston_nimi||p.katunimi_suomi||'',address:[p.katunimi_suomi,p.osoitenumero].filter(Boolean).join(' '),kind:p.alatyyppi||p.tyyppi||'',material:p.materiaali||'',ratu:p.ratu};}).filter(Boolean);
 });
}
const ids=k=>new Set(base[k].map(f=>f.id));
const city={extension:id,fetchedAt:fetchReport.fetchedAt,buildings:polygons('buildings',ids('buildings')),roads:polygons('roads',ids('roads')),pavement:polygons('pavement',ids('pavement')),parks:polygons('parks',ids('parks')),water:[],trees:[]};
// The snapshot clipped the sea to its ±2400 m square. Extensions own a wider
// box around it so the shoreline does not stop at an artificial straight edge.
// Areas registered earlier keep the water inside their own boxes, so neighbours never draw it twice.
const indexFile='public/data/extensions/index.json',registryFile=fs.existsSync(indexFile)?JSON.parse(fs.readFileSync(indexFile)):{schemaVersion:1,extensions:[]};
const waterClip=ext.definition.waterClip||[-5500,-3600,WORLD_EXTENT,WORLD_EXTENT],seaBox=rectangle(waterClip),claimed=[SNAPSHOT_SQUARE,...registryFile.extensions.filter(e=>e.id!==id&&e.waterClip&&!e.ownWater).map(e=>rectangle(e.waterClip))];
for(const w of polygons('water-native',new Set(),true))for(const rings of polygonClipping.difference(polygonClipping.intersection(w.rings,seaBox),...claimed))city.water.push({...w,rings,bbox:bounds(rings)});
for(const f of raw('trees').features){const p=local(f.geometry.coordinates);if(!insideSnapshot(p))city.trees.push({p,species:f.properties.suomenknimi,size:f.properties.kokoluokka});}
const registeredTrees=city.trees.length;
// Inferred planting inside mapped 'Metsä' (forest) polygons; flagged, deterministic.
const paved=new SpatialIndex([...city.roads,...city.pavement].map(p=>({rings:p.rings})));
function seeded(n){let s=n>>>0;return()=>((s=Math.imul(s^s>>>15,s|1)^(s+Math.imul(s^s>>>7,s|61)),((s^s>>>14)>>>0)/4294967296));}
for(const park of city.parks.filter(p=>/^Metsä/.test(p.kind)&&boxesOverlap(p.bbox,contextBounds))){
 const random=seeded([...park.id].reduce((h,c)=>Math.imul(h^c.charCodeAt(0),16777619),2166136261)),spacing=9;
 for(let x=park.bbox[0];x<park.bbox[2];x+=spacing)for(let z=park.bbox[1];z<park.bbox[3];z+=spacing){
  const p=[round(x+random()*spacing),round(z+random()*spacing)];
  if(pointInPolygon(p[0],p[1],park.rings)&&!paved.at(...p)&&!insideSnapshot(p)&&pointInMulti(p[0],p[1],context))city.trees.push({p,species:'(inferred forest)',size:random()<.5?'30 - 50 cm':'20 - 30 cm',inferred:true});
 }
}
// Motorways and their ramps (Länsiväylä) are not in the street-area register: pave them from the traffic
// lines wherever no street area covers the centreline (one-way carriageway ≈ 10.4 m, ramp ≈ 7.2 m).
{const lines=[];
 for(const f of raw('traffic-lines').features){const p=f.properties;if(!/Moottoriväylä|Väylälinkki/.test(p.alatyyppi)||p.paatyyppi==='Jalankulku ja pyöräliikenne')continue;
  const half=p.alatyyppi==='Väylälinkki'?3.6:/Yksisuuntainen/.test(p.yksisuuntaisuus)?5.2:8.5;
  for(const line of f.geometry.type==='LineString'?[f.geometry.coordinates]:f.geometry.type==='MultiLineString'?f.geometry.coordinates:[])lines.push({points:line.map(q=>local(q)),half});}
 const paved=paveUncovered(lines,new SpatialIndex([...base.roads,...city.roads].map(r=>({rings:r.rings}))),insideSnapshot);
 paved.forEach((rings,k)=>city.roads.push({id:`${id}-motorway-${k}`,rings,bbox:bounds(rings),name:'Länsiväylä',address:'',kind:'Ajorata (moottoriväylä)',material:'Asfalttibetoni',fromCentreline:true}));
 if(paved.length)console.log(`${paved.length} motorway carriageway areas paved from the traffic lines`);}
fs.writeFileSync(path.join(OUT,'city.pack'),gzipSync(Buffer.from(JSON.stringify(city)),{level:9}));

// ---------- Textured LOD2 (3D Tiles 1.1 GLB → buildings3d packs/atlases) ----------
const baseIndex=JSON.parse(fs.readFileSync('public/data/buildings3d-index.json')),known=new Set(baseIndex.tiles.flatMap(t=>t.parts.map(p=>p.id)));
const source=raw('textured-index'),ecef=proj4('+proj=geocent +datum=WGS84 +units=m +no_defs','EPSG:4326'),yUp=new Matrix4().makeRotationX(Math.PI/2);
const tiles=[],seen=new Set();let registry=0,atlases=0;
function propertyRows(gl,view){
 const md=gl.extensions?.EXT_structural_metadata,table=md?.propertyTables?.[0];if(!table)return [];
 const schema=md.schema.classes[table.class].properties,rows=Array.from({length:table.count},()=>({}));
 for(const key of ['id','RATU','address','__PARENT_FEATURE']){const p=table.properties[key];if(!p)continue;const def=schema[key],values=view(p.values);
  for(let r=0;r<table.count;r++){let v;if(def.type==='STRING'){const o=view(p.stringOffsets);v=values.toString('utf8',o.readUInt32LE(r*4),o.readUInt32LE(r*4+4));}else v=def.componentType==='FLOAT64'?values.readDoubleLE(r*8):values.readInt32LE(r*4);rows[r][key]=v===def.noData||v==='null'?undefined:v;}}
 return rows;
}
for(const [ti,t] of source.tiles.entries()){
 const buf=fs.readFileSync(path.join(RAW,'textured',t.file));if(buf.toString('utf8',0,4)!=='glTF')throw Error(`${t.file}: expected GLB content (3D Tiles 1.1)`);
 const jl=buf.readUInt32LE(12),gl=JSON.parse(buf.toString('utf8',20,20+jl)),bin=20+jl+8,view=i=>{const v=gl.bufferViews[i];return buf.subarray(bin+(v.byteOffset||0),bin+(v.byteOffset||0)+v.byteLength);};
 const accessor=i=>{if(i===undefined)return null;const a=gl.accessors[i],v=gl.bufferViews[a.bufferView],n={SCALAR:1,VEC2:2,VEC3:3,VEC4:4}[a.type],bytes={5126:4,5125:4,5123:2,5121:1}[a.componentType],fn={5126:'readFloatLE',5125:'readUInt32LE',5123:'readUInt16LE',5121:'readUInt8'}[a.componentType];return Array.from({length:a.count},(_,k)=>Array.from({length:n},(_,j)=>buf[fn](bin+(v.byteOffset||0)+(a.byteOffset||0)+k*(v.byteStride||bytes*n)+j*bytes)));};
 const rows=propertyRows(gl,view),tileMatrix=new Matrix4().fromArray(t.transform),centre=new Vector3().setFromMatrixPosition(tileMatrix),ll=ecef.forward(centre.toArray()),lat=ll[1]*Math.PI/180,lon=ll[0]*Math.PI/180,up=new Vector3(Math.cos(lat)*Math.cos(lon),Math.cos(lat)*Math.sin(lon),Math.sin(lat));
 const primitives=[],bases=new Map(),boxes=new Map(),heights=new Map();
 for(const node of gl.nodes){if(node.mesh===undefined)continue;const world=tileMatrix.clone().multiply(yUp).multiply(node.matrix?new Matrix4().fromArray(node.matrix):new Matrix4());
  for(const p of gl.meshes[node.mesh].primitives){
   const fid=p.extensions?.EXT_mesh_features?.featureIds?.[0],feature=fid?.attribute!==undefined?accessor(p.attributes[`_FEATURE_ID_${fid.attribute}`]).map(v=>v[0]):null,uv=accessor(p.attributes.TEXCOORD_0),idx=p.indices!==undefined?accessor(p.indices).map(v=>v[0]):null;
   const pos=accessor(p.attributes.POSITION).map((v,i)=>{const a=new Vector3(...v).applyMatrix4(world),h=a.clone().sub(centre).dot(up),q=project.forward(ecef.forward(a.toArray()).slice(0,2)),x=q[0]-origin[0],z=origin[1]-q[1],bid=feature?.[i]??0;bases.set(bid,Math.min(bases.get(bid)??Infinity,h));heights.set(bid,Math.max(heights.get(bid)??-Infinity,h));if(!boxes.has(bid))boxes.set(bid,[Infinity,Infinity,-Infinity,-Infinity]);const b=boxes.get(bid);b[0]=Math.min(b[0],x);b[1]=Math.min(b[1],z);b[2]=Math.max(b[2],x);b[3]=Math.max(b[3],z);return [round(x,1000),h,round(z,1000)];});
   primitives.push({pos,feature,uv,ids:idx||pos.map((_,i)=>i),material:p.material});
  }}
 const arrays=new Map(),meta=new Map(),images=new Map();
 const image=async i=>{if(!images.has(i)){const name=`buildings3d/${ti}-${i}.jpg`;await ktx2ToJpeg(view(gl.images[i].bufferView),path.join(OUT,name));atlases++;images.set(i,`${URL_DIR}/${name}`);}return images.get(i);};
 for(const p of primitives)for(let i=0;i<p.ids.length;i+=3){
  const tri=p.ids.slice(i,i+3),bid=p.feature?.[tri[0]]??0,row=rows[bid]||{},bid_id=row.__PARENT_FEATURE||row.id||`${id}-${ti}-${bid}`;
  if(seen.has(bid_id)||known.has(bid_id))continue;
  const key=`${bid}:${p.material}`;
  if(!arrays.has(key)){arrays.set(key,[]);const m=gl.materials[p.material]?.pbrMetallicRoughness||{},tex=m.baseColorTexture?gl.textures[m.baseColorTexture.index]:null,src=tex?.extensions?.KHR_texture_basisu?.source??tex?.source;
   meta.set(key,{id:bid_id,bbox:boxes.get(bid),height:heights.get(bid)-bases.get(bid),ratu:row.RATU,texture:src!==undefined?await image(src):null,color:m.baseColorFactor?.slice(0,3)||[.7,.7,.7]});}
  const arr=arrays.get(key);for(const j of tri){const v=p.pos[j];arr.push(v[0],round(Math.max(0,v[1]-bases.get(bid)),1000)+.12,v[2],...(p.uv?.[j]||[0,0]));}
 }
 const all=[],parts=[];for(const [key,arr] of arrays){parts.push({...meta.get(key),start:all.length/5,count:arr.length/5});for(const v of arr)all.push(v);}
 for(const m of meta.values())if(!seen.has(m.id)){seen.add(m.id);registry++;}
 if(!all.length)continue;
 const b=parts.reduce((b,p)=>[Math.min(b[0],p.bbox[0]),Math.min(b[1],p.bbox[1]),Math.max(b[2],p.bbox[2]),Math.max(b[3],p.bbox[3])],[Infinity,Infinity,-Infinity,-Infinity]);
 fs.writeFileSync(path.join(OUT,`buildings3d/${ti}.pack`),gzipSync(Buffer.from(new Float32Array(all).buffer),{level:9}));tiles.push({file:`${URL_DIR}/buildings3d/${ti}.pack`,bbox:b,parts});
}
fs.writeFileSync(path.join(OUT,'buildings3d-index.json'),JSON.stringify({source:source.base,description:`Extension ${id}: measured Helsinki LOD2 meshes with municipal photographic atlases (KTX2 transcoded to JPEG); buildings already in the main snapshot are excluded by ID.`,tiles,buildings:registry}));

// ---------- Surface chunks (same colours/heights as scripts/prepare-world.mjs) ----------
const chunks=new Map();
function add(rings,color,y){
 if(!rings.length)return;const flat=[],holes=[];for(const [i,r] of rings.entries()){if(i)holes.push(flat.length/2);for(const p of r)flat.push(...p);}
 const tri=earcut(flat,holes,2),b=bounds(rings),key=`${Math.floor((b[0]+b[2])/600)},${Math.floor((b[1]+b[3])/600)}`;if(!chunks.has(key))chunks.set(key,[]);const v=chunks.get(key);
 const rgb=color.match(/\w\w/g).map(x=>parseInt(x,16)/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4);
 for(let i=0;i<tri.length;i+=3)for(const j of [tri[i],tri[i+2],tri[i+1]])v.push(flat[j*2],y,flat[j*2+1],...rgb);
}
for(const p of city.parks){let c='c3cbb0';if(/Nurm|niitt|Niit|mets|Mets|Kitumaa/.test(p.kind))c='b1c397';else if(/Pensas|Perenn|ruusu|kukka|istut|hein/.test(p.kind))c='91ad7a';else if(/vesi|allas|Lammikko|puro/.test(p.kind))c='abc8c9';else if(/kallio|kiv|muur/.test(p.kind))c='b6b9aa';else if(/käyt|Jalank|liikenne|Aukio|Polku|Erotettu|Portaat/.test(p.kind))c='ddd9cb';add(p.rings,c,.025);}
for(const p of city.pavement)add(p.rings,/Silta/.test(p.kind)&&p.material==='Puu'?'a08c6e':/pyör|Pyör/.test(p.kind)?'c8b8a5':/Portaat|portaat/.test(p.kind)?'b9b8a9':'dfdcd1',.05);
for(const p of city.roads)add(p.rings,/Koroke/.test(p.kind)?'dddacd':/Nupu|Noppa|kivi/.test(p.material)?'aaa99e':'919d98',.07);
for(const p of city.buildings)add(p.rings,'c9c6b9',.085);
const surfaceIndex=[];
for(const [key,values] of chunks){const file=`surfaces/${key}.bin`;fs.writeFileSync(path.join(OUT,file+'.pack'),gzipSync(Buffer.from(new Float32Array(values).buffer),{level:9}));surfaceIndex.push(surfaceRecord(`${URL_DIR}/${file}`,values));}
fs.writeFileSync(path.join(OUT,'surface-index.json'),JSON.stringify(surfaceIndex));

// ---------- Mobility (port of scripts/build-mobility.mjs; complement of its ±2350 m rule) ----------
const lines=raw('traffic-lines').features,signals=raw('traffic-lights').features.map(f=>({p:local(f.geometry.coordinates),name:f.properties.risteys}));
function graph(walking){
 const nodes=[],edges=[],cells=new Map();
 const node=p=>{const x=Math.floor(p[0]),z=Math.floor(p[1]);for(let i=x-1;i<=x+1;i++)for(let j=z-1;j<=z+1;j++)for(const n of cells.get(`${i},${j}`)||[])if(Math.hypot(nodes[n][0]-p[0],nodes[n][1]-p[1])<.75)return n;const n=nodes.length;nodes.push(p);const k=`${x},${z}`;if(!cells.has(k))cells.set(k,[]);cells.get(k).push(n);return n;};
 // Underpasses are skipped, except motorway ones: in the flat game they carry Länsiväylä at street level.
 for(const f of lines){const p=f.properties;if(/Alikulku|tunneli/.test(p.silta_alikulku)&&(walking||p.alatyyppi!=='Moottoriväylä'))continue;
  // Junction links (Väylälinkki: ramps and connectors between carriageways) keep motorway interchanges connected.
  if(walking?!/Jalkakäytävä|jalkakäytävä|Suojatie|Puistotie|Kulkuväylä aukiolla/.test(p.alatyyppi):p.paatyyppi!=='Katu'&&p.alatyyppi!=='Väylälinkki')continue;
  for(const line of f.geometry.type==='LineString'?[f.geometry.coordinates]:f.geometry.type==='MultiLineString'?f.geometry.coordinates:[]){
   const points=line.map(q=>local(q));if(points.every(q=>Math.abs(q[0])<=2350&&Math.abs(q[1])<=2350))continue;
   const a=node(points[0]),b=node(points.at(-1));if(a===b)continue;
   const oneWay=/Yksisuuntainen/.test(p.yksisuuntaisuus),reverse=/vastaan/.test(p.yksisuuntaisuus);
   const addEdge=(from,to,pts)=>{let length=0;for(let i=1;i<pts.length;i++)length+=Math.hypot(pts[i][0]-pts[i-1][0],pts[i][1]-pts[i-1][1]);if(length<.5)return;const end=pts.at(-1);let signal=-1,best=27;signals.forEach((s,i)=>{const d=Math.hypot(s.p[0]-end[0],s.p[1]-end[1]);if(d<best){best=d;signal=i;}});edges.push({from,to,points:pts,length:+length.toFixed(2),lane:walking?0:oneWay?.35:1.45,crossing:p.alatyyppi==='Suojatie',signal});};
   if(walking||!oneWay||!reverse)addEdge(a,b,points);if(walking||!oneWay||reverse)addEdge(b,a,[...points].reverse());
  }}
 return {nodes,edges};
}
fs.writeFileSync(path.join(OUT,'mobility.json'),JSON.stringify({source:'City of Helsinki / Liikennevaylat and Liikennevalot_piste, CC BY 4.0',note:'Extension graph: only lines leaving the main ±2350 m graph; node/signal ids are local and merged at runtime.',signals,roads:graph(false),walks:graph(true)}));

// ---------- Playable outline, start points, registry ----------
const playable=surface.map(poly=>poly.map(r=>simplifyRing(r,2)));
registerPlayableArea(playable);
const roads=[...base.roads,...city.roads],buildingIndex=new SpatialIndex([...base.buildings,...city.buildings]);
const starts=ext.definition.starts.map(s=>{
 const cp=route.checkpoints.find(c=>c.name===s.anchor),line=route.centrelines.find(c=>c.id===s.line).points;
 const p=nearestRoadPoint(cp.position[0],cp.position[2],roads,buildingIndex);
 let best=null;for(let i=1;i<line.length;i++){const a=line[i-1],b=line[i],dx=b[0]-a[0],dz=b[1]-a[1],l=dx*dx+dz*dz;if(!l)continue;const t=Math.max(0,Math.min(1,((p.x-a[0])*dx+(p.z-a[1])*dz)/l)),d=Math.hypot(a[0]+dx*t-p.x,a[1]+dz*t-p.z);if(!best||d<best.d)best={d,dx,dz};}
 // Face along the route, or towards a named checkpoint (e.g. the bridge deck).
 const target=s.face&&route.checkpoints.find(c=>c.name===s.face)?.position,dir=target?[target[0]-p.x,target[2]-p.z]:[best.dx*(s.reverse?-1:1),best.dz*(s.reverse?-1:1)];
 const heading=Math.atan2(-dir[0],-dir[1]); // physics: forward = (-sin h, -cos h)
 return {name:s.name,district:s.district,street:p.name,x:p.x,z:p.z,heading:+heading.toFixed(4),extension:id};
});
const wb=[...city.water.map(w=>w.bbox),contextBounds].reduce((b,x)=>[Math.min(b[0],x[0]),Math.min(b[1],x[1]),Math.max(b[2],x[2]),Math.max(b[3],x[3])]);
const entry={id,title:ext.title,status:ext.status,dir:URL_DIR,mapBounds:contextBounds.map(Math.round),waterBounds:wb.map(Math.round),waterClip,playable,starts,checkpoints:route.checkpoints,
 counts:{footprints:city.buildings.length,roads:city.roads.length,pavement:city.pavement.length,parks:city.parks.length,water:city.water.length,registeredTrees,inferredForestTrees:city.trees.length-registeredTrees,texturedBuildings:registry,texturedTiles:tiles.length,atlases,surfaceChunks:surfaceIndex.length},
 deduplicatedAgainstSnapshot:skipped,
 provenance:{provider:'City of Helsinki, City Survey Services; YLRE; Urban Environment Division',license:'CC BY 4.0',licenseUrl:'https://creativecommons.org/licenses/by/4.0/',fetchedAt:fetchReport.fetchedAt,texturedLod2Source:source.base,routeCrop:route.provenance},
 limitations:ext.limitations};
registryFile.extensions=[...registryFile.extensions.filter(e=>e.id!==id),entry];
fs.writeFileSync(indexFile,JSON.stringify(registryFile));
console.log(JSON.stringify({counts:entry.counts,starts:starts.map(s=>`${s.name}: ${s.street} (${s.x},${s.z})`),dedup:skipped},null,1));
placeStarts([id],{keep:ext.definition.starts.filter(s=>s.face).map(s=>s.name)}); // into a traffic lane, clear of kerbs
