import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {gzipSync} from 'node:zlib';
import proj4 from 'proj4';
import {Matrix4,Vector3} from 'three';
const source=JSON.parse(readFileSync('data/raw/textured-index.json'));
const gk25='+proj=tmerc +lat_0=0 +lon_0=25 +k=1 +x_0=25500000 +y_0=0 +ellps=GRS80 +units=m +no_defs';
const ecef=proj4('+proj=geocent +datum=WGS84 +units=m +no_defs','EPSG:4326'),project=proj4('EPSG:4326',gk25);
const origin=project.forward([24.9522,60.1701]),round=n=>Math.round(n*1000)/1000;
mkdirSync('public/data/buildings3d',{recursive:true});
const tiles=[],registry=[],seen=new Set();
for(const [ti,t] of source.tiles.entries()){
 const raw=readFileSync('data/raw/textured/'+t.file);const fj=raw.readUInt32LE(12),fb=raw.readUInt32LE(16),bj=raw.readUInt32LE(20),bb=raw.readUInt32LE(24);
 const ft=JSON.parse(raw.toString('utf8',28,28+fj)),bt=JSON.parse(raw.toString('utf8',28+fj+fb,28+fj+fb+bj));
 const off=28+fj+fb+bj+bb,jl=raw.readUInt32LE(off+12),gl=JSON.parse(raw.toString('utf8',off+20,off+20+jl)),bin=off+20+jl+8;
 const world=new Matrix4().makeRotationX(Math.PI/2).multiply(new Matrix4().fromArray(gl.nodes[0].matrix));const rtc=ft.RTC_CENTER;
 const ll=ecef.forward(rtc),lat=ll[1]*Math.PI/180,lon=ll[0]*Math.PI/180,up=new Vector3(Math.cos(lat)*Math.cos(lon),Math.cos(lat)*Math.sin(lon),Math.sin(lat));
 const textures=(gl.images||[]).map((img,i)=>{const v=gl.bufferViews[img.bufferView],name=`buildings3d/${ti}-${i}.jpg`;writeFileSync('public/data/'+name,raw.subarray(bin+(v.byteOffset||0),bin+(v.byteOffset||0)+v.byteLength));return name;});
 function accessor(i){if(i===undefined)return null;const a=gl.accessors[i],v=gl.bufferViews[a.bufferView],n={SCALAR:1,VEC2:2,VEC3:3,VEC4:4}[a.type],bytes={5126:4,5125:4,5123:2,5121:1}[a.componentType],fn={5126:'readFloatLE',5125:'readUInt32LE',5123:'readUInt16LE',5121:'readUInt8'}[a.componentType];return Array.from({length:a.count},(_,k)=>Array.from({length:n},(_,j)=>raw[fn](bin+(v.byteOffset||0)+(a.byteOffset||0)+k*(v.byteStride||bytes*n)+j*bytes)));}
 const primitives=[],bases=new Map(),boxes=new Map(),heights=new Map();
 for(const mesh of gl.meshes)for(const p of mesh.primitives){
  const batch=accessor(p.attributes._BATCHID)?.map(v=>v[0])||[],uv=accessor(p.attributes.TEXCOORD_0),ids=accessor(p.indices)?.map(v=>v[0]);
  const pos=accessor(p.attributes.POSITION).map((v,i)=>{const a=new Vector3(...v).applyMatrix4(world),h=a.dot(up),geo=ecef.forward([a.x+rtc[0],a.y+rtc[1],a.z+rtc[2]]),q=project.forward(geo.slice(0,2));const x=q[0]-origin[0],z=origin[1]-q[1],bid=batch[i]||0;bases.set(bid,Math.min(bases.get(bid)??Infinity,h));heights.set(bid,Math.max(heights.get(bid)??-Infinity,h));if(!boxes.has(bid))boxes.set(bid,[Infinity,Infinity,-Infinity,-Infinity]);const b=boxes.get(bid);b[0]=Math.min(b[0],x);b[1]=Math.min(b[1],z);b[2]=Math.max(b[2],x);b[3]=Math.max(b[3],z);return [round(x),h,round(z)];});
  primitives.push({pos,batch,uv,ids:ids||pos.map((_,i)=>i),material:p.material});
 }
 const arrays=new Map(),meta=new Map();
 for(const p of primitives)for(let i=0;i<p.ids.length;i+=3){const ids=p.ids.slice(i,i+3),bid=p.batch[ids[0]]||0,id=bt.id?.[bid]||`${ti}-${bid}`,b=boxes.get(bid);if(seen.has(id)||b[2]<-2400||b[0]>2400||b[3]<-2400||b[1]>2400)continue;
  const key=`${bid}:${p.material}`;if(!arrays.has(key)){arrays.set(key,[]);const m=gl.materials[p.material].pbrMetallicRoughness;meta.set(key,{id,bbox:b,height:heights.get(bid)-bases.get(bid),ratu:bt.attributes?.[bid]?.RATU,texture:m.baseColorTexture?textures[gl.textures[m.baseColorTexture.index].source]:null,color:m.baseColorFactor?.slice(0,3)||[.7,.7,.7]});}
  const arr=arrays.get(key);for(const j of ids){const v=p.pos[j];arr.push(v[0],round(Math.max(0,v[1]-bases.get(bid)))+.12,v[2],...(p.uv?.[j]||[0,0]));}
 }
 const all=[],parts=[];for(const [key,arr] of arrays){const m=meta.get(key);parts.push({...m,start:all.length/5,count:arr.length/5});for(const v of arr)all.push(v);}
 if(!all.length)continue;
 for(const m of meta.values())if(!seen.has(m.id)){seen.add(m.id);registry.push(m);}
 const b=[Infinity,Infinity,-Infinity,-Infinity];for(const p of parts){b[0]=Math.min(b[0],p.bbox[0]);b[1]=Math.min(b[1],p.bbox[1]);b[2]=Math.max(b[2],p.bbox[2]);b[3]=Math.max(b[3],p.bbox[3]);}
 const file=`buildings3d/${ti}.pack`;writeFileSync('public/data/'+file,gzipSync(Buffer.from(new Float32Array(all).buffer),{level:9}));tiles.push({file,bbox:b,parts});
 if(ti%40===0)console.log(`${ti+1}/${source.tiles.length} converted`);
}
writeFileSync('public/data/buildings3d-index.json',JSON.stringify({source:source.base,description:'Measured Helsinki LOD2 building meshes with municipal photographic facade and roof texture atlases. Bases levelled for current driving terrain.',tiles,buildings:registry.length}));
console.log(`${registry.length} textured 3D buildings, ${tiles.length} tiles`);
