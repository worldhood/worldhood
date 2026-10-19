import * as THREE from 'three';
import {Kit,footprintFrame} from './place-landmarks.js';
import {groundAt,footprintBase} from './terrain.js';

// Original geometry from the catalogued CC0 front, side and aerial photographs.
// Only footprint and total tower height are source dimensions; other sizes are estimates.
export function createOuluCathedral(spec){
 const F=footprintFrame(spec.rings[0],[-.85,-.53]),k=new Kit(),wall='#c7a259',trim='#e7e3d6',roof='#537c75',dark='#34413e',glass='#566467';
 const floor=groundAt(...world(F,-.53,37.4)),bottom=Math.min(0,footprintBase(spec.rings,.5)-floor-.25),tx=-.53,tz=27.02,front=32.28;
 k.walls(F.local,.65,12.4,wall);
 // Grey stone plinth continues below downhill ground, keeping the whole church rigid.
 k.walls(F.local,bottom,.65,'#6b6c61');
 const ring=F.local;
 for(let i=1;i<ring.length;i++){
  const a=ring[i-1],b=ring[i],dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz);if(len<4)continue;
  let nx=dz/len,nz=-dx/len;const mx=(a[0]+b[0])/2,mz=(a[1]+b[1])/2;
  if(inside(mx+nx*.2,mz+nz*.2,ring)){nx=-nx;nz=-nz;}
  const yaw=Math.atan2(nx,nz),edge=new Kit();
  for(const [y,h,d] of [[.8,.16,.16],[11.95,.18,.3],[12.25,.2,.5]])edge.box(len,h,d,0,y,0,trim);
  // The tower's narrow projecting walls do not have the nave's tall arched grid.
  if(mz<21.3&&len>6){const count=Math.max(1,Math.floor(len/6.8));for(let j=0;j<count;j++){
   const x=(j-(count-1)/2)*len/count;arched(edge,2.1,5.6,x,2.6,.12,trim,glass);
  }}
  const matrix=new THREE.Matrix4().makeRotationY(yaw);matrix.setPosition(mx,0,mz);
  for(const [list,out] of [[edge.solid,k.solid],[edge.glass,k.glass]])for(const g of list){g.applyMatrix4(matrix);out.push(g);}
 }
 // Curved nave/transept roofs, with original standing seams and curved end pediments.
 barrel(k,19.6,53.3,-.7,-4.9,true,roof,wall);
 barrel(k,18.3,42.1,0,-5.25,false,roof,wall);
 // Raised octagonal crossing drum and shallow copper dome.
 for(const g of [k.cyl(10.1,10.1,2.7,-.7,19.5,-5.25,wall,8),k.cyl(10.25,10.25,.25,-.7,22.2,-5.25,trim,8)])g.translate(.7,0,5.25).rotateY(Math.PI/8).translate(-.7,0,-5.25);
 for(let i=0;i<8;i++){
  const angle=i*Math.PI/4,side=new Kit();rect(side,1.7,2.1,0,19.85,9.45,trim,glass);
  const m=new THREE.Matrix4().makeRotationY(angle);m.setPosition(-.7,0,-5.25);
  for(const [list,out] of [[side.solid,k.solid],[side.glass,k.glass]])for(const g of list){g.applyMatrix4(m);out.push(g);}
 }
 const dome=new THREE.SphereGeometry(10.05,40,16,0,Math.PI*2,0,Math.PI/2);dome.scale(1,.63,1);dome.translate(-.7,22.6,-5.25);k.put(k.solid,dome,roof);
 k.cyl(10.1,10.1,.2,-.7,22.45,-5.25,dark,48);
 // Tower: low entrance block, cornice transitions, pilastered belfry and clock chamber.
 k.box(10.55,7.1,10.55,tx,12.4,tz,wall);
 for(const [y,w,h,c] of [[.7,10.75,.18,trim],[18.2,10.85,.2,trim],[18.95,11.5,.35,trim],[19.3,11.65,.12,dark],[22,11.6,.4,trim],[22.4,11.7,.13,dark],[33.3,11.5,.4,trim],[33.7,11.6,.15,dark],[35,9.7,.3,dark],[40.5,9.8,.32,trim]])k.box(w,h,w,tx,y,tz,c);
 k.box(10.6,3,10.6,tx,19.5,tz,wall);k.box(10.2,10.9,10.2,tx,22.5,tz,wall);k.box(10.3,1.7,10.3,tx,33.4,tz,wall);
 k.box(9,5.5,9,tx,35.1,tz,wall);
 for(let face=0;face<4;face++){
  const detail=new Kit(),angle=face*Math.PI/2;
  rect(detail,1.75,3.5,0,11.1,5.32,trim,glass);
  for(const x of [-4.35,-2.7,2.7,4.35]){
   detail.box(.52,8.2,.28,x,23,5.18,trim);detail.box(.8,.22,.5,x,22.85,5.25,trim);detail.box(.85,.28,.6,x,31.1,5.25,trim);
  }
  arched(detail,2.6,5.4,0,23.2,5.16,trim,'#aa905d',false);
  for(let y=23.45;y<27.5;y+=.28)detail.box(2.45,.065,.16,0,y,5.42,'#9c8456');
  for(const y of [22.8,28.7,31.5,32.5])detail.box(10.2,.11,.18,0,y,5.18,trim);
  for(const x of [-3.05,3.05])rect(detail,.95,3.1,x,35.75,4.55,trim,glass);
  for(const y of [35.4,39.85])detail.box(9,.16,.15,0,y,4.55,trim);
  clock(detail,0,37.4,4.65);
  const m=new THREE.Matrix4().makeRotationY(angle);m.setPosition(tx,0,tz);
  for(const [list,out] of [[detail.solid,k.solid],[detail.glass,k.glass]])for(const g of list){g.applyMatrix4(m);out.push(g);}
 }
 // Square spire with flared curved skirt (not a cone), gilded ball and cross.
 squareSpire(k,tx,tz,[[40.8,5.05],[41.15,4.55],[42,3.8],[43.5,2.75],[52.9,1.4],[53.4,1.4]],'#404846');
 k.box(3.1,.18,3.1,tx,53.4,tz,dark);
 for(const sign of [-1,1])for(const t of [-.65,0,.65]){bar(k,[tx+t*2.75,43.5,tz+sign*2.75],[tx+t*1.4,53.35,tz+sign*1.4],.035,dark);bar(k,[tx+sign*2.75,43.5,tz+t*2.75],[tx+sign*1.4,53.35,tz+t*1.4],.035,dark);}k.cyl(.16,.12,.5,tx,53.58,tz,'#af9250',10);
 const orb=new THREE.SphereGeometry(.7,20,12);orb.translate(tx,54.25,tz);k.put(k.solid,orb,'#b39a51');
 k.box(.16,1.85,.16,tx,54.65,tz,'#b39a51');k.box(1.65,.15,.16,tx,55.75,tz,'#b39a51');
 // White two-column portico, triangular pediment and dark entrance.
 k.box(3.5,6.2,.12,tx,1.65,front+.07,'#303834');
 for(const x of [tx-2.55,tx+2.55]){k.cyl(.63,.48,6.9,x,1.65,front+1.25,trim,20);k.cyl(.75,.75,.24,x,1.65,front+1.25,trim,20);k.cyl(.75,.6,.35,x,8.35,front+1.25,trim,20);}
 k.box(7.4,.5,2.1,tx,8.7,front+.9,trim);k.gable(2.2,7.7,9.2,1.55,tx,front+.9,true,dark,trim);k.gable(.12,6.5,9.4,1.12,tx,front+2.05,true,trim,wall);
 const obstacles=[];
 const stairsRing=rectangle(F,tx,front+3.1,10.2,6.1);
 const landingBase=Math.min(0,footprintBase([rectangle(F,tx,front+.25,10,.8)],.25)-floor-.15);k.box(10,1.65-landingBase,.8,tx,landingBase,front+.25,'#8d8d80');
 for(let i=0;i<10;i++){
  const z=front+.4+i*.55,b=Math.min(0,footprintBase([rectangle(F,tx,z,10,.56)],.25)-floor-.15),top=1.65-i*.155;
  k.box(10,top-b,.56,tx,b,z,'#8d8d80');
 }
 for(const x of [tx-4.75,tx+4.75]){
  for(const i of [0,3,6,9])k.cyl(.035,.035,.95,x,1.65-i*.155,front+.4+i*.55,dark,8);
  bar(k,[x,2.6,front+.4],[x,1.2,front+5.35],.055,dark);
 }
 obstacles.push({id:'oulu-cathedral-stairs',name:'Cathedral entrance stairs',rings:[stairsRing],height:1.7});
 const group=k.build(F.matrix,'Oulun tuomiokirkko');group.position.y=floor;
 group.userData={...group.userData,building:spec.building,fixedElevation:true,towerHeight:56.5,estimatedDetails:true,clockFaces:4};
 return {group,obstacles};
}

