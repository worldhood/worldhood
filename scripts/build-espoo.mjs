import {surfaceRecord} from '../src/surface-streaming.js';
// node scripts/build-espoo.mjs [<id>=espoo]
// Converts the City of Espoo open data fetched by scripts/fetch-espoo.mjs into the game's extension
// formats under public/data/extensions/<id>/ (the same files scripts/build-extension.mjs writes for
// Helsinki areas) and registers the area in public/data/extensions/index.json:
//  - buildings3d: CityGML LOD2 surfaces triangulated, bases levelled to the flat street level,
//    per-surface photos packed into ≤1024 px JPEG atlases per 250 m tile (scripts/espoo-atlas.py),
//  - city.pack: footprints, street areas (tran:road_lod2), trees; osm-water.json: sea and ponds,
//  - mobility.json: centreline graph (one-way from Kulkusuunta), Digiroad signals, joined to the
//    neighbouring Helsinki area's graph at the city border,
//  - then scripts/espoo-ground.mjs: park register and OSM land cover, Digiroad speed limits and lanes.
import fs from 'node:fs';
import path from 'node:path';
import {gzipSync,gunzipSync} from 'node:zlib';
import {execFileSync} from 'node:child_process';
import polygonClipping from 'polygon-clipping';
import earcut from 'earcut';
import {bounds,SpatialIndex,registerPlayableArea} from '../src/geo.js';
import {nearestRoadPoint} from '../src/physics.js';
import {readExtension,readRoute,extensionRegions,multiBounds,simplifyRing,pointInMulti,paveUncovered,local as localLL,ORIGIN_GK25} from './extension-geometry.mjs';
import {parseBuildings,parseStreets,parseCentrelines,parseTrees,parseDistricts,toLocal,triangulate,buildingBase,footprints,ringArea,planAtlas,atlasUv,jpegSize,splitAtJunctions,joinSeam} from './espoo-citygml.mjs';
import {osmWater} from './osm-water.mjs';
import {projector} from './official-wfs.mjs';
import {placeStarts} from './place-starts.mjs';
import {espooGround} from './espoo-ground.mjs';

const id=process.argv[2]||'espoo',ext=readExtension(id),route=readRoute(id),RAW=path.join('data/raw/extensions',id),OUT=path.join('public/data/extensions',id),URL_DIR=`extensions/${id}`;
const fetchReport=JSON.parse(fs.readFileSync(path.join(RAW,'fetch-report.json')));
const [E0,N0]=ORIGIN_GK25,round=(n,k=100)=>Math.round(n*k)/k,L=([e,n])=>[round(e-E0),round(N0-n)];
const base=JSON.parse(gunzipSync(fs.readFileSync('public/data/city.pack')));
if(Math.hypot(base.originGK25[0]-E0,base.originGK25[1]-N0)>.01)throw Error('Origin mismatch with public/data/city.pack');
fs.rmSync(OUT,{recursive:true,force:true});for(const d of ['buildings3d','surfaces'])fs.mkdirSync(path.join(OUT,d),{recursive:true});
const {surface,context}=extensionRegions(route),cb=multiBounds(context);
const layer=dir=>fs.readdirSync(path.join(RAW,dir)).filter(f=>f.endsWith('.gml')).sort().map(f=>fs.readFileSync(path.join(RAW,dir,f),'utf8'));
const unique=list=>[...new Map(list.map(x=>[x.id,x])).values()];
const insideArea=([x,z])=>pointInMulti(x,z,context);
const city={extension:id,fetchedAt:fetchReport.fetchedAt,buildings:[],roads:[],pavement:[],parks:[],water:[],trees:[]};

