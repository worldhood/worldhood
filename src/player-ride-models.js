import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

// These anchors are shared by the visible bicycle and the player's foot IK.
export const PLAYER_BIKE={hipY:1.01,hipZ:.23,crankY:.33,crankZ:.05,crankR:.17,crankPerMetre:1.15,pedalX:.14,pedalTop:.0175,barX:.24,barY:1.05,barZ:-.48};
export const PLAYER_SCOOTER={hipY:.90,footX:.025,frontZ:-.09,backZ:.155,groundY:.324,barX:.22,barY:.946,barZ:-.455};

export function addBicycleMotion(root){
 const metal=new THREE.MeshStandardMaterial({color:'#939c98',roughness:.4,metalness:.5}),dark=new THREE.MeshStandardMaterial({color:'#202a27',roughness:.8});
 const wheels=[],wheelMaterial=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.65,metalness:.25});
 const tint=(geometry,hex)=>{
  const g=geometry.index?geometry.toNonIndexed():geometry;if(g!==geometry)geometry.dispose();g.deleteAttribute('uv');
  const color=new THREE.Color(hex),colors=new Float32Array(g.attributes.position.count*3);
  for(let i=0;i<colors.length;i+=3){colors[i]=color.r;colors[i+1]=color.g;colors[i+2]=color.b;}
  g.setAttribute('color',new THREE.BufferAttribute(colors,3));return g;
 };
 const parts=[tint(new THREE.TorusGeometry(.32,.032,6,32).rotateY(Math.PI/2),'#202724'),tint(new THREE.TorusGeometry(.295,.008,4,32).rotateY(Math.PI/2),'#9ca7a1'),tint(new THREE.CylinderGeometry(.04,.04,.09,8).rotateZ(Math.PI/2),'#aab3ad')];
 for(let i=0;i<8;i++)parts.push(tint(new THREE.CylinderGeometry(.004,.004,.59,3).rotateX(i*Math.PI/8),'#9ca7a1'));
 const wheelGeometry=mergeGeometries(parts);parts.forEach(g=>g.dispose());
 for(const z of [-.58,.58]){const mesh=new THREE.Mesh(wheelGeometry,wheelMaterial);mesh.position.set(0,.33,z);mesh.castShadow=true;root.add(mesh);wheels.push(mesh);}
 const cranks=[],pedals=[],crankGeometry=new THREE.CylinderGeometry(.013,.013,PLAYER_BIKE.crankR,7),pedalGeometry=new THREE.BoxGeometry(.13,.035,.10);
 for(let side=0;side<2;side++){
  const sign=side?1:-1,crank=new THREE.Group();crank.position.set(sign*PLAYER_BIKE.pedalX,PLAYER_BIKE.crankY,PLAYER_BIKE.crankZ);root.add(crank);
  const arm=new THREE.Mesh(crankGeometry,metal);arm.position.y=PLAYER_BIKE.crankR/2;arm.castShadow=true;crank.add(arm);
  const pedal=new THREE.Mesh(pedalGeometry,dark);pedal.position.y=PLAYER_BIKE.crankR;pedal.castShadow=true;crank.add(pedal);cranks.push(crank);pedals.push(pedal);
 }
 const axle=new THREE.Mesh(new THREE.CylinderGeometry(.027,.027,PLAYER_BIKE.pedalX*2,8).rotateZ(Math.PI/2),metal);axle.position.set(0,PLAYER_BIKE.crankY,PLAYER_BIKE.crankZ);root.add(axle);
 return {wheels,cranks,pedals,update(distance=0){
  const phase=distance*PLAYER_BIKE.crankPerMetre;
  for(const wheel of wheels)wheel.rotation.x=-distance/.352;
  for(let side=0;side<2;side++){const angle=phase+(side?Math.PI:0);cranks[side].rotation.x=angle;pedals[side].rotation.x=-angle;}
 }};
}
