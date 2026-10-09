import test from 'node:test';
import assert from 'node:assert/strict';
import {SpatialIndex} from '../src/geo.js';
import {createBirdFlightClearance} from '../src/bird-flight-clearance.js';

const box=(x,z,w,d,height)=>({height,rings:[[[x-w/2,z-d/2],[x+w/2,z-d/2],[x+w/2,z+d/2],[x-w/2,z+d/2]]]});
const p=(x,y,z)=>({x,y,z});

test('low gull flights clear rotated stalls and mapped walls, while allowing flight above them',()=>{
 const buildings=new SpatialIndex([box(6,0,.3,6,12)]),clear=createBirdFlightClearance({buildings,stalls:[{x:0,z:0,w:5,d:2,facing:Math.PI/2}]});
 assert.equal(clear(p(-2,1.3,0),p(2,1.3,0)),false,'swept path crosses the canopy footprint');
 assert.equal(clear(p(-2,4,0),p(2,4,0)),true,'clear above the canopy');
 assert.equal(clear(p(5,2,0),p(7,2,0)),false,'thin wall blocks a complete swept step');
 assert.equal(clear(p(5,13,0),p(7,13,0)),true,'clear above the roof');
 assert.equal(clear(p(-2,1.3,2.55),p(0,1.3,2.55)),false,'body radius clears the rotated canopy edge');
 assert.equal(clear(p(-2,1.3,3),p(2,1.3,3)),true,'outside the rotated stall');
 buildings.add([box(-5,0,1,1,9)]);
 assert.equal(clear(p(-6,2,0),p(-4,2,0)),false,'streamed buildings use the live index');
});

test('birds may fly over water but cannot feed below ground or on it; invalid moves are bounded',()=>{
 const clear=createBirdFlightClearance({water:[box(0,0,5,5)]});
 assert.equal(clear(p(-1,2,0),p(1,2,0)),true);
 assert.equal(clear(p(-1,.3,0),p(1,.3,0)),false);
 assert.equal(clear(p(4,.3,0),p(5,.3,0)),true);
 assert.equal(clear(p(4,1,0),p(5,0,0)),false);
 assert.equal(clear(p(4,1,0),p(NaN,1,0)),false);
 assert.equal(clear(p(4,1,0),p(100,1,0)),false);
});
