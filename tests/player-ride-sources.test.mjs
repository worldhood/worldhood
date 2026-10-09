import test from 'node:test';
import assert from 'node:assert/strict';
import {Group,Matrix4,BoxGeometry,MeshBasicMaterial,Color,Vector3} from 'three';
import {PlayerTravel,travelCollision} from '../src/player-travel.js';
import {makeCar} from '../src/physics.js';
import {SpatialIndex} from '../src/geo.js';
import {WorldObjects,solidBox} from '../src/world-objects.js';
import {createLooseMicromobility} from '../src/parked-micromobility.js';
import {combineKnockables} from '../src/street-furniture.js';
import {createRideVehicle,PLAYER_CITY_BIKE} from '../src/player-ride-models.js';
import {createPlayerTravelRenderer} from '../src/player-travel-renderer.js';
import {Cyclists,createCyclistRenderer} from '../src/cyclists.js';
import {createJoints,posePerson,personLook,JOINT} from '../src/person-model.js';

const ground={id:'surface.41192',rings:[[[-1500,-1500],[1500,-1500],[1500,1500],[-1500,1500]]]};
const world=(objects=[])=>({buildings:new SpatialIndex([]),roads:new SpatialIndex([ground]),pavement:new SpatialIndex([ground]),water:[],objects:new WorldObjects(objects)});
const matrixAt=(mesh,index=0)=>{const m=new Matrix4();mesh.getMatrixAt(index,m);return m;};
function makeSet(kind='scooter',x=100,z=-200){return createLooseMicromobility([{id:'one',x,z,heading:.4,color:'#1b9c8c'},{id:'two',x:x+5,z,heading:.4,color:'#f26d5b'}],{kind,name:`Future city ${kind}`});}
function playerBeside(set,w=world()){
 const source=set.rideSources[0],travel=new PlayerTravel(makeCar(source.actor.x-30,source.actor.z),w,{rides:()=>set.rideSources});
 assert.equal(travel.interact().ok,true);Object.assign(travel.actor,{x:source.actor.x+1.4,z:source.actor.z,heading:0});return {travel,source};
}

test('any parked bike or scooter is claimed once, keeps its appearance and remains where dismounted',()=>{
 for(const kind of ['bicycle','citybike','scooter']){
  const set=makeSet(kind),{travel,source}=playerBeside(set),original={...source.actor};
  assert.equal(travel.interact(source.id).ok,true);assert.equal(travel.mode,source.mode);assert.equal(travel.rides.length,3);
  const ride=travel.actor;assert.equal(ride.visual,source.visual);assert.equal(ride.visual.kind,kind);assert.equal(ride.visual.color,'#1b9c8c');
  assert.equal(set.bodies[0].disabled,true);assert.equal(source.actor.playerTaken,true);
  assert.equal(matrixAt(set.group.children[0]).determinant(),0);assert.ok(matrixAt(set.group.children[0],1).determinant()>.9,'neighbour remains visible');
  for(let i=0;i<120;i++)travel.step(new Set(['KeyW']),1/60);
  assert.ok(Math.hypot(ride.x-original.x,ride.z-original.z)>3);assert.equal(source.actor.x,original.x,'hidden source slot does not follow the player');
  for(let i=0;i<120;i++)travel.step(new Set(['Space']),1/60);
  const parked={x:ride.x,z:ride.z};assert.equal(travel.interact().ok,true);assert.equal(travel.mode,'walk');assert.deepEqual({x:ride.x,z:ride.z},parked);
  assert.equal(travel.interact(source.id).ok,true);assert.equal(travel.actor,ride);assert.equal(travel.rides.length,3,'reusing the ride does not duplicate it');
  travel.reset(makeCar(300,150),world());assert.equal(travel.rides.length,2);assert.equal(source.actor.playerTaken,false);assert.equal(set.bodies[0].disabled,undefined);assert.ok(matrixAt(set.group.children[0]).determinant()>.9);
 }
});

