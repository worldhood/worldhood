import * as THREE from 'three';
import {architectureBuilder,architectureColumn,architectureArch} from './cathedral.js';

// Only the photographed Senate Square frontage is reconstructed here. The
// remainder retains the municipal shell and atlas. RATU 5 alignment; 25-bay,
// three-storey composition interpreted from Josefiina Alanen's 2021 photograph.
export function isGovernmentFront(face){return face.normal.x<-.95&&face.d>-88&&face.d<-76;}
export function createGovernmentFront(){
 const b=architectureBuilder(),yellow=new THREE.MeshStandardMaterial({color:'#d2ba80',roughness:.88}),trim=new THREE.MeshStandardMaterial({color:'#e5dfca',roughness:.78}),dark=new THREE.MeshStandardMaterial({color:'#304349',roughness:.28,metalness:.25}),granite=new THREE.MeshStandardMaterial({color:'#939087',roughness:.95});
 const width=83.84,base=1.6,eave=20.7;
 b.box(width,eave,.35,yellow,0,eave/2,-.18);b.box(width,base,.55,granite,0,base/2,-.03);
 for(const [y,h,d] of [[1.7,.22,.5],[7.7,.3,.6],[8.1,.16,.8],[14.05,.12,.32],[19.1,.25,.5],[20.2,.3,.68],[20.65,.22,.92]])b.box(width+.2,h,d,trim,0,y,.08);
 for(let row=0;row<9;row++)b.box(width,.025,.06,granite,0,base+.4+row*.63,.035);
 function window(x,y,w,h){b.box(w,h,.10,dark,x,y,.10);for(const dx of [-w/2-.10,w/2+.10])b.box(.15,h+.24,.22,trim,x+dx,y,.18);for(const yy of [y-h/2-.11,y+h/2+.11])b.box(w+.34,.16,.25,trim,x,yy,.2);b.box(.055,h,.09,trim,x,y,.20);b.box(w,.06,.10,trim,x,y+.24,.2);b.box(w+.6,.18,.42,trim,x,y-h/2-.22,.25);}
 for(let i=0;i<25;i++){
  const x=-width/2+1.75+i*(width-3.5)/24;
  architectureArch(b,x,4.9,.065,1.75,3.8);
  window(x,11.1,1.85,3.55);window(x,16.7,1.65,2.6);
  b.box(2.35,.13,.40,trim,x,13.25,.28);
  if(i<3||i>21)for(const side of [-1,1])b.box(.36,11.0,.3,trim,x+side*1.48,13.7,.17);
 }
 // Central Corinthian order and triangular pediment are actual protruding mesh.
 b.box(20.9,.45,3.6,trim,0,7.83,1.55);
 for(let i=0;i<6;i++)architectureColumn(b,-8.4+i*3.36,2.9,8.05,11.0,.48);
 b.box(21.3,.65,3.8,trim,0,19.65,1.6);b.box(21.8,.28,4.15,trim,0,20.18,1.62);
 const shape=new THREE.Shape();shape.moveTo(-10.8,0);shape.lineTo(10.8,0);shape.lineTo(0,2.75);shape.closePath();b.add(new THREE.ExtrudeGeometry(shape,{depth:.24,bevelEnabled:false}),yellow,0,20.38,3.4);
 for(const sign of [-1,1]){const a=new THREE.Vector3(sign*10.95,20.40,3.65),c=new THREE.Vector3(0,23.15,3.65),g=new THREE.CylinderGeometry(.115,.115,a.distanceTo(c),6);g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),c.clone().sub(a).normalize()));g.translate(...a.add(c).multiplyScalar(.5).toArray());b.add(g,trim);}
 // Clock dial is geometry; the hands are a visual detail, not the current time.
 const clock=new THREE.CylinderGeometry(.58,.58,.08,32);clock.rotateX(Math.PI/2);b.add(clock,dark,0,21.45,3.69);b.box(.045,.65,.04,trim,0,21.62,3.76);b.box(.46,.045,.04,trim,.20,21.45,3.76);
 for(let i=0;i<Math.floor(width/.5);i++)b.box(.22,.18,.35,trim,-width/2+.25+i*.5,20.37,.39);
 const group=b.finish(),angle=-Math.PI/2+.052,normal=new THREE.Vector3(Math.sin(angle),0,Math.cos(angle)),tangent=new THREE.Vector3(Math.cos(angle),0,-Math.sin(angle));group.position.copy(normal.multiplyScalar(-83.5).add(tangent.multiplyScalar((23.7+107.54)/2)));group.rotation.y=angle;group.updateMatrixWorld(true);
 for(const mesh of group.children)mesh.geometry.applyMatrix4(group.matrixWorld);
 return group.children;
}
