import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

// Kamppi Chapel (Chapel of Silence), Simonkatu 7 / Narinkkatori. K2S Architects, 2012.
// MEASURED: footprint ring = Helsinki municipal record RATU 57950
// (Rakennukset_alue.749377, 73 points, closing point dropped). The municipal
// 3D model is a vertical extrusion of that ring from 0.12 m to 13.06 m, so the
// ring is the envelope of the widest (top) part of the bowl.
// PUBLISHED: 11.5 m tall, windowless, horizontal finger-jointed spruce planks
// with pigmented transparent wax, daylight through a perimeter void in the roof.
// INTERPRETED: the flare profile (base scale 0.75 of the top), rim detail,
// plank height and the small glazed entrance tucked under the east overhang.
export const KAMPPI_CHAPEL_RATU=57950;
export const KAMPPI_CHAPEL_FOOTPRINT=[[-902.18,79.07],[-901.83,79.07],[-900.84,79.13],[-899.84,79.12],[-898.85,79.02],[-897.99,78.87],[-897.3,78.77],[-896.64,78.59],[-895.99,78.34],[-895.38,78.01],[-894.82,77.61],[-894.33,77.18],[-893.87,76.59],[-893.48,75.96],[-893.16,75.28],[-892.94,74.65],[-892.76,73.94],[-892.67,73.21],[-892.66,73.19],[-892.53,72.19],[-892.48,71.18],[-892.51,70.17],[-892.61,69.17],[-892.78,68.24],[-892.95,67.69],[-893.19,67.17],[-893.5,66.69],[-893.81,66.32],[-894.34,65.89],[-894.92,65.54],[-895.54,65.25],[-896.18,65.04],[-896.85,64.91],[-897.47,64.85],[-898.65,64.75],[-899.84,64.73],[-901.03,64.79],[-902.18,64.92],[-903.71,65.2],[-905.23,65.55],[-905.81,65.71],[-907.24,66.23],[-908.64,66.82],[-909.33,67.14],[-910.22,67.61],[-911.08,68.15],[-911.9,68.75],[-912.66,69.42],[-912.72,69.48],[-913.15,69.89],[-913.52,70.36],[-913.82,70.88],[-914.05,71.43],[-914.21,72.01],[-914.25,72.27],[-914.18,72.89],[-914.03,73.5],[-913.81,74.08],[-913.51,74.63],[-913.15,75.14],[-912.93,75.38],[-912.22,76],[-911.46,76.55],[-910.66,77.04],[-909.82,77.45],[-909.47,77.6],[-908.34,78.03],[-907.18,78.38],[-906,78.65],[-905.69,78.71],[-904.35,78.91],[-903,79.03]];
export const KAMPPI_CHAPEL={
 ratu:KAMPPI_CHAPEL_RATU,
 centre:{x:-902.534,z:72.025},   // area centroid of the municipal ring (250 m²)
 base:0,                           // ground level of the flat game terrain
 height:11.5,                      // published overall height
 municipalTop:13.06,               // municipal extrusion top (incl. terrain offset)
 baseScale:.75,                    // interpreted: bowl footprint at ground vs top
 rimScale:1,                       // rim reaches the measured ring
 wallTopScale:.985,
 plank:.118,                       // interpreted plank course height (m)
 lobbyHeight:2.9,                  // interpreted glazed entrance height (m)
 lobbySector:55*Math.PI/180,       // half-angle of the glazed entrance sector
 lobbyFacing:-25*Math.PI/180,      // sector centre: east end, turned toward Lasipalatsi (NE)
};
const C=KAMPPI_CHAPEL,H=C.base+C.height,WALL_TOP=H-.32;
// Scale factor of the footprint ring at height y: narrow at the ground, near
// vertical at the top (a bowl / boat-hull section).
export function chapelWallScale(y){
 const t=THREE.MathUtils.clamp((y-C.base)/(WALL_TOP-C.base),0,1),k=1-C.baseScale/C.wallTopScale;
 return C.wallTopScale*(1-k*(1-t)**2);
}

