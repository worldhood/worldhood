import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {personLook,posePerson,advanceGait,createJoints,JOINT,PROPORTIONS,createPersonBatch,smoothHeading,accessoryOn,uniformTorsoGeometry} from '../src/person-model.js';
import {createRoadblock,officerLook,ARREST} from '../src/roadblock.js';
import {Finale} from '../src/finale.js';

test('a crowd mixes ages, outerwear, hair, scarves, dogs, strollers and phones',()=>{
 const looks=Array.from({length:600},(_,i)=>personLook(5003+i*11));
 const share=f=>looks.filter(f).length/looks.length;
 assert.ok(share(l=>l.age==='senior')>.05&&share(l=>l.age==='senior')<.16,'some older people');
 assert.ok(share(l=>l.age==='teen')>.03,'some teenagers');
 for(const outer of ['coat','puffer','hoodie','jacket'])assert.ok(share(l=>l.outer===outer)>.04,outer);
 for(const style of ['long','short','beanie','cap','bun','bob'])assert.ok(looks.some(l=>l.hairStyle===style),style);
 assert.ok(share(l=>l.scarf)>.15,'scarves');assert.ok(share(l=>l.skirt)>.05,'skirts');assert.ok(share(l=>l.bagType==='backpack')>.08,'backpacks');
 const dogs=share(l=>l.accessory==='dog'),strollers=share(l=>l.accessory==='stroller'),phones=share(l=>l.phoneWalk);
 assert.ok(dogs>.01&&dogs<.07&&strollers>.005&&strollers<.05&&phones>.03&&phones<.15,JSON.stringify({dogs,strollers,phones}));
 const heights=looks.map(l=>l.height);assert.ok(Math.max(...heights)-Math.min(...heights)>.35,'varied heights');
 assert.ok(looks.every(l=>l.stride>.75&&l.stride<1.1),'stride factor stays human');
 // Earlier draws are unchanged by the added ones: a seed keeps its colours.
 assert.equal(personLook(42).shirt,personLook(42).shirt);assert.equal(personLook(7,{shirt:'#000'}).shirt,'#000');
});

test('seniors stoop and take shorter steps; the gait clock follows the stride so feet do not skate',()=>{
 const senior=personLook(1,{age:'senior',stoop:.14,stride:.82,height:1.7}),adult=personLook(1,{age:'adult',stoop:0,stride:1,height:1.7});
 const run=look=>{const p={...look,x:0,z:0,heading:0,speed:1.2},g={};for(let i=0;i<60;i++)advanceGait(p,g,1/60,look);return {p,g};};
 const a=run(adult),s=run(senior);
 assert.ok(s.g.gaitPhase!==a.g.gaitPhase,'cadence differs with stride');
 const J=createJoints(),lean=look=>{const {p,g}=run(look);posePerson(p,look,g,J);return -J[JOINT.spineY+2];};
 assert.ok(lean(senior)>lean(adult)+.1,'stooped upper body');
 // Planted foot: while the same foot is the lowest, it moves back at exactly the walking speed.
 for(const speed of [.6,1.3,1.7]){
  const p={...adult,x:0,z:0,heading:0,speed},g={};for(let i=0;i<120;i++)advanceGait(p,g,1/60,adult);
  const prev=createJoints(),step=1/240;let worst=0;
  for(let i=0;i<480;i++){posePerson(p,adult,g,prev);advanceGait(p,g,step,adult);posePerson(p,adult,g,J);
   const low=a=>a[JOINT.ankleL+1]<a[JOINT.ankleR+1]?JOINT.ankleL:JOINT.ankleR,f=low(J);
   if(f===low(prev)&&J[f+1]<PROPORTIONS.ankle*adult.height+1e-4&&prev[f+1]<PROPORTIONS.ankle*adult.height+1e-4)worst=Math.max(worst,Math.abs((J[f+2]-prev[f+2])/step-speed));}
  assert.ok(worst<.05,`stance foot slides ${worst.toFixed(3)} m/s at ${speed} m/s`);
 }
});

test('dogs, strollers and phones are drawn only for free walkers and stay within the batch pools',()=>{
 const look=personLook(3,{accessory:'dog',height:1.75});
 assert.equal(accessoryOn({},look),'dog');assert.equal(accessoryOn({pose:'cycle'},look),null);assert.equal(accessoryOn({suitcase:true},look),null);
 assert.equal(accessoryOn({},{...look,height:1.2}),null,'children do not walk dogs alone');
 const batch=createPersonBatch(40);batch.begin();
 for(let i=0;i<40;i++)batch.draw({x:i,z:0,heading:0,speed:1.2,gaitWalk:1,gaitPhase:i},personLook(i,{accessory:i%2?'dog':'stroller',scarf:'#8a2f35',outer:'hoodie'}),{gaitWalk:1,gaitPhase:i});
 batch.end();
 for(const m of batch.list){assert.ok(m.count<=m.userData.capacity,m.name);assert.ok(m.instanceMatrix.array.slice(0,m.count*16).every(Number.isFinite),m.name);}
 assert.ok(batch.meshes.seg.count>40*19,'dogs and strollers add segments');
});

