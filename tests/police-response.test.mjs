import test from 'node:test';
import assert from 'node:assert/strict';
import {ImpactSystem,DAMAGE_RATE} from '../src/impacts.js';

test('car crashes damage the player less than hitting a building at the same speed; taps are free',()=>{
 assert.ok(DAMAGE_RATE.vehicle<DAMAGE_RATE.pedestrian&&DAMAGE_RATE.pedestrian<DAMAGE_RATE.building);
 const hit=(kind,speed)=>{const car={x:0,z:0,heading:0,speed};new ImpactSystem().damage(car,speed,kind,kind==='building'?null:{id:1,x:0,z:-3});return car.damage||0;};
 for(const speed of [8,14,20])assert.ok(hit('vehicle',speed)<hit('building',speed)*.5,`at ${speed} m/s`);
 assert.equal(hit('vehicle',2.5),0);assert.ok(hit('vehicle',14)>0);assert.ok(hit('vehicle',40)<=.25);
});

test('vehicle collisions in the impact system do not report to police (police.observe owns crash severity)',()=>{
 const reports=[],sim=new ImpactSystem(),from={x:0,z:7,speed:12,heading:0},car={...from,z:1};
 sim.collide(from,car,[],[],[{id:2,x:0,z:0,heading:0,speed:3,edge:{}}],{report:(...r)=>reports.push(r)});
 assert.equal(reports.length,0);assert.ok(car.damage>0);
});
