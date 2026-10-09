import * as THREE from 'three';
import {bicycleGeometry,scooterGeometry} from './parked-micromobility.js';
import {createPersonBatch,personLook,advanceGait} from './person-model.js';
import {addBicycleMotion,PLAYER_BIKE,PLAYER_SCOOTER} from './player-ride-models.js';
import {groundAt} from './terrain.js';

export function createPlayerTravelRenderer(scene){
 const group=new THREE.Group();group.name='Player and rideable vehicles';scene.add(group);
 const person=createPersonBatch(1,{name:'Player'});group.add(person.group);
 const look=personLook(2026,{height:1.75,coat:0,skirt:false,shirt:'#d65f39',trousers:'#273b4a',age:'adult',accessory:null,phoneWalk:false,stoop:0,outer:'jacket',scarf:null,hairStyle:'short',bagType:'backpack'}),gait={};
 const models=new Map(),ringMaterial=new THREE.MeshBasicMaterial({color:'#eeaa55',transparent:true,opacity:.7,depthWrite:false,side:THREE.DoubleSide});
 for(const [id,geometry,color] of [['bike',bicycleGeometry({animated:true}),'#edb844'],['scooter',scooterGeometry(),'#399d91']]){
  const paint=geometry.getAttribute('paint'),colors=geometry.getAttribute('color'),tint=new THREE.Color(color);
  for(let i=0;i<paint.count;i++)if(paint.getX(i)>0)colors.setXYZ(i,tint.r,tint.g,tint.b);
  const root=new THREE.Group(),mesh=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({vertexColors:true,roughness:.55,metalness:.25}));mesh.castShadow=true;root.add(mesh);group.add(root);
  const ring=new THREE.Mesh(new THREE.RingGeometry(.7,.75,32),ringMaterial);ring.rotation.x=-Math.PI/2;ring.position.y=.02;root.add(ring);
  const canvas=document.createElement('canvas');canvas.width=256;canvas.height=64;const ctx=canvas.getContext('2d');ctx.fillStyle='#213831e8';ctx.fillRect(0,0,256,64);ctx.fillStyle='#fff6df';ctx.font='600 28px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(id==='bike'?'BICYCLE':'SCOOTER',128,32);
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
  const label=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,depthWrite:false}));label.position.y=1.6;label.scale.set(1.6,.4,1);root.add(label);
  models.set(id,{root,ring,label,motion:id==='bike'?addBicycleMotion(root):null});
 }
 return {group,look,update(travel,dt,{visible=true,actorVisible=true}={}){
  group.visible=visible;if(!travel)return;
  const p=travel.viewActor();
  for(const [id,{root,ring,label,motion}] of models){
   const ride=travel.rides.find(r=>r.id===id);root.visible=!!ride&&Math.hypot(ride.x-p.x,ride.z-p.z)<220;if(!root.visible)continue;
   root.position.set(ride.x,.12+groundAt(ride.x,ride.z),ride.z);root.rotation.y=ride.heading;
   const f=ride.fallen;if(f)f.elapsed=Math.min(1,(f.elapsed||0)+dt*3);root.rotation.z=f?f.side*(Math.PI/2-.12)*f.elapsed*f.elapsed:0; // tipped onto its side after a crash
   motion?.update(ride.distance||0);
   label.visible=false;
   ring.visible=actorVisible&&travel.mode==='walk'&&travel.riding!==ride&&Math.hypot(ride.x-p.x,ride.z-p.z)<3.2;
  }
  person.begin();
  if(actorVisible&&travel.mode!=='car'){
   const pose=travel.mode==='walk'?'walk':travel.mode==='bike'?'cycle':'scooter';
   const actor={...p,speed:Math.abs(p.speed),pose,groundY:pose==='scooter'?PLAYER_SCOOTER.groundY:.12,running:Math.abs(p.speed)>2.5,grip:true,
    bike:{...PLAYER_BIKE,crank:p.distance*PLAYER_BIKE.crankPerMetre},scooter:PLAYER_SCOOTER};
   advanceGait(actor,gait,dt,look);person.draw(actor,look,gait);
  }
  person.end();
 }};
}

export function travelCameraPose(actor,heading,zoom=150,look=0,buildings=null){
 let distance=2.7+Math.max(36,Math.min(240,zoom))/90;
 for(let d=.4;buildings&&d<=distance;d+=.2){if(buildings.at(actor.x+Math.sin(heading)*d,actor.z+Math.cos(heading)*d)){distance=Math.max(.35,d-.3);break;}}
 const y=groundAt(actor.x,actor.z),px=actor.x+Math.sin(heading)*distance,pz=actor.z+Math.cos(heading)*distance;
 return {position:[px,Math.max(y,groundAt(px,pz))+2.5,pz],target:[actor.x-Math.sin(heading+look)*2,y+1.2,actor.z-Math.cos(heading+look)*2]};
}
