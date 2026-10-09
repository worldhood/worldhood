import test from 'node:test';
import assert from 'node:assert/strict';
import {WorldObjects,objectBehavior,solidBox} from '../src/world-objects.js';
import {SpatialIndex} from '../src/geo.js';
import {makeCar,driveStep,carSamples} from '../src/physics.js';

const ground={at:()=>({})},worldFor=objects=>({buildings:new SpatialIndex([]),roads:ground,pavement:ground,water:[],objects});
test('thin poles inside a car are caught even when none of the old sample points touches them',()=>{
 const post=solidBox({id:'post',x:.48,z:0,width:.08,depth:.08}),objects=new WorldObjects([post]),car=makeCar(0,0);
 assert.ok(carSamples(car).every(([x,z])=>!new SpatialIndex([post]).at(x,z)));
 assert.equal(objects.overlap(car),post);
 const moving=makeCar(0,6);moving.speed=22;let hit=false;
 for(let i=0;i<60;i++)if(driveStep(moving,new Set(['KeyW']),1/60,worldFor(objects)).collision){hit=true;break;}
 assert.equal(hit,true);assert.ok(moving.z>2.3,'bumper stops before the thin post, not after it passes through the body');assert.equal(moving.speed,0);
});
test('solid boards block frontal, reverse, angled and sideways contact across their full width',()=>{
 const board=solidBox({id:'wide-board',x:0,z:0,width:3.3,depth:.3,yaw:.32}),objects=new WorldObjects([board]);
 for(const heading of [0,.32,Math.PI/2,Math.PI,Math.PI*1.3]){
  const from={x:Math.sin(heading)*8,z:Math.cos(heading)*8,heading},to={x:-from.x,z:-from.z,heading};
  assert.equal(objects.blocksStep(from,to),board,`heading ${heading}`);
 }
 assert.equal(objects.blocksStep({x:1.4,z:5,heading:0},{x:1.4,z:-5,heading:0}),board,'outer board can be struck away from the centre pole');
 assert.equal(objects.blocksStep({x:5,z:5,heading:0},{x:5,z:-5,heading:0}),null,'nearby clear ground stays open');
});
test('the footprint query reaches across index cells and checks turning body corners',()=>{
 const post=solidBox({id:'cell-edge',x:16.03,z:0,width:.06,depth:.06}),objects=new WorldObjects([post]);
 assert.equal(objects.overlap({x:15.1,z:0,heading:0}),post);
 const turnPost=solidBox({id:'corner',x:1.7,z:0,width:.08,depth:.08}),turns=new WorldObjects([turnPost]);
 assert.equal(turns.overlap({x:0,z:0,heading:0}),null);
 assert.equal(turns.blocksStep({x:0,z:0,heading:0},{x:0,z:0,heading:Math.PI/2}),turnPost);
});
test('overhead boards, decorative marks and simulated breakables do not form invisible solid walls',()=>{
 const objects=new WorldObjects(['overhead','decoration','breakable'].map(mode=>objectBehavior({id:mode},mode)));
 assert.equal(objects.blocksStep({x:0,z:8},{x:0,z:-8}),null);
 assert.deepEqual(objects.snapshot(),{count:3,solid:0,breakable:1,overhead:1,decoration:1});
 assert.throws(()=>objectBehavior({},'unknown'),/Unknown world object mode/);
 assert.throws(()=>new WorldObjects([{id:'missing-shape'}]),/no footprint/);
});
test('claimed objects disappear from collision immediately without rebuilding the index',()=>{
 const box=solidBox({id:'ride',x:0,z:0,width:1,depth:2}),objects=new WorldObjects([box]),p={x:0,z:0};
 assert.equal(objects.overlap(p),box);assert.equal(objects.overlap(p,{ignore:[box]}),null);
 box.disabled=true;assert.equal(objects.overlap(p),null);delete box.disabled;
 box.playerTaken=true;assert.equal(objects.overlap(p),null);delete box.playerTaken;
 assert.equal(objects.overlap(p),box);
});
test('contact recovery allows reversing away but blocks movement further into an object',()=>{
 const board=solidBox({id:'board',x:0,z:0,width:6,depth:.4}),objects=new WorldObjects([board]),from={x:0,z:2.4,heading:0};
 assert.equal(objects.blocksStep(from,{...from,z:2.8}),null);
 assert.equal(objects.blocksStep(from,{...from,z:2.1}),board);
});
test('concave footprints and courtyards retain their open spaces',()=>{
 const obstacle={id:'courtyard',rings:[[[-8,-8],[8,-8],[8,8],[-8,8]],[[-5,-5],[-5,5],[5,5],[5,-5]]]},objects=new WorldObjects([obstacle]);
 assert.equal(objects.overlap({x:0,z:0}),null);
 assert.equal(objects.overlap({x:6,z:0}),obstacle);
});
