import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createKnockables,carContact} from '../src/knockables.js';
import {makeCar} from '../src/physics.js';

const parts=()=>[{geometry:new THREE.BoxGeometry(.2,1,.05).translate(0,.5,0),material:new THREE.MeshBasicMaterial()}];
const simulate=(k,car,world,seconds,dt=1/60)=>{for(let t=0;t<seconds;t+=dt){if(car){car.x-=Math.sin(car.heading)*car.speed*dt;car.z-=Math.cos(car.heading)*car.speed*dt;}k.step(dt,car,world);}k.update();};

test('car footprint contact uses the rotated body rectangle',()=>{
  const car=makeCar(0,0,0);
  assert.ok(carContact(car,0,-2.4,.3));assert.ok(carContact(car,1.1,0,.3));
  assert.equal(carContact(car,1.5,0,.3),null);assert.equal(carContact(car,0,-3,.3),null);
});

test('a struck bollard flies forward, lands on its side and comes to rest',()=>{
  const k=createKnockables([{x:0,z:-4,yaw:0}],parts()),car=makeCar(0,0,0);car.speed=12;
  let peak=0;for(let t=0;t<1;t+=1/60){car.z-=car.speed/60;k.step(1/60,car,null);peak=Math.max(peak,k.bodies[0].y);}
  const b=k.bodies[0];
  assert.ok(b.knocked);assert.ok(peak>.5,'lifted off the ground');assert.ok(car.speed<12&&car.speed>11,'light object barely slows the car');
  car.speed=0;simulate(k,car,null,6);
  assert.ok(b.resting);assert.equal(b.y,0);assert.ok(b.z<-10,'travelled ahead of the car');
  assert.ok(Math.abs(Math.abs(b.tilt%Math.PI)-Math.PI/2)<.03,'lies on its side');
  assert.ok(k.group.children[0].instanceMatrix.array.every(Number.isFinite));
});

test('a stationary or crawling car does not topple bollards',()=>{
  const k=createKnockables([{x:0,z:-2.5,yaw:0}],parts()),car=makeCar(0,0,0);car.speed=.3;
  simulate(k,car,null,1);assert.equal(k.bodies[0].knocked,false);
});

test('buildings stop sliding bollards and fallen ones respawn once the player is far away',()=>{
  const wall={at:(x,z)=>z<-8?{}:undefined},k=createKnockables([{x:0,z:-4,yaw:0}],parts()),car=makeCar(0,0,0);car.speed=20;
  simulate(k,car,{buildings:wall},.4);car.speed=0;simulate(k,car,{buildings:wall},6);
  const b=k.bodies[0];assert.ok(b.z>=-8.5);assert.ok(b.resting&&b.knocked);
  car.x=500;simulate(k,car,null,61);assert.equal(b.knocked,false);assert.equal(b.z,-4);
});
