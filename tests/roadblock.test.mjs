import test from 'node:test';
import assert from 'node:assert/strict';
import {crossesStrip,headingAlong,ARREST} from '../src/roadblock.js';
import {PoliceSimulation} from '../src/police.js';
import {makeCar,driveStep,FLAT_TYRES} from '../src/physics.js';

const strip={a:{x:0,z:-10},b:{x:0,z:10}};
test('the spike strip catches a car driving over it, not one beside it',()=>{
 assert.equal(crossesStrip({x:5,z:0},{x:-5,z:0},strip),true,'drove straight across');
 assert.equal(crossesStrip({x:5,z:0},{x:1.5,z:0},strip),true,'front wheels on the spikes');
 assert.equal(crossesStrip({x:9,z:0},{x:6,z:0},strip),false,'still approaching');
 assert.equal(crossesStrip({x:5,z:20},{x:-5,z:20},strip),false,'passed beyond the end');
 assert.ok(Math.abs(headingAlong(-1,0)-Math.PI/2)<1e-9,'forward is (-sin h, -cos h)');
});
test('shredded tyres drag a fast car down to a crawl and cap its drive',()=>{
 const world={roads:{at:()=>true},pavement:{at:()=>true},buildings:{at:()=>null},water:[]};
 const car=makeCar(0,0);car.speed=25;car.flat=1;
 for(let i=0;i<240;i++)driveStep(car,new Set(['KeyW']),1/60,world);
 assert.ok(car.speed<=FLAT_TYRES.speed+.5,`crawling at ${car.speed}`);
});
test('parked roadblock units stay put, survive resets and can arrest at once',()=>{
 const graph={nodes:[{x:0,z:0},{x:100,z:0}],edges:[],outgoing:[[],[]]};
 const police=new PoliceSimulation(graph,{buildings:{at:()=>null}});
 police.setParked([{x:10,z:0,heading:0}]);police.reset();
 assert.equal(police.units.length,1);assert.equal(police.units[0].parked,true);
 assert.equal(police.arrestNow('Busted.'),true);assert.equal(police.busted,true);assert.equal(police.arrestNow(),false);
 police.setParked([]);assert.equal(police.units.length,0);
 assert.ok(ARREST.card<ARREST.up[0]&&ARREST.card>ARREST.cuff[0],'the BUSTED card comes up while the cuffs go on');
});
