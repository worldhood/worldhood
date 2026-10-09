import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {gzipSync} from 'node:zlib';
import polygonClipping from 'polygon-clipping';
import earcut from 'earcut';
import proj4 from 'proj4';
import {bounds,SpatialIndex,pointInPolygon} from '../src/geo.js';
import {nearestRoadPoint} from '../src/physics.js';
const data=JSON.parse(readFileSync('public/data/city.json'));
const roofs=JSON.parse(readFileSync('public/data/roof-index.json'));
const box=[[[ -2400,-2400],[2400,-2400],[2400,2400],[-2400,2400],[-2400,-2400]]];
data.water=data.water.flatMap(w=>polygonClipping.intersection(w.rings,box).map(rings=>({...w,rings,bbox:bounds(rings)})));
const gk25='+proj=tmerc +lat_0=0 +lon_0=25 +k=1 +x_0=25500000 +y_0=0 +ellps=GRS80 +units=m +no_defs';
const local=ll=>{const p=proj4('EPSG:4326',gk25,ll);return [p[0]-data.originGK25[0],data.originGK25[1]-p[1]];};
const bs=new SpatialIndex(data.buildings);
data.landmarks=[['Senate Square','Senaatintori',[24.9524,60.1685]],['Market Square','Kauppatori',[24.9558,60.16735]],['Central Station','Rautatientori',[24.9434,60.17065]],['Esplanadi','Esplanadi',[24.9472,60.16755]],['Uspenski Cathedral','Katajanokka',[24.9603,60.1686]],['Hakaniemi','Hakaniemi',[24.9515,60.1792]],['Kamppi','Kamppi',[24.9314,60.1683]]].map(([name,district,ll])=>{const [x,z]=local(ll);return {name,district,...nearestRoadPoint(x,z,data.roads,bs)};});
data.landmarks[0].name='Senate Square';
// Keep the menu name and street name as separate fields.
const labels=['Senate Square','Market Square','Central Station','Esplanadi','Uspenski Cathedral','Hakaniemi','Kamppi'];
data.landmarks.forEach((l,i)=>{l.street=l.name;l.name=labels[i];});
const ratuSet=new Set(roofs.registry.map(r=>String(r.ratu)).filter(x=>x!=='undefined'));
const modelIndex=new SpatialIndex(roofs.registry.map(r=>({...r,rings:[[[r.bbox[0],r.bbox[1]],[r.bbox[2],r.bbox[1]],[r.bbox[2],r.bbox[3]],[r.bbox[0],r.bbox[3]]]]})));
for(const b of data.buildings){
 const cx=(b.bbox[0]+b.bbox[2])/2,cz=(b.bbox[1]+b.bbox[3])/2;
 b.hasModel=ratuSet.has(String(b.ratu)) || modelIndex.near(cx,cz).some(m=>{const a=m.bbox,bb=b.bbox;const overlap=Math.max(0,Math.min(a[2],bb[2])-Math.max(a[0],bb[0]))*Math.max(0,Math.min(a[3],bb[3])-Math.max(a[1],bb[1]));return overlap/Math.max(1,(bb[2]-bb[0])*(bb[3]-bb[1]))>.5;});
}
const chunks=new Map();
function add(rings,color,y){
 if(!rings.length)return;
 const flat=[],holes=[];for(const [i,r] of rings.entries()){if(i)holes.push(flat.length/2);for(const p of r)flat.push(...p);}
 const ids=earcut(flat,holes,2);const b=bounds(rings);const key=`${Math.floor((b[0]+b[2])/600)},${Math.floor((b[1]+b[3])/600)}`;
 if(!chunks.has(key))chunks.set(key,[]);const v=chunks.get(key);
 const c=color.match(/\w\w/g).map(x=>parseInt(x,16)/255);
 // Three.js vertex colours are linear.
 const rgb=c.map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4);
 for(let i=0;i<ids.length;i+=3){for(const j of [ids[i],ids[i+2],ids[i+1]])v.push(flat[j*2],y,flat[j*2+1],...rgb);}
}
// Water is rendered once by createSea; do not bake a competing water plane.
for(const p of data.parks){let c='c3cbb0';if(/Nurm|niitt|Niit|mets|Mets|Kitumaa/.test(p.kind))c='b1c397';else if(/Pensas|Perenn|ruusu|kukka|istut|hein/.test(p.kind))c='91ad7a';else if(/vesi|allas|Lammikko|puro/.test(p.kind))c='abc8c9';else if(/kallio|kiv|muur/.test(p.kind))c='b6b9aa';else if(/käyt|Jalank|liikenne|Aukio|Polku|Erotettu|Portaat/.test(p.kind))c='ddd9cb';add(p.rings,c,.025);}
for(const p of data.pavement)add(p.rings,/pyör|Pyör/.test(p.kind)?'c8b8a5':/Portaat|portaat/.test(p.kind)?'b9b8a9':'dfdcd1',.05);
for(const p of data.roads)add(p.rings,/Koroke/.test(p.kind)?'dddacd':/Nupu|Noppa|kivi/.test(p.material)?'aaa99e':'919d98',.07);
// Building footprints remain visible in the overview even before detailed tiles arrive.
for(const p of data.buildings)add(p.rings,'c9c6b9',.085);
mkdirSync('public/data/surfaces',{recursive:true});const surfaceIndex=[];
for(const [key,values] of chunks){const arr=new Float32Array(values);const filename=`surfaces/${key}.bin`;writeFileSync(`public/data/${filename}`,Buffer.from(arr.buffer));surfaceIndex.push({file:filename});}
writeFileSync('public/data/surface-index.json',JSON.stringify(surfaceIndex));
writeFileSync('public/data/city.json.gz',gzipSync(Buffer.from(JSON.stringify(data)),{level:9}));
writeFileSync('public/data/city.json',JSON.stringify(data));
const p=JSON.parse(readFileSync('public/data/provenance.json'));p.counts.fallbackFootprints=data.buildings.filter(b=>!b.hasModel).length;p.counts.footprintsInsidePlayableRadius=data.buildings.filter(b=>Math.hypot((b.bbox[0]+b.bbox[2])/2,(b.bbox[1]+b.bbox[3])/2)<=2000).length;
writeFileSync('public/data/provenance.json',JSON.stringify(p,null,2));
console.log('Prepared surface chunks:',chunks.size,'Fallback buildings:',p.counts.fallbackFootprints,'Landmarks:',data.landmarks);
