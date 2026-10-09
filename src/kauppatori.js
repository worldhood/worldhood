import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {architectureBuilder} from './cathedral.js';
import {SpatialIndex,pointInPolygon} from './geo.js';
import {createHavisAmanda} from './havis-amanda.js';
import {addGraniteSetts} from './market-street-surface.js';

export const MARKET_MONUMENTS={amanda:{x:-39.066,z:281.183},empress:{x:124.882,z:275.284}};
// Canopy centres digitised from the 2025 municipal orthophoto. These are a
// representative market day, not a promise of today's individual vendor layout.
const CANOPIES=[
 [514,458,1],[550,493,1],[591,490,1],[618,490,1],[668,486,1],[697,486,0],
 [474,532,1],[515,532,1],[541,531,1],[578,528,1],[619,525,1],
 [716,518,1],[743,518,1],[774,518,1],[582,460,0],[707,452,0],[739,453,0],[774,449,0],
 [743,487,0],[779,487,0],[844,452,0],[855,471,0],[892,475,0],[908,483,0],
 [941,476,0],[969,477,0],[865,514,0],[891,513,0],[929,509,0],[966,509,0],
 [961,545,0],[985,547,0],[790,560,0],[827,556,1],[927,609,1],[966,610,1],
].map(([px,py,orange])=>({x:px/3.84-90,z:py/3.84+150,orange:!!orange,w:5.2,d:4.4}));
function footprint(x,z,w,d){return {name:'Market stall',rings:[[[x-w/2,z-d/2],[x+w/2,z-d/2],[x+w/2,z+d/2],[x-w/2,z+d/2]]]};}
export function marketStallPlacements(data){
 const square=new SpatialIndex(data.pavement.filter(p=>p.name==='Kauppatori'&&p.kind==='Aukiot')),roads=new SpatialIndex(data.roads),buildings=new SpatialIndex(data.buildings);
 return CANOPIES.filter(s=>footprint(s.x,s.z,s.w,s.d).rings[0].every(([x,z])=>square.at(x,z)&&!roads.at(x,z)&&!buildings.at(x,z)&&!data.water.some(p=>pointInPolygon(x,z,p.rings)))&&Object.values(MARKET_MONUMENTS).every(m=>Math.hypot(s.x-m.x,s.z-m.z)>7));
}
function pavingMaterial(kind){
 const asphalt=/Asfal/i.test(kind),small=/Noppa/.test(kind),cobble=/Mukulu/.test(kind);
 // Mapped sett kinds share the photo-guided granite setts (market-street-surface.js).
 if(/Nupu|Noppa|Mukul/.test(kind))return addGraniteSetts(new THREE.MeshStandardMaterial({color:small?'#8f8c89':'#8a8784',roughness:.9}),`market-setts-${kind}`,small?.8:/Mukul/.test(kind)?1.2:1);
 const mat=new THREE.MeshStandardMaterial({color:asphalt?'#555b59':cobble?'#969083':small?'#a29b8f':'#97978f',roughness:.95});
 mat.onBeforeCompile=shader=>{
  shader.vertexShader='varying vec3 vMarketWorld;\n'+shader.vertexShader.replace('#include <worldpos_vertex>','#include <worldpos_vertex>\nvMarketWorld=(modelMatrix*vec4(transformed,1.0)).xyz;');
  shader.fragmentShader='varying vec3 vMarketWorld;\n'+shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
   vec2 p=vMarketWorld.xz/${small?'.16':cobble?'.23':'.32'};p.x+=mod(floor(p.y),2.)*.5;
   vec2 cell=floor(p);float noise=fract(sin(dot(cell,vec2(127.1,311.7)))*43758.5453);
   vec2 edge=min(fract(p),1.-fract(p));vec2 aa=max(fwidth(p),vec2(.001));
   float joint=1.-smoothstep(.012,.035+max(aa.x,aa.y),min(edge.x,edge.y));
   float visibility=1.-smoothstep(.12,.55,max(aa.x,aa.y));
   diffuseColor.rgb*= ${asphalt?'mix(1.,.96+noise*.08,visibility)':'(mix(1.,.88+noise*.24,visibility)*(1.-joint*.21*visibility))'};
  `);
 };mat.customProgramCacheKey=()=>`market-paving-${kind}`;return mat;
}
export function createKauppatori(data){
 const group=new THREE.Group();group.name='Kauppatori — mapped paving and photo-guided market';
 const batches=new Map();let sections=0;
 for(const p of data.pavement){if(p.name!=='Kauppatori'||p.kind!=='Aukiot')continue;
  const shape=new THREE.Shape(p.rings[0].map(([x,z])=>new THREE.Vector2(x,-z)));for(const r of p.rings.slice(1))shape.holes.push(new THREE.Path(r.map(([x,z])=>new THREE.Vector2(x,-z))));
  const g=new THREE.ShapeGeometry(shape).toNonIndexed();g.rotateX(-Math.PI/2);g.translate(0,.10,0);const kind=p.material||'Nupukivi';if(!batches.has(kind))batches.set(kind,[]);batches.get(kind).push(g);sections++;
 }
 for(const [kind,gs] of batches){const m=new THREE.Mesh(mergeGeometries(gs),pavingMaterial(kind));m.receiveShadow=true;group.add(m);gs.forEach(g=>g.dispose());}
 const b=architectureBuilder(),mat=(color,roughness=.8,metalness=0)=>new THREE.MeshStandardMaterial({color,roughness,metalness}),orange=mat('#d97827'),canvas=mat('#dfdac7'),iron=mat('#3a4847',.6,.5),wood=mat('#8c7151'),stone=mat('#858783'),red=mat('#a67c70'),bronze=mat('#456c5e',.6,.5),gold=mat('#ba9853',.35,.65),water=mat('#45777b',.25,.35),produce=[mat('#b24332'),mat('#b4a34c'),mat('#6e8650')];
 const stalls=marketStallPlacements(data),obstacles=[];
 for(const [i,s] of stalls.entries()){
  obstacles.push(footprint(s.x,s.z,s.w,s.d));
  for(const dx of [-s.w/2,s.w/2])for(const dz of [-s.d/2,s.d/2])b.cylinder(.035,.035,2.55,iron,s.x+dx,1.3,s.z+dz,6);
  // Two pitched fabric panels, striped on orange market canopies.
  for(let strip=0;strip<6;strip++)for(const side of [-1,1]){
   const w=s.w/6,x=-s.w/2+(strip+.5)*w,g=new THREE.PlaneGeometry(w,Math.hypot(s.d/2,.75));g.rotateX(-Math.PI/2+side*Math.atan2(.75,s.d/2));
   const fabric=s.orange&&strip%3!==0?orange:canvas;fabric.side=THREE.DoubleSide;b.add(g,fabric,s.x+x,2.925,s.z+side*s.d/4);
   b.box(w,.24,.035,fabric,s.x+x,2.46,s.z+side*s.d/2);
  }
  b.box(s.w-.3,.65,.9,wood,s.x,.62,s.z+s.d/2-.6);
  for(let j=0;j<4;j++){b.box(.95,.12,.7,wood,s.x-1.65+j*1.1,1.0,s.z+s.d/2-.6);b.box(.8,.16,.55,produce[(i+j)%3],s.x-1.65+j*1.1,1.13,s.z+s.d/2-.6);}
 }
 // HAM's georeferenced monuments. Small sculptural forms are silhouettes, not scans.
 const a=MARKET_MONUMENTS.amanda;
 const amanda=createHavisAmanda(a);group.add(amanda.group);
 obstacles.push(footprint(a.x,a.z,10.5,10.5));
 const e=MARKET_MONUMENTS.empress;
 for(let i=0;i<3;i++)b.box(4.3-i*.55,.25,4.3-i*.55,red,e.x,.225+i*.25,e.z);
 b.box(1.5,1.6,1.5,red,e.x,1.6,e.z);b.cylinder(.35,.7,5.2,red,e.x,5,e.z,4);b.add(new THREE.SphereGeometry(.42,16,12),gold,e.x,7.88,e.z);
 b.cylinder(.18,.32,.65,gold,e.x,8.37,e.z,8);for(const side of [-1,1]){const wing=new THREE.SphereGeometry(.4,10,6);wing.scale(1.9,.25,.8);b.add(wing,gold,e.x+side*.47,8.62,e.z);b.add(new THREE.SphereGeometry(.13,10,6),gold,e.x+side*.16,8.87,e.z);}
 obstacles.push(footprint(e.x,e.z,5,5));
 // Mooring bollards along the real mapped shoreline. The granite wall and coping stone come from quay.js.
 let quaySegments=0;
 for(const p of data.water)for(const ring of p.rings)for(let i=0;i<ring.length;i++){
  const a=ring[i],c=ring[(i+1)%ring.length],length=Math.hypot(c[0]-a[0],c[1]-a[1]);
  if(length<.7||length>90||![a,c].every(([x,z])=>x>12&&x<300&&z>265&&z<545))continue;
  quaySegments++;
  if(length>8)for(let j=0;j<length;j+=12){const t=(j+1)/length;b.cylinder(.16,.22,.55,iron,a[0]+(c[0]-a[0])*t,.4,a[1]+(c[1]-a[1])*t,10);}
 }
 group.add(b.finish());group.userData={mappedPavingSections:sections,stalls:stalls.length,quaySegments,monuments:MARKET_MONUMENTS,amanda:amanda.group.userData,accuracy:'Mapped paving and shoreline; photo-guided canopies and reconstructed monument sculptures, not scans'};
 return {group,obstacles,stalls,update:amanda.update};
}