// ---------- Buildings ----------
const centre=b=>{const r=(b.polys.find(p=>p.kind==='ground')||b.polys[0]).rings[0].points;return L([r.reduce((s,p)=>s+p[0],0)/r.length,r.reduce((s,p)=>s+p[1],0)/r.length]);};
const buildings=unique(layer('buildings').flatMap(parseBuildings)).filter(b=>insideArea(centre(b)));
for(const b of buildings)footprints(b,ORIGIN_GK25).forEach((rings,k)=>city.buildings.push({id:`espoo-${b.id}${k?`-${k}`:''}`,rings,bbox:bounds(rings),name:'',address:b.address,kind:b.use,material:''}));
const TILE=250,MAX_MPP=.22,groups=new Map();
for(const b of buildings){const [x,z]=centre(b),k=`${Math.floor(x/TILE)},${Math.floor(z/TILE)}`;if(!groups.has(k))groups.set(k,[]);groups.get(k).push(b);}
const photoSize=new Map();
function photo(uri){
 if(photoSize.has(uri))return photoSize.get(uri);const file=path.join(RAW,'textures',uri.split('/').pop());let size=null;
 if(fs.existsSync(file)){const fd=fs.openSync(file,'r'),buf=Buffer.alloc(262144),n=fs.readSync(fd,buf,0,buf.length,0);fs.closeSync(fd);size=jpegSize(buf.subarray(0,n));if(size)size.file=file;}
 photoSize.set(uri,size);return size;
}
const localRings=p=>p.rings.map(r=>r.points.map(q=>toLocal(ORIGIN_GK25,q)));
// Buildings → atlas groups: one 1024 px atlas holds a group; dense tiles split until the texel density is fair.
function atlasGroups(list){
 const items=[];for(const b of list)for(const p of b.polys){if(p.kind==='ground'||!p.texture)continue;const s=photo(p.texture.uri);if(!s)continue;items.push({b,p,src:s.file,w:s.w,h:s.h,area:Math.max(.5,ringArea(localRings(p)[0]))});}
 if(!items.length)return [];
 // A plain swatch (the atlas background) for the few surfaces of textured buildings that have no photo.
 items.push({swatch:true,w:8,h:8,area:.01});
 const plan=planAtlas(items,{size:1024,metresPerPixel:.06});
 if(plan.metresPerPixel>MAX_MPP&&list.length>1){const sorted=[...list].sort((a,c)=>centre(a)[0]-centre(c)[0]||centre(a)[1]-centre(c)[1]),half=sorted.length>>1;return [...atlasGroups(sorted.slice(0,half)),...atlasGroups(sorted.slice(half))];}
 return [{items,plan}];
}
const tiles=[],jobs=[];let atlases=0,textured=0,densities=[];
for(const [ti,list] of [...groups.values()].entries()){
 const rect=new Map(),parts=[],all=[];
 atlasGroups(list).forEach(({items,plan},k)=>{const file=`buildings3d/${ti}-${k}.jpg`;atlases++;densities.push(plan.metresPerPixel);
  jobs.push({out:path.join(OUT,file),size:plan.size,pad:2,quality:80,items:items.flatMap((it,i)=>it.swatch?[]:[{src:it.src,...plan.rects[i]}])});
  const swatch={r:plan.rects[items.findIndex(it=>it.swatch)],texture:`${URL_DIR}/${file}`,size:plan.size,swatch:true};
  items.forEach((it,i)=>{if(!it.swatch)rect.set(it.p,{r:plan.rects[i],texture:swatch.texture,size:plan.size});else for(const b of new Set(items.map(x=>x.b).filter(Boolean)))rect.set(b,swatch);});});
 for(const b of list){
  const low=buildingBase(b),byTexture=new Map();
  const swatch=rect.get(b);
  for(const p of b.polys){if(p.kind==='ground')continue;const t=rect.get(p)||swatch,key=t?.texture||'';if(!byTexture.has(key))byTexture.set(key,{t,polys:[],colors:[]});const g=byTexture.get(key);g.polys.push(p);if(p.color)g.colors.push(p.color);}
  for(const [texture,g] of byTexture){
   const start=all.length/5,box=[Infinity,Infinity,-Infinity,-Infinity];let top=0;
   for(const p of g.polys){const t=rect.get(p)||swatch,tris=triangulate(localRings(p),t&&!t.swatch?p.rings.map(r=>p.texture.uv[r.id]):[]);
    for(const tri of tris)for(const [q,uv] of tri){const y=round(Math.max(0,q[1]-low),1000)+.12,[u,v]=t?atlasUv(uv||[.5,.5],t.r,t.size):[0,0];all.push(round(q[0],1000),y,round(q[2],1000),u,v);
     box[0]=Math.min(box[0],q[0]);box[1]=Math.min(box[1],q[2]);box[2]=Math.max(box[2],q[0]);box[3]=Math.max(box[3],q[2]);top=Math.max(top,y);}}
   const count=all.length/5-start;if(!count)continue;
   const color=texture?[1,1,1]:g.colors.length?[0,1,2].map(c=>+(g.colors.reduce((s,x)=>s+x[c],0)/g.colors.length).toFixed(3)):[.75,.74,.72];
   parts.push({id:`espoo-${b.id}`,bbox:box.map(v=>round(v,1000)),height:round(top-.12,1000),texture:texture||null,color,start,count});
  }
  if(swatch)textured++;
 }
 if(!all.length)continue;
 const b=parts.reduce((b,p)=>[Math.min(b[0],p.bbox[0]),Math.min(b[1],p.bbox[1]),Math.max(b[2],p.bbox[2]),Math.max(b[3],p.bbox[3])],[Infinity,Infinity,-Infinity,-Infinity]);
 fs.writeFileSync(path.join(OUT,`buildings3d/${ti}.pack`),gzipSync(Buffer.from(new Float32Array(all).buffer),{level:9}));tiles.push({file:`${URL_DIR}/buildings3d/${ti}.pack`,bbox:b,parts});
}
const jobFile=path.join(RAW,'atlas-jobs.json');fs.writeFileSync(jobFile,JSON.stringify(jobs));
execFileSync('python3',['-E','-P','scripts/espoo-atlas.py',jobFile],{stdio:'inherit'});
fs.writeFileSync(path.join(OUT,'buildings3d-index.json'),JSON.stringify({source:`${fetchReport.wfs} (${fetchReport.layers.buildings})`,description:`Extension ${id}: City of Espoo LOD2 city model (CityGML) with its 2024 oblique-aerial façade and orthophoto roof photos packed into atlases; bases levelled to the flat street level.`,tiles,buildings:buildings.length}));

