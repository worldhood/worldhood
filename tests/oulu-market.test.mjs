import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createOuluMarket} from '../src/oulu-market.js';
import {createPlace} from '../src/place-scene.js';
import {validatePlace} from '../src/place-data.js';
import * as THREE from 'three';
import {SpatialIndex,bounds} from '../src/geo.js';
import {gunzipSync} from 'node:zlib';
import polygonClipping from 'polygon-clipping';
import {createOuluSquare} from '../src/oulu-square.js';
import {marketStallRing} from '../src/oulu-square-data.js';
test('Oulu market geometry is finite, bounded and keeps the mapped collision footprint',()=>{
 const place=JSON.parse(fs.readFileSync('public/cities/oulu/places/market.json'));
 const {group,obstacles}=createOuluMarket(place.ouluMarket);let triangles=0,meshes=0;
 group.traverse(o=>{if(!o.isMesh)return;meshes++;const a=o.geometry.attributes.position;triangles+=a.count/3;for(const v of a.array)assert.ok(Number.isFinite(v));});
 assert.ok(triangles<60000);assert.ok(meshes<=60,'whole square ensemble includes fifteen mapped structures');assert.equal(place.hideBuildings[0],'osm-way-28979742');
 assert.equal(obstacles.length,28+place.ouluMarket.square.stalls.length);assert.ok(obstacles.every(o=>o.rings[0].every(p=>p.every(Number.isFinite))));assert.equal(place.replaceTrees,false);
 assert.equal(group.getObjectByName('Toripolliisi'),undefined,'uncleared artwork is excluded');
 assert.ok(!obstacles.some(o=>o.id==='oulu-toripolliisi'),'no invisible statue collision');
 const quay=group.getObjectByName('Torinranta stepped timber promenade');assert.equal(quay.userData.fixedElevation,true);
 const barrier=obstacles.find(o=>o.id==='oulu-torinranta-terrace');assert.deepEqual(barrier.rings[0][0],barrier.rings[0].at(-1));
 assert.equal(place.ouluMarket.quay.steps.length,4,'four mapped stair access points are retained');
});
test('complete Oulu place renders its paving and rejects missing map coordinates',()=>{
 const place=JSON.parse(fs.readFileSync('public/cities/oulu/places/market.json'));
 assert.ok(place.paving.every(s=>s.rings.every(r=>r.every(p=>p?.every(Number.isFinite)))));
 const {group}=createPlace(place);group.traverse(o=>{if(o.isMesh)for(const n of o.geometry.attributes.position.array)assert.ok(Number.isFinite(n));});
 const bad=structuredClone(place);bad.paving[0].rings[0][0]=null;assert.ok(validatePlace(bad).some(s=>s.includes('finite coordinate')));
});
test('square replacements retain OSM outlines and replace oversized kiosk heights',()=>{
 const place=JSON.parse(fs.readFileSync('public/cities/oulu/places/market.json')),square=place.ouluMarket.square;
 const data=JSON.parse(gunzipSync(fs.readFileSync('public/cities/oulu/city.pack'))),{group}=createOuluSquare(square);
 assert.equal(square.buildings.length,15);
 for(const b of square.buildings){const original=data.buildings.find(o=>o.id===b.building);assert.deepEqual(b.ring,original.rings[0]);assert.ok(place.hideBuildings.includes(b.building));assert.equal(place.heights[b.building],b.eave+b.rise);
  const box=new THREE.Box3().setFromObject(group.getObjectByName(b.name)),mapped=bounds([b.ring]);assert.ok(box.min.x>=mapped[0]-2&&box.max.x<=mapped[2]+2&&box.min.z>=mapped[1]-2&&box.max.z<=mapped[3]+2);
  if(b.kind==='kiosk'){assert.ok(original.height>=7);assert.ok(box.max.y<3.3,'small food kiosk must not remain a ten-metre wall');}
 }
 const winter=createOuluSquare({...square,season:'winter'});assert.equal(winter.obstacles.filter(o=>o.id.startsWith('oulu-market-stall')).length,0);assert.ok(!winter.group.getObjectByName('Summer market stall 1'));
});
test('square paving and summer stalls keep mapped buildings and carriageways clear',()=>{
 const place=JSON.parse(fs.readFileSync('public/cities/oulu/places/market.json')),square=place.ouluMarket.square;
 const data=JSON.parse(gunzipSync(fs.readFileSync('public/cities/oulu/city.pack'))),blockers=[...data.buildings,...data.roads.filter(r=>r.kind==='Ajorata')];
 const intersects=(rings,b)=>{const a=bounds(rings),q=b.bbox;return a[0]<q[2]&&a[2]>q[0]&&a[1]<q[3]&&a[3]>q[1]&&polygonClipping.intersection(rings,b.rings).length>0;};
 for(const p of place.paving.filter(p=>p.kind==='oulu-square-granite'))for(const b of blockers)assert.ok(!intersects(p.rings,b),b.id);
 const {obstacles}=createOuluSquare(square),stalls=obstacles.filter(o=>o.id.startsWith('oulu-market-stall'));assert.equal(stalls.length,square.stalls.length);
 for(const [i,s] of square.stalls.entries()){assert.deepEqual(stalls[i].rings[0],marketStallRing(s));for(const b of blockers)assert.ok(!intersects([marketStallRing(s,.25)],b));for(const t of square.stalls.slice(i+1))assert.equal(polygonClipping.intersection([marketStallRing(s,.25)],[marketStallRing(t,.25)]).length,0);}
});
