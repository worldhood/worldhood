import * as THREE from 'three';
import {createPersonBatch,advanceGait,personLook} from './person-model.js';
import {groundAt} from './terrain.js';
import {registerEnvMaterial,unregisterEnvMaterial} from './environment.js';

// After the player properly hits a car (not a slow shove), its driver opens the
// driver's door (front left, Finland), climbs out, turns to face the player and shakes
// a hand over their head, the other arm out in a "what are you doing" gesture. Purely cosmetic: no
// collision, no text: body language only. The driver gets back in after a while.
export const ANGRY={delay:.7,door:.45,climb:.9,stay:9,back:.8,close:.4,max:3};
const SEAT_FORWARD=.25,INSIDE=.45,OUTSIDE=1.5,GROUND=.13,DOOR_OPEN=1.1;
// Generic proportions when the renderer cannot tell us the model (tests, unknown actors).
const FALLBACK={spec:{l:4.4,w:1.8,h:1.5,belt:.95},paint:new THREE.Color('#9aa0a0')};
const ease=v=>{v=Math.min(1,Math.max(0,v));return v*v*(3-2*v);};
// The opening door: a hinged painted panel with its window, plus a dark recess
// over the car's own (closed) door so the opening reads as a hole into the cabin.
const glassMaterial=new THREE.MeshStandardMaterial({color:'#1b252b',roughness:.1,metalness:.6}),recessMaterial=new THREE.MeshStandardMaterial({color:'#15191b',roughness:.9});
export function createDoor(vehicle){
 const {spec:s,paint}=vehicle,L=s.l/2,W=s.w/2,front=-L+.93,rear=.2,len=rear-front,low=.3,belt=s.belt,top=s.h-.1;
 const root=new THREE.Group(),hinge=new THREE.Group(),paintMaterial=vehicle.material?registerEnvMaterial(vehicle.material.clone()):new THREE.MeshStandardMaterial({color:paint,roughness:.35,metalness:.3}); // same clearcoat/reflections as the body
 hinge.position.set(-W-.005,0,front);root.add(hinge);
 const panel=new THREE.Mesh(new THREE.BoxGeometry(.06,belt-low,len),paintMaterial);panel.position.set(-.03,(belt+low)/2,len/2);
 const glass=new THREE.Mesh(new THREE.BoxGeometry(.03,top-belt,len*.86),glassMaterial);glass.position.set(-.02,(belt+top)/2,len*.53);
 const frame=new THREE.Mesh(new THREE.BoxGeometry(.04,.05,len*.9),paintMaterial);frame.position.set(-.02,top,len*.5);
 hinge.add(panel,glass,frame);
 const recess=new THREE.Mesh(new THREE.BoxGeometry(.04,top-low-.04,len-.06),recessMaterial);recess.position.set(-W+.01,(top+low)/2,(front+rear)/2);root.add(recess);
 for(const m of [panel,glass,frame])m.castShadow=true;
 return {root,hinge,recess,dispose(){unregisterEnvMaterial(paintMaterial);paintMaterial.dispose();for(const m of [panel,glass,frame,recess])m.geometry.dispose();}};
}
export function createAngryDrivers({vehicleOf=null}={}){
 const group=new THREE.Group();group.name='Angry drivers';
 const batch=createPersonBatch(ANGRY.max,{name:'Angry drivers'});group.add(batch.group);
 const drivers=[];let count=0;
 // Called when the player's car really hits `car` (an NPC from mobility).
 function trigger(car,time){
  const old=drivers.find(d=>d.car===car);if(old){old.angry=Math.max(old.angry,time);return old;} // hit again: stays out longer
  if(drivers.length>=ANGRY.max)remove(drivers.reduce((a,b)=>a.hit<b.hit?a:b));
  const seed=count++,d={car,hit:time,angry:time,start:null,look:personLook(car.id*31+seed*7),gait:{},actor:{x:car.x,z:car.z,heading:car.heading,speed:0,pose:'wave',groundY:GROUND},seed};
  drivers.push(d);return d;
 }
 function remove(d){drivers.splice(drivers.indexOf(d),1);if(d.door){group.remove(d.door.root);d.door.dispose();}}
 function update(dt,time,player){
  batch.begin(player);
  for(const d of [...drivers]){
   const k=d.car.knocked;
   // Recycled or claimed cars no longer own this old roadside animation.
   if(!k||d.car.playerTaken||d.car.edge===null){remove(d);continue;}
   // Climb out once the car has stopped (or shortly after the hit if it keeps creeping).
   if(d.start===null){if(k.rest===null&&time-d.hit<ANGRY.delay+1.5)continue;if(time-d.hit<ANGRY.delay)continue;
    const h=d.car.heading,lx=-Math.cos(h),lz=Math.sin(h),fx=-Math.sin(h),fz=-Math.cos(h);
    d.start=time;d.seat={x:d.car.x+fx*SEAT_FORWARD,z:d.car.z+fz*SEAT_FORWARD,lx,lz,out:Math.atan2(-lx,-lz)};
    d.door=createDoor(vehicleOf?.(d.car)||FALLBACK);d.door.root.position.set(d.car.x,.12+groundAt(d.car.x,d.car.z),d.car.z);d.door.root.rotation.y=h;group.add(d.door.root);}
   // Timeline: door swings open, driver climbs out, gestures; later climbs back in and pulls the door shut.
   const t=time-d.start,leave=Math.max(d.angry-d.hit,0)+ANGRY.stay+ANGRY.door+ANGRY.climb,back=t>leave?(t-leave)/ANGRY.back:0;
   if(back>=1+ANGRY.close/ANGRY.back){remove(d);continue;}
   const open=back>1?1-ease((back-1)*ANGRY.back/ANGRY.close):ease(t/ANGRY.door);
   d.door.hinge.rotation.y=-DOOR_OPEN*open*(1-.04*Math.sin(Math.min(1,t/ANGRY.door)*Math.PI*3)*(1-Math.min(1,t/ANGRY.door)));d.door.recess.visible=open>.02;
   const e=ease((t-ANGRY.door*.6)/ANGRY.climb)*(1-ease(back)),r=INSIDE+(OUTSIDE-INSIDE)*e,a=d.actor;
   if(back>=1){continue;} // back in the seat, door closing
   const px=a.x,pz=a.z;a.x=d.seat.x+d.seat.lx*r;a.z=d.seat.z+d.seat.lz*r;a.speed=dt>0?Math.min(1.4,Math.hypot(a.x-px,a.z-pz)/dt*1.5):0;
   // Sits low in the seat, ducks under the roof line and stands up as they step out.
   a.groundY=GROUND-.75*(1-e);
   // Swing the legs out first (face the door), then turn to the player once standing.
   const want=e<.75?d.seat.out:Math.atan2(-(player.x-a.x),-(player.z-a.z));let dh=want-a.heading;dh=Math.atan2(Math.sin(dh),Math.cos(dh));a.heading+=dh*Math.min(1,dt*(e<.75?10:6));
   a.pose=e>.8&&back===0?'wave':'chat';
   advanceGait(a,d.gait,dt,d.look);batch.draw(a,d.look,d.gait,time);
  }
  batch.end();group.visible=drivers.length>0;
 }
 return {group,trigger,update,snapshot:()=>drivers.map(d=>({x:d.actor.x,z:d.actor.z,out:d.start!==null,pose:d.actor.pose,door:d.door?+(-d.door.hinge.rotation.y/DOOR_OPEN).toFixed(2):0}))};
}
