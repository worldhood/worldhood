import * as THREE from 'three';
import {Kit,footprintFrame} from './place-landmarks.js';
import {marketStallRing} from './oulu-square-data.js';
import {groundAt} from './terrain.js';

// Mapped footprints, photo-interpreted elevations. Summer stalls are a representative
// trading-day layout, not permanent buildings or a reconstruction of a specific event.
export function createOuluSquare(spec){
 const group=new THREE.Group();group.name='Kauppatori square ensemble';const obstacles=[];
 for(const b of spec.buildings){
  const F=footprintFrame(b.ring,b.facing),k=new Kit(),W=F.width,D=F.depth,H=b.eave,roof='#3d423d',frame='#55564b';
  if(b.kind==='warehouse'){
   k.walls(F.local,0,.3,'#76776c');k.walls(F.local,.3,H,b.wall);
   k.gable(D+.3,W+.3,H,b.rise,0,0,true,roof,b.wall);
   if(b.frontWall)k.box(W-.15,H-.35,.05,0,.3,D/2+.03,b.frontWall);
   // Log courses are shaded rather than thousands of separate slats.
   for(const x of [-W/2+.1,W/2-.1])k.box(.15,H,.2,x,0,D/2+.08,frame);
   k.box(W+.35,.12,.3,0,H-.05,D/2+.12,frame);
   for(const sign of [-1,1]){const g=new THREE.BoxGeometry(Math.hypot(W/2,b.rise),.13,.18);g.rotateZ(-sign*Math.atan2(b.rise,W/2));g.translate(sign*W/4,H+b.rise/2,D/2+.13);k.put(k.solid,g,frame);}
   const doorW=Math.min(1.7,W*.3);k.box(doorW+.25,2.35,.15,0,.3,D/2+.08,frame);k.pane(doorW,2.1,.07,0,.42,D/2+.18,b.door);
   if(b.door==='#28679c'){
    for(const x of [-doorW/2,0,doorW/2])k.box(.07,2.1,.12,x,.42,D/2+.26,b.door);
    for(const y of [.45,1.1,1.8,2.45])k.box(doorW,.07,.12,0,y,D/2+.26,b.door);
   }
   // One shuttered loading opening above the entrance, as in the reference fronts.
   const upperY=Math.max(2.9,H-2.1),shutterX=b.shutterState==='open'?-1.7:0;k.box(1.8,1.75,.14,0,upperY,D/2+.08,frame);
   if(b.shutterState==='open'){k.pane(1.5,1.5,.1,0,upperY+.12,D/2+.17,'#586e68');k.box(.06,1.5,.08,0,upperY+.12,D/2+.25,'#a9a28b');}
   k.box(1.5,1.5,.1,shutterX,upperY+.12,D/2+.18,b.door==='#28679c'?'#373a33':b.door);
   for(let x=-.7;x<.8;x+=.16)k.box(.018,1.5,.04,x+shutterX,upperY+.12,D/2+.24,'#797465');
   for(const y of [upperY+.35,upperY+1.35])k.box(1.5,.05,.06,shutterX,y,D/2+.27,'#3b3d35');
   if(b.name==='Suola-Aitta'||b.name==='Tervasoihtu')for(let i=0;i<3;i++)k.box(2.5,.16,.5,0,.1+i*.16,D/2+.9-i*.25,'#a58b61');
  }else if(b.kind==='boat'){
   k.walls(F.local,-.4,.5,'#343c39');k.walls(F.local,.5,1.5,b.wall);
   k.box(W*.8,.15,D*.9,0,1.5,0,'#c7c8b9');
   k.box(W*.75,1.4,D*.4,0,1.6,D*.1,b.wall);
   k.box(W*.72,.65,.08,0,2.25,D*.3+.05,'#b66655');
   for(let i=0;i<4;i++)k.pane(W*.15,.5,.1,(i-1.5)*W*.175,2.32,D*.3+.12,'#687e7d');
   k.box(W*.84,.16,D*.45,0,3,D*.1,'#e0dfd0');
   for(const side of [-1,1]){for(let z=-D*.4;z<D*.45;z+=1.5)k.cyl(.025,.025,.8,side*W*.43,1.55,z,'#b16a58');k.box(.04,.045,D*.9,side*W*.43,2.32,0,'#b16a58');}
   k.cyl(.05,.05,2.5,0,3,D*.05,'#c0c4b8');
  }else{
   k.walls(F.local,0,H,b.wall);k.box(W+.3,.18,D+.3,0,H,0,'#d6d5c5');
   k.box(W*.82,1.2,.08,0,1.15,D/2+.04,'#343a33');
   k.box(W*.88,.09,.65,0,1.05,D/2+.25,'#a5a495');
   k.box(W*.85,.45,.07,0,H-.55,D/2+.07,'#41473d');
  }
  const node=k.build(F.matrix,b.name);node.userData.building=b.building;node.userData.estimatedHeight=H+b.rise;
  // Keep the entrance at the adjacent pavement instead of burying it at the lowest
  // sample under a long waterfront warehouse. Heights themselves remain photo estimates.
  if(b.kind!=='boat'){node.userData.fixedElevation=true;node.position.y=groundAt(F.origin[0]+F.normal[0]*D/2,F.origin[1]+F.normal[1]*D/2);}
  if(['Suola-Aitta','Tervasoihtu'].includes(b.name))obstacles.push({id:`${b.building}-steps`,name:'Warehouse entrance steps',rings:[frameRing(F,0,D/2+.65,2.6,1.3)],height:.6});
  if(b.kind==='kiosk')obstacles.push({id:`${b.building}-counter`,name:'Kiosk counter',rings:[frameRing(F,0,D/2+.25,W*.88,.65)],height:1.15});
  if(b.kind==='warehouse')for(const mesh of node.children){if(mesh.material.metalness>.1)continue;mesh.material=mesh.material.clone();mesh.material.onBeforeCompile=shader=>{
   shader.vertexShader='varying vec3 timberP;varying vec3 timberN;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\ntimberP=position;timberN=normal;');
   shader.fragmentShader='varying vec3 timberP;varying vec3 timberN;\n'+shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
    if(abs(timberN.y)<.15 && timberP.y>.3 && timberP.y<${H.toFixed(3)}){
     float joint=(1.-smoothstep(.018,.035,min(fract(timberP.y/.23),1.-fract(timberP.y/.23))))*(1.-smoothstep(.04,.12,fwidth(timberP.y)));
     float grain=sin(timberP.y*4.3+sin((timberP.x+timberP.z)*1.8)*2.);
     diffuseColor.rgb*=1.-joint*.26+grain*.035;
    }`);
  };mesh.material.customProgramCacheKey=()=>`oulu-log-courses-${H}`;}
  if(b.label)node.add(textLabel(b.label,F,Math.min(W-.6,5),b.name==='Tervasoihtu'?H+.05:b.kind==='warehouse'?Math.max(2.7,H-2.4):H-.5,D/2+.3));
  group.add(node);
 }
 if(spec.season==='summer')for(const [i,s] of spec.stalls.entries()){
  const k=new Kit(),W=4.4,D=3.2,H=2.25;
  for(const x of [-W/2,W/2])for(const z of [-D/2,D/2])k.cyl(.025,.025,H,x,0,z,'#b6b9ab');
  // Four-sided fabric canopy, shallow peak and short valance.
  const roof=new THREE.ConeGeometry(1,1,4);roof.rotateY(Math.PI/4);roof.scale(W/Math.SQRT2,.8,D/Math.SQRT2);roof.translate(0,H+.4,0);k.put(k.solid,roof,s.colour);
  for(const z of [-D/2,D/2])k.box(W,.18,.05,0,H-.08,z,s.colour);
  if(s.striped)for(let x=-2;x<2;x+=.4)k.box(.17,.18,.06,x,H-.08,D/2+.04,'#e0dfd3');
  for(const x of [-1.45,0,1.45]){
   k.box(1.35,.08,.75,x,.87,.6,'#9c8c6e');for(const dx of [-.55,.55])k.box(.045,.87,.5,x+dx,0,.6,'#6b6f62');
   k.box(1.35,.65,.04,x,.2,1,s.type==='produce'?'#b97164':'#787e83');
   if(s.type==='produce')for(let j=0;j<6;j++){const fruit=new THREE.IcosahedronGeometry(.12,1);fruit.scale(1,.8,1);fruit.translate(x+(j%3-1)*.32,.99,.4+Math.floor(j/3)*.3);k.put(k.solid,fruit,['#bca759','#78904e','#a4674b'][(i+j)%3]);}
   else for(let j=0;j<3;j++)k.box(.28,.32,.035,x+(j-1)*.35,1.2,-.6,['#c5b65c','#7d8d9a','#b96657'][j]);
  }
  const matrix=new THREE.Matrix4().makeRotationY(s.yaw);matrix.setPosition(s.x,0,s.z);const node=k.build(matrix,`Summer market stall ${i+1}`);node.userData.rigid=true;group.add(node);
  const ring=marketStallRing(s);
  obstacles.push({id:`oulu-market-stall-${i}`,name:'Market stall',rings:[ring],height:3.05});
 }
 group.userData.source=spec.source;return {group,obstacles};
}
function frameRing(F,x,z,w,d){return [[x-w/2,z-d/2],[x+w/2,z-d/2],[x+w/2,z+d/2],[x-w/2,z+d/2],[x-w/2,z-d/2]].map(([u,v])=>[F.origin[0]+F.axis[0]*u+F.normal[0]*v,F.origin[1]+F.axis[1]*u+F.normal[1]*v]);}
function textLabel(text,F,w,y,z){
 const group=new THREE.Group();if(typeof document==='undefined')return group;
 const c=document.createElement('canvas');c.width=512;c.height=64;const g=c.getContext('2d');g.fillStyle='#ded8ba';g.fillRect(0,0,512,64);g.fillStyle='#363b32';g.font='bold 32px sans-serif';g.textAlign='center';g.fillText(text,256,44,490);
 const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;const m=new THREE.Mesh(new THREE.PlaneGeometry(w,.38),new THREE.MeshStandardMaterial({map:t,roughness:.85}));m.position.set(0,y,z);m.updateMatrix();m.applyMatrix4(F.matrix);group.add(m);return group;
}