// ---------- Street areas, trees ----------
function unionTriangles(tris){let out=[];for(let i=0;i<tris.length;i+=300)out=polygonClipping.union(out,...tris.slice(i,i+300).map(t=>{const r=t.map(L);return [[...r,r[0]]];}));return out;}
const areaArea=r=>{let s=0;for(let i=1;i<r.length;i++)s+=r[i-1][0]*r[i][1]-r[i][0]*r[i-1][1];return Math.abs(s)/2;};
for(const f of unique(layer('streets').flatMap(parseStreets))){
 const tris=f.triangles.filter(t=>t.length===3);if(!tris.length)continue;const c=L([tris[0][0][0],tris[0][0][1]]);if(!insideArea(c)&&!tris.some(t=>insideArea(L(t[1]))))continue;
 const road=f.part==='Ajorata',kind=road&&/Erotus|Liikenteenjakaja/.test(f.use)?'Koroke (erotus)':f.use;
 unionTriangles(tris).forEach((rings,k)=>{if(areaArea(rings[0])<.3)return;(road?city.roads:city.pavement).push({id:`espoo-${f.id}${k?`-${k}`:''}`,rings,bbox:bounds(rings),name:f.name,address:'',kind,material:''});});
}
const hash=s=>{let h=2166136261;for(const c of s)h=Math.imul(h^c.charCodeAt(0),16777619);return (h>>>0)/4294967296;};
for(const t of unique([...layer('broadleaf').flatMap(x=>parseTrees(x,false)),...layer('conifer').flatMap(x=>parseTrees(x,true))])){
 const p=L([t.e,t.n]);if(!insideArea(p))continue;const r=hash(t.id);
 city.trees.push({p,species:t.conifer?'havupuu':'lehtipuu',size:'',height:+(t.conifer?10+r*9:8+r*8).toFixed(1),conifer:t.conifer});
}
const near=pts=>pts.some(p=>pointInMulti(p[0],p[1],context));
const centrelines=splitAtJunctions(unique(layer('centrelines').flatMap(parseCentrelines).map(l=>({...l,id:`${l.id}`}))).map(l=>({...l,points:l.points.map(L)})).filter(l=>near(l.points)));
// Lines running mostly under buildings are service tunnels and decks (Tapiola centre): not drivable at street level.
const footprintIndex=new SpatialIndex(city.buildings),underBuildings=l=>{let n=0,k=0;for(let i=1;i<l.points.length;i++){const a=l.points[i-1],b=l.points[i],m=Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/3));for(let j=0;j<m;j++){n++;if(footprintIndex.at(a[0]+(b[0]-a[0])*(j+.5)/m,a[1]+(b[1]-a[1])*(j+.5)/m))k++;}}return k>n*.3;};
const DRIVE=l=>l.part==='Ajorata'&&!/Katuraide|Pysäköintialue|Polkupyörä/.test(l.use)&&!underBuildings(l),WALK=l=>l.part==='Kevyt liikenne'&&/Jalkakäytävä|Yhdistetty|Puistoraitti|Tori/.test(l.use);
// State roads and ramps the street-area register leaves out (Länsiväylä, Kehä I) get carriageways from the centrelines.
{const covered=new SpatialIndex(city.roads.filter(r=>!/Koroke/.test(r.kind)).map(r=>({rings:r.rings})));
 const paved=paveUncovered(centrelines.filter(DRIVE).map(l=>({points:l.points,half:l.direction>0?4.6:4})),covered,q=>!insideArea(q));
 paved.forEach((rings,k)=>city.roads.push({id:`espoo-paved-${k}`,rings,bbox:bounds(rings),name:'',address:'',kind:'Ajorata (keskilinjasta)',material:'',fromCentreline:true}));}
