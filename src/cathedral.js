import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {addCathedralSite} from './cathedral-site.js';
import {clipTriangleHeight} from './geometry-clipping.js';

// Architectural reconstruction, not a survey of individual ornaments. Main shell
// alignment and roof geometry: municipal RATU 211. Six-column porticos and the
// ~60 m stair width: cathedral's own architectural history. Rise, treads, capitals
// and sculpture silhouettes are photo-guided approximations, explicitly documented.
export const CATHEDRAL={x:-1.45,z:-30.98,angle:.052,terrace:8.4,stairWidth:64,stairRun:19.5,steps:46};
const white=new THREE.MeshStandardMaterial({color:'#eeece5',roughness:.76});
const stone=new THREE.MeshStandardMaterial({color:'#99968e',roughness:.94});
const copper=new THREE.MeshStandardMaterial({color:'#69877c',metalness:.45,roughness:.49});
const glass=new THREE.MeshStandardMaterial({color:'#273d46',metalness:.48,roughness:.22});
const bronze=new THREE.MeshStandardMaterial({color:'#526057',metalness:.6,roughness:.7});
const gold=new THREE.MeshStandardMaterial({color:'#d2b266',metalness:.75,roughness:.32});
export async function loadSenateMaterials(anisotropy=4){
 const loader=new THREE.TextureLoader();
 const [map,normalMap,roughnessMap]=await Promise.all(['color','normal','roughness'].map(kind=>loader.loadAsync(`/materials/granite-${kind}.jpg`)));
 for(const t of [map,normalMap,roughnessMap]){t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=anisotropy;}
 map.colorSpace=THREE.SRGBColorSpace;
 Object.assign(stone,{map,normalMap,roughnessMap,roughness:.95,normalScale:new THREE.Vector2(.16,.16)});stone.color.set('#aaa69f');
 // Use the scan for microstructure, not its brown colour/underexposure. Balance
 // its linear luminance around 1 so photo-guided granite swatches remain neutral.
 stone.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#ifdef USE_MAP
 vec3 sampleStone=texture2D(map,vMapUv).rgb;
 float stoneVariation=clamp(dot(sampleStone,vec3(0.2126,0.7152,0.0722))/0.21,0.78,1.18);
 diffuseColor.rgb*=stoneVariation;
 #endif`);};
 stone.customProgramCacheKey=()=> 'neutral-granite-v1';
}
function stoneUV(g,scale=3){
 const p=g.attributes.position,n=g.attributes.normal,uv=[];
 for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i);if(Math.abs(n.getY(i))>.7)uv.push(x/scale,z/scale);else if(Math.abs(n.getX(i))>.7)uv.push(z/scale,y/scale);else uv.push(x/scale,y/scale);}
 g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));return g;
}
function builder(){
 const batches=new Map();
 function add(g,mat,x=0,y=0,z=0,rotation=0){g.rotateY(rotation);g.translate(x,y,z);if(g.index)g=g.toNonIndexed();g.deleteAttribute('uv');if(!batches.has(mat))batches.set(mat,[]);batches.get(mat).push(g);}
 const box=(w,h,d,mat,x,y,z,r=0)=>add(new THREE.BoxGeometry(w,h,d),mat,x,y,z,r);
 const cylinder=(r1,r2,h,mat,x,y,z,n=24)=>add(new THREE.CylinderGeometry(r1,r2,h,n),mat,x,y,z);
 function finish(){const group=new THREE.Group();for(const [mat,geometries] of batches){const g=mergeGeometries(geometries);if(mat.map)stoneUV(g);const copy=mat.clone();copy.onBeforeCompile=mat.onBeforeCompile;copy.customProgramCacheKey=mat.customProgramCacheKey;const mesh=new THREE.Mesh(g,copy);mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);geometries.forEach(g=>g.dispose());}return group;}
 return {add,box,cylinder,finish};
}
function column(b,x,z,base,height,r=.67){
 b.box(r*2.8,.25,r*2.8,white,x,base+.125,z);
 b.cylinder(r*1.2,r*1.3,.32,white,x,base+.4,z);
 b.cylinder(r*.84,r,height-1.15,white,x,base+.6+(height-1.15)/2,z,32);
 b.cylinder(r*1.22,r*.88,.42,white,x,base+height-.35,z);
 b.box(r*2.65,.22,r*2.65,white,x,base+height-.10,z);
 // Small physical leaf/volute forms; decorative approximation, not scanned capitals.
 for(let i=0;i<8;i++){const a=i*Math.PI/4;b.add(new THREE.SphereGeometry(r*.19,6,4),white,x+Math.sin(a)*r,base+height-.38,z+Math.cos(a)*r);}
}
function archedWindow(b,x,y,z,w,h,r=0){
 const shape=new THREE.Shape();shape.moveTo(-w/2,-h/2);shape.lineTo(w/2,-h/2);shape.lineTo(w/2,h/2-w/2);shape.absarc(0,h/2-w/2,w/2,0,Math.PI,false);shape.closePath();
 b.add(new THREE.ExtrudeGeometry(shape,{depth:.08,bevelEnabled:false,curveSegments:12}),glass,x,y,z,r);
 const dx=Math.cos(r),dz=-Math.sin(r);
 for(const side of [-1,1])b.box(.15,h-w/2,.25,white,x+dx*side*(w/2+.08),y-w/4,z+dz*side*(w/2+.08),r);
 b.box(w+.4,.18,.38,white,x,y-h/2-.09,z,r);
 b.box(.075,h,.14,white,x,y,z+.08*Math.cos(r),r);
 b.box(w,.085,.14,white,x,y+.2,z+.08*Math.cos(r),r);
 const arch=new THREE.TorusGeometry(w/2+.08,.095,6,24,Math.PI);b.add(arch,white,x,y+h/2-w/2,z,r);
}
function statue(b,x,y,z,scale=1,mat=bronze){
 b.box(.65*scale,.3*scale,.65*scale,white,x,y+.15*scale,z);
 b.cylinder(.22*scale,.34*scale,1.3*scale,mat,x,y+.95*scale,z,8);
 b.add(new THREE.SphereGeometry(.21*scale,8,6),mat,x,y+1.75*scale,z);
 b.box(.8*scale,.18*scale,.22*scale,mat,x,y+1.26*scale,z);
}
export {builder as architectureBuilder,column as architectureColumn,archedWindow as architectureArch};
export function createCathedral(array,part){
 const b=builder(),c=CATHEDRAL,base=c.terrace;
 // Greek-cross nave ends stop behind the free-standing portico columns.
 b.box(22.7,16.7,47.6,white,0,base+8.35,0);
 b.box(47.6,16.7,22.7,white,0,base+8.35,0);
 for(const [w,d] of [[23.3,48.2],[48.2,23.3]]){b.box(w,.7,d,stone,0,base+.35,0);b.box(w,.38,d,white,0,24.65,0);b.box(w+.4,.28,d+.4,white,0,25.05,0);}
 for(let side=0;side<4;side++){
  const r=side*Math.PI/2,s=Math.sin(r),co=Math.cos(r),local=builder();
  local.box(23.2,.75,6,stone,0,base+.375,26.2);
  for(let i=0;i<6;i++)column(local,-9.6+i*3.84,27.15,base+.75,15.65);
  local.box(24.05,.66,5.55,white,0,25.1,26.25);
  local.box(24.45,.30,5.95,white,0,25.56,26.25);
  // Dark entry is behind actual pillars, so the colonnade has visible open space.
  archedWindow(local,0,14.1,23.84,3.1,7.8);
  for(const x of [-7.4,7.4])archedWindow(local,x,17,23.85,1.75,5.2);
  for(const x of [-10.4,-5.2,5.2,10.4])local.box(.75,13.8,.28,white,x,17.3,23.95);
  for(const x of [-10.7,0,10.7])statue(local,x,x===0?29.2:26.5,28.4,1.05);
  const g=local.finish();for(const mesh of g.children){mesh.geometry.rotateY(r);b.add(mesh.geometry,mesh.material);}
 }
  // Retain surveyed lower roof/pediment geometry. Smooth dome profiles below are
  // reconstructions fitted to the municipal envelope, not the original vertices.
 const upperWhite=[],upperCopper=[];
 for(let i=part.start;i<part.start+part.count;i+=3){const source=[0,1,2].map(j=>Array.from(array.slice((i+j)*5,(i+j)*5+3)));
  const local=source.map(p=>{const x=p[0]-c.x,z=p[2]-c.z;return [x*Math.cos(c.angle)-z*Math.sin(c.angle),x*Math.sin(c.angle)+z*Math.cos(c.angle)];});
  const corner=local.every(([x,z])=>Math.abs(Math.abs(x)-13.4)<6.4&&Math.abs(Math.abs(z)-13.4)<6.4);
  for(const v of clipTriangleHeight(source,24.9,corner?33.72:40.05)){
  const a=new THREE.Vector3(...v[0]),n=new THREE.Vector3(...v[1]).sub(a).cross(new THREE.Vector3(...v[2]).sub(a)).normalize(),y=v.reduce((s,p)=>s+p[1],0)/3;
  const metallic=Math.abs(n.y)>.17||y>55;
  for(const p of v){const x=p[0]-c.x,z=p[2]-c.z; (metallic?upperCopper:upperWhite).push(x*Math.cos(c.angle)-z*Math.sin(c.angle),p[1],x*Math.sin(c.angle)+z*Math.cos(c.angle));}
  }
 }
 for(const [values,mat] of [[upperWhite,white],[upperCopper,copper]])if(values.length){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(values,3));g.computeVertexNormals();b.add(g,mat);}
 function dome(x,z,r,base,height){
  const profile=[];for(let i=0;i<=24;i++){const a=i*Math.PI/48;profile.push(new THREE.Vector2(Math.max(.001,r*Math.cos(a)),height*Math.sin(a)));}
  b.add(new THREE.LatheGeometry(profile,64),copper,x,base,z);
  for(let j=0;j<12;j++){const angle=j*Math.PI/6,points=[];for(let i=0;i<=16;i++){const a=i*Math.PI/32;points.push(new THREE.Vector3(x+(r+.035)*Math.cos(a)*Math.sin(angle),base+height*Math.sin(a),z+(r+.035)*Math.cos(a)*Math.cos(angle)));}b.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),24,.04,5,false),copper);}
  b.cylinder(r+.18,r+.18,.26,white,x,base-.12,z,64);
 }
 b.cylinder(8.04,8.04,14.3,white,0,47.15,0,64);dome(0,0,8.04,54.3,8.1);
 for(const x of [-13.4,13.4])for(const z of [-13.4,13.4]){b.cylinder(2.62,2.62,6.4,white,x,36.9,z,32);dome(x,z,2.8,40.1,3.0);for(let side=0;side<4;side++){const a=side*Math.PI/2;archedWindow(b,x+Math.sin(a)*2.67,36.7,z+Math.cos(a)*2.67,1.2,3.7,a);}}
 // Drum pilasters and tall arched openings stand proud of the measured upper shell.
 for(let i=0;i<12;i++){const a=i*Math.PI/6,r=8.15,x=Math.sin(a)*r,z=Math.cos(a)*r;archedWindow(b,x,47.6,z,1.55,6.6,a);b.box(.48,10,.28,white,Math.sin(a+.16)*r,47.6,Math.cos(a+.16)*r,a+.16);}
 b.cylinder(.12,.15,2.4,gold,0,63.15,0,8);b.box(1.45,.14,.14,gold,0,63.55,0);
 const group=b.finish();group.position.set(c.x,0,c.z);group.rotation.y=c.angle;group.name='Helsinki Cathedral — architectural reconstruction';
 group.userData={columns:24,mainStairSteps:c.steps,sourceRatu:211,accuracy:'Measured roof and alignment; reconstructed architectural details'};
 return group;
}
export function createSenateSquare(pavements=[]){
 const b=builder(),c=CATHEDRAL;
 const site=addCathedralSite(b,c,stone);
 const terrace=b.finish();terrace.rotation.y=c.angle;
 const monument=builder(),mx=3.0,mz=67.4;
 monument.cylinder(7.4,7.4,.08,stone,mx,.10,mz,64);
 for(let i=0;i<3;i++)monument.box(8-i*1.1,.32,8-i*1.1,stone,mx,.16+i*.32,mz);
 const red=new THREE.MeshStandardMaterial({color:'#977d70',roughness:.83});monument.box(2.8,4.6,2.8,red,mx,3.26,mz);monument.box(3.4,.36,3.4,red,mx,5.74,mz);statue(monument,mx,5.92,mz,1.5);
 for(const [dx,dz] of [[3,0],[-3,0],[0,3],[0,-3]])statue(monument,mx+dx,1,mz+dz,.85);
 const iron=new THREE.MeshStandardMaterial({color:'#384541',roughness:.7,metalness:.5});
 // Low octagonal monument enclosure, a photo-guided approximation.
 for(let i=0;i<8;i++){const a=(i+.5)*Math.PI/4,aa=(i+1.5)*Math.PI/4,p=new THREE.Vector3(mx+Math.sin(a)*6.1,0,mz+Math.cos(a)*6.1),q=new THREE.Vector3(mx+Math.sin(aa)*6.1,0,mz+Math.cos(aa)*6.1),length=p.distanceTo(q),angle=Math.atan2(q.x-p.x,q.z-p.z);
  for(const y of [.38,1.03])monument.box(.055,.065,length,iron,(p.x+q.x)/2,y,(p.z+q.z)/2,angle);
  for(let j=0;j<9;j++){const t=j/9;monument.cylinder(.027,.027,1.1,iron,p.x+(q.x-p.x)*t,.59,p.z+(q.z-p.z)*t,5);}
 }
 const group=new THREE.Group();group.add(terrace,monument.finish());group.name='Senate Square — mapped paving, stairs, terrace and monument';
 // Preserve every mapped section and hole, rather than inventing a plaza grid.
 const batches=new Map();let mappedSections=0;
 for(const p of pavements){if(p.name!=='Senaatintori'||p.kind!=='Aukiot')continue;
  const shape=new THREE.Shape(p.rings[0].map(([x,z])=>new THREE.Vector2(x,-z)));
  for(const ring of p.rings.slice(1))shape.holes.push(new THREE.Path(ring.map(([x,z])=>new THREE.Vector2(x,-z))));
  const g=new THREE.ShapeGeometry(shape).toNonIndexed();g.rotateX(-Math.PI/2);g.translate(0,.082,0);stoneUV(g,2.4);
  const key=p.material||'stone';if(!batches.has(key))batches.set(key,[]);batches.get(key).push(g);mappedSections++;
 }
 for(const [kind,geometries] of batches){const mat=stone.clone();mat.onBeforeCompile=stone.onBeforeCompile;mat.customProgramCacheKey=stone.customProgramCacheKey;mat.color.set(/Noppa/.test(kind)?'#a9a49a':/Nupu/.test(kind)?'#b7b2a8':'#c5c1b7');const mesh=new THREE.Mesh(mergeGeometries(geometries),mat);mesh.receiveShadow=true;group.add(mesh);geometries.forEach(g=>g.dispose());}
 group.userData.mappedPavingSections=mappedSections;
 group.userData.siteLayout=site;
 // In this flat-terrain driving prototype, cars/pedestrians cannot enter raised
 // architecture until elevation-aware navigation is available.
 function obstacle(x0,z0,x1,z1){const co=Math.cos(c.angle),s=Math.sin(c.angle),ring=[[x0,z0],[x1,z0],[x1,z1],[x0,z1]].map(([x,z])=>[x*co+z*s,-x*s+z*co]);return {rings:[ring],name:'Raised cathedral architecture'};}
 return {group,obstacles:[obstacle(-64,-73,34,8),obstacle(-68.3,-45,-64,-15),obstacle(-31,5,33.2,25),obstacle(-54.2,5,-32,24.5),obstacle(34,5,56.2,24.5),{rings:[Array.from({length:8},(_,i)=>{const a=(i+.5)*Math.PI/4;return [mx+Math.sin(a)*6.1,mz+Math.cos(a)*6.1];})],name:'Alexander II monument enclosure'}]};
}
