import * as THREE from 'three';
import {SpatialIndex} from './geo.js';
import {createBreakableSigns} from './breakable-signs.js';
// Names checked against Helsinki's bilingual street-name register. Mounting
// points are inferred from mapped footways, NOT surveyed sign-pole positions.
export const STREET_NAMES=[
 ['Laivasillankatu','Skeppsbrogatan',210,938,.64],['Eteläranta','Södra kajen',18,655,0],
 ['Eteläranta','Södra kajen',14,492,0],['Pohjoisesplanadi','Norra esplanaden',-58,250,0],
 ['Unioninkatu','Unionsgatan',-65,150,0],['Aleksanterinkatu','Alexandersgatan',-68,125,Math.PI/2],
 ['Mikonkatu','Mikaelsgatan',-376,112,Math.PI/2],['Kaivokatu','Brunnsgatan',-425,-8,Math.PI/2],
 ['Mannerheimintie','Mannerheimvägen',-732,9,Math.PI/2],
];
export function streetNamePlacements(data){
 const roads=new SpatialIndex(data.roads.filter(p=>!/Koroke/.test(p.kind))),pavement=new SpatialIndex(data.pavement.filter(p=>!/pyörä/i.test(p.kind))),buildings=new SpatialIndex(data.buildings),out=[];
 for(const [fi,sv,cx,cz,yaw]of STREET_NAMES){let best;
  for(let dx=-15;dx<=15;dx+=.5)for(let dz=-15;dz<=15;dz+=.5){const x=cx+dx,z=cz+dz,d=Math.hypot(dx,dz);if(best&&d>=best.d)continue;
   if(!pavement.at(x,z)||roads.at(x,z)||buildings.at(x,z))continue;
   if([[-.3,0],[.3,0],[0,-.3],[0,.3]].some(([a,b])=>roads.at(x+a,z+b)||!pavement.at(x+a,z+b)))continue;
   // Plaques must name a nearby real road, not whichever pavement was closest.
   if(!data.roads.some(r=>r.name===fi&&x>r.bbox[0]-12&&x<r.bbox[2]+12&&z>r.bbox[1]-12&&z<r.bbox[3]+12))continue;
   best={fi,sv,x,z,yaw,d};
  }if(best)out.push(best);
 }return out;
}
export function createStreetNameSigns(data){
 const group=new THREE.Group();group.name='Bilingual street-name plaques';const placements=streetNamePlacements(data),poleMat=new THREE.MeshStandardMaterial({color:'#657574',metalness:.55,roughness:.6});
 // Each plaque post bends or snaps when hit (breakable-signs.js); its meshes are re-posed directly.
 const signs=createBreakableSigns('Street-name posts');
 for(const p of placements){
  const i=signs.post({id:p.fi+'-'+p.x.toFixed(1),x:p.x,z:p.z,yaw:p.yaw,height:3.25,radius:.055});
  const c=document.createElement('canvas');c.width=1024;c.height=256;const ctx=c.getContext('2d');ctx.fillStyle='#edece3';ctx.fillRect(0,0,1024,256);ctx.strokeStyle='#23322f';ctx.lineWidth=8;ctx.strokeRect(6,6,1012,244);ctx.fillStyle='#23322f';ctx.textAlign='center';ctx.font='600 75px sans-serif';ctx.fillText(p.fi,512,105,970);ctx.font='500 69px sans-serif';ctx.fillText(p.sv,512,205,970);
  const texture=new THREE.CanvasTexture(c);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=4;const mat=new THREE.MeshStandardMaterial({map:texture,roughness:.8});
  const pole=new THREE.Mesh(new THREE.CylinderGeometry(.045,.055,3.25,8),poleMat);pole.position.set(p.x,1.625,p.z);group.add(pole);signs.attach(pole,i);
  for(const side of [0,Math.PI]){const sign=new THREE.Mesh(new THREE.PlaneGeometry(1.9,.475),mat);sign.rotation.y=p.yaw+side;sign.position.set(p.x+Math.sin(sign.rotation.y)*.035,3,p.z+Math.cos(sign.rotation.y)*.035);group.add(sign);signs.attach(sign,i);}
 }
 group.add(signs.finish());group.breakable=signs;
 group.userData={count:placements.length,placements,accuracy:'Actual bilingual street names; approximate safe mounting points'};return group;
}
