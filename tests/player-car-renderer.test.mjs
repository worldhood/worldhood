import test from 'node:test';
import assert from 'node:assert/strict';
import {Scene,Texture,Vector3} from 'three';
import {createPlayerCarRenderer} from '../src/player-car-renderer.js';
import {makeCar} from '../src/physics.js';
import {createVehicle} from '../src/vehicles.js';
import {currentEnvironment,setEnvironment} from '../src/environment.js';
import {terrain,setTerrain,groundPose} from '../src/terrain.js';

const car=(x,z,type,paint)=>({...makeCar(x,z),visual:type?{type,paint}:undefined});
const state=home=>({homeCar:home,car:home,actor:home,cars:[home]});
const paintMesh=model=>model.getObjectByName('paint');

test('switching cars preserves each appearance and parked position and selects the correct wheel/body references',()=>{
 const scene=new Scene(),renderer=createPlayerCarRenderer(scene),home=car(12,34),travel=state(home);renderer.sync(travel);
 const original=renderer.group.children[0],taken=car(-7,60,'taxi','#376487');travel.cars.push(taken);travel.car=travel.actor=taken;renderer.sync(travel);
 const active=renderer.group.children[0],parked=scene.getObjectByName('Player parked cars');
 assert.equal(active.userData.type,'taxi');assert.equal(paintMesh(active).material.color.getHexString(),'376487');
 assert.equal(renderer.group.userData,active.userData);assert.ok(active.userData.wheels.every(w=>active.children.includes(w.pivot)));
 assert.equal(original.parent,parked);assert.deepEqual(original.position.toArray(),[12,.12,34]);assert.deepEqual(active.position.toArray(),[0,0,0]);
 taken.x=27;taken.z=-18;travel.car=travel.actor=home;renderer.sync(travel);
 assert.equal(renderer.group.children[0],original);assert.equal(active.parent,parked);assert.deepEqual(active.position.toArray(),[27,.12,-18]);assert.equal(paintMesh(active).material.color.getHexString(),'376487');
 renderer.setVisible(false);assert.equal(renderer.group.visible,false);assert.equal(parked.visible,false);renderer.setVisible(true);assert.equal(parked.visible,true);
});

test('damage remains per car and a reset restores the original model while disposing the taken car geometry',()=>{
 const scene=new Scene(),renderer=createPlayerCarRenderer(scene),home=car(0,0),travel=state(home);renderer.sync(travel);
 const original=renderer.group.children[0],homePaint=paintMesh(original),base=Array.from(homePaint.geometry.attributes.position.array);
 Object.assign(home,{damage:1,damageZones:{front:1,rear:0,left:0,right:0},damageVersion:1});renderer.sync(travel);
 assert.notDeepEqual(Array.from(homePaint.geometry.attributes.position.array),base);
 const taken=car(15,20,'estate','#678998');travel.cars.push(taken);travel.car=travel.actor=taken;renderer.sync(travel);
 const model=renderer.group.children[0],takenPaint=paintMesh(model),shared=paintMesh(createVehicle(0,false,'estate')).geometry,sharedBefore=Array.from(shared.attributes.position.array);let disposed=0;takenPaint.geometry.addEventListener('dispose',()=>disposed++);
 Object.assign(taken,{damage:1,damageZones:{front:0,rear:1,left:0,right:0},damageVersion:1});renderer.sync(travel);
 assert.deepEqual(Array.from(shared.attributes.position.array),sharedBefore,'damage never alters a cached NPC model');
 const fresh=car(50,70);renderer.sync(state(fresh));
 assert.equal(renderer.group.children[0],original);assert.equal(model.parent,null);assert.equal(scene.getObjectByName('Player parked cars').children.length,0);assert.equal(disposed,1);
 assert.deepEqual(Array.from(homePaint.geometry.attributes.position.array),base,'starter car damage clears on reset');
});

test('reset unregisters disposed car paint so later sky updates do not retain or mutate it',()=>{
 const scene=new Scene(),renderer=createPlayerCarRenderer(scene),home=car(0,0),travel=state(home);renderer.sync(travel);
 const taken=car(1,0,'hatchback','#845836');travel.cars.push(taken);travel.car=travel.actor=taken;renderer.sync(travel);const paint=paintMesh(renderer.group.children[0]).material;
 let disposed=false;paint.addEventListener('dispose',()=>disposed=true);renderer.sync(state(car(30,30)));assert.equal(disposed,true);
 const previous=currentEnvironment(),next=new Texture(),before=paint.version;
 try{setEnvironment(next);assert.notEqual(paint.envMap,next,'disposed material must leave the sky registry');assert.equal(paint.version,before);}
 finally{setEnvironment(previous);next.dispose();}
});

test('the active car stays aligned with the same slope when its heading changes',()=>{
 const previous=terrain(),ground=Float32Array.from([-4,0,4,-4,0,4,-4,0,4]);
 setTerrain({size:3,cell:20,extent:20,ground});
 try{
  const renderer=createPlayerCarRenderer(new Scene()),model=renderer.group,normal=new Vector3(-.2,1,0).normalize();
  for(const heading of [0,Math.PI/2,Math.PI,-Math.PI/2]){
   const pose=groundPose(0,0,heading,1.4,.8);
   // The frame loop assigns heading and terrain pitch/roll separately.
   model.rotation.y=heading;model.rotation.x=pose.pitch;model.rotation.z=pose.roll;
   const up=new Vector3(0,1,0).applyQuaternion(model.quaternion);
   assert.ok(up.distanceTo(normal)<1e-6,`car up vector follows the road normal at heading ${heading}`);
  }
 }finally{setTerrain(previous);}
});
