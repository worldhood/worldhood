import * as THREE from 'three';
import {architectureBuilder} from './cathedral.js';
import {FontLoader} from 'three/addons/loaders/FontLoader.js';
import {TextGeometry} from 'three/addons/geometries/TextGeometry.js';
import fontData from 'three/examples/fonts/optimer_regular.typeface.json' with {type:'json'};
export {THREE};

// RATU 405: official Vaakuna gallery exterior.
// Municipal wall triangles define the footprint and terrace silhouette. Bay
// spacing/material swatches are photo-guided estimates, not surveyed LOD3.
const fronts=[
 [.991629574,-.129115405,-713.094744],
 [.591298685,.806452643,-446.199269],
 [-.801466095,.598040214,601.738542],
 [-.802390703,.596799095,600.889670],
 [.991628833,-.129121099,-717.306712],
 [.991628321,-.129125026,-720.641813],
 [.608193616,.793788716,-461.946951],
 [.626140213,.779710481,-478.341354],
 [-.806403917,.591365116,597.306686],
];
export function isSokosFront(ratu,f){
 return ratu===405&&fronts.some(([nx,nz,d])=>f.normal.x*nx+f.normal.z*nz>.99999&&Math.abs(f.d-d)<.12);
}
export function sokosFaceContains(f,s,y){
 return f.triangles.some(({local:[a,b,c]})=>{
  const den=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1]);
  if(Math.abs(den)<1e-8)return false;
  const p=((b[1]-c[1])*(s-c[0])+(c[0]-b[0])*(y-c[1]))/den;
  const q=((c[1]-a[1])*(s-c[0])+(a[0]-c[0])*(y-c[1]))/den;
  return p>=-1e-6&&q>=-1e-6&&p+q<=1+1e-6;
 });
}
const font=new FontLoader().parse(fontData);
export function createSokosFace(f){
 const b=architectureBuilder(),rectangles=[];
 const stone=new THREE.MeshStandardMaterial({color:'#aaa89b',roughness:.87});
 const glass=new THREE.MeshStandardMaterial({color:'#637681',roughness:.3,metalness:.15});
 const frame=new THREE.MeshStandardMaterial({color:'#bcb9a7',roughness:.65,metalness:.2});
 const bronze=new THREE.MeshStandardMaterial({color:'#443f34',roughness:.48,metalness:.4});
 const blue=new THREE.MeshStandardMaterial({color:'#315b87',roughness:.74});
 const white=new THREE.MeshStandardMaterial({color:'#e2e0d3',roughness:.6});
 const mats=[stone,glass,frame,bronze,blue,white];
 // An exact triangle backing retains stepped terraces and avoids filling holes.
 const positions=f.triangles.flatMap(t=>t.local.flatMap(([s,y])=>[s,y,0]));
 const backing=new THREE.BufferGeometry();backing.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));backing.computeVertexNormals();
 b.add(backing,stone);
 function box(s,y,w,h,depth,offset,material){
  if(![0,.25,.5,.75,1].every(u=>[0,.25,.5,.75,1].every(v=>sokosFaceContains(f,s+(u-.5)*w,y+(v-.5)*h))))return false;
  b.box(w,h,depth,material,s,y,offset);rectangles.push({s,y,w,h});return true;
 }
 const width=f.s1-f.s0,columns=Math.max(1,Math.round(width/2.18)),pitch=width/columns;
 // Six rows above the retail glazing; continuous stone spandrels remain visible.
 const rows=[9.25,12.55,15.85,19.15,22.45,25.75,29.05,32.35];
 for(let i=0;i<columns;i++)for(const y0 of rows){
  const s=f.s0+(i+.5)*pitch,w=pitch-.42,h=2.46,y=y0+h/2;
  if(!box(s,y,w+.18,h+.18,.15,.075,frame))continue;
  box(s,y,w,h,.045,.165,glass);
  box(s+w*.27,y,.065,h,.10,.20,bronze);
  box(s,y-h/2-.08,w+.24,.12,.32,.18,stone);
 }
 // Double-height retail frontage and its recognisable blue canopy.
 if(f.y0<1){
  const shops=Math.max(1,Math.round(width/4.5)),step=width/shops;
  for(let i=0;i<shops;i++)for(const [y,h] of [[2.3,3.65],[6.15,2.6]]){
   const s=f.s0+(i+.5)*step;
   box(s,y,step-.24,h,.10,.09,bronze);
   box(s,y,step-.5,h-.22,.05,.17,glass);
   box(s,y,.09,h,.22,.23,frame);
  }
  box((f.s0+f.s1)/2,.37,width,.5,.23,.08,bronze);
  // A shallow tilted canopy is geometry, not a blue stripe painted on the wall.
  const awning=new THREE.BoxGeometry(width,1.05,1.1);awning.rotateX(-.35);
  b.add(awning,blue,(f.s0+f.s1)/2,8.2,.52);
  box((f.s0+f.s1)/2,8.78,width,.12,.3,.65,frame);
 }
 // Individual light-coloured terrace balusters, clipped against the real face.
 if(f.y0>28){
  const y=f.y0+.58;
  for(let s=f.s0+.3;s<f.s1-.25;s+=.67){
   box(s,y,.07,.95,.12,.42,white);
   box(s,y+.47,.67,.09,.16,.42,white);
  }
 }
 // The photographed corner carries SOKOS lettering. Typeface is an approximation.
 if(Math.abs(f.d+446.199269)<.12){
  const text=new TextGeometry('SOKOS',{font,size:2.1,depth:.10,curveSegments:5,bevelEnabled:false});
  text.computeBoundingBox();const tw=text.boundingBox.max.x-text.boundingBox.min.x;
  text.scale(.72,1,1);b.add(text,white,(f.s0+f.s1)/2-tw*.36,9.35,.25);
 }
 const group=b.finish(),angle=Math.atan2(f.normal.x,f.normal.z);
 group.rotation.y=angle;group.position.set(f.normal.x*f.d,0,f.normal.z*f.d);group.updateMatrixWorld(true);
 const meshes=[...group.children];
 for(const m of meshes){m.geometry.applyMatrix4(group.matrixWorld);m.geometry.computeBoundingBox();m.geometry.computeBoundingSphere();m.userData.sokos=true;}
 for(const m of mats)m.dispose();
 return {meshes,rectangles};
}