test('claimed knockable rides and their attached parts stay absent from collisions, updates and prop resets',()=>{
 const part={geometry:new BoxGeometry(.4,.2,.04),material:new MeshBasicMaterial()},set=createLooseMicromobility([{id:'plate-bike',x:0,z:0,heading:0}],{kind:'bicycle',parts:[part]}),source=set.rideSources[0];
 assert.equal(source.claim(),true);const before={x:set.bodies[0].x,z:set.bodies[0].z};
 const car=makeCar(0,2,0);car.speed=10;
 for(let i=0;i<120;i++)set.step(1/60,car,world());set.resetAll();set.update();
 assert.deepEqual({x:set.bodies[0].x,z:set.bodies[0].z},before);assert.equal(set.snapshot().hits,0);
 for(const mesh of set.group.children)assert.equal(matrixAt(mesh).determinant(),0,'frame and attached plate are both hidden');
 assert.equal(source.claim(),false);source.release();assert.equal(source.canClaim(),true);
 for(const mesh of set.group.children)assert.ok(matrixAt(mesh).determinant()>.9);
 assert.deepEqual(combineKnockables([combineKnockables([set])]).rideSources,[source],'nested providers retain the original source identity');
});

test('fallen parked rides are picked up at their current position, and airborne moving rides cannot be claimed',()=>{
 const set=makeSet(),body=set.bodies[0],source=set.rideSources[0];
 Object.assign(body,{x:110,z:-190,yaw:1.1,knocked:true,resting:false,y:1,vx:2});
 assert.equal(source.actor.x,110);assert.equal(source.actor.heading,1.1);assert.equal(source.claim(),false);
 Object.assign(body,{resting:true,y:0,vx:0,tilt:Math.PI/2});
 const {travel}=playerBeside(set);assert.equal(travel.interact(source.id).ok,true);assert.equal(travel.actor.x,110);assert.equal(travel.actor.heading,1.1);assert.equal(travel.actor.fallen,undefined);
 travel.reset(makeCar(0,0),world());assert.equal(body.x,100);assert.equal(body.z,-200);assert.equal(body.tilt,0);
});

test('docked rides roll onto clear ground while docks and intervening walls remain solid',()=>{
 const set=createLooseMicromobility([{id:'docked',x:0,z:0,heading:0}],{kind:'citybike'}),dock=solidBox({id:'dock',x:0,z:-.7,width:.55,depth:.3}),w=world([dock]),{travel,source}=playerBeside(set,w);
 assert.equal(travelCollision(source.actor,'bike',w),'building');
 assert.equal(travel.interact(source.id).ok,true);assert.ok(travel.actor.z>.3,'the bike moved backwards away from the fixed dock');assert.equal(travel.actor.heading,Math.PI,'ready to pedal away from its dock');assert.equal(travelCollision(travel.actor,'bike',w),null);assert.equal(dock.disabled,undefined);
 const beforeZ=travel.actor.z;for(let i=0;i<90;i++)travel.step(new Set(['KeyW']),1/60);assert.ok(travel.actor.z>beforeZ+2,'the first forward pedal stroke clears the dock');
 const blockedSet=makeSet(),wall=solidBox({id:'wall',x:100.7,z:-200,width:.12,depth:8}),blocked=playerBeside(blockedSet,world([wall]));
 assert.equal(blocked.travel.interact(blocked.source.id).ok,false);assert.equal(blocked.source.actor.playerTaken,false);assert.ok(matrixAt(blockedSet.group.children[0]).determinant()>.9,'failed mount does not consume or hide the source');
});