function resampleRing(ring,n){
 const pts=ring.map(p=>new THREE.Vector2(p[0],p[1])),lens=[0];
 for(let i=0;i<pts.length;i++)lens.push(lens[i]+pts[i].distanceTo(pts[(i+1)%pts.length]));
 const total=lens[pts.length],out=[];
 for(let k=0,j=0;k<n;k++){
  const d=k/n*total;while(lens[j+1]<d)j++;
  const a=pts[j],b=pts[(j+1)%pts.length],f=(d-lens[j])/Math.max(1e-9,lens[j+1]-lens[j]);out.push(a.clone().lerp(b,f));
 }
 // Two light smoothing passes remove survey kinks without leaving the ring.
 let r=out;for(let pass=0;pass<2;pass++)r=r.map((p,i)=>p.clone().multiplyScalar(.5).addScaledVector(r[(i+r.length-1)%r.length],.25).addScaledVector(r[(i+1)%r.length],.25));
 const arc=[0];for(let i=1;i<=r.length;i++)arc.push(arc[i-1]+r[i-1].distanceTo(r[i%r.length]));
 return {points:r,arc};
}
const at=(p,s,y)=>[C.centre.x+(p.x-C.centre.x)*s,y,C.centre.z+(p.y-C.centre.z)*s];

