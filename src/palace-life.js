import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {WATERFRONT_FRONTAGES} from './kauppatori-buildings.js';

// Original stylised characters: a fictional cameo, not a reconstruction of an
// observed presidential appearance or an endorsement of this game.
export function createPalaceLife(){
 const group=new THREE.Group();group.name='Palace sentries and fictional balcony greeting';
 const materials=Object.fromEntries(Object.entries({skin:'#d4ac8e',suit:'#273d55',dress:'#34616a',uniform:'#4a5140',white:'#e6e2d8',shoe:'#1d2424',hair:'#a99b7a',grey:'#909087',gold:'#b9a76a',tie:'#6995ba'}).map(([key,color])=>[key,new THREE.MeshStandardMaterial({color,roughness:.8})]));
 const waves=[];
 function mesh(parent,geometry,material,x,y,z){const m=new THREE.Mesh(geometry,materials[material]);m.position.set(x,y,z);m.castShadow=true;parent.add(m);return m;}
 function ellipsoid(parent,x,y,z,sx,sy,sz,material){const g=new THREE.SphereGeometry(1,12,8);g.scale(sx,sy,sz);return mesh(parent,g,material,x,y,z);}
 function box(parent,x,y,z,w,h,d,material){return mesh(parent,new THREE.BoxGeometry(w,h,d),material,x,y,z);}
 function limb(parent,a,b,r,material){const delta=new THREE.Vector3(...b).sub(new THREE.Vector3(...a)),g=new THREE.CylinderGeometry(r*.8,r,delta.length(),8);g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),delta.clone().normalize()));return mesh(parent,g,material,...new THREE.Vector3(...a).add(new THREE.Vector3(...b)).multiplyScalar(.5).toArray());}
 function person({guard=false,woman=false,x,y,z,phase=0}){
  const body=new THREE.Group(),cloth=guard?'uniform':woman?'dress':'suit';body.position.set(x,y,z);group.add(body);
  for(const side of [-1,1]){limb(body,[side*.11,.12,0],[side*.11,.87,0],.075,cloth);ellipsoid(body,side*.11,.075,.08,.09,.07,.17,'shoe');}
  if(woman)mesh(body,new THREE.CylinderGeometry(.17,.28,.6,12),cloth,0,.78,0);
  ellipsoid(body,0,1.12,0,.235,.34,.14,cloth);
  box(body,0,1.29,.145,.15,.24,.018,'white');
  if(!woman)box(body,0,1.27,.163,.038,.27,.018,guard?'uniform':'tie');
  limb(body,[0,1.40,0],[0,1.51,0],.07,'skin');
  if(woman)ellipsoid(body,0,1.67,-.035,.15,.20,.135,'hair');
  ellipsoid(body,0,1.65,.02,.115,.16,.11,'skin');ellipsoid(body,0,1.65,.126,.025,.037,.035,'skin');
  ellipsoid(body,0,1.765,-.012,.117,.055,.107,guard?'shoe':woman?'hair':'grey');
  for(const side of [-1,1])ellipsoid(body,side*.044,1.686,.119,.012,.009,.007,'shoe');
  if(!guard&&!woman){for(const side of [-1,1]){const ring=new THREE.TorusGeometry(.041,.006,4,12);const m=mesh(body,ring,'shoe',side*.051,1.687,.125);m.scale.y=.65;}box(body,0,1.687,.126,.027,.006,.007,'shoe');}
  if(guard){
   mesh(body,new THREE.CylinderGeometry(.135,.14,.10,12),'uniform',0,1.83,0);box(body,0,1.789,.096,.25,.022,.16,'shoe');
   box(body,0,1.00,.142,.41,.07,.032,'white');box(body,0,1.00,.165,.065,.065,.02,'gold');
   for(const side of [-1,1]){box(body,side*.19,1.40,0,.11,.025,.13,'gold');limb(body,[side*.24,1.36,0],[side*.26,.90,.02],.059,cloth);ellipsoid(body,side*.26,.85,.02,.05,.07,.04,'white');}
  }else{
   limb(body,[-.22,1.37,0],[-.25,.92,.03],.06,cloth);ellipsoid(body,-.25,.88,.03,.05,.07,.045,'skin');
   const arm=new THREE.Group();arm.position.set(.22,1.36,0);body.add(arm);
   limb(arm,[0,0,0],[.17,.18,.02],.063,cloth);limb(arm,[.17,.18,.02],[.20,.43,.03],.05,cloth);
   const hand=ellipsoid(arm,.20,.49,.03,.05,.083,.026,'skin');waves.push({arm,hand,phase});
  }
  // Merge static body parts by material; articulated waving arms remain separate.
  body.updateMatrixWorld(true);const byMaterial=new Map();
  for(const child of [...body.children])if(child.isMesh){const g=child.geometry.clone().applyMatrix4(child.matrix);if(!byMaterial.has(child.material))byMaterial.set(child.material,[]);byMaterial.get(child.material).push(g);body.remove(child);child.geometry.dispose();}
  for(const [material,geometries] of byMaterial){const m=new THREE.Mesh(mergeGeometries(geometries),material);m.castShadow=true;body.add(m);geometries.forEach(g=>g.dispose());}
  return body;
 }
 for(const x of [-5,5])person({guard:true,x,y:.08,z:5.12});
 person({x:-.8,y:5.43,z:1.36});person({woman:true,x:.9,y:5.43,z:1.36,phase:1.4});
 const {s,d}=WATERFRONT_FRONTAGES[23],angle=.052;
 group.position.set(Math.cos(angle)*s+Math.sin(angle)*d,0,-Math.sin(angle)*s+Math.cos(angle)*d);group.rotation.y=angle;
 group.userData={guards:2,balconyFigures:2,fictional:true,names:['Alexander Stubb','Suzanne Innes-Stubb'],note:'Stylised fictional greeting; no endorsement or real-time presence implied'};
 return {group,update(time,car){group.visible=!!car&&Math.hypot(car.x-group.position.x,car.z-group.position.z)<350;for(const w of waves){w.arm.rotation.z=Math.sin(time*2.8+w.phase)*.15;w.hand.rotation.z=Math.sin(time*4+w.phase)*.22;}}};
}