test('taken stopped NPC bicycles stop simulating and disappear from both rider and bike rendering until released',()=>{
 const sim=new Cyclists({pavement:[ground]},2),source=sim.rideSources[0],actor=source.actor,scene=new Group(),renderer=createCyclistRenderer(scene,sim);
 actor.speed=3;assert.equal(source.claim(),false);actor.speed=0;assert.equal(source.claim(),true);const before={x:actor.x,z:actor.z,s:actor.s};
 for(let i=0;i<120;i++)sim.step(1/60,{x:-1000,z:-1000});renderer.update(actor);
 assert.deepEqual({x:actor.x,z:actor.z,s:actor.s},before);assert.equal(sim.snapshot().some(r=>r.id===actor.id),false);
 const vehicleMeshes=renderer.group.children.filter(m=>m.isInstancedMesh);assert.ok(vehicleMeshes.length>2);
 for(const mesh of vehicleMeshes)assert.equal(Math.abs(matrixAt(mesh).determinant()),0);
 source.release();sim.step(.1,{x:-1000,z:-1000});renderer.update(actor);assert.ok(actor.speed>0);assert.ok(matrixAt(vehicleMeshes[0]).determinant()>.9);
});

test('the travel renderer adds arbitrary claimed ride IDs and releases their meshes on restart',()=>{
 const set=makeSet(),{travel,source}=playerBeside(set),renderer=createPlayerTravelRenderer(new Group());renderer.update(travel,1/60);
 const original=renderer.group.children.length;assert.equal(travel.interact(source.id).ok,true);travel.advanceTransition(1);renderer.update(travel,1/60);
 assert.equal(renderer.group.children.length,original+1);const model=renderer.group.children.find(g=>g.userData.color==='#1b9c8c');assert.ok(model);assert.equal(model.position.x,travel.actor.x);
 let disposed=0;model.children.find(m=>m.isMesh).geometry.addEventListener('dispose',()=>disposed++);
 travel.reset(makeCar(220,180),world());renderer.update(travel,1/60);
 assert.equal(renderer.group.children.length,original);assert.equal(model.parent,null);assert.equal(disposed,1,'the old ride geometry is disposed once');
});

test('claimed models retain scooter accent and city-bike shape, with pedals matched to the city-bike rider',()=>{
 const coral=createRideVehicle({kind:'scooter',accent:'#f26d5b'},'scooter'),green=createRideVehicle({kind:'scooter',color:'#2fcf7c'},'scooter');
 for(const [model,hex] of [[coral,'#f26d5b'],[green,'#2fcf7c']]){const color=new Color(hex),g=model.frame.geometry,p=g.attributes.paint,c=g.attributes.color,i=Array.from(p.array).findIndex(v=>v>0);assert.ok(Math.abs(c.getX(i)-color.r)<1e-6);assert.ok(Math.abs(c.getY(i)-color.g)<1e-6);assert.ok(Math.abs(c.getZ(i)-color.b)<1e-6);}
 const city=createRideVehicle({kind:'citybike'},'bike'),personal=createRideVehicle({kind:'bicycle'},'bike');assert.notEqual(city.frame.geometry.attributes.position.count,personal.frame.geometry.attributes.position.count);assert.equal(city.anchors,PLAYER_CITY_BIKE);
 const look=personLook(2026,{height:1.75,coat:0,skirt:false,phoneWalk:false,stoop:0,accessory:null}),j=createJoints(),pedal=new Vector3();
 for(let i=0;i<16;i++){
  const d=i/16*Math.PI*2/PLAYER_CITY_BIKE.crankPerMetre;city.motion.update(d);city.root.updateMatrixWorld(true);posePerson({pose:'cycle',grip:true,speed:4,bike:{...PLAYER_CITY_BIKE,crank:d*PLAYER_CITY_BIKE.crankPerMetre}},look,{gaitWalk:0,gaitRun:0,gaitPhase:0},j);
  for(let side=0;side<2;side++){city.motion.pedals[side].getWorldPosition(pedal);const heel=new Vector3(...j.slice(JOINT.heelL+side*3,JOINT.heelL+side*3+3)),toe=new Vector3(...j.slice(JOINT.toeL+side*3,JOINT.toeL+side*3+3)),ball=heel.lerp(toe,.68);assert.ok(Math.abs(ball.z-pedal.z)<.01);assert.ok(Math.abs(ball.y-.036-(pedal.y+PLAYER_CITY_BIKE.pedalTop))<.01);}
 }
 for(const m of [city,personal,coral,green])m.dispose();
});
