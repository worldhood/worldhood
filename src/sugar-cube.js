import * as THREE from 'three';
import {architectureBuilder} from './cathedral.js';

// RATU 1707: Aalto's former Enso-Gutzeit headquarters. Two principal façades
// matched to the municipal planes. 10 / 17 bays and four upper grid rows are
// interpreted from Aalto Foundation photographs/elevations; dimensions are
// fitted to the source shell, not claimed as a measured architectural survey.
export function isSugarCubeFront(ratu,face){
 if(ratu!==1707)return false;
 return (face.normal.x<-.8&&Math.abs(face.d+402.47)<.2)||
  (face.normal.z>.8&&Math.abs(face.d-22.65)<.2)||
  (face.normal.z>.8&&Math.abs(face.d-20.21)<.2);
}
export function createSugarCubeFront(){
 const b=architectureBuilder();
 const marble=new THREE.MeshStandardMaterial({color:'#e2e0d6',roughness:.7});
 const joint=new THREE.MeshStandardMaterial({color:'#bbbdb7',roughness:.8});
 const teak=new THREE.MeshStandardMaterial({color:'#62503a',roughness:.65});
 const glass=new THREE.MeshStandardMaterial({color:'#354a50',roughness:.24,metalness:.25});
 const stone=new THREE.MeshStandardMaterial({color:'#767974',roughness:.95});
 const curtains=['#778581','#485c5d'].map(color=>new THREE.MeshStandardMaterial({color,roughness:.8}));
 const meshes=[];
 function elevation(width,bays,s,d,angle){
  const f=architectureBuilder(),step=width/bays,base=3.72,pitch=3.9,height=19.32;
  // Glazing is behind deep projecting stone members rather than drawn on them.
  f.box(width,height-.18,.18,glass,0,height/2,.025);
  f.box(width,.58,.42,stone,0,.29,.2);
  for(let i=0;i<=bays;i++){
   const x=-width/2+i*step;
   f.box(.29,height-base+.25,.62,marble,x,(height+base)/2,.30);
   f.box(.09,height-base+.28,.70,joint,x+.12,(height+base)/2,.28);
   if(i%2===0)f.box(.31,base,.52,marble,x,base/2,.26);
  }
  for(let row=0;row<=4;row++){
   const y=base+row*pitch;f.box(width+.18,.32,.7,marble,0,y,.31);
   // Sloping stone sill catches a separate highlight/shadow.
   const sill=new THREE.BoxGeometry(width,.12,.67);sill.rotateX(.15);f.add(sill,marble,0,y+.19,.29);
   if(row===4)continue;
   for(let i=0;i<bays;i++){
    const x=-width/2+(i+.5)*step,w=step-.56,h=pitch-.65,cy=y+pitch/2;
    for(const side of [-1,1])f.box(.075,h,.10,teak,x+side*w/2,cy,.16);
    for(const sign of [-1,1])f.box(w,.075,.10,teak,x,cy+sign*h/2,.16);
    // Narrow ventilation pane next to the large fixed pane.
    f.box(.06,h,.11,teak,x-w*.30,cy,.18);
    f.box(w*.18,h*.95,.025,curtains[(i+row)%4===0?0:1],x+w*.31,cy,.12);
   }
  }
  f.box(width,.20,.8,marble,0,base,.34);
  const group=f.finish();group.rotation.y=angle;group.position.set(Math.cos(angle)*s+Math.sin(angle)*d,0,-Math.sin(angle)*s+Math.cos(angle)*d);group.updateMatrixWorld(true);
  for(const m of group.children){m.geometry.applyMatrix4(group.matrixWorld);meshes.push(m);}
 }
 elevation(31.42,10,(-8.78+22.64)/2,-402.47,Math.atan2(-.832,-.555));
 elevation(53,17,(402.47+455.47)/2,22.65,Math.atan2(-.555,.832));
 // Set-back restaurant level above the southern grid, in its measured plane.
 b.box(46.14,3.58,.25,glass,0,21.11,0);
 for(let i=0;i<=26;i++)b.box(.075,3.58,.16,teak,-23.07+i*46.14/26,21.11,.14);
 b.box(46.6,.4,.65,marble,0,22.86,.15);b.box(46.4,.18,.35,marble,0,19.43,.08);
 const group=b.finish(),angle=Math.atan2(-.555,.832),s=(409.33+455.47)/2,d=20.21;
 group.rotation.y=angle;group.position.set(Math.cos(angle)*s+Math.sin(angle)*d,0,-Math.sin(angle)*s+Math.cos(angle)*d);group.updateMatrixWorld(true);
 for(const m of group.children){m.geometry.applyMatrix4(group.matrixWorld);meshes.push(m);}
 return meshes;
}