fs.writeFileSync(path.join(OUT,'city.pack'),gzipSync(Buffer.from(JSON.stringify(city)),{level:9}));

// ---------- Water: OSM sea and ponds inside Espoo's districts (Helsinki's sea stays Helsinki's) ----------
const waterClip=[cb[0]-1200,cb[1]-1200,cb[2]+1200,cb[3]+1200].map(v=>Math.round(v/100)*100);
const districts=parseDistricts(fs.readFileSync(path.join(RAW,'districts.gml'),'utf8'));
const espooArea=polygonClipping.union(...districts.map(d=>d.rings.map(r=>{const q=r.map(L);if(q[0][0]!==q.at(-1)[0]||q[0][1]!==q.at(-1)[1])q.push(q[0]);return q;})));
const osm=osmWater(JSON.parse(fs.readFileSync(path.join(RAW,'osm-water.json'))),ll=>localLL(ll),waterClip);
const water=polygonClipping.intersection(osm,espooArea).map(poly=>poly.map(r=>simplifyRing(r,.8))).filter(poly=>poly[0].length>3).map((rings,i)=>({id:`osm-water-${i}`,rings,bbox:bounds(rings),name:'',kind:'Vesi',material:''}));
fs.writeFileSync(path.join(OUT,'osm-water.json'),JSON.stringify({source:'OpenStreetMap natural=coastline and natural=water, clipped to the City of Espoo districts',license:'ODbL 1.0 — © OpenStreetMap contributors',water}));

