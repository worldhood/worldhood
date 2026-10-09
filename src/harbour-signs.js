import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

// Observed in August 2024 street-level photography looking north. These are three circular mandatory-turn signs,
// NOT motorway direction boards. Locations/heights are photo-guided estimates
// against the municipal junction plan, not survey measurements.
export const OVERHEAD_TURN_SIGNS=[
 {x:7.8,z:270,y:5.9,turn:'left'},
 {x:12.4,z:270,y:5.85,turn:'right'},
 {x:18.7,z:270,y:5.85,turn:'right'},
];
export const SIGN_SUPPORTS=[{x:-3,z:270},{x:33,z:270}];

export function createHarbourSigns(){
 const group=new THREE.Group();group.name='Eteläranta photo-guided suspended turn signs';
 const materials={metal:new THREE.MeshStandardMaterial({color:'#8f9995',metalness:.65,roughness:.5}),wire:new THREE.MeshStandardMaterial({color:'#424e4c',metalness:.5,roughness:.7}),blue:new THREE.MeshStandardMaterial({color:'#1657aa',roughness:.5}),white:new THREE.MeshStandardMaterial({color:'#f0f1e9',roughness:.65})};
 const parts=new Map();
 function add(g,m){if(g.index)g=g.toNonIndexed();g.deleteAttribute('uv');if(!parts.has(m))parts.set(m,[]);parts.get(m).push(g);}
 function beam(a,b,r,m='metal'){
  const start=new THREE.Vector3(...a),end=new THREE.Vector3(...b),v=end.clone().sub(start);
  const g=new THREE.CylinderGeometry(r,r,v.length(),8);g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),v.normalize()));g.translate(...start.add(end).multiplyScalar(.5).toArray());add(g,m);
 }
 // Match the cable-supported arrangement; no gantry or sign posts in lanes.
 // End supports sit on the two mapped pedestrian areas outside the road.
 for(const p of SIGN_SUPPORTS)beam([p.x,.1,p.z],[p.x,7.2,p.z],.065);
 function cableY(x){const t=(x+3)/36;return 6.8-.40*4*t*(1-t);}
 for(const lower of [0,-.48])for(let i=0;i<36;i++)beam([-3+i,cableY(-3+i)+lower,270],[-2+i,cableY(-2+i)+lower,270],.012,'wire');
 for(const s of OVERHEAD_TURN_SIGNS){
  // Aluminium back and raised circular rim; only the south-facing side has
  // the white arrow. Looking from behind must not show a mirrored arrow.
  const back=new THREE.CylinderGeometry(.39,.39,.05,48);back.rotateX(Math.PI/2);back.translate(s.x,s.y,s.z);add(back,'metal');
  const face=new THREE.CircleGeometry(.375,48);face.translate(s.x,s.y,s.z+.026);add(face,'blue');
  const rim=new THREE.TorusGeometry(.381,.009,6,48);rim.translate(s.x,s.y,s.z+.027);add(rim,'metal');
  // Original vector outline: short upright stem, smooth 90° elbow and
  // triangular horizontal arrowhead, following the photographed symbol.
  const arrow=new THREE.Shape();arrow.moveTo(-.14,-.25);arrow.lineTo(-.04,-.25);arrow.lineTo(-.04,.025);arrow.quadraticCurveTo(-.04,.085,.02,.085);arrow.lineTo(.08,.085);arrow.lineTo(.08,-.015);arrow.lineTo(.255,.135);arrow.lineTo(.08,.285);arrow.lineTo(.08,.185);arrow.lineTo(.015,.185);arrow.quadraticCurveTo(-.14,.185,-.14,.025);arrow.closePath();
  const arrowGeo=new THREE.ExtrudeGeometry(arrow,{depth:.003,bevelEnabled:false,curveSegments:10});if(s.turn==='left')arrowGeo.rotateY(Math.PI);arrowGeo.translate(s.x,s.y,s.z+.033);add(arrowGeo,'white');
  for(const dx of [-.14,.14]){
   beam([s.x+dx,s.y+.24,s.z-.035],[s.x+dx,cableY(s.x+dx),s.z-.035],.014);
   beam([s.x+dx-.06,s.y+.23,s.z-.035],[s.x+dx+.06,s.y+.23,s.z-.035],.02);
  }
 }
 for(const [m,gs] of parts){const mesh=new THREE.Mesh(mergeGeometries(gs),materials[m]);mesh.castShadow=true;group.add(mesh);gs.forEach(g=>g.dispose());}
 group.userData={count:3,turns:OVERHEAD_TURN_SIGNS.map(s=>s.turn),capture:'2024-08',accuracy:'Photo-guided; sign identity/order observed, height and anchors estimated'};
 return group;
}
