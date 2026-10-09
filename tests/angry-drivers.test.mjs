import test from 'node:test';
import assert from 'node:assert/strict';
import {createAngryDrivers,ANGRY} from '../src/angry-drivers.js';

const car=()=>({id:3,x:10,z:20,heading:0,knocked:{rest:null}});
test('driver climbs out of the left door after the car stops, faces the player and waves',()=>{
 const drivers=createAngryDrivers(),npc=car(),player={x:30,z:20};
 drivers.trigger(npc,0);
 let t=0;const step=dt=>{t+=dt;drivers.update(dt,t,player);};
 for(let i=0;i<20;i++)step(.05); // still sliding: stays in the car
 assert.equal(drivers.snapshot()[0].out,false);
 npc.knocked.rest=t;for(let i=0;i<60;i++)step(.05);
 const d=drivers.snapshot()[0];
 assert.equal(d.out,true);assert.equal(d.pose,'wave');
 assert.ok(d.x<npc.x-1.2,'heading 0 faces -z, so the driver door is on -x');
});
test('driver leaves with the car and gets back in after a while',()=>{
 const drivers=createAngryDrivers(),npc=car(),player={x:0,z:0};npc.knocked.rest=0;
 drivers.trigger(npc,0);let t=0;
 while(t<ANGRY.delay+ANGRY.climb+ANGRY.stay+ANGRY.back+1){t+=.1;drivers.update(.1,t,player);}
 assert.equal(drivers.snapshot().length,0);
 drivers.trigger(npc,t);npc.knocked=null;drivers.update(.1,t+.1,player);
 assert.equal(drivers.snapshot().length,0);
});
test('at most ANGRY.max drivers at once',()=>{
 const drivers=createAngryDrivers();
 for(let i=0;i<ANGRY.max+2;i++)drivers.trigger({...car(),id:i},i);
 drivers.update(.1,10,{x:0,z:0});
 assert.equal(drivers.snapshot().length,ANGRY.max);
});
test('taking a crashed NPC car removes its old roadside driver and open door immediately',()=>{
 const drivers=createAngryDrivers(),npc={...car(),edge:{}};npc.knocked.rest=0;drivers.trigger(npc,0);drivers.update(.1,3,{x:0,z:0});
 assert.equal(drivers.snapshot().length,1);assert.ok(drivers.group.children.length>1,'an open door exists');
 npc.playerTaken=true;npc.edge=null;drivers.update(.1,3.1,{x:0,z:0});
 assert.equal(drivers.snapshot().length,0);assert.equal(drivers.group.children.length,1);assert.equal(drivers.group.visible,false);
});
