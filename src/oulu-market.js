import * as THREE from 'three';
import {Kit,footprintFrame} from './place-landmarks.js';
import {createTorinranta} from './oulu-torinranta.js';
import {createOuluSquare} from './oulu-square.js';

// Original geometry interpreted from owner photographs and Estormiz's CC0 photographs.
// Footprint is OSM; architectural proportions are estimates.
export function createOuluMarket(spec){
 const group=new THREE.Group(),obstacles=[],F=footprintFrame(spec.ring,[.85,.53]);
 const k=new Kit(),brick='#9b6658',trim='#d4c9ac',green='#59796b',roof='#38413e';
 const W=F.width,v=6.335,front=15.52,back=-2.85,eave=5.6;
 k.walls(F.local,0,eave,brick);
 for(const side of [-1,1]){const run=(front-back)/2-1.6,rise=1.55,g=new THREE.BoxGeometry(W+.2,.12,Math.hypot(run,rise));g.rotateX(side*Math.atan2(rise,run));g.translate(0,eave+rise/2,v+side*(1.6+run/2));k.put(k.solid,g,roof);}
 k.box(W,1.4,3.2,0,7.1,v,green);k.gable(W+.3,3.6,8.5,.8,0,v,false,roof,green);
 for(let i=0;i<14;i++){
  const x=-W/2+(i+.5)*W/14;
  k.box(2.55,1.15,.1,x,.45,front+.08,trim);
  // Pointed arch, not a semicircular placeholder window.
  const s=new THREE.Shape();s.moveTo(-.9,0);s.lineTo(.9,0);s.lineTo(.9,2.15);s.quadraticCurveTo(.6,2.85,0,3.15);s.quadraticCurveTo(-.6,2.85,-.9,2.15);s.closePath();
  const g=new THREE.ExtrudeGeometry(s,{depth:.09,bevelEnabled:false,curveSegments:5});g.translate(x,1.8,front+.11);k.put(k.solid,g,green);
  // Recessed dark glazing within the pointed green frames (CC0 2025-08-05 detail).
  const pane=g.clone();pane.scale(.82,.91,1);pane.translate(x*.18,.18, .1);k.put(k.glass,pane,'#4e6054');
  for(const dx of [-.56,0,.56])k.box(.07,2.5,.12,x+dx,1.8,front+.22,trim);
  k.box(1.65,.07,.12,x,3.05,front+.22,trim);
  const a=x-W/28;k.box(.36,6,.4,a,0,front+.12,brick);k.box(.64,.22,.6,a,5.8,front+.12,trim);
  k.cyl(.18,.18,.3,a,6.02,front+.12,trim);
  const relief=new THREE.CylinderGeometry(.2,.2,.04,12);relief.rotateX(Math.PI/2);relief.translate(a,4.9,front+.35);k.put(k.solid,relief,trim);
  for(let petal=0;petal<6;petal++){const angle=petal*Math.PI/3,g=new THREE.SphereGeometry(1,6,4);g.scale(.055,.11,.025);g.rotateZ(angle);g.translate(a+Math.sin(angle)*.11,4.9+Math.cos(angle)*.11,front+.39);k.put(k.solid,g,'#e2d9bf');}
  k.box(.08,.65,.08,a,2.8,front+.65,'#292d2c');k.box(.08,.08,.6,a,3.4,front+.4,'#292d2c');
  const globe=new THREE.SphereGeometry(.18,8,6);globe.translate(a,3.2,front+.7);k.put(k.solid,globe,'#eee4cb');
  for(const side of [-1,1]){
   k.pane(2.6,1.05,.05,x,7.25,v+side*1.63,'#738b87');
   for(const angle of [-.58,.58])for(const dx of [-.63,.63]){const bar=new THREE.BoxGeometry(1.45,.055,.09);bar.rotateZ(angle);bar.translate(x+dx,7.8,v+side*1.69);k.put(k.solid,bar,trim);}
  }
 }
 // Entrance gable at the north end. Its facade uses the same independent footprint frame.
 const end=new Kit();end.box(front-back,6,.3,0,0,0,brick);end.gable(.35,front-back,6,4.3,0,0,true,brick,brick);
 pointed(end,7.1,7.7,0,.35,.19,trim);pointed(end,6.5,7.25,0,.35,.23,green);
 for(let i=-3;i<=3;i++)end.box(.09,6.2,.1,i*.75,.4,.36,trim);
 for(const y of [2,3.6,5.2])end.box(5.9,.1,.12,0,y,.38,trim);
 end.box(2.6,2.4,.18,0,0,.45,'#31463d');
 for(const x of [-8,8]){end.box(.75,9,.8,x,0,0,brick);end.box(1.1,.3,1.1,x,8.9,0,trim);}
 pointed(end,2.5,1.6,0,8,.22,trim);pointed(end,2.2,1.4,0,8,.27,green);
 for(const side of [-1,1]){const g=new THREE.BoxGeometry(10,.15,.3);g.rotateZ(-side*.43);g.translate(side*4.5,8.15,.2);end.put(end.solid,g,trim);}
 const E=new THREE.Matrix4().makeRotationY(Math.PI/2);E.setPosition(W/2,0,v);E.premultiply(F.matrix);
 const hall=k.build(F.matrix,'Kauppahalli'),entrance=end.build(E,'Market hall entrance');
 if(typeof document!=='undefined'){
  const canvas=document.createElement('canvas');canvas.width=768;canvas.height=96;const c=canvas.getContext('2d');c.fillStyle='#29352e';c.fillRect(0,0,768,96);c.fillStyle='#d3c9ae';c.font='bold 60px sans-serif';c.textAlign='center';c.fillText('KAUPPAHALLI',384,70);
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;const label=new THREE.Mesh(new THREE.PlaneGeometry(6.2,.5),new THREE.MeshStandardMaterial({map:texture,roughness:.8}));label.position.set(0,7.7,.4);label.updateMatrix();label.applyMatrix4(E);entrance.add(label);
 }
 hall.add(entrance);hall.userData.building=spec.building;group.add(hall);
 for(const node of [hall,entrance])for(const mesh of node.children.filter(o=>o.isMesh)){
  if(!mesh.material.vertexColors||mesh.material.transparent)continue;
  mesh.material=mesh.material.clone();mesh.material.onBeforeCompile=sh=>{
   sh.uniforms.marketInverse={value:F.matrix.clone().invert()};
   sh.vertexShader='uniform mat4 marketInverse;varying vec3 marketP;varying vec3 marketN;\n'+sh.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nmarketP=(marketInverse*vec4(position,1.0)).xyz;marketN=mat3(marketInverse)*normal;');
   sh.fragmentShader='varying vec3 marketP;varying vec3 marketN;\n'+sh.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
    if(diffuseColor.r>diffuseColor.g*1.8 && diffuseColor.g>diffuseColor.b*1.1){
     float row=floor(marketP.y/.075);vec2 bp=vec2(abs(marketN.z)>.6?marketP.x:marketP.z,marketP.y);
     vec2 cell=fract(vec2(bp.x/.25+mod(row,2.)*.5,bp.y/.075));
     vec2 edge=min(cell,1.-cell)*vec2(.25,.075);float gap=1.-smoothstep(.002,.006,min(edge.x,edge.y));
     float noise=fract(sin(dot(floor(vec2(bp.x/.25+mod(row,2.)*.5,row)),vec2(17.13,61.7)))*137.9);
     diffuseColor.rgb=mix(diffuseColor.rgb*(.86+noise*.25),vec3(.30,.27,.23),gap*.6);
    }`);
  };mesh.material.customProgramCacheKey=()=>'oulu-original-brick';
 }
 // Thin standing seams and ridge rail, rather than a flat generic roof.
 const r=new Kit();for(let x=-W/2;x<W/2;x+=1.1)for(const side of [-1,1]){
  const g=new THREE.BoxGeometry(.035,.035,7.6);g.rotateX(side*.2);g.translate(x,6.42,v+side*5.39);r.put(r.solid,g,roof);
 }
 for(let x=-W/2;x<W/2;x+=.75)r.box(.025,.4,.025,x,9.3,v,'#272d2c');r.box(W,.035,.035,0,9.65,v,'#272d2c');
 for(let x=-W/2;x<W/2;x+=1.5){const g=new THREE.TorusGeometry(.18,.016,4,10,Math.PI);g.translate(x,9.65,v);r.put(r.solid,g,'#272d2c');}
 hall.add(r.build(F.matrix,'Standing seams and ridge railing'));
 const vents=new Kit();for(const u of [-15,-5,5,15]){vents.cyl(.18,.14,.65,u,7.15,v+2.2,trim);vents.cyl(.23,.23,.1,u,7.8,v+2.2,trim);}hall.add(vents.build(F.matrix,'Roof vents'));
 // Toripolliisi reconstruction omitted pending permission for the underlying artwork.
 if(spec.quay){const quay=createTorinranta(spec.quay);group.add(quay.group);obstacles.push(...quay.obstacles);}
 if(spec.square){const square=createOuluSquare(spec.square);group.add(square.group);obstacles.push(...square.obstacles);}
 // Bicycle hoops on the hall pavement; positions are photo estimates, not surveyed points.
 const furniture=new Kit();for(let i=0;i<10;i++){
  const x=-W/2+3+i*2.4,z=front+1.7;
  for(const dx of [-.35,.35])furniture.cyl(.025,.025,.8,x+dx,0,z,'#303534');furniture.box(.7,.05,.05,x,.78,z,'#303534');
  const wx=F.origin[0]+F.axis[0]*x+F.normal[0]*z,wz=F.origin[1]+F.axis[1]*x+F.normal[1]*z;
  obstacles.push({name:'Bicycle rack',rings:[frameRectangle(F,x,z,.8,.12)]});
 }
 hall.add(furniture.build(F.matrix,'Bicycle racks'));
 const terrace=new Kit();for(let i=0;i<4;i++){
  const u=W/2+1+i*2,z=front-.4;
  for(const x of [u-1,u+1])terrace.cyl(.035,.035,.95,x,0,z,'#303735');
  terrace.box(2,.055,.055,u,.92,z,'#303735');
  for(const angle of [-.4,.4]){const g=new THREE.BoxGeometry(2.12,.04,.04);g.rotateZ(angle);g.translate(u,.48,z);terrace.put(terrace.solid,g,'#303735');}
  obstacles.push({name:'Cafe railing',rings:[frameRectangle(F,u,z,2.1,.12)]});
 }
 const rail=terrace.build(F.matrix,'Cafe terrace cross rails');rail.userData.rigid=true;group.add(rail);
 const bin=new Kit();bin.cyl(.25,.25,.95,W/2-2,0,front+4,'#777c79');bin.cyl(.26,.26,.05,W/2-2,.95,front+4,'#343a37');
 const trash=bin.build(F.matrix,'Street litter bin');trash.userData.rigid=true;group.add(trash);
 const bx=F.origin[0]+F.axis[0]*(W/2-2)+F.normal[0]*(front+4),bz=F.origin[1]+F.axis[1]*(W/2-2)+F.normal[1]*(front+4);obstacles.push({name:'Litter bin',rings:[rectangle(bx,bz,.52,.52)]});
 for(const t of spec.trees||[]){
  const at=t.p||[F.origin[0]+F.axis[0]*t.u+F.normal[0]*t.v,F.origin[1]+F.axis[1]*t.u+F.normal[1]*t.v];
  const tree=new Kit();tree.cyl(.12,.055,t.height,0,0,0,'#777161');
  for(let i=0;i<10;i++){const a=i*2.4,y=2.3+i*.36,g=new THREE.CylinderGeometry(.012,.045,2,6);g.rotateZ(.7);g.rotateY(a);g.translate(Math.cos(a)*.6,y,Math.sin(a)*.6);tree.put(tree.solid,g,'#777161');
   if(!t.bare){const leaf=new THREE.IcosahedronGeometry(.75,1);leaf.scale(.8,1.1,.8);leaf.translate(Math.cos(a)*.6,y+.65,Math.sin(a)*.6);tree.put(tree.solid,leaf,['#6c8649','#79964f','#5f7c3e'][i%3]);}
  }
  tree.box(1.3,.035,1.3,0,0,0,'#383c38');
  const node=tree.build(new THREE.Matrix4(),'Photo-guided street tree');node.position.set(at[0],0,at[1]);node.userData.rigid=true;group.add(node);obstacles.push({name:'Street tree',rings:[rectangle(...at,.3,.3)]});
 }
 for(const s of spec.signs||[]){
  const sign=new Kit();sign.cyl(.025,.025,2.9,0,0,0,'#939997');
  if(s.kind==='no-parking'){
   const disc=(radius,z,hex)=>{const g=new THREE.CylinderGeometry(radius,radius,.025,24);g.rotateX(Math.PI/2);g.translate(0,2.6,z);sign.put(sign.solid,g,hex);};
   disc(.34,0,'#df4732');disc(.28,.025,'#0955ac');const slash=new THREE.BoxGeometry(.07,.58,.03);slash.rotateZ(.7);slash.translate(0,2.6,.05);sign.put(sign.solid,slash,'#df4732');
  }else{sign.box(.55,.55,.04,0,2.35,0,'#0955ac');sign.box(.06,.38,.045,-.08,2.43,.03,'#f5f5ef');sign.box(.25,.06,.045,0,2.75,.03,'#f5f5ef');sign.box(.06,.17,.045,.12,2.6,.03,'#f5f5ef');sign.box(.25,.06,.045,0,2.6,.03,'#f5f5ef');}
  const matrix=F.matrix.clone().multiply(new THREE.Matrix4().makeTranslation(s.u,0,s.v));
  const node=sign.build(matrix,'Photo-guided sign');group.add(node);node.userData.rigid=true;
  const x=F.origin[0]+F.axis[0]*s.u+F.normal[0]*s.v,z=F.origin[1]+F.axis[1]*s.u+F.normal[1]*s.v;obstacles.push({name:'Sign post',rings:[rectangle(x,z,.12,.12)]});
 }
 const house=createPinkHouse(spec.houseRing);house.userData.building=spec.houseBuilding;group.add(house);
 group.userData.source=spec.source;return {group,obstacles};
}
function pointed(k,w,h,x,y,z,hex){const s=new THREE.Shape();s.moveTo(-w/2,0);s.lineTo(w/2,0);s.lineTo(w/2,h*.65);s.quadraticCurveTo(w*.35,h*.88,0,h);s.quadraticCurveTo(-w*.35,h*.88,-w/2,h*.65);s.closePath();const g=new THREE.ExtrudeGeometry(s,{depth:.06,bevelEnabled:false,curveSegments:6});g.translate(x,y,z);k.put(k.solid,g,hex);}
function createPinkHouse(ring){
 const F=footprintFrame(ring,[-.85,-.53]),k=new Kit(),pink='#c89192',white='#e5ded0',front=F.depth/2,back=-1.77;
 k.walls(F.local,0,5.2,pink);k.box(F.width,.35,.15,0,0,front,'#929187');k.gable(F.width,front-back,5.2,3.3,0,(front+back)/2,false,'#879191',pink);
 for(let y=.4;y<5.2;y+=.15)k.box(F.width,.018,.04,0,y,front+.02,'#b58283');
 for(let i=0;i<9;i++){
  const x=(i-4)*F.width/9.4;k.box(1.35,2.5,.12,x,1.3,front+.05,white);k.pane(1.1,2.25,.1,x,1.42,front+.13,'#73817e');
  k.box(.055,2.3,.13,x,1.4,front+.19,white);k.box(1.13,.065,.13,x,2.5,front+.19,white);k.box(1.6,.13,.28,x,3.84,front+.08,white);k.gable(.2,1.65,3.95,.42,x,front+.06,true,white,white);
 }
 for(const x of [-F.width/2,F.width/2]){k.box(.38,5.2,.22,x,0,front+.06,white);k.box(.65,.2,.42,x,4.95,front+.08,white);}
 k.box(F.width,.25,.35,0,5,front+.07,white);
 for(const u of [-F.width/2,F.width/2])for(const side of [-1,1]){const g=new THREE.BoxGeometry(.17,.17,Math.hypot((front-back)/2,3.3));g.rotateX(side*Math.atan2(3.3,(front-back)/2));g.translate(u,6.85,(front+back)/2+side*(front-back)/4);k.put(k.solid,g,white);}
 for(const u of [-6,6]){k.box(.55,1.2,.55,u,8,(front+back)/2-.5,'#727b7b');k.box(.7,.12,.7,u,9.1,(front+back)/2-.5,'#5e6767');}
 for(const u of [-F.width/2,F.width/2]){const e=new Kit();e.box(1.7,1.4,.08,0,5.65,0,white);e.pane(1.4,1.15,.1,0,5.77,.06,'#73817e');const m=new THREE.Matrix4().makeRotationY(u<0?-Math.PI/2:Math.PI/2);m.setPosition(u,0,(front+back)/2);k.solid.push(...e.solid.map(g=>g.applyMatrix4(m)));k.glass.push(...e.glass.map(g=>g.applyMatrix4(m)));}
 return k.build(F.matrix,'Jurveliuksen talo');
}
function rectangle(x,z,w,d){return [[x-w/2,z-d/2],[x+w/2,z-d/2],[x+w/2,z+d/2],[x-w/2,z+d/2],[x-w/2,z-d/2]];}
function frameRectangle(F,u,v,w,d){return rectangle(u,v,w,d).map(([a,b])=>[F.origin[0]+F.axis[0]*a+F.normal[0]*b,F.origin[1]+F.axis[1]*a+F.normal[1]*b]);}
