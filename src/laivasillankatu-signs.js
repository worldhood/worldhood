import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {objectBehavior,solidBox} from './world-objects.js';

// Read from 2024 street-level reference photography.
// Camera position is NOT the sign position. This placement is constrained by the
// municipal roadway at local Z660; height/spacing/anchors remain estimates.
export const LAIVASILLANKATU_SIGN_REFERENCE = Object.freeze({
  capture: '2024-08',
  camera: {latitude:60.1640929, longitude:24.9531964, bearing:294.6, fov:37.5},
  position: {x:45,z:660,angle:.30},
  plate: ['Raitiovaunut','Spårvagnar'],
  accuracy:'Symbols and wording observed; placement, height and dimensions photo-estimated, not surveyed',
});
export const LAIVASILLANKATU_SIGN_FACES = Object.freeze([
  {x:-7,y:6.1,turn:'left'}, {x:-5.9,y:6.1,turn:'straight',tramPlate:true},
  {x:.3,y:6.05,turn:'straight'}, {x:4.5,y:6.1,turn:'straight'},
]);

export function createLaivasillankatuSigns({canvasFactory=()=>globalThis.document?.createElement('canvas')}={}){
  const group=new THREE.Group();group.name='Laivasillankatu observed four-circle suspended signs';
  const {position}=LAIVASILLANKATU_SIGN_REFERENCE;
  group.position.set(position.x,0,position.z);group.rotation.y=position.angle;
  const materials={metal:new THREE.MeshStandardMaterial({color:'#a0aaa6',metalness:.65,roughness:.5}),
    wire:new THREE.MeshStandardMaterial({color:'#475451',metalness:.4,roughness:.7}),
    blue:new THREE.MeshStandardMaterial({color:'#1555b2',roughness:.55}),
    white:new THREE.MeshStandardMaterial({color:'#f7f7f2',roughness:.65})};
  const batches=new Map();
  function add(g,m){if(g.index){const old=g;g=old.toNonIndexed();old.dispose();}g.deleteAttribute('uv');if(!batches.has(m))batches.set(m,[]);batches.get(m).push(g);}
  function beam(a,b,r,m='metal'){
    const p=new THREE.Vector3(...a),q=new THREE.Vector3(...b),v=q.clone().sub(p);
    const g=new THREE.CylinderGeometry(r,r,v.length(),6);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),v.normalize()));
    g.translate(...p.add(q).multiplyScalar(.5).toArray());add(g,m);
  }
  // East lattice support on the waterfront side; west cable terminates at a
  // façade anchor, not an invented post in the left-turn roadway.
  for(const dz of [-.13,.13])for(const dx of [-.13,.13])beam([14.5+dx,0,dz],[14.5+dx,9.2,dz],.028);
  for(let y=0;y<9;y+=.6)for(const dz of [-.13,.13]){
    beam([14.37,y,dz],[14.63,y+.6,dz],.016);beam([14.63,y,dz],[14.37,y+.6,dz],.016);
  }
  const cableY=x=>6.85-.27*4*((x+30)/44.5)*(1-(x+30)/44.5);
  for(const drop of [0,-.72])for(let x=-30;x<14.5;x+=1){const nx=Math.min(14.5,x+1);beam([x,cableY(x)+drop,0],[nx,cableY(nx)+drop,0],.012,'wire');}
  for(const s of LAIVASILLANKATU_SIGN_FACES){
    const back=new THREE.CylinderGeometry(.42,.42,.045,48);back.rotateX(Math.PI/2);back.translate(s.x,s.y,0);add(back,'metal');
    const rim=new THREE.CircleGeometry(.409,48);rim.translate(s.x,s.y,.024);add(rim,'white');
    const face=new THREE.CircleGeometry(.391,48);face.translate(s.x,s.y,.026);add(face,'blue');
    const arrow=new THREE.Shape();
    if(s.turn==='straight'){
      arrow.moveTo(-.06,-.29);arrow.lineTo(.06,-.29);arrow.lineTo(.06,.12);arrow.lineTo(.19,.12);arrow.lineTo(0,.32);arrow.lineTo(-.19,.12);arrow.lineTo(-.06,.12);
    }else{
      arrow.moveTo(.15,-.25);arrow.lineTo(.045,-.25);arrow.lineTo(.045,.025);arrow.quadraticCurveTo(.045,.085,-.02,.085);arrow.lineTo(-.08,.085);arrow.lineTo(-.08,-.015);arrow.lineTo(-.255,.135);arrow.lineTo(-.08,.285);arrow.lineTo(-.08,.185);arrow.lineTo(-.015,.185);arrow.quadraticCurveTo(.15,.185,.15,.025);
    }
    arrow.closePath();const g=new THREE.ShapeGeometry(arrow,12);g.translate(s.x,s.y,.028);add(g,'white');
    for(const dx of [-.14,.14])beam([s.x+dx,s.y-.34,-.035],[s.x+dx,cableY(s.x+dx),-.035],.012);
    if(s.tramPlate){
      const backing=new THREE.BoxGeometry(.91,.36,.035);backing.translate(s.x,s.y-.63,0);add(backing,'metal');
      const canvas=canvasFactory();let material=materials.blue;
      if(canvas){
        canvas.width=1024;canvas.height=400;const c=canvas.getContext('2d');
        c.fillStyle='#1555b2';c.fillRect(0,0,1024,400);c.strokeStyle='#f7f7f2';c.lineWidth=16;c.strokeRect(10,10,1004,380);
        c.fillStyle='#ffffff';c.font='600 130px Arial, sans-serif';c.textAlign='center';c.textBaseline='middle';
        LAIVASILLANKATU_SIGN_REFERENCE.plate.forEach((line,i)=>c.fillText(line,512,112+i*169,940));
        const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=4;
        material=new THREE.MeshStandardMaterial({map:texture,roughness:.65});
      }
      const panel=new THREE.Mesh(new THREE.PlaneGeometry(.89,.345),material);panel.position.set(s.x,s.y-.63,.019);panel.name='Raitiovaunut / Spårvagnar';group.add(panel);
    }
  }
  for(const [name,gs] of batches){const mesh=new THREE.Mesh(mergeGeometries(gs),materials[name]);mesh.castShadow=true;group.add(mesh);gs.forEach(g=>g.dispose());}
  // The mast is physical; the suspended faces and cables leave the road open.
  group.obstacles=[solidBox({id:'laivasillankatu-sign-mast',name:'Laivasillankatu sign lattice mast',x:position.x+14.5*Math.cos(position.angle),z:position.z-14.5*Math.sin(position.angle),width:.32,depth:.32,yaw:position.angle})];
  group.worldObjects=[...group.obstacles,...LAIVASILLANKATU_SIGN_FACES.map((s,i)=>objectBehavior({id:`laivasillankatu-suspended-sign-${i}`,minY:s.y-(s.tramPlate?.81:.42)},'overhead'))];
  group.userData={...LAIVASILLANKATU_SIGN_REFERENCE,count:4,turns:LAIVASILLANKATU_SIGN_FACES.map(s=>s.turn),collision:'solid mast only; suspended signs leave the roadway open'};
  return group;
}