test('the rendered heading turns smoothly towards the walking direction',()=>{
 const g={};assert.equal(smoothHeading(g,1,1/60),1);
 let h=0;g.yaw=0;for(let i=0;i<3;i++)h=smoothHeading(g,Math.PI/2,1/60);
 assert.ok(h>0&&h<Math.PI/2*.5,'a right-angle turn takes several frames');
 for(let i=0;i<60;i++)h=smoothHeading(g,Math.PI/2,1/60);assert.ok(Math.abs(h-Math.PI/2)<.01,'and settles');
 g.yaw=3;for(let i=0;i<60;i++)h=smoothHeading(g,-3,1/60);assert.ok(Math.abs(Math.atan2(Math.sin(h+3),Math.cos(h+3)))<.02,'turns the short way across ±π');
});

test('officers wear the Finnish police uniform: navy jacket or hi-vis vest, peaked cap, no civilian extras',()=>{
 for(const vest of [false,true]){const l=officerLook(3,vest);
  assert.equal(l.uniform,vest?'vest':'jacket');assert.equal(l.hairStyle,'police');assert.equal(l.accessory,null);assert.equal(l.scarf,null);assert.equal(l.coat,0);}
 const g=uniformTorsoGeometry(),uv=g.attributes.uv,p=g.attributes.position;
 let back=null;for(let i=0;i<p.count;i++)if(p.getZ(i)>.99&&Math.abs(p.getY(i)-.66)<.2)back=uv.getX(i);
 assert.ok(back!==null&&Math.abs(back-.5)<.1,'the print centre (u=.5) is on the back (+z)');
 const batch=createPersonBatch(4,{police:true});assert.ok(batch.meshes.vest&&batch.meshes.jacket);
 batch.begin();batch.draw({x:0,z:0,heading:0,speed:0},officerLook(1,true),{});batch.draw({x:2,z:0,heading:0,speed:0},officerLook(2,false),{});batch.end();
 assert.deepEqual([batch.meshes.vest.count,batch.meshes.jacket.count,batch.meshes.torso.count],[1,1,0]);
});

function arrestWorld(){
 const at=()=>null,yes=()=>true;
 return {buildings:{at},cameraBuildings:{at},roads:{at:yes},pavement:{at:yes}};
}
test('the arrest scene runs to the end: out of the car, hands on the roof, cuffed, walked to the patrol car',()=>{
 const scene=new THREE.Scene(),carModel=new THREE.Group();carModel.userData.spec={l:4.6,w:1.85,h:1.6,belt:.95};
 const police={units:[{x:0,z:11,heading:0}],setParked(){},minUnits:0};
 const roadblock=createRoadblock(scene,{world:arrestWorld(),police,carModel}),car={x:0,z:0,heading:0,speed:0};
 const finale=new Finale();finale.arrest({car,police:{level:3}});roadblock.startArrest(car);
 const poses=new Set(),officerPoses=new Set();let t=0,ended=false,card=null,lean=0;
 while(t<12){t+=1/30;roadblock.update(1/30,car);const s=roadblock.snapshot().arrest;
  if(s.doorAt!==null){poses.add(s.driver.pose);for(const o of s.officers)officerPoses.add(o.pose);lean=Math.max(lean,s.driver.lean);}
  if(!ended&&finale.cinematicStep(1/30,roadblock.playing)){ended=true;card=s.doorAt===null?null:t-s.doorAt;}}
 const s=roadblock.snapshot().arrest;
 for(const p of ['grab','handsOnCar','cuffed'])assert.ok(poses.has(p),`driver ${p}`);
 for(const p of ['grab','cuffing','escort'])assert.ok(officerPoses.has(p),`officer ${p}`);
 assert.equal(s.driver.prone,false,'nobody is thrown face down any more');assert.ok(lean>.3,'leans onto the car');
 assert.ok(ended&&card>=ARREST.card-.05&&card<ARREST.up[0],`BUSTED card while the cuffs go on (${card})`);
 assert.ok(Math.hypot(s.driver.x-s.patrol.x,s.driver.z-s.patrol.z)<.5,'walked to the patrol car');
 assert.ok(Math.hypot(s.patrol.x-police.units[0].x,s.patrol.z-police.units[0].z)<2.5,'the patrol car is the nearest unit');
 for(const o of s.officers)assert.ok(Math.hypot(o.x-s.driver.x,o.z-s.driver.z)<1.2,'officers escort at arm\'s length');
 roadblock.clearArrest();assert.equal(roadblock.snapshot().arrest,null);
});
