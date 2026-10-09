import * as THREE from 'three';
import {architectureBuilder} from './cathedral.js';

// SkyWheel: georeferenced 60.167167 N, 24.959778 E, 40 m overall height.
// Allas: photo-guided 2017–2019 three-pool layout, not a 2026 site survey.
export const SKYWHEEL={x:420.48,z:327.06,height:40,cabins:30,yaw:1.15};
export const ALLAS={x:337,z:365,yaw:.12};
export function createWaterfrontLandmarks(){
 const root=new THREE.Group();root.name='SkyWheel and Allas waterfront landmarks';
 const material=(color,metalness=0,roughness=.7)=>new THREE.MeshStandardMaterial({color,metalness,roughness});
 const white=material('#e2e5df',.25),steel=material('#9baead',.55),glass=material('#397894',.35,.25),wood=material('#a48455'),dark=material('#4b4438'),warm=material('#198caa',.3,.18),sea=material('#315d63',.25,.20);
 const base=architectureBuilder(),rotor=architectureBuilder(),wheel=new THREE.Group();wheel.position.set(SKYWHEEL.x,0,SKYWHEEL.z);wheel.rotation.y=SKYWHEEL.yaw;root.add(wheel);
 function beam(b,a,c,r,m){const p=new THREE.Vector3(...a),v=new THREE.Vector3(...c).sub(p),g=new THREE.CylinderGeometry(r,r,v.length(),8);g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),v.clone().normalize()));b.add(g,m,...p.addScaledVector(v,.5).toArray());}
 for(const z of [-3,3])for(const x of [-8,8])beam(base,[x,.3,z],[0,21,z*.65],.30,white);
 base.box(19,.7,9,steel,0,.1,0);base.box(9,3.2,5,dark,8,1.6,3);
 for(const z of [-1.9,1.9]){
  rotor.add(new THREE.TorusGeometry(17.5,.16,8,96),white,0,0,z);
  for(let i=0;i<15;i++){const a=i*Math.PI*2/15;beam(rotor,[0,0,z],[17.5*Math.cos(a),17.5*Math.sin(a),z],.07,white);}
 }
 for(let i=0;i<30;i++){const a=i*Math.PI*2/30,x=17.5*Math.cos(a),y=17.5*Math.sin(a);beam(rotor,[x,y,-1.9],[x,y,1.9],.08,steel);}
 const disk=rotor.finish();disk.position.y=21;wheel.add(base.finish(),disk);
 const cabinBody=new THREE.InstancedMesh(new THREE.BoxGeometry(1.65,1.55,2.0),glass,30),cabinRoof=new THREE.InstancedMesh(new THREE.BoxGeometry(1.9,.15,2.2),white,30),temp=new THREE.Object3D();
 cabinBody.frustumCulled=false;cabinRoof.frustumCulled=false;wheel.add(cabinBody,cabinRoof);
 const pools=architectureBuilder(),allas=new THREE.Group();allas.position.set(ALLAS.x,0,ALLAS.z);allas.rotation.y=ALLAS.yaw;root.add(allas);
 pools.box(82,.75,43,dark,0,.1,0);
 pools.box(82,.18,43,wood,0,.57,0);
 // Pool water sits inside raised wooden surrounds. Long pools are 25 m.
 for(const p of [{x:-25,z:0,w:25,d:15,mat:sea},{x:1,z:8,w:20,d:11,mat:warm},{x:28,z:0,w:15,d:25,mat:warm}]){
  pools.box(p.w,.05,p.d,p.mat,p.x,.69,p.z);
  for(const side of [-1,1]){pools.box(p.w+.5,.18,.26,wood,p.x,.79,p.z+side*p.d/2);pools.box(.26,.18,p.d,wood,p.x+side*p.w/2,.79,p.z);}
  if(p.d===25)for(let i=-2;i<=2;i++)pools.box(.06,.02,24,white,p.x+i*2.1,.73,p.z);
 }
 // Timber pavilion, stepped roof terraces, glazed doors and broad deck stairs.
 pools.box(67,5,13,wood,0,3.2,-29);pools.box(34,2.5,12,wood,5,6.9,-29);pools.box(68,.20,14,dark,0,5.82,-29);pools.box(35,.20,13,dark,5,8.25,-29);
 for(let x=-31;x<32;x+=4.8)pools.box(3.0,3.0,.12,glass,x,2.6,-22.43);
 for(let x=-32;x<=33;x+=.38)pools.box(.075,5.0,.09,dark,x,3.25,-22.42);
 for(let i=0;i<18;i++)pools.box(8,.2,3.4+i*.45,wood,26,4.3-i*.20,-17.8+i*.225);
 for(const z of [-21,21]){beam(pools,[-41,1.9,z],[41,1.9,z],.04,steel);for(let x=-41;x<=41;x+=2.5)pools.box(.05,1.2,.05,steel,x,1.3,z);}
 for(let i=0;i<16;i++){const x=-37+i*4.3;pools.box(.7,.12,1.8,white,x,.96,-13);pools.box(.7,.55,.10,white,x,1.17,-13.8);}
 allas.add(pools.finish());root.userData={skywheel:SKYWHEEL,allas:ALLAS,accuracy:'Original photo-guided interpretation; deck boundaries and small details approximate'};
 return {group:root,update(time){const angle=time*.025;disk.rotation.z=angle;for(let i=0;i<30;i++){const a=i*Math.PI*2/30+angle;temp.position.set(17.5*Math.cos(a),21+17.5*Math.sin(a)-.90,0);temp.updateMatrix();cabinBody.setMatrixAt(i,temp.matrix);temp.position.y+=.85;temp.updateMatrix();cabinRoof.setMatrixAt(i,temp.matrix);}cabinBody.instanceMatrix.needsUpdate=true;cabinRoof.instanceMatrix.needsUpdate=true;}};
}
