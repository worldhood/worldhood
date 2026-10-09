import test from 'node:test';
import assert from 'node:assert/strict';
import {ImpactSystem} from '../src/impacts.js';
import {fallAmount,applyImpactPose} from '../src/impact-pose.js';
import {createVehicleDamage} from '../src/vehicle-damage.js';
import {createVehicle} from '../src/vehicles.js';
import * as THREE from 'three';
import {sweptContact,trafficFootprintsOverlap,leavingBody,nudgeOut} from '../src/contact-geometry.js';
import {makeCar,driveStep} from '../src/physics.js';
test('reverse escapes overlapping pedestrians and cyclists without another incident',()=>{
 for(const kind of ['pedestrian','cyclist'])for(const heading of [0,.8,Math.PI]){
  const car=makeCar(0,0,heading),actor={id:1,x:-Math.sin(heading)*2.5,z:-Math.cos(heading)*2.5,heading,edge:{}},sim=new ImpactSystem(),reports=[];
  const world={roads:{at:()=>true},pavement:{at:()=>true},buildings:{at:()=>false},water:[]};
  for(let i=0;i<60;i++){const from={...car};driveStep(car,new Set(['KeyS']),1/60,world);sim.collide(from,car,kind==='pedestrian'?[actor]:[],kind==='cyclist'?[actor]:[],[],{report:(...r)=>reports.push(r)});}
  assert.ok(car.speed< -2);assert.ok(Math.hypot(car.x,car.z)>1);assert.equal(actor.knockdown,undefined);assert.equal(car.damage,undefined);assert.equal(reports.length,0);
 }
});
test('existing car contact can retreat, including opposite-facing traffic',()=>{
 for(const heading of [0,Math.PI]){
  const actor={id:2,x:0,z:0,heading,edge:{},speed:0},from={x:0,z:4.6,heading:0,speed:-2},car={...from,z:4.7};
  new ImpactSystem().collide(from,car,[],[],[actor]);assert.equal(car.z,4.7);assert.equal(car.speed,-2);assert.equal(car.damage,undefined);
 }
 const actor={x:0,z:0,heading:0};
 assert.equal(sweptContact({x:1.9,z:0,heading:0},{x:2,z:0,heading:0},actor),false);
 assert.equal(sweptContact({x:1.9,z:0,heading:0},{x:1.8,z:0,heading:0},actor),true);
 assert.equal(sweptContact({x:1.9,z:0,heading:0},{x:1.95,z:0,heading:.3},actor),true,'rotation must not swing a corner into traffic');
});
test('slow forward contact remains solid; retreat cannot pass through an actor',()=>{
 const actor={id:1,x:0,z:-2.6,heading:0,edge:{}},from={x:0,z:0,heading:0,speed:0},car={...from,z:-.01,speed:.2};
 new ImpactSystem().collide(from,car,[actor],[],[]);assert.equal(car.z,0);assert.equal(car.speed,0);assert.equal(actor.knockdown,undefined);
 assert.equal(sweptContact(from,{...from,z:-6},actor,true),true);
 // Retreat into a different person is still blocked by that person's footprint.
 const reverse={...from,z:.2,speed:-2};new ImpactSystem().collide(from,reverse,[actor,{...actor,id:2,z:2.7}],[],[]);assert.equal(reverse.z,0);
});
test('a fast hit throws the person, the car drives on a little slower, one report, then they lie still, get up and walk back',()=>{
 for(const kind of ['pedestrian','cyclist']){
  const sim=new ImpactSystem(),from={x:0,z:5,speed:20,heading:0},car={...from,z:-5},a={id:1,x:0,z:0,heading:0,speed:1,edge:{}},reports=[];
  sim.collide(from,car,kind==='pedestrian'?[a]:[],kind==='cyclist'?[a]:[],[],{report:(...args)=>reports.push(args)});
  assert.ok(car.speed>18&&car.speed<20,`car keeps ${car.speed}`);assert.equal(car.z,-5);assert.ok(a.knockdown);assert.equal(a.knockdown.level,'thrown');
  assert.equal(reports.length,1);assert.equal(reports[0][2],12,'a throw is reported as the most serious hit');assert.ok(car.damage>0);
  sim.step(.6);assert.ok(fallAmount(a)>.3,'tumbling');assert.ok(a.knockdown.body.z<-3,'thrown ahead of the car');
  const damage=car.damage;sim.collide(from,car,[a],[],[],{report:(...args)=>reports.push(args)});assert.equal(reports.length,1);assert.equal(car.damage,damage);
  let t=.6,rest=null,rise=null,gone=null;
  while(t<40&&a.knockdown){sim.step(1/30);t+=1/30;if(a.knockdown?.phase==='rest'&&rest===null)rest=t;if(a.knockdown?.phase==='rise'&&rise===null)rise=t;}
  gone=t;assert.ok(rest!==null&&rest<4,`lands and lies still after ${rest}s`);assert.ok(rise-rest>7,'a hard hit keeps them down a good while');
  assert.ok(gone<40,'gets up and walks back');assert.equal(a.knockdown,undefined);
  assert.ok(a.impactCooldown>sim.time);sim.reset();assert.equal(a.impactCooldown,undefined);
 }
});
test('near misses and stationary contact do not knock people down',()=>{
 const sim=new ImpactSystem(),from={x:0,z:5,speed:20,heading:0},p={id:1,x:4,z:0,heading:0,edge:{}};
 sim.collide(from,{...from,z:-5},[p],[],[]);assert.equal(p.knockdown,undefined);
 sim.collide({...from,speed:0},{...from,speed:0},[{...p,x:0,z:5}],[],[]);assert.equal(sim.events,0);
});
test('vehicle hits damage the car once per sustained contact and reset clears fallen actors',()=>{
 const sim=new ImpactSystem(),from={x:0,z:7,speed:12,heading:0},car={...from,z:1},other={id:2,x:0,z:0,heading:0,speed:3,edge:{}};
 sim.collide(from,car,[],[],[other]);assert.equal(car.speed,0);assert.ok(car.damage>0);assert.equal(other.speed,0);
 const d=car.damage;sim.collide(from,car,[],[],[other]);assert.equal(car.damage,d);
 sim.damage(car,1,'building');assert.equal(car.damage,d);
 const person={knockdown:{elapsed:1,duration:7}};sim.actors.add(person);sim.reset();assert.equal(person.knockdown,undefined);
});
test('fall transforms lie sideways; car dents are finite, isolated, and repairable',()=>{
 const m=new THREE.InstancedMesh(new THREE.BoxGeometry(),new THREE.MeshBasicMaterial(),1),matrix=new THREE.Matrix4().makeTranslation(0,1,0);m.setMatrixAt(0,matrix);
 applyImpactPose(m,0,{x:0,z:0,heading:0,knockdown:{elapsed:1,duration:7,side:1}});m.getMatrixAt(0,matrix);assert.ok(new THREE.Vector3(0,1,0).transformDirection(matrix).y<.01);
 const car=createVehicle(1,false,'estate'),other=createVehicle(1,false,'estate'),before=car.getObjectByName('paint').geometry.attributes.position.array.slice(),damage=createVehicleDamage(car);
 damage.update({damageVersion:1,damage:.4,damageZones:{front:.8,rear:0,left:0,right:0}});
 assert.notDeepEqual(car.getObjectByName('paint').geometry.attributes.position.array,before);
 assert.deepEqual(other.getObjectByName('paint').geometry.attributes.position.array,before);
 assert.ok(car.getObjectByName('paint').geometry.attributes.position.array.every(Number.isFinite));
 damage.update({});assert.deepEqual(car.getObjectByName('paint').geometry.attributes.position.array,before);
});
test('every overlapping car pose has at least one input that moves the car, and tunnelling stays blocked',()=>{
 let total=0;
 for(let ang=0;ang<Math.PI*2;ang+=Math.PI/12)for(let r=2.2;r<=4.6;r+=.6)for(let h=0;h<Math.PI*2;h+=Math.PI/8){
  const actor={x:Math.cos(ang)*r,z:Math.sin(ang)*r,heading:h},from={x:0,z:0,heading:0};
  if(!trafficFootprintsOverlap(from,actor))continue;total++;
  const moves=[];for(const speed of [-2,2])for(const steer of [-1,0,1]){const heading=steer*speed/2.8*.43/60;moves.push({x:-Math.sin(heading)*speed/60,z:-Math.cos(heading)*speed/60,heading});}
  assert.ok(moves.some(to=>!sweptContact(from,to,actor)),`trapped at ${ang.toFixed(2)} ${r} ${h.toFixed(2)}`);
  // Driving straight through the other car is still a contact.
  assert.equal(sweptContact(from,{x:actor.x*2,z:actor.z*2,heading:0},actor),true);
 }
 assert.ok(total>1000);
});
test('a player wedged against a bus keeps speed only while moving out of it',()=>{
 const bus={x:0,z:0,heading:0};
 assert.equal(leavingBody({x:1.5,z:0,heading:Math.PI/2,speed:-2},1/60,bus),true,'backing away sideways');
 assert.equal(leavingBody({x:1.5,z:0,heading:Math.PI/2,speed:2},1/60,bus),false,'driving further in');
 assert.equal(leavingBody({x:1.5,z:3,heading:0,speed:-2},1/60,bus),true,'sliding out lengthwise');
 assert.equal(leavingBody({x:1.5,z:3,heading:0,speed:0},1/60,bus),false);
 const world={roads:{at:(x)=>x<2},pavement:{at:()=>false},buildings:{at:()=>false}},player={x:1.5,z:0};
 assert.equal(nudgeOut(player,0,1.5,world),true);assert.ok(player.x<2&&player.x>1.5,'takes the part of the shift that fits');
});
