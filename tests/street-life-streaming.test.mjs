import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {SpatialIndex} from '../src/geo.js';
import {Mobility} from '../src/mobility.js';
import {createStreetLife} from '../src/street-life.js';
import {breakableSigns} from '../src/breakable-signs.js';
import {crossingPolygons} from '../src/crossing-markings.js';
const rect=(x,z,w,h)=>({rings:[[[x,z],[x+w,z],[x+w,z+h],[x,z+h],[x,z]]]});
const roads=(z0,z1)=>({nodes:[[0,z0],[0,z1]],edges:[{from:0,to:1,points:[[0,z0],[0,z1]],lane:1.5,signal:0}]});
const walks=z=>({nodes:[[-5,z],[5,z]],edges:[{from:0,to:1,points:[[-5,z],[5,z]],lane:0,signal:0,crossing:true}]});

test('street-detail appends preserve actor renderers and existing posts while adding markings, kerbs and signals',()=>{
 const pavement=[rect(5,-50,5,50),rect(-10,-50,5,50)],world={buildings:new SpatialIndex([]),roads:new SpatialIndex([rect(-5,-50,10,50)]),pavement:new SpatialIndex(pavement)};
 const mobility=new Mobility({roads:roads(0,-50),walks:walks(-30),signals:[{p:[0,-50]}]},world,{cars:1,people:1});
 const scene=new THREE.Scene(),street=createStreetLife(scene,mobility),traffic=street.traffic,children=street.group.children.slice(),before=street.staticCounts();
 assert.equal(before.signals,1);const oldPosts=breakableSigns.bodies.slice();assert.equal(oldPosts.length,1);oldPosts[0].knocked=true;
 const nextPavement=[rect(5,-100,5,50),rect(-10,-100,5,50)];world.roads.add([rect(-5,-100,10,50)]);world.pavement.add(nextPavement);
 const added=mobility.appendRegion({roads:roads(-50,-100),walks:walks(-80),signals:[{p:[0,-100]}]});street.append({...added,pavement:nextPavement});
 assert.equal(street.traffic,traffic);for(const child of children)assert.ok(street.group.children.includes(child));assert.equal(breakableSigns.bodies[0],oldPosts[0]);assert.equal(oldPosts[0].knocked,true);
 assert.deepEqual(street.staticCounts(),{roads:2,walks:2,pavement:4,signals:2});assert.ok(street.group.children.length>children.length);
 const count=street.group.children.length;street.append({...added,pavement:nextPavement});street.append();assert.equal(street.group.children.length,count);assert.equal(street.staticCounts().signals,2);
 assert.doesNotThrow(()=>street.update(1/60,{x:0,z:-80}));
});

test('appended crossing batches omit already rendered authored crossings',()=>{
 const world={roads:{at:()=>true},buildings:{at:()=>false}};
 assert.ok(crossingPolygons([],world).polygons.length>0);
 assert.deepEqual(crossingPolygons([],world,{reviewed:[]}),{polygons:[],chains:[]});
});