// ---------- Surface chunks (colours and heights as in scripts/build-extension.mjs) ----------
const chunks=new Map();
function add(rings,color,y){
 const flat=[],holes=[];for(const [i,r] of rings.entries()){if(i)holes.push(flat.length/2);for(const p of r)flat.push(...p);}
 const tri=earcut(flat,holes,2),b=bounds(rings),key=`${Math.floor((b[0]+b[2])/600)},${Math.floor((b[1]+b[3])/600)}`;if(!chunks.has(key))chunks.set(key,[]);const v=chunks.get(key);
 const rgb=color.match(/\w\w/g).map(x=>parseInt(x,16)/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4);
 for(let i=0;i<tri.length;i+=3)for(const j of [tri[i],tri[i+2],tri[i+1]])v.push(flat[j*2],y,flat[j*2+1],...rgb);
}
for(const p of city.pavement)add(p.rings,/^Pyörätie/.test(p.kind)?'c8b8a5':/Puistoraitti/.test(p.kind)?'d6d0bd':'dfdcd1',.05);
for(const p of city.roads)add(p.rings,/Koroke/.test(p.kind)?'dddacd':'919d98',.07);
for(const p of city.buildings)add(p.rings,'c9c6b9',.085);
const surfaceIndex=[];
for(const [key,values] of chunks){const file=`surfaces/${key}.bin`;fs.writeFileSync(path.join(OUT,file+'.pack'),gzipSync(Buffer.from(new Float32Array(values).buffer),{level:9}));surfaceIndex.push(surfaceRecord(`${URL_DIR}/${file}`,values));}
fs.writeFileSync(path.join(OUT,'surface-index.json'),JSON.stringify(surfaceIndex));

// ---------- Mobility ----------
const lights=JSON.parse(fs.readFileSync(path.join(RAW,'digiroad-lights.json'))),toGame=projector(lights.crs,(lon,lat)=>localLL([lon,lat])),signals=[];
for(const f of lights.features){const c=f.geometry?.coordinates;if(!c)continue;const p=toGame(c);if(!signals.some(s=>Math.hypot(s.p[0]-p[0],s.p[1]-p[1])<3))signals.push({p,name:'Digiroad'});}
function graph(walking){
 const nodes=[],edges=[],cells=new Map();
 const node=p=>{const x=Math.floor(p[0]),z=Math.floor(p[1]);for(let i=x-1;i<=x+1;i++)for(let j=z-1;j<=z+1;j++)for(const n of cells.get(`${i},${j}`)||[])if(Math.hypot(nodes[n][0]-p[0],nodes[n][1]-p[1])<.75)return n;const n=nodes.length;nodes.push(p);const k=`${x},${z}`;if(!cells.has(k))cells.set(k,[]);cells.get(k).push(n);return n;};
 for(const l of centrelines){if(!(walking?WALK(l):DRIVE(l)))continue;
  const points=l.points,a=node(points[0]),b=node(points.at(-1));if(a===b)continue;const oneWay=!walking&&l.direction>0;
  const addEdge=(from,to,pts)=>{let length=0;for(let i=1;i<pts.length;i++)length+=Math.hypot(pts[i][0]-pts[i-1][0],pts[i][1]-pts[i-1][1]);if(length<.5)return;const end=pts.at(-1);let signal=-1,best=27;signals.forEach((s,i)=>{const d=Math.hypot(s.p[0]-end[0],s.p[1]-end[1]);if(d<best){best=d;signal=i;}});edges.push({from,to,points:pts,length:+length.toFixed(2),lane:walking?0:oneWay?.35:1.45,crossing:false,signal});};
  if(!oneWay||l.direction===1)addEdge(a,b,[...points]);if(!oneWay||l.direction===2)addEdge(b,a,[...points].reverse());
 }
 return {nodes,edges};
}
const roads=graph(false),walks=graph(true),seam={};
const neighbourFile='public/data/extensions/lansivayla/mobility.json';
if(fs.existsSync(neighbourFile)){const n=JSON.parse(fs.readFileSync(neighbourFile));seam.roads=joinSeam(roads,n.roads,25);seam.walks=joinSeam(walks,n.walks,15);}
fs.writeFileSync(path.join(OUT,'mobility.json'),JSON.stringify({source:'City of Espoo / GIS:Keskilinjat (CC BY 4.0); traffic lights: Digiroad, Väylävirasto (CC BY 4.0)',note:'Extension graph; dead ends at the Helsinki border sit on the neighbouring area\'s nodes so the runtime merge joins them.',signals,roads,walks}));

