import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createLaivasillankatuSigns,LAIVASILLANKATU_SIGN_REFERENCE as reference,LAIVASILLANKATU_SIGN_FACES as signs} from '../src/laivasillankatu-signs.js';

test('Laivasillankatu photographed symbols and bilingual tram plate are preserved',()=>{
  assert.deepEqual(signs.map(s=>s.turn),['left','straight','straight','straight']);
  assert.deepEqual(reference.plate,['Raitiovaunut','Spårvagnar']);
  assert.equal(signs.filter(s=>s.tramPlate).length,1);assert.equal(signs[1].tramPlate,true);
  assert.equal(reference.capture,'2024-08');assert.match(reference.accuracy,/not surveyed/);
});
test('suspended sign kit has bounded finite geometry, one-sided faces and only a solid support at ground level',()=>{
  const group=createLaivasillankatuSigns({canvasFactory:()=>null});group.updateMatrixWorld(true);
  assert.ok(group.children.length<=5);assert.equal(group.obstacles.length,1);assert.equal(group.obstacles[0].collisionMode,'solid');assert.equal(group.worldObjects.filter(o=>o.collisionMode==='overhead').length,4);
  assert.ok(new THREE.Box3().setFromObject(group).max.y<10);
  const plate=group.getObjectByName('Raitiovaunut / Spårvagnar');assert.ok(plate.position.y>5);
  const normal=new THREE.Vector3(0,0,1).applyQuaternion(group.quaternion);assert.ok(normal.z>.9&&normal.x>.2);
  group.traverse(o=>{if(o.isMesh){assert.ok(Array.from(o.geometry.attributes.position.array).every(Number.isFinite));assert.equal(o.material.side,THREE.FrontSide);o.geometry.dispose();o.material.dispose();}});
});
