import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createHavisAmanda,HAVIS_AMANDA_REFERENCE} from '../src/havis-amanda.js';
test('Amanda has a separate standing figure, four sea lions and fish, upper bowl and bounded original geometry',()=>{
 const a=createHavisAmanda({x:0,z:0});assert.equal(HAVIS_AMANDA_REFERENCE.seaLions,4);assert.equal(a.group.userData.fish,4);
 assert.ok(a.group.getObjectByName('Amanda figure — turned head and hand at neck'));
 const bounds=new THREE.Box3().setFromObject(a.group);assert.ok(bounds.max.y>5&&bounds.max.y<5.5);assert.ok(bounds.max.x<=5&&bounds.min.x>=-5);
 let triangles=0,meshes=0;a.group.traverse(m=>{if(!m.isMesh)return;meshes++;const g=m.geometry;assert.ok(g.attributes.position.array.every(Number.isFinite));triangles+=(g.index?.count??g.attributes.position.count)/3;});
 assert.ok(meshes<16,`${meshes} draw calls`);assert.ok(triangles<85000,`${triangles} triangles`);
});
test('fountain spray animates only near the player and remains finite',()=>{
 const a=createHavisAmanda({x:0,z:0}),spray=a.group.children.find(m=>m.isPoints),before=Array.from(spray.geometry.attributes.position.array);
 a.update(1,{x:0,z:0});assert.ok(spray.geometry.attributes.position.array.some((v,i)=>v!==before[i]));assert.ok(spray.geometry.attributes.position.array.every(Number.isFinite));
 a.update(2,{x:1000,z:0});assert.equal(spray.visible,false);a.update(3,{x:20,z:10});assert.equal(spray.visible,true);
});
