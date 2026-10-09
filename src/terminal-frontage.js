import * as THREE from 'three';
import {architectureBuilder} from './cathedral.js';
import {bounds} from './geo.js';

export function createOlympiaFrontage(city,m){
 const group=new THREE.Group(),b=architectureBuilder(),obstacles=[],terminal=city.buildings.find(p=>p.ratu===1796);
 group.name='Olympia terminal: photo-guided canopy, louvers and entrances';
 if(!terminal)return {group,obstacles};
 const ring=terminal.rings[0],shape=new THREE.Shape(ring.map(([x,z])=>new THREE.Vector2(x,-z)));
 const shell=new THREE.ExtrudeGeometry(shape,{depth:7.9,bevelEnabled:false});shell.rotateX(-Math.PI/2);b.add(shell,m.brick,0,.1,0);
 const roof=new THREE.ShapeGeometry(shape);roof.rotateX(-Math.PI/2);b.add(roof,m.dark,0,8.05,0);
 let area=0;for(let i=1;i<ring.length;i++)area+=ring[i-1][0]*ring[i][1]-ring[i][0]*ring[i-1][1];
 let posts=0,doors=0;const panels=[];
 function text(text,w,h,position,yaw,color='#f0f0e8'){
  if(typeof document==='undefined')return;
  const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=128;const c=canvas.getContext('2d');
  c.fillStyle=color;c.font='600 92px Arial';c.textAlign='center';c.textBaseline='middle';c.fillText(text,512,66,1000);
  const t=new THREE.CanvasTexture(canvas);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;
  const mesh=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshStandardMaterial({map:t,transparent:true,alphaTest:.2,roughness:.75}));mesh.position.set(...position);mesh.rotation.y=yaw;group.add(mesh);
 }
 for(let i=1;i<ring.length;i++){
  const a=ring[i-1],d=ring[i],dx=d[0]-a[0],dz=d[1]-a[1],length=Math.hypot(dx,dz);if(length<7)continue;
  const nx=dz/length*Math.sign(area),nz=-dx/length*Math.sign(area),yaw=Math.atan2(-nz,nx),front=nx<-.5&&length>35;
  const point=(s,y,offset=0)=>[a[0]+dx*s/length+nx*offset,y,a[1]+dz*s/length+nz*offset];
  const wall=(depth,h,width,mat,s,y,offset=.1)=>b.box(depth,h,width,mat,...point(s,y,offset),yaw);
  wall(.2,.2,length,m.white,length/2,7.92);
  if(front){
   // Low entrance block with a full-width projecting canopy, not three floors.
   wall(.13,2.05,length-1.2,m.dark,length/2,6.55,.13);
   for(let y=5.58;y<7.55;y+=.115)wall(.17,.052,length-1.4,m.metal,length/2,y,.23);
   for(let s=.7;s<length;s+=4.05)wall(.23,2.2,.1,m.white,s,6.53,.30);
   wall(5.1,.26,length+1,m.granite,length/2,4.55,2.45);
   wall(.14,.45,length+1,m.brick,length/2,4.47,5.0);
   wall(.2,.11,length+1,m.white,length/2,4.77,5.03);
   for(let s=1.4;s<length-1;s+=7.5){
    wall(.48,4.2,.48,m.granite,s,2.12,4.4);wall(.68,.25,.68,m.granite,s,.15,4.4);posts++;
    const [x,,z]=point(s,0,4.4),r=[[x-.3,z-.3],[x+.3,z-.3],[x+.3,z+.3],[x-.3,z+.3]];obstacles.push({id:'terminal-canopy-column',rings:[r],bbox:bounds([r])});
   }
   for(let s=2.4;s<length-1.5;s+=6.2){
    wall(.12,3.5,5.55,m.glass,s,2.1,.16);
    for(const offset of [-2.7,-1.35,0,1.35,2.7])wall(.18,3.55,.065,m.metal,s+offset,2.1,.26);
    wall(.19,.075,5.6,m.white,s,3.55,.27);wall(.19,.075,5.6,m.metal,s,.45,.27);
    // Paired sliding doors with handles, dark thresholds and transom glazing.
    if(s>length*.3&&s<length*.7){for(const offset of [-.3,.3])wall(.24,.42,.035,m.white,s+offset,1.35,.32);wall(.4,.08,2.7,m.dark,s,.15,.35);doors++;}
   }
   const faceYaw=Math.atan2(nx,nz);
   for(const s of [5.2,length-4.2]){
    wall(.9,.66,1.4,m.granite,s,.4,3.5);
    wall(.78,.045,1.27,m.dark,s,.76,3.5);
    const leaves=new THREE.MeshStandardMaterial({color:'#526740',roughness:.95});
    for(const offset of [-.42,0,.42]){const g=new THREE.IcosahedronGeometry(.32,0);g.scale(1,.7,1);b.add(g,leaves,...point(s+offset,.94,3.5));}
    const [x,,z]=point(s,0,3.5),r=[[x-.7,z-.7],[x+.7,z-.7],[x+.7,z+.7],[x-.7,z+.7]];obstacles.push({id:'terminal-planter',rings:[r],bbox:bounds([r])});
   }
   text('OLYMPIA',6.3,.68,point(length*.44,5.05,5.14),faceYaw);
   text('TERMINAALI · TERMINALEN',6.8,.3,point(length*.64,5.03,5.14),faceYaw);
   text('SILJA LINE',7.4,.85,point(length*.88,6.65,.37),faceYaw,'#245b99');
   panels.push({a,d,length,normal:[nx,nz],canopyDepth:5.1,height:8});
  }else{
   const n=Math.floor(length/3.05),bay=length/n;
   for(let j=0;j<n;j++)for(const y of [2.25,6.05]){
    const s=(j+.5)*bay;wall(.08,1.9,bay-.38,m.glass,s,y);
    for(const offset of [-(bay-.28)/2,0,(bay-.28)/2])wall(.16,2.0,.065,m.white,s+offset,y,.17);
    for(const offset of [-1,1])wall(.16,.09,bay-.20,m.white,s,y+offset*.98,.17);
   }
   wall(.16,.2,length,m.granite,length/2,4.08);
  }
 }
 group.add(b.finish());group.userData={placed:true,posts,doors,panels,height:8.05,accuracy:'Facade and canopy interpreted from supplied 2023/2024 photos on municipal footprint; dimensions estimated'};
 return {group,obstacles};
}