// ---------- Playable outline, starts, registry ----------
const playable=surface.map(poly=>poly.map(r=>simplifyRing(r,2)));
registerPlayableArea(playable);
const buildingIndex=new SpatialIndex(city.buildings);
const starts=ext.definition.starts.map(s=>{
 const cp=route.checkpoints.find(c=>c.name===s.anchor),line=route.centrelines.find(c=>c.id===s.line).points,p=nearestRoadPoint(cp.position[0],cp.position[2],city.roads.filter(r=>!r.fromCentreline),buildingIndex);
 let best=null;for(let i=1;i<line.length;i++){const a=line[i-1],b=line[i],dx=b[0]-a[0],dz=b[1]-a[1],l=dx*dx+dz*dz;if(!l)continue;const t=Math.max(0,Math.min(1,((p.x-a[0])*dx+(p.z-a[1])*dz)/l)),d=Math.hypot(a[0]+dx*t-p.x,a[1]+dz*t-p.z);if(!best||d<best.d)best={d,dx,dz};}
 const dir=[best.dx*(s.reverse?-1:1),best.dz*(s.reverse?-1:1)];
 return {name:s.name,district:s.district,street:p.name,x:p.x,z:p.z,heading:+Math.atan2(-dir[0],-dir[1]).toFixed(4),extension:id};
});
const indexFile='public/data/extensions/index.json',registry=fs.existsSync(indexFile)?JSON.parse(fs.readFileSync(indexFile)):{schemaVersion:1,extensions:[]};
const wb=[...water.map(w=>w.bbox),cb].reduce((b,x)=>[Math.min(b[0],x[0]),Math.min(b[1],x[1]),Math.max(b[2],x[2]),Math.max(b[3],x[3])]);
const entry={id,title:ext.title,status:ext.status,dir:URL_DIR,mapBounds:cb.map(Math.round),waterBounds:wb.map(Math.round),waterClip,ownWater:true,osmWater:'osm-water.json',playable,starts,checkpoints:route.checkpoints,
 counts:{footprints:city.buildings.length,roads:city.roads.length,pavement:city.pavement.length,parks:0,water:water.length,registeredTrees:city.trees.length,inferredForestTrees:0,texturedBuildings:textured,modelledBuildings:buildings.length,texturedTiles:tiles.length,atlases,surfaceChunks:surfaceIndex.length,signals:signals.length,roadEdges:roads.edges.length},
 seam,atlasMetresPerPixel:{min:Math.min(...densities),median:densities.sort((a,b)=>a-b)[densities.length>>1],max:Math.max(...densities)},
 provenance:{provider:'City of Espoo (Espoon kaupunki): 3D city model, street areas, centrelines, trees and districts',credit:'© Espoon kaupunki, CC BY 4.0',
  note:`© Espoon kaupunki, CC BY 4.0: City of Espoo 3D city model with 2024 photo textures, street areas, centrelines and trees, fetched ${fetchReport.fetchedAt}; traffic lights from Digiroad (Väylävirasto, CC BY 4.0); sea outlines © OpenStreetMap contributors (ODbL)`,license:'CC BY 4.0',licenseUrl:'https://creativecommons.org/licenses/by/4.0/',fetchedAt:fetchReport.fetchedAt,
  sources:{cityModel:`${fetchReport.wfs} ${fetchReport.layers.buildings} (CityGML 2.0 LOD2, 2024 textures)`,streets:fetchReport.layers.streets,centrelines:fetchReport.layers.centrelines,trees:`${fetchReport.layers.broadleaf}, ${fetchReport.layers.conifer}`,signals:'Digiroad dr_liikennevalo, Väylävirasto, CC BY 4.0',water:'OpenStreetMap (ODbL), osm-water.json'},routeCrop:route.provenance},
 limitations:ext.limitations};
registry.extensions=[...registry.extensions.filter(e=>e.id!==id),entry];
fs.writeFileSync(indexFile,JSON.stringify(registry));
const ground=espooGround(id);
console.log(JSON.stringify({ground,counts:entry.counts,seam,atlasMetresPerPixel:entry.atlasMetresPerPixel,starts:starts.map(s=>`${s.name}: ${s.street} (${s.x},${s.z})`)},null,1));
placeStarts([id]); // into a traffic lane, clear of kerbs
