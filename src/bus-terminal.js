import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {createBreakableSigns} from './breakable-signs.js';

// Green-framed shelters / glazed walls / platform poles from 2025 street-level
// reference photography. Exact furniture poses are fitted to mapped pedestrian
// surfaces near GTFS stop coordinates, not claimed as a surveyed inventory.
export function terminalAnchors(stops,world){
 const free=(x,z)=>!world.roads.at(x,z)&&!world.buildings.at(x,z)&&!!(world.pavement?.at(x,z)||world.trafficForbidden?.at(x,z));
 const result=[];
 for(const stop of stops){
  let best=null;
  for(let dx=-8;dx<=8;dx+=.5)for(let dz=-5;dz<=5;dz+=.5){const x=stop.x+dx,z=stop.z+dz,score=dx*dx+dz*dz;if(best&&score>=best.score)continue;
   if(![-.35,0,.35].every(a=>[-.35,0,.35].every(b=>free(x+a,z+b))))continue;
   best={...stop,x,z,score};
  }
  if(!best)continue;
  const heading=-3.047,c=Math.cos(heading),s=Math.sin(heading);
  best.heading=heading;best.shelter=false;
  // Long side follows the bus bay. Sample the complete footprint, not just its centre.
  for(const side of [1,-1]){const x=best.x+side*c*1.2,z=best.z-side*s*1.2;
   if(result.some(p=>p.shelter&&Math.hypot(p.shelter.x-x,p.shelter.z-z)<6))continue;
   let clear=true;for(let a=-.8;a<=.81;a+=.4)for(let b=-2.7;b<=2.71;b+=.45)if(!free(x+c*a+s*b,z-s*a+c*b))clear=false;
   if(clear){best.shelter={x,z};break;}
  }
  result.push(best);
 }return result;
}
export function createBusTerminal(stops,world){
 const group=new THREE.Group();group.name='Rautatientori terminal stop furniture';
 const anchors=terminalAnchors(stops,world),batches=new Map();
 const green=new THREE.MeshStandardMaterial({color:'#254a40',roughness:.68}),metal=new THREE.MeshStandardMaterial({color:'#969f99',roughness:.5}),glass=new THREE.MeshStandardMaterial({color:'#94b5ba',transparent:true,opacity:.3,depthWrite:false,roughness:.25,side:THREE.DoubleSide}),bench=new THREE.MeshStandardMaterial({color:'#7d786a',roughness:.8});
 function box(w,h,d,mat,x,y,z,heading=0){const geo=new THREE.BoxGeometry(w,h,d);geo.rotateY(heading);geo.translate(x,y,z);if(!batches.has(mat))batches.set(mat,[]);batches.get(mat).push(geo);}
 // Platform sign poles are light single posts: they bend or snap when hit (breakable-signs.js).
 const signs=createBreakableSigns('Bus platform poles');
 for(const a of anchors){
  const post=signs.post({id:`bus-${a.platform||a.code||a.x}`,x:a.x,z:a.z,height:3.43,radius:.06});{const g=new THREE.BoxGeometry(.09,3.35,.09);g.translate(a.x,1.75,a.z);signs.add(g,metal,post);}
  if(typeof document!=='undefined'){
   const canvas=document.createElement('canvas');canvas.width=512;canvas.height=640;const ctx=canvas.getContext('2d');
   ctx.fillStyle='#f5f5ec';ctx.fillRect(0,0,512,640);ctx.fillStyle='#087bb6';ctx.fillRect(0,0,512,175);ctx.fillStyle='white';ctx.font='bold 94px sans-serif';ctx.textAlign='center';ctx.fillText('BUS',256,122);ctx.fillStyle='#1d343e';ctx.font='bold 160px sans-serif';ctx.fillText(a.platform,256,370);ctx.font='32px sans-serif';ctx.fillText('Rautatientori',256,448);ctx.fillText('Järnvägstorget',256,496);ctx.font='28px sans-serif';ctx.fillText(a.code||'',256,579);
   const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;const sign=new THREE.Mesh(new THREE.PlaneGeometry(.62,.78),new THREE.MeshBasicMaterial({map:texture,side:THREE.DoubleSide}));sign.position.set(a.x,3.05,a.z+.06);group.add(sign);signs.attach(sign,post);
  }
  if(a.shelter){const {x,z}=a.shelter,c=Math.cos(a.heading),s=Math.sin(a.heading),place=(lx,y,lz,w,h,d,mat)=>box(w,h,d,mat,x+c*lx+s*lz,y,z-s*lx+c*lz,a.heading);
   place(0,2.75,0,1.6,.14,5.4,green);
   for(const lx of [-.7,.7])for(const lz of [-2.55,0,2.55])place(lx,1.42,lz,.065,2.6,.065,green);
   place(.7,1.48,0,.035,2.3,5.15,glass);for(const lz of [-2.55,2.55])place(0,1.48,lz,1.4,2.3,.035,glass);
   place(.25,.6,0,.5,.13,3.8,bench);for(const lz of [-1.5,1.5])place(.25,.32,lz,.08,.48,.1,green);
  }
 }
 for(const [material,gs]of batches){const mesh=new THREE.Mesh(mergeGeometries(gs),material);mesh.castShadow=material!==glass;mesh.receiveShadow=true;group.add(mesh);gs.forEach(g=>g.dispose());}
 group.add(signs.finish());group.breakable=signs;
 group.userData={stops:anchors.length,shelters:anchors.filter(a=>a.shelter).length,anchors,accuracy:'Mapped stops; photo-guided style; pedestrian-surface-fitted furniture, not exact surveyed placement'};return group;
}
