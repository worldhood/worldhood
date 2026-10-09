import * as THREE from 'three';
import {architectureBuilder} from './cathedral.js';
import {bounds} from './geo.js';

// HAM: https://www.hamhelsinki.fi/veistos/lyhdynkantajat/
// Museum's west-pair map point: 60.170696, 24.941246.
// Register both pairs to the projecting entrance piers in RATU 324's measured
// footprint. The east-facing Rautatientori side is NOT their location.
export const LANTERN_PAIRS=[{x:-608.75,z:-67.6},{x:-578.7,z:-69.2}];
export function createStationStatues(){
 const b=architectureBuilder(),stone=new THREE.MeshStandardMaterial({color:'#987f70',roughness:.93}),recess=new THREE.MeshStandardMaterial({color:'#64564e',roughness:1}),copper=new THREE.MeshStandardMaterial({color:'#40635b',roughness:.6,metalness:.5}),glass=new THREE.MeshStandardMaterial({color:'#ecf1e1',emissive:'#dce9ce',emissiveIntensity:.35,roughness:.4});
 stone.onBeforeCompile=s=>{s.vertexShader='varying vec3 vStone;\n'+s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvStone=position;');s.fragmentShader='varying vec3 vStone;\n'+s.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
 float fp=max(length(dFdx(vStone)),length(dFdy(vStone)));
 float grain=fract(sin(dot(floor(vStone*37.),vec3(12.98,78.23,44.7)))*43758.54);
 diffuseColor.rgb*=1.+(grain-.5)*.20*(1.-smoothstep(.02,.1,fp));`);};
 function ellipsoid(x,y,z,rx,ry,rz,m=stone){const g=new THREE.SphereGeometry(1,20,14);g.scale(rx,ry,rz);b.add(g,m,x,y,z);}
 function beam(a,c,r,m=stone){const av=new THREE.Vector3(...a),v=new THREE.Vector3(...c).sub(av),g=new THREE.CylinderGeometry(r,r,v.length(),10);g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),v.clone().normalize()));g.translate(...av.addScaledVector(v,.5).toArray());b.add(g,m);}
 const obstacles=[];
 for(const p of LANTERN_PAIRS){
  const ring=[[p.x-1.65,p.z-.7],[p.x+1.65,p.z-.7],[p.x+1.65,p.z+1.65],[p.x-1.65,p.z+1.65]];obstacles.push({name:'Lyhdynkantajat stone pedestal',rings:[ring],bbox:bounds([ring])});
  b.box(3.4,.34,1.75,stone,p.x,.22,p.z+.08);
  for(const side of [-1,1]){
   const x=p.x+side*.80,z=p.z-side*.042;
   b.box(1.45,4.15,1.2,stone,x,2.26,z);b.box(1.57,.22,1.34,stone,x,4.32,z);
   // Column-like lower body, muscular bust and bent arms supporting a globe.
   for(const dx of [-.49,-.25,0,.25,.49])b.box(.035,3.5,.026,recess,x+dx,2.38,z+.606);
   for(const y of [1.05,2.12,3.2])b.box(1.45,.025,.025,recess,x,y,z+.607);
   ellipsoid(x,5.18,z,.77,.99,.53);ellipsoid(x,5.9,z,.28,.4,.30);
   ellipsoid(x,6.62,z+.03,.47,.70,.39);
   // Strong brow, angular nose, recessed eyes, lips and jaw. Hair falls in
   // two stone wedges beside the face, rather than a generic bald sphere.
   for(const side of [-1,1]){
    ellipsoid(x+side*.42,6.58,z-.05,.16,.58,.35);
    b.box(.28,.085,.06,recess,x+side*.19,6.73,z+.363);
    const brow=new THREE.BoxGeometry(.30,.13,.15);brow.rotateZ(side*.12);b.add(brow,stone,x+side*.19,6.86,z+.37);
    ellipsoid(x+side*.20,6.48,z+.30,.23,.23,.13);
    ellipsoid(x+side*.76,5.30,z+.02,.29,.48,.30);
    beam([x+side*.79,5.08,z+.15],[x+side*.64,4.62,z+.55],.24);
    beam([x+side*.64,4.62,z+.55],[x+side*.45,4.99,z+1.05],.22);
    ellipsoid(x+side*.47,4.99,z+1.06,.20,.30,.17);
    for(let finger=0;finger<4;finger++)beam([x+side*.39,4.83+finger*.095,z+1.19],[x+side*.54,4.86+finger*.095,z+1.13],.035);
   }
   const nose=new THREE.ConeGeometry(.14,.43,4);nose.rotateX(.2);b.add(nose,stone,x,6.61,z+.47);
   b.box(.23,.035,.05,recess,x,6.31,z+.373);ellipsoid(x,6.21,z+.25,.24,.18,.20);
   // Faceted milk-glass globes with a green metal lattice, as in HAM's photo.
   const gy=5.17,gz=z+1.13,r=.62,globe=new THREE.SphereGeometry(r,10,6);b.add(globe,glass,x,gy,gz);
   for(let k=0;k<10;k++){
    const a=k*Math.PI*2/10;for(let j=0;j<6;j++){const t1=j*Math.PI/6,t2=(j+1)*Math.PI/6;beam([x+r*Math.sin(t1)*Math.cos(a),gy+r*Math.cos(t1),gz+r*Math.sin(t1)*Math.sin(a)],[x+r*Math.sin(t2)*Math.cos(a),gy+r*Math.cos(t2),gz+r*Math.sin(t2)*Math.sin(a)],.018,copper);}
   }
   for(const t of [Math.PI/3,Math.PI/2,Math.PI*2/3]){const ring=new THREE.TorusGeometry(r*Math.sin(t),.02,5,10);ring.rotateX(Math.PI/2);b.add(ring,copper,x,gy+r*Math.cos(t),gz);}
  }
 }
 const group=b.finish();group.name='Four Lyhdynkantajat at Kaivokatu main entrance';group.userData={figures:4,pairs:LANTERN_PAIRS,source:'HAM + municipal RATU 324 entrance piers',accuracy:'Original photo-guided sculptural approximation; not a scan. Heights and facial proportions interpreted.'};
 return {group,obstacles};
}
