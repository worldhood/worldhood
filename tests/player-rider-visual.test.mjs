import test from 'node:test';
import assert from 'node:assert/strict';
import {Group,Vector3} from 'three';
import {addBicycleMotion,PLAYER_BIKE,PLAYER_SCOOTER} from '../src/player-ride-models.js';
import {posePerson,createJoints,JOINT,personLook} from '../src/person-model.js';

const look=personLook(2026,{height:1.75,coat:0,skirt:false,phoneWalk:false,stoop:0,accessory:null}),gait={gaitWalk:0,gaitRun:0,gaitPhase:0};
const point=(j,index)=>new Vector3(j[index],j[index+1],j[index+2]);
const segmentDistance=(p,a,b)=>{const d=b.clone().sub(a),t=Math.max(0,Math.min(1,p.clone().sub(a).dot(d)/d.lengthSq()));return a.clone().addScaledVector(d,t).distanceTo(p);};

test('bicycle feet stay on the animated pedals throughout a full revolution and wheels turn with distance',()=>{
 const root=new Group(),motion=addBicycleMotion(root),j=createJoints(),pedal=new Vector3();
 for(let i=0;i<=32;i++){
  const distance=i/32*Math.PI*2/PLAYER_BIKE.crankPerMetre;motion.update(distance);root.updateMatrixWorld(true);
  posePerson({pose:'cycle',grip:true,speed:5,bike:{...PLAYER_BIKE,crank:distance*PLAYER_BIKE.crankPerMetre}},look,gait,j);
  assert.ok(j.every(Number.isFinite));
  for(let side=0;side<2;side++){
   motion.pedals[side].getWorldPosition(pedal);const heel=point(j,JOINT.heelL+side*3),toe=point(j,JOINT.toeL+side*3),ball=heel.lerp(toe,.68);
   assert.ok(Math.abs(ball.x-pedal.x)<.065,'foot supported across the pedal width');
   assert.ok(Math.abs(ball.z-pedal.z)<.008,'ball of foot over pedal');
   assert.ok(Math.abs(ball.y-.036-(pedal.y+PLAYER_BIKE.pedalTop))<.008,'sole rests on pedal platform');
   assert.ok(Math.abs(motion.pedals[side].getWorldQuaternion(root.quaternion.clone()).x)<1e-8,'pedal platform remains level');
  }
  assert.equal(motion.wheels[0].rotation.x,-distance/.352);
 }
});

test('scooter feet are staggered entirely on the narrow deck and stay planted at speed',()=>{
 const j=createJoints();
 for(const speed of [0,3,6.94]){
  posePerson({pose:'scooter',grip:true,speed,scooter:PLAYER_SCOOTER},look,{gaitWalk:1,gaitRun:1,gaitPhase:speed},j);
  assert.ok(j.every(Number.isFinite));
  for(const side of [0,3])for(const joint of [JOINT.heelL,JOINT.toeL]){
   const p=point(j,joint+side);assert.ok(Math.abs(p.x)+.046<.086,'shoe fits within the 17 cm deck');assert.ok(p.z>-.30&&p.z<.26,'shoe stays over the deck length');
   assert.ok(Math.abs(p.y-.036+PLAYER_SCOOTER.groundY-(.12+.198))<.003,'shoe sole rests on the deck surface');
  }
  assert.ok(Math.abs(j[JOINT.ankleL+2]-j[JOINT.ankleR+2])>.2,'feet are one behind the other');
 }
});

test('player palms wrap around both handlebar grips instead of hanging past the bars',()=>{
 for(const pose of ['cycle','scooter']){
  const anchors=pose==='cycle'?PLAYER_BIKE:PLAYER_SCOOTER,j=createJoints();
  posePerson({pose,grip:true,speed:4,bike:{...PLAYER_BIKE,crank:.8},scooter:PLAYER_SCOOTER},look,gait,j);
  for(let side=0;side<2;side++){
   const grip=new Vector3((side?1:-1)*anchors.barX,anchors.barY,anchors.barZ),wrist=point(j,JOINT.wristL+side*3),fingers=point(j,JOINT.handL+side*3);
   assert.ok(segmentDistance(grip,wrist,fingers)<.006,'grip passes through the hand');assert.ok(fingers.distanceTo(grip)<.035,'fingers curl just past grip');assert.ok(wrist.distanceTo(grip)<.075);
  }
 }
});