function woodMaterial(){
 const m=new THREE.MeshStandardMaterial({color:'#ffffff',roughness:.78,metalness:0});
 m.onBeforeCompile=shader=>{
  shader.uniforms.plank={value:C.plank};
  shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nattribute vec2 woodCoord;\nvarying vec2 vWood;').replace('#include <begin_vertex>','#include <begin_vertex>\nvWood=woodCoord;');
  shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>
varying vec2 vWood;uniform float plank;
float wHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}`).replace('#include <color_fragment>',`#include <color_fragment>
{
 float row=floor(vWood.y/plank),rr=wHash(vec2(row,3.1));
 float segLen=2.1+rr*2.2,seg=floor((vWood.x+rr*17.0)/segLen),r=wHash(vec2(row,seg));
 vec3 honey=mix(vec3(.74,.54,.32),vec3(.89,.70,.46),r);
 honey*=1.0+.035*sin(vWood.x*23.0+r*40.0)+.02*sin(vWood.x*71.0+row);
 vec3 meanWood=vec3(.82,.62,.39);
 float aa=fwidth(vWood.y);
 honey=mix(honey,meanWood,smoothstep(.02,.07,aa));
 float f=fract(vWood.y/plank),d=min(f,1.0-f)*plank;
 float groove=1.0-smoothstep(.004,.004+aa,d);
 honey*=1.0-.3*groove*(1.0-smoothstep(.012,.04,aa));
 honey*=mix(.9,1.0,smoothstep(0.0,.6,vWood.y));
 diffuseColor.rgb*=pow(honey,vec3(2.2));
}`);
 };
 m.customProgramCacheKey=()=>'kamppi-chapel-wood';
 return m;
}

// Lofted rows [scale,y] around the resampled ring, with seam duplicated for the wood coordinate.
function loft(ring,rows,woodV){
 const {points,arc}=ring,n=points.length,pos=[],wood=[],idx=[];
 for(let r=0;r<rows.length;r++)for(let i=0;i<=n;i++){const p=points[i%n];pos.push(...at(p,rows[r][0],rows[r][1]));wood.push(arc[i],woodV(r,rows[r]));}
 for(let r=0;r<rows.length-1;r++)for(let i=0;i<n;i++){const a=r*(n+1)+i,b=a+1,c=a+n+1,d=c+1;idx.push(a,c,b,b,c,d);}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('woodCoord',new THREE.Float32BufferAttribute(wood,2));g.setIndex(idx);g.computeVertexNormals();
 const nrm=g.attributes.normal;for(let r=0;r<rows.length;r++){const a=r*(n+1),b=a+n,v=new THREE.Vector3().fromBufferAttribute(nrm,a).add(new THREE.Vector3().fromBufferAttribute(nrm,b)).normalize();nrm.setXYZ(a,v.x,v.y,v.z);nrm.setXYZ(b,v.x,v.y,v.z);}
 return g;
}
function annulus(points,s0,y0,s1,y1){
 const n=points.length,pos=[],idx=[];
 for(let i=0;i<n;i++)pos.push(...at(points[i],s0,y0),...at(points[i],s1,y1));
 for(let i=0;i<n;i++){const a=i*2,b=a+1,c=((i+1)%n)*2,d=c+1;idx.push(a,c,b,b,c,d);}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setIndex(idx);g.computeVertexNormals();return g;
}
function fan(points,s,y){
 const pos=[C.centre.x,y,C.centre.z],idx=[],n=points.length;
 for(const p of points)pos.push(...at(p,s,y));
 for(let i=0;i<n;i++)idx.push(0,1+(i+1)%n,1+i);
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setIndex(idx);g.computeVertexNormals();return g;
}
function orient(g){ // make faces point away from the centre / upward, whatever the ring winding
 const p=g.attributes.position,idx=g.index.array;let score=0;
 for(let i=0;i<idx.length;i+=3){const a=new THREE.Vector3().fromBufferAttribute(p,idx[i]),b=new THREE.Vector3().fromBufferAttribute(p,idx[i+1]),c=new THREE.Vector3().fromBufferAttribute(p,idx[i+2]);const nrm=b.clone().sub(a).cross(c.clone().sub(a)),m=a.add(b).add(c).divideScalar(3);score+=nrm.x*(m.x-C.centre.x)+nrm.z*(m.z-C.centre.z)+nrm.y*1e-3;}
 return score;
}
const flip=g=>{const a=g.index.array;for(let i=0;i<a.length;i+=3){const t=a[i+1];a[i+1]=a[i+2];a[i+2]=t;}g.computeVertexNormals();return g;};

export function createKamppiChapel(){
 const ring=resampleRing(KAMPPI_CHAPEL_FOOTPRINT,144),pts=ring.points;
 // Ring winding sign: the loft/annulus normals point outward for one winding only.
 const outward=g=>orient(g)<0?flip(g):g;

 // Wall rows: dense at the curved base, then the rounded rim lip.
 const rows=[];for(let i=0;i<=16;i++){const t=i/16,y=C.base+(WALL_TOP-C.base)*(1-(1-t)**1.4);rows.push([chapelWallScale(y),y]);}
 rows.push([.995,H-.2],[C.rimScale,H-.1],[.996,H-.02]);
 const woodV=(r,row)=>row[1];
 const wall=outward(loft(ring,rows,woodV));
 // Rim top and inner lip down to the perimeter skylight, still timber.
 const lipRows=[[.996,H-.02],[.985,H],[.965,H],[.958,H-.14]];
 const lip=loft(ring,lipRows,(r,row)=>H+ (row[0]<.99?.3:0));
 if(orient(lip)>0)flip(lip);
 const woodGeom=mergeGeometries([wall,lip].map(g=>g.toNonIndexed()));

 // Perimeter skylight ring and flat roof.
 const sky=annulus(pts,.958,H-.14,.905,H-.2);if(sky.attributes.normal.getY(0)<0)flip(sky);
 const roof=fan(pts,.905,H-.2);if(roof.attributes.normal.getY(1)<0)flip(roof);

 // Interpreted glazed entrance under the east overhang (faces Lasipalatsi).
 const glass=[sky.toNonIndexed()],dark=[roof.toNonIndexed()];
 const sector=pts.map((p,i)=>({p,i,a:Math.atan2(p.y-C.centre.z,p.x-C.centre.x)})).filter(q=>Math.abs(q.a-C.lobbyFacing)<=C.lobbySector).sort((a,b)=>a.a-b.a).map(q=>q.p);
 const gS=.955,lh=C.base+C.lobbyHeight,wallS=chapelWallScale(lh+.3);
 {
  const pos=[],gp=[];
  for(let i=0;i<sector.length-1;i++){
   const a=sector[i],b=sector[i+1];
   gp.push(...at(a,gS,C.base),...at(b,gS,C.base),...at(a,gS,lh),...at(b,gS,C.base),...at(b,gS,lh),...at(a,gS,lh));
   // lobby roof slab: top, fascia, soffit
   const top=[at(a,.97,lh+.28),at(b,.97,lh+.28),at(a,wallS,lh+.28),at(b,wallS,lh+.28)];
   const bot=[at(a,.97,lh),at(b,.97,lh),at(a,wallS,lh),at(b,wallS,lh)];
   pos.push(...top[0],...top[2],...top[1],...top[1],...top[2],...top[3]);
   pos.push(...bot[0],...top[0],...bot[1],...bot[1],...top[0],...top[1]);
   pos.push(...bot[0],...bot[1],...bot[2],...bot[1],...bot[3],...bot[2]);
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(gp,3));g.computeVertexNormals();glass.push(g);
  const d=new THREE.BufferGeometry();d.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));d.computeVertexNormals();dark.push(d);
  // End walls closing the glazed sector against the flared timber base.
  for(const e of [sector[0],sector[sector.length-1]]){
   const ep=[],steps=6;
   for(let k=0;k<steps;k++){const y0=C.base+C.lobbyHeight*k/steps,y1=C.base+C.lobbyHeight*(k+1)/steps;const q=[at(e,chapelWallScale(y0)-.01,y0),at(e,gS,y0),at(e,gS,y1),at(e,chapelWallScale(y1)-.01,y1)];ep.push(...q[0],...q[1],...q[2],...q[0],...q[2],...q[3],...q[0],...q[2],...q[1],...q[0],...q[3],...q[2]);}
   const eg=new THREE.BufferGeometry();eg.setAttribute('position',new THREE.Float32BufferAttribute(ep,3));eg.computeVertexNormals();dark.push(eg);
  }
  // Slim dark mullions every ~1.3 m and a door frame at the east point.
  let acc=0;
  for(let i=0;i<sector.length-1;i++){
   const a=new THREE.Vector3(...at(sector[i],gS,0)),b=new THREE.Vector3(...at(sector[i+1],gS,0));acc+=a.distanceTo(b);
   if(acc<1.3&&i<sector.length-2)continue;acc=0;
   const m=new THREE.BoxGeometry(.07,C.lobbyHeight,.1);m.rotateY(-Math.atan2(b.z-a.z,b.x-a.x));m.translate(b.x,C.base+C.lobbyHeight/2,b.z);dark.push(m.toNonIndexed());
  }
  const first=new THREE.Vector3(...at(sector[0],gS,0));const m0=new THREE.BoxGeometry(.07,C.lobbyHeight,.1);m0.translate(first.x,C.base+C.lobbyHeight/2,first.z);dark.push(m0.toNonIndexed());
  const mid=sector[Math.floor(sector.length/2)],door=new THREE.Vector3(...at(mid,gS+.004,0));
  const bar=new THREE.BoxGeometry(.12,.1,2.2);bar.translate(door.x,C.base+2.25,door.z);dark.push(bar.toNonIndexed());
 }
 for(const g of dark)for(const k of Object.keys(g.attributes))if(k!=='position'&&k!=='normal')g.deleteAttribute(k);
 for(const g of glass)for(const k of Object.keys(g.attributes))if(k!=='position'&&k!=='normal')g.deleteAttribute(k);

 const group=new THREE.Group();group.name='Kamppi Chapel';
 const materials={
  wood:woodMaterial(),
  dark:new THREE.MeshStandardMaterial({color:'#44484a',roughness:.72,metalness:.15}),
  glass:new THREE.MeshStandardMaterial({color:'#8fa6ae',roughness:.08,metalness:.25,emissive:'#2a2418',side:THREE.DoubleSide}),
 };
 for(const [name,geometry] of [['wood',woodGeom],['dark',mergeGeometries(dark)],['glass',mergeGeometries(glass)]]){
  geometry.computeBoundingSphere();geometry.computeBoundingBox();
  const mesh=new THREE.Mesh(geometry,materials[name]);mesh.name=`Kamppi Chapel ${name}`;mesh.castShadow=name!=='glass';mesh.receiveShadow=true;mesh.matrixAutoUpdate=false;group.add(mesh);
 }
 group.matrixAutoUpdate=false;
 const baseRing=pts.map(p=>{const q=at(p,chapelWallScale(C.base),C.base);return [q[0],q[2]];}),topRing=pts.map(p=>{const q=at(p,C.rimScale,H-.1);return [q[0],q[2]];});
 group.userData={landmark:'Kamppi Chapel',ratu:C.ratu,height:C.height,top:H,baseRing,topRing,drawCalls:group.children.length,sources:'public/models/kamppi-chapel-sources.json'};
 const ringObs=[...KAMPPI_CHAPEL_FOOTPRINT,KAMPPI_CHAPEL_FOOTPRINT[0]];
 const xs=ringObs.map(p=>p[0]),zs=ringObs.map(p=>p[1]);
 const obstacles=[{name:'Kamppi Chapel',ratu:C.ratu,rings:[ringObs],bbox:[Math.min(...xs),Math.min(...zs),Math.max(...xs),Math.max(...zs)]}];
 return {group,obstacles};
}
