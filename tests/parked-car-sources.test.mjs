import test from 'node:test';
import assert from 'node:assert/strict';
import {BoxGeometry,InstancedMesh,Matrix4,MeshBasicMaterial} from 'three';
import {createParkedCarSource,instancedCarVisibility} from '../src/parked-car-sources.js';
import {SpatialIndex} from '../src/geo.js';

test('taking a parked car atomically removes its old collider and visual and reset restores it',()=>{
 const actor={id:'example',x:10,z:20,heading:.8,speed:0,edge:{}},edge=actor.edge;
 const obstacle={id:'example',rings:[[[9,18],[11,18],[11,22],[9,22]]]},index=new SpatialIndex([obstacle]),visibility=[];
 const source=createParkedCarSource({id:'example',actor,obstacle,visual:{type:'estate',paint:'#456789'},setHidden:hidden=>visibility.push(hidden)});
 assert.equal(source.obstacle,obstacle);assert.equal(index.at(10,20),obstacle);
 assert.equal(source.claim(),true);assert.equal(source.claim(),false);assert.equal(actor.playerTaken,true);assert.equal(actor.edge,null);assert.equal(index.at(10,20),undefined);assert.deepEqual(visibility,[true]);
 actor.x=100;actor.z=200;actor.heading=2;actor.speed=10;
 assert.equal(source.release(),true);assert.equal(source.release(),false);assert.equal(actor.playerTaken,false);assert.equal(actor.edge,edge);assert.equal(actor.x,10);assert.equal(actor.z,20);assert.equal(actor.heading,.8);assert.equal(actor.speed,0);assert.equal(index.at(10,20),obstacle);assert.deepEqual(visibility,[true,false]);
 assert.equal(source.claim(),true);assert.equal(source.release(),true,'can be taken again after reset');
});

test('already disabled or externally claimed props cannot be duplicated',()=>{
 const obstacle={disabled:true},actor={x:0,z:0,heading:0,speed:0,edge:{}},source=createParkedCarSource({id:'claimed',actor,obstacle,visual:{type:'taxi',paint:'#fff'}});
 assert.equal(source.claim(),false);assert.ok(actor.edge);obstacle.disabled=false;actor.playerTaken=true;
 assert.equal(source.claim(),false);assert.equal(obstacle.disabled,false);assert.equal(source.release(),false,'only the owner restores a claimed visual');
});

test('hiding one instanced car removes all of its parts, preserves its neighbours, and restores exact matrices',()=>{
 const body=new InstancedMesh(new BoxGeometry(),new MeshBasicMaterial(),3),wheels=new InstancedMesh(new BoxGeometry(),new MeshBasicMaterial(),12);
 const initial=new Map();
 for(const mesh of [body,wheels])for(let i=0;i<mesh.count;i++){const m=new Matrix4().makeRotationY(.2+i*.1);m.setPosition(i*7,.5,-i);mesh.setMatrixAt(i,m);initial.set(`${mesh.id}:${i}`,Array.from(mesh.instanceMatrix.array.slice(i*16,i*16+16)));}
 const parts=[{mesh:body,index:1},...Array.from({length:4},(_,i)=>({mesh:wheels,index:4+i}))],show=instancedCarVisibility(parts),selected=new Set(parts.map(({mesh,index})=>`${mesh.id}:${index}`));
 show(true);
 for(const mesh of [body,wheels])for(let i=0;i<mesh.count;i++){
  const m=new Matrix4();mesh.getMatrixAt(i,m);
  if(selected.has(`${mesh.id}:${i}`))assert.equal(m.determinant(),0,'taken car part is collapsed');
  else assert.deepEqual(m.elements,initial.get(`${mesh.id}:${i}`),'unclaimed neighbour is unchanged');
 }
 show(false);
 for(const mesh of [body,wheels])for(let i=0;i<mesh.count;i++){const m=new Matrix4();mesh.getMatrixAt(i,m);assert.deepEqual(m.elements,initial.get(`${mesh.id}:${i}`));}
 for(const mesh of [body,wheels]){mesh.geometry.dispose();mesh.material.dispose();}
});
