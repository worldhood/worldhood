import * as THREE from 'three';
import {Kit,footprintFrame} from './place-landmarks.js';
import {groundAt,footprintBase} from './terrain.js';

// Original facade/roof geometry from the documented CC0 and owner photographs.
// The municipal LOD1 height anchors the main mass; detailed heights are estimates.
export function createOuluCityHall(spec){
 const F=footprintFrame(spec.rings[0],[.85,.53]),inverse=F.matrix.clone().invert(),W=F.width,D=F.depth,H=spec.sourceHeight,k=new Kit();
 const wall=spec.wall,trim='#e0d6b9',roof='#48514c',glass='#526968',copper='#756d60',front=D/2,wingFront=14.9;
 const localRing=r=>r.map(([x,z])=>{const p=new THREE.Vector3(x,0,z).applyMatrix4(inverse);return [p.x,p.z];});
 const holes=spec.rings.slice(1).map(localRing),shape=new THREE.Shape(F.local.map(([u,v])=>new THREE.Vector2(u,-v)));
 for(const r of holes)shape.holes.push(new THREE.Path(r.map(([u,v])=>new THREE.Vector2(u,-v))));
 const floor=groundAt(F.origin[0]+F.normal[0]*(front+6),F.origin[1]+F.normal[1]*(front+6));
 // Keep the architecture level, but continue its masonry below the lowest terrain
 // along every wall. Preserve the courtyard holes in this foundation as well.
 const foundationBottom=Math.min(0,footprintBase(spec.rings,.5)-floor-.25);
 const foundation=new THREE.ExtrudeGeometry(shape,{depth:-foundationBottom+.02,bevelEnabled:false});
 foundation.rotateX(-Math.PI/2);foundation.translate(0,foundationBottom,0);k.put(k.solid,foundation,wall);
 const body=new THREE.ExtrudeGeometry(shape,{depth:H,bevelEnabled:false});body.rotateX(-Math.PI/2);k.put(k.solid,body,wall);
 // Colour the actual roof cap and the observed pink rear wall independently.
 const p=body.attributes.position,n=body.attributes.normal,c=body.attributes.color;
 for(let i=0;i<p.count;i+=3){const back=[i,i+1,i+2].every(j=>p.getZ(j)<-16)&&Math.abs(n.getY(i))<.1,colour=new THREE.Color(n.getY(i)>.9?roof:back?'#b28b83':wall);for(let j=i;j<i+3;j++)c.setXYZ(j,colour.r,colour.g,colour.b);}
 // Main roof strips around the two mapped courtyards; no filled courtyard collision polygon.
 hip(k,W+.5,9,H,2.1,0,10.4,roof);hip(k,W+.4,8,H,2.7,0,-13.8,roof);
 for(const x of [-W/2+3.4,W/2-3.4])hip(k,6.8,25,H,2.1,x,-.3,roof);
 k.box(10,.3,22,0,H,0,roof);
 for(const r of holes){const xs=r.map(p=>p[0]),zs=r.map(p=>p[1]),w=Math.max(...xs)-Math.min(...xs),d=Math.max(...zs)-Math.min(...zs),x=(Math.min(...xs)+Math.max(...xs))/2,z=(Math.min(...zs)+Math.max(...zs))/2;
  k.box(w+.6,.8,d+.6,x,H+.4,z,'#8c7e61');hip(k,w+.8,d+.8,H+1.2,2.3,x,z,'#6c9ba3');
  for(let i=0;i<5;i++)k.box(.055,.055,d*.9,x-w*.4+i*w*.2,H+1.5,z,'#617b76');
 }
 // Front rustication and horizontal bands follow the projecting centre and recessed wings.
 for(const [x,w,z] of [[0,22.4,front],[-18.5,14.2,wingFront],[18.5,14.2,wingFront]]){
  for(let y=.4;y<6.7;y+=.48)k.box(w,.035,.06,x,y,z+.04,'#987244');
  for(const [y,h,d] of [[1.85,.13,.16],[6.65,.23,.4],[H-.7,.22,.4],[H-.23,.3,.75]])k.box(w+.15,h,d,x,y,z+.08,trim);
  for(let u=-w/2+.4;u<w/2;u+=.75)k.box(.28,.15,.35,x+u,H-.5,z+.25,trim);
 }
 // Three bays on each wing: basement openings, round-headed ground floor, tall upper
 // windows with curved hoods, and smaller attic windows (not a repeated generic grid).
 for(const sign of [-1,1])for(let i=0;i<3;i++){
  const x=sign*(13.7+i*4.8),z=wingFront+.12;
  archWindow(k,1.45,1.4,x,.25,z,trim,glass);
  archWindow(k,1.8,3.05,x,2.55,z,trim,glass);
  rectWindow(k,1.85,3.6,x,7.5,z,trim,glass);hood(k,2.7,.65,x,11.48,z+.14,trim);
  for(const dx of [-1.12,1.12]){k.box(.22,3.7,.23,x+dx,7.4,z+.11,trim);k.box(.34,.18,.35,x+dx,7.3,z+.15,trim);}
  rectWindow(k,1.5,2.05,x,12.8,z,trim,glass);
 }
 // Central front: three entrance arches, three double-height window bays and four pilasters.
 for(const x of [-3.7,0,3.7]){
  archWindow(k,2.5,3.7,x,2.1,front+.12,'#ad8450','#333b34');
  k.box(2.1,2.7,.1,x,2.15,front+.31,'#383c32');
  for(const dx of [-.6,.6])for(const y of [2.5,3.3,4.1])k.box(.55,.55,.03,x+dx,y,front+.38,'#26302b');
  k.box(.055,2.7,.05,x,2.15,front+.4,'#796f54');
  rectWindow(k,2.55,3.8,x,7.45,front+.14,'#a98b5f',glass);
  rectWindow(k,2.55,3.45,x,12.05,front+.14,'#a98b5f',glass);
 }
 for(const x of [-5.55,-1.85,1.85,5.55]){
  k.box(.4,8.15,.32,x,7.3,front+.25,trim);k.box(.65,.23,.5,x,7.08,front+.3,trim);k.box(.7,.28,.5,x,15.45,front+.3,trim);
  for(const dx of [-.2,0,.2])k.cyl(.11,.07,.25,x+dx,15.15,front+.5,trim,8);
 }
 for(const x of [-9.0,9.0]){
  rectWindow(k,1.7,3.65,x,7.5,front+.12,trim,glass);hood(k,2.45,.6,x,11.4,front+.24,trim);
  oculus(k,.56,x,13.45,front+.2,trim,glass);
  for(const dx of [-2.45,2.45])for(let y=6.95;y<H-.7;y+=.7)k.box(.55,.22,.18,x+dx,y,front+.17,'#c09b66');
 }
 // Two square drums and rounded mansard caps, with crossed circular windows, not clock faces.
 const pavilionData=[];for(const x of [-8.9,8.9]){
  const z=front-2.3,y=H+.25,w=5.1;k.box(w,3,w,x,y,z,wall);k.box(w+.55,.28,w+.55,x,y-.12,z,roof);
  for(const u of [-1.45,0,1.45])archWindow(k,.77,2.05,x+u,y+.35,z+w/2+.04,'#cfb78b',glass);
  for(const u of [-2.3,-.7,.7,2.3])k.box(.22,2.6,.17,x+u,y+.15,z+w/2+.15,trim);
  k.box(w+.6,.32,w+.6,x,y+2.92,z,trim);
  roundedCap(k,x,y+3.25,z,w+1,3.8,copper);
  oculus(k,.48,x,y+4.52,z+(w+1)/2+.05,'#88735b',glass,true);
  const top=y+7.05;k.box(1.95,.22,1.95,x,top,z,roof);
  for(const side of [-1,1])for(let q=-.85;q<=.86;q+=.34){k.cyl(.025,.025,.9,x+q,top+.2,z+side*.88,'#303b34',6);k.cyl(.025,.025,.9,x+side*.88,top+.2,z+q,'#303b34',6);}
  for(const side of [-1,1]){k.box(1.85,.04,.04,x,top+1.02,z+side*.88,'#303b34');k.box(.04,.04,1.85,x+side*.88,top+1.02,z,'#303b34');}
  k.cyl(.12,.055,1.8,x,top+.15,z,'#353c33',10);k.cyl(.035,.025,4.3,x,top+.75,z,'#303b34',8);k.box(1.3,.045,.045,x,top+3.6,z,'#303b34');
  for(const dx of [-.5,.5]){const g=new THREE.TorusGeometry(.12,.018,4,10);g.translate(x+dx,top+3.45,z);k.put(k.solid,g,'#303b34');}
  pavilionData.push({x,z,base:y,capTop:top});
 }
 // Balustrade, central crest panel and flag mast. Crest is a deliberately simplified original symbol.
 for(let x=-6;x<=6;x+=.45)k.cyl(.065,.09,.7,x,H+.4,front+.1,trim,6);
 k.box(12.4,.13,.23,0,H+1.1,front+.1,trim);k.box(3.15,2,.5,0,H+.1,front+.2,wall);hip(k,3.6,1.5,H+2.1,.65,0,front-.1,roof);
 crest(k,0,H+.48,front+.49);k.cyl(.04,.025,5.9,0,H+2.6,front-.1,'#d2d4c9',8);
 // Current rooftop service enclosure, visible in the 2025 aerial reference.
 k.box(6,2.1,3.5,0,H+.5,front-5.2,'#47534e');for(const x of [-1.6,1.6])for(const z of [front-4.4,front-6]){k.cyl(.6,.6,.24,x,H+2.6,z,'#d2d6c8',12);k.cyl(.45,.45,.03,x,H+2.84,z,'#5e6d65',12);}
 // Rear elevation: the independently observed pink neo-Gothic hall, not the ochre front repeated.
 const rear=new Kit();
 // The mapped back is stepped. Attach detail to each wall plane rather than hiding
 // central windows behind the deeper projecting wall.
 const backEdges=F.local.slice(1).map((b,i)=>[F.local[i],b]).filter(([a,b])=>a[1]<-16&&b[1]<-16&&Math.abs(b[0]-a[0])>.5);
 const rearPlane=x=>{const u=-x,planes=backEdges.filter(([a,b])=>u>=Math.min(a[0],b[0])&&u<=Math.max(a[0],b[0])).map(([a,b])=>a[1]+(b[1]-a[1])*(u-a[0])/(b[0]-a[0]));return -Math.min(...planes)+.08;};
 for(let i=0;i<13;i++){const x=(i-6)*W/13.5,z=rearPlane(x);archWindow(rear,1.55,3.15,x,3.5,z,'#d9c8b7',glass);archWindow(rear,1.7,4.6,x,8,z,'#d9c8b7',glass);}
 for(const [a,b] of backEdges)for(const y of [2.6,7.2,13.2,15.1])rear.box(Math.abs(b[0]-a[0]),.18,.25,-(a[0]+b[0])/2,y,-(a[1]+b[1])/2+.1,'#d3c1ac');
 rear.gable(.4,10,H-.2,4.8,0,rearPlane(0),true,'#a9827b','#b28b83');
 for(const x of [-3.8,0,3.8])rear.gable(.18,3.7,12.65,1.4,x,rearPlane(x)+.12,true,'#d9c8b7','#c19c8d');
 oculus(rear,.35,0,H+1.4,rearPlane(0)+.3,'#d9c8b7',glass);
 const R=F.matrix.clone().multiply(new THREE.Matrix4().makeRotationY(Math.PI));
 const group=new THREE.Group();group.name='Oulun kaupungintalo';group.add(k.build(F.matrix,'City Hall front and roof'));group.add(rear.build(R,'City Hall rear elevation'));
 group.userData={building:spec.building,fixedElevation:true,sourceHeight:H,pavilions:pavilionData,courtyards:holes.length};
 // The old source's vertical datum/foundation level is uncertain. Place the visible
 // entrance at the shared terrain's stair foot rather than burying the lower steps.
 group.position.y=floor;
 const furniture=new Kit(),obstacles=[];
 // Broad, three-aisle entrance stairs; all projecting solids have footprint obstacles.
 const supportBase=(x,z,w,d)=>Math.min(0,footprintBase([frameRing(F,x,z,w,d)],.25)-floor-.15);
 const stairW=13.6;for(let i=0;i<13;i++){const z=front+.5+i*.43,bottom=supportBase(0,z,stairW,.44);furniture.box(stairW,2.05-i*.15-bottom,.44,0,bottom,z,'#aaa99c');}
 for(const x of [-6.7,-2.25,2.25,6.7]){
  for(const i of [0,4,8,12])furniture.cyl(.035,.035,1,x,2.05-i*.15,front+.5+i*.43,'#303c34',8);
  bar(furniture,[x,3.07,front+.5],[x,1.27,front+5.66],.065,'#303c34');
 }
 obstacles.push({id:'oulu-city-hall-stairs',name:'City Hall entrance stairs',rings:[frameRing(F,0,front+3,13.9,6.3)],height:2.1});
 for(const x of [-7.2,7.2]){
  const bottom=supportBase(x,front+.2,.65,.65);furniture.box(.65,2.2-bottom,.65,x,bottom,front+.2,'#9b9d8e');furniture.cyl(.36,.43,.45,x,2.2,front+.2,'#a6a48b',12);
  for(let i=0;i<5;i++){const g=new THREE.ConeGeometry(.27-i*.025,.6,8);g.translate(x,2.65+i*.3,front+.2);furniture.put(furniture.solid,g,'#4b6242');}
  obstacles.push({name:'Entrance planter',rings:[frameRing(F,x,front+.2,.9,.9)],height:3.8});
 }
 // Central multi-arm garden lamp and two smaller lamps at the stairs, as in the front views.
 for(const [x,z,h] of [[-.3,front+22.6,7.4],[-7.6,front+2.2,4.1],[7.6,front+2.2,4.1]]){
  const wx=F.origin[0]+F.axis[0]*x+F.normal[0]*z,wz=F.origin[1]+F.axis[1]*x+F.normal[1]*z,y0=groundAt(wx,wz)-floor;
  furniture.box(1,.25,1,x,y0,z,'#444c42');furniture.box(.75,1.1,.75,x,y0+.25,z,'#444c42');furniture.box(.95,.16,.95,x,y0+1.35,z,'#38463d');furniture.cyl(.21,.09,h-1.6,x,y0+1.5,z,'#38463d',10);
  for(const y of [1.6,2.5,h-1.4])furniture.cyl(.25,.25,.12,x,y0+y,z,'#38463d',10);
  for(const [u,v] of [[0,0],[-1,0],[1,0],...(h>5?[[0,-1],[0,1]]:[])]){
   const y=y0+h-(u||v?1:.1);bar(furniture,[x,y-.9,z],[x+u*.8,y-.6,z+v*.8],.065,'#38463d');
   furniture.cyl(.27,.23,.65,x+u*.8,y-.6,z+v*.8,'#a9b6a5',4);furniture.cyl(.34,0,.3,x+u*.8,y+.05,z+v*.8,'#38463d',4);
   for(const dx of [-.17,.17])for(const dz of [-.17,.17])furniture.box(.035,.65,.035,x+u*.8+dx,y-.6,z+v*.8+dz,'#38463d');
  }
  obstacles.push({name:'City Hall garden lamp',rings:[frameRing(F,x,z,1.1,1.1)],height:h});
 }
 for(const x of [-12,12]){const z=front+21,wx=F.origin[0]+F.axis[0]*x+F.normal[0]*z,wz=F.origin[1]+F.axis[1]*x+F.normal[1]*z,y=groundAt(wx,wz)-floor;
  for(const dx of [-1.1,1.1])furniture.box(.1,.55,.5,x+dx,y,z,'#3d483d');furniture.box(2.7,.1,.55,x,y+.52,z,'#6f6551');furniture.box(2.7,.38,.08,x,y+.65,z+.26,'#6f6551');
  obstacles.push({name:'City Hall garden bench',rings:[frameRing(F,x,z,2.8,.7)],height:1.1});
 }
 group.add(furniture.build(F.matrix,'City Hall entrance stairs and lamps'));
 for(const part of group.children)for(const mesh of part.children)if(mesh.isMesh&&mesh.material.metalness>.1){mesh.material=mesh.material.clone();mesh.material.metalness=.05;mesh.material.roughness=.3;mesh.material.emissive=new THREE.Color('#52655d');mesh.material.emissiveIntensity=.13;}
 return {group,obstacles};
}
function rectWindow(k,w,h,x,y,z,trim,glass){k.box(w+.24,h+.24,.12,x,y-.12,z,trim);k.pane(w,h,.08,x,y,z+.1,glass);k.box(.065,h,.1,x,y,z+.17,'#3a463e');k.box(w,.065,.1,x,y+h*.61,z+.17,'#3a463e');k.box(w+.4,.12,.25,x,y-.2,z+.07,trim);}
function archWindow(k,w,h,x,y,z,trim,glass){k.arch(w+.25,h+.15,x,y-.08,z,trim);k.arch(w,h,x,y,z+.1,glass,{glass:true});k.box(.055,h-w/2,.08,x,y,z+.23,'#3b473e');k.box(w,.055,.08,x,y+h-w/2,z+.23,'#3b473e');}
function oculus(k,r,x,y,z,trim,glass,cross=false){const g=new THREE.CircleGeometry(r,24);g.translate(x,y,z);k.put(k.glass,g,glass);const t=new THREE.TorusGeometry(r+.04,.08,6,24);t.translate(x,y,z+.03);k.put(k.solid,t,trim);for(const angle of cross?[0,Math.PI/2]:[-.7,.7]){const a=new THREE.BoxGeometry(r*1.9,.035,.04);a.rotateZ(angle);a.translate(x,y,z+.07);k.put(k.solid,a,'#4c5549');}}
function hood(k,w,h,x,y,z,c){const s=new THREE.Shape();s.moveTo(-w/2,0);s.quadraticCurveTo(0,h*2,w/2,0);s.lineTo(w/2-.16,0);s.quadraticCurveTo(0,h*1.5,-w/2+.16,0);s.closePath();const g=new THREE.ExtrudeGeometry(s,{depth:.13,bevelEnabled:false,curveSegments:12});g.translate(x,y,z);k.put(k.solid,g,c);}
function hip(k,w,d,y,h,x,z,c){const a=[[-w/2,0,-d/2],[w/2,0,-d/2],[w/2,0,d/2],[-w/2,0,d/2]],b=[[-w*.36,h,-d*.12],[w*.36,h,-d*.12],[w*.36,h,d*.12],[-w*.36,h,d*.12]],pos=[];for(let i=0;i<4;i++){const j=(i+1)%4;for(const p of [a[i],b[j],a[j],a[i],b[i],b[j]])pos.push(p[0]+x,p[1]+y,p[2]+z);}for(const p of [b[0],b[2],b[1],b[0],b[3],b[2]])pos.push(p[0]+x,p[1]+y,p[2]+z);const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.computeVertexNormals();k.put(k.solid,g,c);}
function roundedCap(k,x,y,z,w,h,c){const rings=Array.from({length:11},(_,i)=>{const t=i/10,half=w/2*(1-.68*t*t);return Array.from({length:32},(_,j)=>{const a=j*Math.PI/16,co=Math.cos(a),si=Math.sin(a);return [x+half*Math.sign(co)*Math.abs(co)**.45,y+h*t,z+half*Math.sign(si)*Math.abs(si)**.45];});}),pos=[];for(let i=1;i<rings.length;i++)for(let j=0;j<32;j++){const n=(j+1)%32;for(const p of [rings[i-1][j],rings[i][j],rings[i][n],rings[i-1][j],rings[i][n],rings[i-1][n]])pos.push(...p);}const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.computeVertexNormals();k.put(k.solid,g,c);}
function crest(k,x,y,z){k.box(1.45,1.6,.06,x,y,z,'#b34636');k.box(1.45,.5,.07,x,y,z+.04,'#648f9d');for(const u of [-.45,0,.45]){k.box(.26,.65,.1,x+u,y+.7,z+.06,'#d7b753');for(const v of [-.08,.08])k.box(.07,.13,.12,x+u+v,y+1.35,z+.08,'#d7b753');}k.box(1.1,.12,.1,x,y+.23,z+.09,'#ded8b9');}
function bar(k,a,b,r,c){const d=new THREE.Vector3(...b).sub(new THREE.Vector3(...a)),g=new THREE.CylinderGeometry(r/2,r/2,d.length(),8);g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),d.clone().normalize()));g.translate(...a.map((v,i)=>(v+b[i])/2));k.put(k.solid,g,c);}
function frameRing(F,x,z,w,d){return [[x-w/2,z-d/2],[x+w/2,z-d/2],[x+w/2,z+d/2],[x-w/2,z+d/2],[x-w/2,z-d/2]].map(([u,v])=>[F.origin[0]+F.axis[0]*u+F.normal[0]*v,F.origin[1]+F.axis[1]*u+F.normal[1]*v]);}