function world(F,x,z){return [F.origin[0]+F.axis[0]*x+F.normal[0]*z,F.origin[1]+F.axis[1]*x+F.normal[1]*z];}
function rectangle(F,x,z,w,d){return [[x-w/2,z-d/2],[x+w/2,z-d/2],[x+w/2,z+d/2],[x-w/2,z+d/2],[x-w/2,z-d/2]].map(([u,v])=>world(F,u,v));}
function inside(x,z,r){let hit=false;for(let i=0,j=r.length-1;i<r.length;j=i++){const a=r[i],b=r[j];if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])hit=!hit;}return hit;}
function rect(k,w,h,x,y,z,trim,glass){k.box(w+.22,h+.22,.1,x,y-.11,z,trim);k.pane(w,h,.06,x,y,z+.09,glass);for(let i=1;i<4;i++)k.box(w,.045,.05,x,y+h*i/4,z+.15,trim);for(const dx of [-w/6,w/6])k.box(.045,h,.05,x+dx,y,z+.15,trim);}
function arched(k,w,h,x,y,z,trim,glass,pane=true){k.arch(w+.3,h+.25,x,y-.1,z,trim);k.arch(w,h,x,y,z+.1,glass,{glass:pane});if(pane){k.box(.06,h-.1,.07,x,y,z+.23,trim);for(const t of [.3,.6,.8])k.box(w,.06,.07,x,y+h*t,z+.23,trim);}}
function clock(k,x,y,z){
 const face=new THREE.CircleGeometry(1.45,48);face.translate(x,y,z);k.put(k.solid,face,'#e5e3d4');
 for(const [r,c] of [[1.48,'#e7e3d6'],[1.28,'#303a36']]){const g=new THREE.TorusGeometry(r,.055,6,48);g.translate(x,y,z+.03);k.put(k.solid,g,c);}
 // Roman-style hour strokes and minute ticks are geometry, never copied photo pixels.
 for(let i=0;i<60;i++){const a=i*Math.PI/30,g=new THREE.BoxGeometry(i%5===0?.055:.025,i%5===0?.27:.085,.035);g.rotateZ(-a);g.translate(x+Math.sin(a)*1.13,y+Math.cos(a)*1.13,z+.06);k.put(k.solid,g,'#303a36');}
 bar(k,[x,y,z+.12],[x-.67,y+.5,z+.12],.07,'#303a36');bar(k,[x,y,z+.15],[x+.3,y+.94,z+.15],.045,'#303a36');
}
function barrel(k,w,len,x,z,alongZ,roof,wall){
 const profile=Array.from({length:25},(_,i)=>{const u=i/24*Math.PI;return [-Math.cos(u)*w/2,Math.sin(u)**.62*7.5];});
 const shape=new THREE.Shape(profile.map(([a,b])=>new THREE.Vector2(a,b)));shape.closePath();const g=new THREE.ExtrudeGeometry(shape,{depth:len,bevelEnabled:false});g.translate(0,12.4,-len/2);if(!alongZ)g.rotateY(Math.PI/2);g.translate(x,0,z);
 const p=g.attributes.position,n=g.attributes.normal;k.put(k.solid,g,roof);const c=g.attributes.color,colour=new THREE.Color(wall);for(let i=0;i<p.count;i++)if(Math.abs(alongZ?n.getZ(i):n.getX(i))>.9)c.setXYZ(i,colour.r,colour.g,colour.b);
 // Pale curved pediment moulding on each end, interpreted from the aerial references.
 for(const sign of [-1,1]){const arc=new THREE.TorusGeometry(w/2-.16,.12,5,40,Math.PI);arc.scale(1,7.35/(w/2-.16),1);arc.translate(0,12.4,sign*(len/2+.06));if(!alongZ)arc.rotateY(Math.PI/2);arc.translate(x,0,z);k.put(k.solid,arc,'#e7e3d6');}
 // Long seams follow the curved roof, with a sparse set of cross seams.
 for(let i=1;i<24;i++){const [a,b]=profile[i],seam=new THREE.BoxGeometry(.035,.035,len);seam.translate(a,12.43+b,0);if(!alongZ)seam.rotateY(Math.PI/2);seam.translate(x,0,z);k.put(k.solid,seam,'#486c65');}
}
function squareSpire(k,x,z,rings,c){const pos=[];for(let i=1;i<rings.length;i++){const [ya,a]=rings[i-1],[yb,b]=rings[i],p=[[-a,ya,-a],[a,ya,-a],[a,ya,a],[-a,ya,a]],q=[[-b,yb,-b],[b,yb,-b],[b,yb,b],[-b,yb,b]];for(let j=0;j<4;j++){const n=(j+1)%4;for(const v of [p[j],q[n],p[n],p[j],q[j],q[n]])pos.push(v[0]+x,v[1],v[2]+z);}}const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.computeVertexNormals();k.put(k.solid,g,c);}
function bar(k,a,b,r,c){const d=new THREE.Vector3(...b).sub(new THREE.Vector3(...a)),g=new THREE.CylinderGeometry(r/2,r/2,d.length(),6);g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize()));g.translate(...a.map((v,i)=>(v+b[i])/2));k.put(k.solid,g,c);}
