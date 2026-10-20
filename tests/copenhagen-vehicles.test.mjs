import test from 'node:test';
import assert from 'node:assert/strict';
import {setCityStyle} from '../src/city-style.js';
import {createTrafficRenderer} from '../src/traffic-renderer.js';

// Copenhagen draws traffic with the batched renderer (three batches per body style, shared far boxes, lamps after dark);
// every other city keeps the classic renderer (tests/trams.test.mjs, tests/distance-lod.test.mjs).
test('Copenhagen traffic: batched parts near the player, shared box pairs beyond, nothing past the fog',()=>{
 setCityStyle({id:'copenhagen'});
 try{
  const actors=[0,120,300,900].map((x,id)=>({id,x,z:0,heading:0,speed:0,edge:{}}));
  const r=createTrafficRenderer(actors,{types:['hatchback']});
  const near=r.group.children.filter(m=>!m.userData.lod),low=r.group.children.filter(m=>m.userData.lod==='far');
  assert.equal(low.length,2);assert.ok(low.every(m=>!m.castShadow&&m.geometry.type==='BoxGeometry'));
  r.update(0,{x:0,z:0});
  assert.ok(near.every(m=>m.count===2*m.userData.parts.length),'two cars within 150 m keep every part');assert.ok(low.every(m=>m.count===1),'one car is a box pair');
  r.update(0,null);assert.ok(near.every(m=>m.count===4*m.userData.parts.length),'no viewer: everything detailed');
  r.update(0,{x:5000,z:0});assert.ok(near.every(m=>m.count===0)&&low.every(m=>m.count===0));
 }finally{setCityStyle(null);}
});
test('Copenhagen traffic: a mixed fleet keeps seven body styles and every car rendered',()=>{
 setCityStyle({id:'copenhagen'});
 try{
  const actors=Array.from({length:52},(_,id)=>({id,edge:true,x:id*10,z:0,heading:0,speed:5})),fleet=createTrafficRenderer(actors);fleet.update(.016,{x:0,z:0});
  assert.equal(fleet.types.length,7);assert.ok(fleet.batchCount<=134);
  const firstParts=fleet.types.map(t=>fleet.group.children.find(m=>m.userData.type===t)),farBodies=fleet.group.children.find(m=>m.userData.lod==='far'&&m.userData.coloured);const cars=m=>m.count/(m.userData.parts?.length||1);
  assert.equal(firstParts.reduce((n,m)=>n+cars(m),0)+farBodies.count,52);assert.ok(firstParts.reduce((n,m)=>n+cars(m),0)>=15);
 }finally{setCityStyle(null);}
});
