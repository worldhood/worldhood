import test from 'node:test';
import assert from 'node:assert/strict';
import {cornerSpeedLimit} from '../src/traffic-driving.js';
const edge=points=>{const cumulative=[0];for(let i=1;i<points.length;i++)cumulative.push(cumulative.at(-1)+Math.hypot(points[i][0]-points[i-1][0],points[i][1]-points[i-1][1]));return {points,cumulative,length:cumulative.at(-1)};};
test('straight traffic retains cruise speed, including across a junction',()=>{
 const a=edge([[0,0],[0,-100]]),b=edge([[0,-100],[0,-150]]);
 assert.equal(cornerSpeedLimit(a,99,12,[b]),12);
});
test('traffic brakes progressively before a right-angle corner and releases after it',()=>{
 const a=edge([[0,0],[0,-100],[100,-100]]);
 assert.equal(cornerSpeedLimit(a,0,12),12);
 const approach=cornerSpeedLimit(a,90,12),turn=cornerSpeedLimit(a,99,12);
 assert.ok(approach<12&&approach>turn);assert.ok(turn>=3&&turn<5);
 assert.equal(cornerSpeedLimit(a,110,12),12);
});
test('police junction lookahead slows a fast pursuit before changing edges',()=>{
 const a=edge([[0,0],[0,-100]]),b=edge([[0,-100],[100,-100]]);
 const limit=cornerSpeedLimit(a,70,25,[b]);assert.ok(limit<16&&limit>10);
 assert.ok(cornerSpeedLimit(a,99,25,[b])<5);
 assert.equal(cornerSpeedLimit(a,99,25,[undefined]),25);
});
test('a heading wrapping through pi is not mistaken for a sharp corner',()=>{
 const a=edge([[0,0],[.01,20],[0,40]]);assert.equal(cornerSpeedLimit(a,19,12),12);
});
