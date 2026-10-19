import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {gunzipSync} from 'node:zlib';import * as THREE from 'three';
import {createOuluCathedral} from '../src/oulu-cathedral.js';import {createPlace,loadPlaceModels} from '../src/place-scene.js';import {footprintFrame} from '../src/place-landmarks.js';import {SpatialIndex,bounds} from '../src/geo.js';import {setTerrain,decodeTerrain,groundAt} from '../src/terrain.js';
const place=JSON.parse(fs.readFileSync('public/cities/oulu/places/cathedral.json')),spec=place.ouluCathedral;
test('Cathedral replaces exactly its mapped outline with a bounded source-height landmark',async()=>{
 const data=JSON.parse(gunzipSync(fs.readFileSync('public/cities/oulu/city.pack'))),original=data.buildings.find(b=>b.id===spec.building);
 assert.deepEqual(spec.rings,original.rings);assert.deepEqual(place.hideBuildings,[original.id]);assert.equal(place.heights[original.id],56.5);
 const {group}=createOuluCathedral(spec),box=new THREE.Box3().setFromObject(group);assert.ok(Math.abs(box.max.y-56.5)<.01);assert.equal(group.userData.clockFaces,4);assert.equal(group.userData.fixedElevation,true);
 let meshes=0,triangles=0;group.traverse(o=>{if(!o.isMesh)return;meshes++;triangles+=o.geometry.attributes.position.count/3;for(const n of o.geometry.attributes.position.array)assert.ok(Number.isFinite(n));});assert.equal(meshes,2);assert.ok(triangles<60000);
 assert.ok(createPlace(place,{models:await loadPlaceModels([place])}).group.getObjectByName('Oulun tuomiokirkko'));
 assert.throws(()=>createPlace(place),/not loaded/);
});
test('Cathedral clock faces and dome are visible outside their supporting walls',()=>{
 const {group}=createOuluCathedral(spec),F=footprintFrame(spec.rings[0],[-.85,-.53]);group.updateMatrixWorld(true);
 for(let i=0;i<4;i++){
  const a=i*Math.PI/2,n=new THREE.Vector3(Math.sin(a),0,Math.cos(a)),eye=new THREE.Vector3(-.53+n.x*7,37.4,27.02+n.z*7).applyMatrix4(F.matrix),direction=n.clone().negate().transformDirection(F.matrix);
  const hit=new THREE.Raycaster(eye,direction).intersectObject(group,true)[0];assert.ok(hit&&hit.distance<2.4,'clock face projects beyond the clock-chamber wall');
 }
 const domeEye=new THREE.Vector3(-.7,35,-5.25).applyMatrix4(F.matrix),hit=new THREE.Raycaster(domeEye,new THREE.Vector3(0,-1,0)).intersectObject(group,true)[0];assert.ok(hit.point.y>28&&hit.point.y<30,'crossing dome rises above the curved nave roofs');
 const windowEye=new THREE.Vector3(-.58,20.65,7).applyMatrix4(F.matrix),windowDirection=new THREE.Vector3(0,0,-1).transformDirection(F.matrix),windowHit=new THREE.Raycaster(windowEye,windowDirection).intersectObject(group,true)[0];assert.ok(windowHit.object.material.metalness>.1,'drum glazing must sit outside the octagonal support');
});
test('Cathedral foundations meet real terrain and projecting steps have collision',()=>{
 setTerrain(decodeTerrain(gunzipSync(fs.readFileSync('public/cities/oulu/terrain.pack'))));try{
  const {group,obstacles}=createOuluCathedral(spec);group.updateMatrixWorld(true);group.traverse(o=>{if(o.isMesh){o.material=o.material.clone();o.material.side=THREE.DoubleSide;}});
  for(const r of spec.rings)for(let i=1;i<r.length;i++){
   const a=r[i-1],b=r[i],len=Math.hypot(b[0]-a[0],b[1]-a[1]);if(len<.2)continue;const x=(a[0]+b[0])/2,z=(a[1]+b[1])/2,n=new THREE.Vector3((b[1]-a[1])/len,0,-(b[0]-a[0])/len),eye=new THREE.Vector3(x,groundAt(x,z)+.03,z).addScaledVector(n,.1);
   assert.ok(new THREE.Raycaster(eye,n.negate(),0,.2).intersectObject(group,true).length,'mapped wall must meet terrain');
  }
  const stairs=obstacles.find(o=>o.id==='oulu-cathedral-stairs'),idx=new SpatialIndex([{...stairs,bbox:bounds(stairs.rings)}]),F=footprintFrame(spec.rings[0],[-.85,-.53]),p=new THREE.Vector3(-.53,10,35.38).applyMatrix4(F.matrix);
  assert.ok(idx.at(p.x,p.z));const hit=new THREE.Raycaster(p,new THREE.Vector3(0,-1,0)).intersectObject(group,true)[0];assert.ok(hit&&hit.point.y>groundAt(p.x,p.z),'visible steps occupy the obstacle footprint');
 }finally{setTerrain(null);}
});
