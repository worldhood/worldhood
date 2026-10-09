import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createPersonBatch,facePose,headGeometry,hairGeometry,personLook,PERSON_LOD} from '../src/person-model.js';

test('eyes, brows and lips face forward and remain in front of the skin and hairline',()=>{
 const head=headGeometry(),p=head.attributes.position,f=head.attributes.faceFeature,n=head.attributes.normal;
 const skin=[];for(let i=0;i<p.count;i++)if(f.getX(i)===0)skin.push(p.getX(i),p.getY(i),p.getZ(i));
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(skin,3));
 const material=new THREE.MeshBasicMaterial({side:THREE.DoubleSide}),skull=new THREE.Mesh(geometry,material),hair=new THREE.Mesh(hairGeometry(),material);
 const ray=new THREE.Raycaster(),direction=new THREE.Vector3(0,0,1),features=new Set();
 for(let i=0;i<p.count;i++)if(f.getX(i)>0){
  features.add(f.getX(i));assert.ok(n.getZ(i)<-.4,'facial details are visible from the front');
  const x=p.getX(i),y=p.getY(i),z=p.getZ(i);ray.set(new THREE.Vector3(x,y,-1),direction);
  const surface=ray.intersectObject(skull)[0];assert.ok(surface&&z<surface.point.z-.0001,'features are not buried in the skull');
  if(f.getX(i)<=3){const fringe=ray.intersectObject(hair)[0];assert.ok(!fringe||z<fringe.point.z,'eyes and brows clear the hairline');}
 }
 assert.deepEqual([...features].sort(),[1,2,3,4,5]);
 assert.ok(p.count/3<=390,'facial detail stays inside the existing per-person triangle budget');
 for(const g of [head,geometry,hair.geometry])g.dispose();material.dispose();
});

test('speaking has continuous, bounded syllables and stops when the actor stops speaking',()=>{
 const look=personLook(42),actor={speaking:true,pose:'chat'},gait={},values=[];
 for(let i=0;i<720;i++){gait.gaitClock=i/240;const face=facePose(actor,look,gait);assert.ok(face.every(Number.isFinite));values.push(face[0]);}
 assert.ok(Math.max(...values)>.65&&Math.min(...values)<.08,'speech includes open vowels and closed rests');
 assert.ok(values.slice(1).every((value,i)=>Math.abs(value-values[i])<.06),'mouth motion is continuous between rendered frames');
 actor.speaking=false;assert.equal(facePose(actor,look,gait)[0],0,'listening does not continue lip movement');
 actor.speaking=true;actor.mouthOpen=.32;assert.ok(Math.abs(facePose(actor,look,gait)[0]-.32)<1e-6,'an audio envelope overrides the procedural cycle');
 actor.mouthOpen=9;assert.equal(facePose(actor,look,gait)[0],1);actor.mouthOpen=-1;assert.equal(facePose(actor,look,gait)[0],0);
});

test('expressions and blinks are readable, deterministic and independent for each character',()=>{
 const look=personLook(16),gait={gaitClock:1},shape=expression=>facePose({expression},look,gait);
 assert.ok(shape('friendly')[1]>0&&shape('concerned')[1]<0,'smile and concern change the mouth corners');
 assert.ok(shape('surprised')[2]>shape('neutral')[2]&&shape('angry')[2]<0,'brow height reflects the expression');
 assert.ok(shape('concerned')[6]<shape('angry')[6],'concern raises the inner brow; anger lowers it');
 assert.deepEqual(shape('toString'),shape('neutral'),'unknown expressions safely fall back');
 assert.deepEqual(personLook(16),look,'facial variation is stable for a saved character seed');
 assert.notEqual(personLook(17).eyeSpacing,look.eyeSpacing);assert.notEqual(personLook(17).mouthWidth,look.mouthWidth);
 const firstBlink=Array.from({length:12},(_,i)=>{const l=personLook(i);for(let t=0;t<6;t+=.02)if(facePose({},l,{gaitClock:t})[3]>.8)return t;});
 assert.ok(new Set(firstBlink).size>8,'a crowd does not blink in unison');
 let closed=0,open=0;for(let t=0;t<6;t+=.01){const b=facePose({},look,{gaitClock:t})[3];if(b>.8)closed++;if(b<.01)open++;}
 assert.ok(closed>0&&open>500,'a brief blink leaves the eyes open most of the time');
});

test('nearby faces animate per instance without extra draw calls; distant crowds keep the cheaper LOD',()=>{
 const batch=createPersonBatch(3),look=personLook(5),actor={x:0,z:0,heading:0,speed:0,speaking:true,mouthOpen:.7};
 batch.begin({x:0,z:0});batch.draw(actor,look,{gaitClock:1});batch.draw({...actor,x:1,mouthOpen:.1},look,{gaitClock:1});batch.draw({...actor,x:PERSON_LOD.face+1},look,{gaitClock:1});batch.end();
 const {faceState,faceShape}=batch.meshes.head.geometry.attributes;
 assert.equal(batch.list.length,9);assert.ok(batch.list.every(m=>m.isInstancedMesh));assert.equal(faceState.count,3);
 assert.ok(Math.abs(faceState.getX(0)-.7)<1e-6&&Math.abs(faceState.getX(1)-.1)<1e-6,'each nearby head gets its own speech envelope');
 assert.equal(faceState.getX(2),0,'facial animation is skipped beyond the conversation detail distance');
 assert.deepEqual(faceState.updateRanges,[{start:0,count:12}]);assert.deepEqual(faceShape.updateRanges,[{start:0,count:12}]);
 batch.begin({x:0,z:0});batch.draw({...actor,x:PERSON_LOD.detail+1},look,{});batch.end();
 assert.equal(batch.meshes.head.count,0);assert.equal(batch.meshes.lowHead.count,1);assert.equal(batch.meshes.lowHead.geometry.attributes.faceState,undefined,'far heads carry no facial animation attributes');
 batch.begin({x:0,z:0});assert.equal(batch.draw({...actor,x:PERSON_LOD.hide+1},look,{}),false);batch.end();assert.ok(batch.list.every(mesh=>mesh.count===0));
});
