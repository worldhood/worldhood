import * as THREE from 'three';
import {architectureBuilder} from './cathedral.js';
import {FontLoader} from 'three/addons/loaders/FontLoader.js';
import {TextGeometry} from 'three/addons/geometries/TextGeometry.js';
import fontData from 'three/examples/fonts/gentilis_regular.typeface.json' with {type:'json'};
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

// Eteläranta 10 / Teollisuuskeskus, RATU 488. This is NOT Presidentinlinna 23.
// Each band is fitted to an actual source plane, retaining roof setbacks and
// the H-shaped shell behind.
export const PALACE_RESTAURANT_RATU=488;
export const PALACE_RESTAURANT_PLANES=[
 {id:'harbour-main',nx:.9982137383569266,nz:-.05974389136547182,d:-21.843981323813047,s0:-577.280145,s1:-495.073355,y0:.12,y1:24.591,tolerance:.07},
 {id:'upper-band',nx:.998210,nz:-.059801,d:-23.916,s0:-575.084,s1:-497.175,y0:24.591,y1:27.661,tolerance:.065},
 {id:'restaurant-south',nx:.9981918958,nz:-.0601077297,d:-26.59949038,s0:-572.463212,s1:-536.709605,y0:27.661,y1:31.361,tolerance:.05},
 {id:'restaurant-north',nx:.9982137067,nz:-.0597444204,d:-26.40414595,s0:-536.719250,s1:-500.235116,y0:27.661,y1:31.361,tolerance:.05},
 {id:'roof-south',nx:.9982341621,nz:-.0594016629,d:-30.94118562,s0:-567.383921,s1:-546.424914,y0:31.361,y1:33.322,tolerance:.055},
 {id:'roof-north',nx:.998234,nz:-.059405,d:-30.887,s0:-536.727298,s1:-506.796782,y0:31.361,y1:34.851,tolerance:.05},
];
export function isPalaceRestaurantFront(ratu,f){
 if(ratu!==PALACE_RESTAURANT_RATU)return false;
 return PALACE_RESTAURANT_PLANES.some(p=>f.normal.x*p.nx+f.normal.z*p.nz>.9999&&Math.abs(f.d-p.d)<p.tolerance&&f.y0>=p.y0-.08&&f.y1<=p.y1+.08&&f.s0>=p.s0-.15&&f.s1<=p.s1+.15);
}
export function createPalaceRestaurantFront(){
 const m={stone:new THREE.MeshStandardMaterial({color:'#d9ddd9',roughness:.8}),
  glass:new THREE.MeshStandardMaterial({color:'#657e86',roughness:.29,metalness:.3}),
  frame:new THREE.MeshStandardMaterial({color:'#657074',roughness:.55,metalness:.45}),
  dark:new THREE.MeshStandardMaterial({color:'#2e4448',roughness:.35,metalness:.22}),
  concrete:new THREE.MeshStandardMaterial({color:'#aeb6b4',roughness:.86}),
  joint:new THREE.MeshStandardMaterial({color:'#adb5b3',roughness:.8}),
  blind:new THREE.MeshStandardMaterial({color:'#a9b8b8',roughness:.75}),
  letters:new THREE.MeshStandardMaterial({color:'#c7ae70',emissive:'#d6ba75',emissiveIntensity:.25,roughness:.38,metalness:.45})};
 const meshes=[];
 function flush(b,p,label){
  const group=b.finish();group.rotation.y=Math.atan2(p.nx,p.nz);group.position.set(p.nx*p.d,0,p.nz*p.d);group.updateMatrixWorld(true);
  for(const mesh of [...group.children]){mesh.geometry.applyMatrix4(group.matrixWorld);group.remove(mesh);mesh.updateMatrixWorld(true);mesh.geometry.computeBoundingBox();mesh.geometry.computeBoundingSphere();mesh.userData.landmark='Palace restaurant / Eteläranta 10';mesh.userData.elevation=label;meshes.push(mesh);}
 }
 function band(b,p,cy,h,bays){
  const width=p.s1-p.s0,step=width/bays;
  b.box(width-.20,h,.10,m.glass,(p.s0+p.s1)/2,cy,.09);
  for(let i=0;i<=bays;i++)b.box(.085,h+.08,.18,m.frame,p.s0+i*step,cy,.18);
  for(const side of [-1,1])b.box(width,.095,.21,m.frame,(p.s0+p.s1)/2,cy+side*h/2,.18);
  // A few lightly closed blinds break uniform reflections, without photos of
  // trees baked into the windows. Their state is artistic, not surveyed.
  for(let i=3;i<bays;i+=13)b.box(step-.10,h*.32,.025,m.blind,p.s0+(i+.5)*step,cy+h*.33,.155);
 }
 const p=PALACE_RESTAURANT_PLANES[0],b=architectureBuilder(),w=p.s1-p.s0,c=(p.s0+p.s1)/2;
 b.box(w,p.y1-7.151,.22,m.stone,c,(p.y1+7.151)/2,-.10);
 const rowPitch=(p.y1-7.151)/6;
 for(let row=0;row<6;row++){
  const cy=7.151+(row+.53)*rowPitch;band(b,p,cy,1.77,58);
  // Precast panel joints in the white horizontal spandrels.
  const y=7.151+(row+1)*rowPitch-.22;
  b.box(w,.025,.03,m.joint,c,y,.04);
  for(let s=p.s0+2.8;s<p.s1;s+=5.6)b.box(.018,.78,.035,m.joint,s,y-.35,.043);
 }
 // Recessed entrance / second-storey gallery rather than a solid blank plinth.
 b.box(w,6.85,.20,m.dark,c,3.6,-3.25);
 for(const y of [.19,3.76,7.04])b.box(w,.23,3.7,m.concrete,c,y,-1.65);
 for(let i=0;i<=14;i++){
  const s=p.s0+i*w/14;b.box(.65,6.91,.65,m.stone,s,3.575,-.24);
  for(const x of [-.19,0,.19])b.box(.018,6.8,.04,m.joint,s+x,3.575,.10);
 }
 for(let s=p.s0+.6;s<p.s1;s+=1.8){
  b.box(.055,3.2,.12,m.frame,s,1.94,-3.05);
  b.box(.05,1.05,.06,m.frame,s,4.45,.04);
 }
 for(const y of [4.02,4.98])b.box(w,.055,.07,m.frame,c,y,.055);
 b.box(w,.18,.44,m.stone,c,7.10,.11);
 flush(b,p,'harbour ribbon / recessed base');
 for(const upper of PALACE_RESTAURANT_PLANES.slice(1)){
  const wing=architectureBuilder(),width=upper.s1-upper.s0,cy=(upper.y0+upper.y1)/2,h=upper.y1-upper.y0;
  wing.box(width,h,.22,m.stone,(upper.s0+upper.s1)/2,cy,-.1);
  band(wing,upper,cy+.10,Math.max(.9,h-.78),Math.max(8,Math.round(width/1.48)));
  wing.box(width,.18,.36,m.stone,(upper.s0+upper.s1)/2,upper.y1-.09,.08);
  if(upper.id==='upper-band'){
   for(let s=upper.s0;s<upper.s1;s+=1.6)wing.box(.045,.88,.055,m.frame,s,upper.y1+.44,.23);
   wing.box(width,.045,.08,m.frame,(upper.s0+upper.s1)/2,upper.y1+.88,.23);
  }
  flush(wing,upper,upper.id);
 }
 // The south gable really is predominantly blank stone in both reference
 // views. Cover only the verified east wing patch, leaving the courtyard and
 // western wing/source returns untouched; do not invent windows on this wall.
 const south={nx:.0591646269,nz:.9982482391,d:577.280754},gable=architectureBuilder();
 const lo=-36.83,hi=-21.60,width=hi-lo;
 gable.box(width,24.50-7.16,.16,m.stone,(lo+hi)/2,(24.50+7.16)/2,.20);
 for(let y=7.6;y<24.4;y+=1.45){gable.box(width,.025,.03,m.joint,(lo+hi)/2,y,.295);for(let s=lo+((Math.round(y/1.45)%2)?1.9:3.8);s<hi;s+=3.8)gable.box(.022,1.43,.03,m.joint,s,y+.72,.295);}
 flush(gable,south,'south gable panel joints');
 // Warm rooftop serif identity, facing east towards the harbour. Letter
 // spacing/size is a reference-guided approximation, not an exact neon trace.
 const sign=architectureBuilder(),font=new FontLoader().parse(fontData),text=new TextGeometry('PALACE',{font,size:1.85,depth:.10,curveSegments:5,bevelEnabled:false});
 text.computeBoundingBox();const tw=text.boundingBox.max.x-text.boundingBox.min.x;text.scale(14.0/tw,1,1);text.computeBoundingBox();text.translate(-(text.boundingBox.max.x+text.boundingBox.min.x)/2,0,0);
 sign.add(text,m.letters,-561.7,32.1,.22);
 for(const s of [-567.5,-563.7,-559.9,-556.1])sign.box(.065,1.25,.09,m.frame,s,31.78,.16);
 flush(sign,PALACE_RESTAURANT_PLANES[2],'PALACE rooftop letters');
 const batches=new Map();
 for(const mesh of meshes){const mat=mesh.material,key=[mat.color.getHex(),mat.roughness,mat.metalness,mat.emissive.getHex(),mat.emissiveIntensity].join(':');if(!batches.has(key))batches.set(key,[]);batches.get(key).push(mesh);}
 return [...batches.values()].map(batch=>{
  const geometry=mergeGeometries(batch.map(m=>m.geometry)),mesh=new THREE.Mesh(geometry,batch[0].material);
  geometry.computeBoundingBox();geometry.computeBoundingSphere();mesh.castShadow=true;mesh.receiveShadow=true;
  mesh.userData={landmark:'Palace restaurant / Eteläranta 10',elevations:[...new Set(batch.map(m=>m.userData.elevation))]};
  batch.forEach((m,i)=>{m.geometry.dispose();if(i)m.material.dispose();});return mesh;
 });
}
