import test from 'node:test';
import assert from 'node:assert/strict';
import {consumeBattery,BATTERY_RANGE_METRES} from '../src/battery.js';
import {makeCar,driveStep} from '../src/physics.js';
import {dialAngle,smoothSpeed} from '../src/speedometer.js';
const world={roads:{at:()=>true},buildings:{at:()=>false},pavement:{at:()=>false},water:[]};
test('battery drains with actual distance in either direction; standing still is free',()=>{
 assert.equal(consumeBattery(1,0,0),1);
 assert.equal(consumeBattery(1,100,-10),consumeBattery(1,100,10));
 assert.ok(consumeBattery(1,100,30)<consumeBattery(1,100,10));
 assert.equal(consumeBattery(.001,BATTERY_RANGE_METRES,20),0);
 for(const key of ['KeyW','KeyS']){const car=makeCar(0,0);for(let i=0;i<120;i++)driveStep(car,new Set([key]),1/60,world);assert.ok(car.battery<1);assert.ok(car.distance>0);}
});
test('empty battery prevents powered travel but keeps braking available; reset recharges',()=>{
 for(const key of ['KeyW','KeyS']){const car=makeCar(0,0);car.battery=0;driveStep(car,new Set([key]),1,world);assert.equal(car.speed,0);assert.equal(car.distance,0);}
 const car=makeCar(0,0);car.battery=0;car.speed=10;driveStep(car,new Set(['KeyS']),.2,world);assert.ok(car.speed<5);
 assert.equal(makeCar(0,0).battery,1);
});
test('speed needle is bounded and smoothly approaches its target independently of frame rate',()=>{
 assert.equal(dialAngle(0),-120);assert.equal(dialAngle(60),0);assert.equal(dialAngle(120),120);assert.equal(dialAngle(999),120);
 const results=[30,60,120].map(fps=>{let shown=0;for(let i=0;i<fps;i++)shown=smoothSpeed(shown,80,1/fps);return shown;});
 assert.ok(results.every(n=>n>79&&n<80));assert.ok(Math.abs(results[0]-results[2])<1e-9);
 assert.equal(smoothSpeed(20,40,0),20);
});
