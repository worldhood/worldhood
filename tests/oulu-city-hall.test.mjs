import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {gunzipSync} from 'node:zlib';import * as THREE from 'three';
import {createOuluCityHall} from '../src/oulu-city-hall.js';import {SpatialIndex,bounds} from '../src/geo.js';import {footprintFrame} from '../src/place-landmarks.js';
import {decodeTerrain,setTerrain,groundAt} from '../src/terrain.js';
const source=JSON.parse(fs.readFileSync('cities/oulu/city-hall-model.json')),place=JSON.parse(fs.readFileSync('public/cities/oulu/places/city-hall.json'));
test('City Hall walls reach the real sloping terrain around the exterior and courtyards',()=>{
 setTerrain(decodeTerrain(gunzipSync(fs.readFileSync('public/cities/oulu/terrain.pack'))));
 try{
  const {group}=createOuluCityHall(place.ouluCityHall);group.updateMatrixWorld(true);
  const shell=group.getObjectByName('City Hall front and roof');
  shell.traverse(o=>{if(o.isMesh)o.material.side=THREE.DoubleSide;});
  let downhillSamples=0;
  for(const ring of source.rings)for(let i=1;i<ring.length;i++){
   const a=ring[i-1],b=ring[i],length=Math.hypot(b[0]-a[0],b[1]-a[1]),normal=new THREE.Vector3((b[1]-a[1])/length,0,-(b[0]-a[0])/length);
   for(let d=.5;d<length;d+=1){const x=a[0]+(b[0]-a[0])*d/length,z=a[1]+(b[1]-a[1])*d/length,y=groundAt(x,z)+.03;
    if(y<group.position.y)downhillSamples++;
    const eye=new THREE.Vector3(x,y,z).addScaledVector(normal,.1),ray=new THREE.Raycaster(eye,normal.clone().negate(),0,.2);
    assert.ok(ray.intersectObject(shell,true).length,`wall must meet ground at ${x},${z}`);
   }
  }
  assert.ok(downhillSamples>20,'exercise the formerly floating downhill walls');
 }finally{setTerrain(null);}
});
test('City Hall registration and legacy height replace the default while retaining both courtyards',()=>{
 const data=JSON.parse(gunzipSync(fs.readFileSync('public/cities/oulu/city.pack'))),original=data.buildings.find(b=>b.id===source.building);
 assert.equal(source.component,226);assert.equal(source.licence,'CC BY 4.0');assert.ok(source.bboxResidual<2);assert.ok(Math.abs(source.sourceHeight-16.4733)<.001);assert.equal(original.height,10);
 assert.deepEqual(place.ouluCityHall.rings,original.rings);assert.equal(place.ouluCityHall.rings.length,3);assert.ok(place.hideBuildings.includes(source.building));
 const F=footprintFrame(source.rings[0],[.85,.53]);assert.ok(F.width>50&&F.width<53);
 const {group}=createOuluCityHall(place.ouluCityHall),idx=new SpatialIndex([{rings:source.rings,bbox:bounds(source.rings)}]);
 for(const r of source.rings.slice(1)){const xs=r.map(p=>p[0]),zs=r.map(p=>p[1]),x=(Math.min(...xs)+Math.max(...xs))/2,z=(Math.min(...zs)+Math.max(...zs))/2;assert.equal(idx.at(x,z),undefined);
  const ray=new THREE.Raycaster(new THREE.Vector3(x,.8,z),new THREE.Vector3(0,-1,0));group.updateMatrixWorld(true);assert.equal(ray.intersectObject(group,true).length,0,'courtyard floor must not be filled by the replacement shell');
 }
});
test('City Hall detail is finite and bounded, with twin pavilions and projecting stair collisions',()=>{
 const {group,obstacles}=createOuluCityHall(place.ouluCityHall);let triangles=0,draws=0;group.traverse(o=>{if(!o.isMesh)return;draws++;triangles+=o.geometry.attributes.position.count/3;for(const n of o.geometry.attributes.position.array)assert.ok(Number.isFinite(n));});
 assert.ok(triangles<60000);assert.ok(draws<=6);assert.equal(group.userData.pavilions.length,2);assert.equal(group.userData.courtyards,2);assert.equal(group.userData.fixedElevation,true);
 const box=new THREE.Box3().setFromObject(group);assert.ok(box.max.y>28&&box.max.y<30);assert.ok(Math.abs(group.userData.pavilions[0].x+group.userData.pavilions[1].x)<.001);
 const view=footprintFrame(source.rings[0],[.85,.53]),eye=new THREE.Vector3(0,9.5,-view.depth/2-10).applyMatrix4(view.matrix),direction=new THREE.Vector3(view.normal[0],0,view.normal[1]);group.updateMatrixWorld(true);
 const rearHit=new THREE.Raycaster(eye,direction).intersectObject(group,true)[0];assert.equal(rearHit.object.parent.name,'City Hall rear elevation','rear central glazing must sit outside the projecting shell');
 assert.equal(obstacles.length,8);for(const o of obstacles){assert.deepEqual(o.rings[0][0],o.rings[0].at(-1));assert.ok(o.rings[0].every(p=>p.every(Number.isFinite)));}
 const stairs=obstacles.find(o=>o.id==='oulu-city-hall-stairs'),idx=new SpatialIndex([{...stairs,bbox:bounds(stairs.rings)}]),F=footprintFrame(source.rings[0],[.85,.53]),x=F.origin[0]+F.normal[0]*(F.depth/2+3),z=F.origin[1]+F.normal[1]*(F.depth/2+3);assert.ok(idx.at(x,z));
});
