import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {createMunicipalWaterfront} from '../src/municipal-waterfront.js';
import {footprintFrame} from '../src/place-landmarks.js';
import {SpatialIndex,bounds} from '../src/geo.js';
const data=JSON.parse(fs.readFileSync('cities/oulu/waterfront-model.json'));
test('municipal waterfront meshes retain metre scale, geographic registration and closed collision outlines',()=>{
 assert.equal(data.models.length,2);assert.equal(data.licence,'CC BY 4.0');
 for(const m of data.models){assert.ok(m.height>13&&m.height<15);assert.ok(m.bboxResidual<3.1);assert.deepEqual(m.ring[0],m.ring.at(-1));assert.ok(m.ring.length>=5);
  const idx=new SpatialIndex([{id:m.building,rings:[m.ring],bbox:bounds([m.ring])}]),F=footprintFrame(m.ring,[.85,.53]);assert.ok(idx.at(...F.origin));
  assert.ok(m.vertices.every(v=>v.length===3&&v.every(Number.isFinite)));assert.ok(m.faces.every(f=>f.length===3&&f.every(i=>i>=0&&i<m.vertices.length)));
 }
 const library=data.models.find(m=>m.kind==='library');assert.ok(Math.abs(footprintFrame(library.ring,[.85,.53]).width-54)<.5,'54 m facade agrees with city architectural description');
});
test('blank municipal facades are opened without changing source data or rendering budget',()=>{
 const before=JSON.stringify(data);
 const group=createMunicipalWaterfront(data.models);let triangles=0,meshes=0;
 group.traverse(o=>{if(!o.isMesh)return;meshes++;triangles+=o.geometry.attributes.position.count/3;for(const n of o.geometry.attributes.position.array)assert.ok(Number.isFinite(n));});
 assert.ok(triangles<30000);assert.ok(meshes<=16);
 for(const m of data.models){const node=group.getObjectByName(m.name),shell=node.getObjectByName('Imported municipal LOD1 shell');assert.equal(shell.geometry.attributes.position.count,(m.faces.length-shell.userData.replacedTriangles)*3);assert.equal(shell.userData.replacedTriangles,m.kind==='library'?2:4);assert.equal(node.userData.municipalElevation,true);}
 assert.equal(JSON.stringify(data),before,'facade replacement must not alter municipal coordinates or collision outlines');
 assert.ok(group.getObjectByName('Photo-guided theatre entrance'));
 let glazing=0;group.traverse(o=>{if(o.isMesh&&o.material.transparent){glazing++;assert.equal(o.material.depthWrite,false);}});assert.equal(glazing,3);
});
