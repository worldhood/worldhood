import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createPersonBatch,posePerson,advanceGait,personLook,createJoints,JOINT,PROPORTIONS,limbGeometry,torsoGeometry,headGeometry,hairGeometry} from '../src/person-model.js';

const dist=(J,a,b)=>Math.hypot(J[a]-J[b],J[a+1]-J[b+1],J[a+2]-J[b+2]);
const tris=g=>(g.index?.count??g.attributes.position.count)/3;
function walker(speed,extra={}){
 const p={...personLook(3),x:0,z:0,heading:0,speed,running:speed>3,pose:'walk',...extra};
 for(let i=0;i<120;i++)advanceGait(p,p,1/60);
 return p;
}
function cycle(p,fn){const J=createJoints();for(let i=0;i<24;i++){p.gaitPhase=i/24*Math.PI*2;posePerson(p,p,p,J);fn(J,p.gaitPhase);}}

test('person geometry is finite, rounded and cheap',()=>{
 const parts={limb:limbGeometry(),torso:torsoGeometry(),head:headGeometry(),hair:hairGeometry()};
 for(const [name,g] of Object.entries(parts)){assert.ok(g.attributes.position.array.every(Number.isFinite),name);assert.ok(g.attributes.normal.array.every(Number.isFinite),name);}
 // ~15 limb segments + torso + head + hair stays modest for crowds of hundreds
 // (8-segment limbs and a 14-segment skull so nothing reads faceted up close).
 const perPerson=15*tris(parts.limb)+tris(parts.torso)+tris(parts.head)+tris(parts.hair);
 assert.ok(perPerson<1700,`${perPerson} triangles per person`);
 const box=new THREE.Box3().setFromBufferAttribute(parts.head.attributes.position);
 assert.ok(box.max.y-(-.117)>.2&&box.max.y-(-.117)<.26,'head ~1/7.5 of a 1.75 m adult');
});

test('limbs stay attached at hips, knees, shoulders and elbows throughout the walk cycle',()=>{
 for(const speed of [0,.42,1.3,4.2])for(const pose of ['walk','phone','browse','chat'])for(const suitcase of [false,true]){
  const p=walker(speed,{pose,suitcase}),H=p.height,P=PROPORTIONS;
  cycle(p,J=>{
   assert.ok(J.every(Number.isFinite));
   for(const s of [0,3]){
    assert.ok(Math.abs(dist(J,JOINT.hipL+s,JOINT.kneeL+s)-P.thigh*H)<1e-3,'thigh length fixed: knee attached to hip');
    assert.ok(Math.abs(dist(J,JOINT.kneeL+s,JOINT.ankleL+s)-P.shin*H)<1e-3,'shin length fixed: ankle attached to knee');
    assert.ok(Math.abs(dist(J,JOINT.shoulderL+s,JOINT.elbowL+s)-P.upperArm*H)<1e-3,'upper arm hangs from the shoulder');
    assert.ok(Math.abs(dist(J,JOINT.elbowL+s,JOINT.wristL+s)-P.forearm*H)<.02,'forearm attached at the elbow');
    assert.ok(dist(J,JOINT.hipL+s,JOINT.pelvis)<.07*H,'hip joint on the pelvis');
    assert.ok(dist(J,JOINT.shoulderL+s,JOINT.neck)<.14*H,'shoulder on the torso');
    assert.ok(dist(J,JOINT.handL+s,JOINT.shoulderL+s)<(P.upperArm+P.forearm+P.hand)*H+1e-3,'hand within arm reach');
    assert.ok(dist(J,JOINT.toeL+s,JOINT.hipL+s)<(P.thigh+P.shin+.15)*H,'foot within leg reach');
   }
   const knee=Math.min(J[JOINT.kneeL+1],J[JOINT.kneeR+1]);assert.ok(knee>.18*H&&knee<.36*H);
   // A planted foot keeps contact: the lower ankle is at ankle height, never under the ground.
   assert.ok(Math.min(J[JOINT.ankleL+1],J[JOINT.ankleR+1])>=P.ankle*H-1e-6);
   // Walkers never float: a flat foot, or the toes of a foot rolling off, are on the ground.
   const contact=Math.min(...[JOINT.heelL,JOINT.heelR,JOINT.toeL,JOINT.toeR].map(j=>J[j+1]));
   if(speed<3)assert.ok(contact<(P.ankle-.028)*H+.006,'walkers never float');
   assert.ok(J[JOINT.head+1]>.88*H*(speed>3?.9:1)&&J[JOINT.head+1]<.97*H);
  });
 }
});

test('idle, walk and run poses differ in stride, knee bend, arm swing and lean',()=>{
 const measure=speed=>{const p=walker(speed);let stride=0,knee=0,arm=0,minY=Infinity,maxY=-Infinity,lean=0;
  cycle(p,J=>{stride=Math.max(stride,Math.abs(J[JOINT.ankleL+2]-J[JOINT.ankleR+2]));arm=Math.max(arm,Math.abs(J[JOINT.wristL+2]-J[JOINT.wristR+2]));
   const thigh=[J[JOINT.kneeL]-J[JOINT.hipL],J[JOINT.kneeL+1]-J[JOINT.hipL+1],J[JOINT.kneeL+2]-J[JOINT.hipL+2]],shin=[J[JOINT.ankleL]-J[JOINT.kneeL],J[JOINT.ankleL+1]-J[JOINT.kneeL+1],J[JOINT.ankleL+2]-J[JOINT.kneeL+2]];
   knee=Math.max(knee,Math.acos((thigh[0]*shin[0]+thigh[1]*shin[1]+thigh[2]*shin[2])/Math.hypot(...thigh)/Math.hypot(...shin)));
   minY=Math.min(minY,J[JOINT.pelvis+1]);maxY=Math.max(maxY,J[JOINT.pelvis+1]);lean=-J[JOINT.spineY+2];});
  return {stride,knee,arm,bob:maxY-minY,lean};};
 const idle=measure(0),walk=measure(1.3),run=measure(4.2);
 assert.ok(idle.stride<.06&&idle.arm<.12&&idle.knee<.2,JSON.stringify(idle));
 assert.ok(walk.stride>.45&&walk.knee>.7&&walk.arm>.2&&walk.bob>.01,JSON.stringify(walk));
 assert.ok(run.stride>walk.stride&&run.knee>walk.knee+.4&&run.lean>walk.lean+.1,JSON.stringify({walk,run}));
 // Cadence follows ground speed; standing still freezes the cycle.
 const rate=speed=>{const p={...personLook(1),speed,heading:0,x:0,z:0},g={gaitPhase:0};advanceGait(p,g,0);advanceGait(p,g,.1);return g.gaitPhase;};
 assert.equal(rate(0),0);assert.ok(rate(.42)<rate(1.3)&&rate(1.3)<rate(4.2));
});

test('instanced segments start at the solved joints in world space',()=>{
 const batch=createPersonBatch(4,{luggage:true}),J=createJoints();
 for(const [speed,heading,x,z] of [[0,0,10,5],[1.3,1.2,-4,7],[4.2,-2.4,30,-8]])for(let ph=0;ph<6.28;ph+=.7){
  const p={...personLook(9),x,z,heading,speed,running:speed>3,pose:'walk',coat:0,bagType:null,hairStyle:'short'};advanceGait(p,p,.5);p.gaitPhase=ph;
  batch.begin();batch.draw(p);batch.end();posePerson(p,p,p,J);
  const world=j=>new THREE.Vector3(x+J[j]*Math.cos(heading)+J[j+2]*Math.sin(heading),.13+J[j+1],z-J[j]*Math.sin(heading)+J[j+2]*Math.cos(heading));
  const axis=(i)=>{const m=new THREE.Matrix4();batch.meshes.seg.getMatrixAt(i,m);const e=m.elements;const a=new THREE.Vector3(e[12],e[13],e[14]);return new THREE.Line3(a,a.clone().add(new THREE.Vector3(e[4],e[5],e[6])));};
  const on=(i,j,label)=>{const l=axis(i),q=world(j),c=new THREE.Vector3();l.closestPointToPoint(q,true,c);assert.ok(c.distanceTo(q)<.005,`${label} ${c.distanceTo(q)}`);};
  // Per person: thighL, shinL, footL, thighR, shinR, footR, pelvis, upperL, foreL, handL, upperR, foreR, handR.
  for(const s of [0,1]){on(s*3,JOINT.hipL+s*3,'thigh at hip');on(s*3,JOINT.kneeL+s*3,'thigh at knee');on(s*3+1,JOINT.kneeL+s*3,'shin at knee');on(s*3+1,JOINT.ankleL+s*3,'shin at ankle');
   on(7+s*3,JOINT.shoulderL+s*3,'upper arm at shoulder');on(7+s*3,JOINT.elbowL+s*3,'upper arm at elbow');on(8+s*3,JOINT.elbowL+s*3,'forearm at elbow');on(9+s*3,JOINT.wristL+s*3,'hand at wrist');}
  for(const m of batch.list)assert.ok(m.instanceMatrix.array.slice(0,m.count*16).every(Number.isFinite));
 }
});

test('person batches stay within the draw-call budget and keep knockdown poses',()=>{
 const batch=createPersonBatch(50,{luggage:true});
 // Six near meshes plus three far-level meshes (distant torsos/coats, heads, limbs; see PERSON_LOD).
 assert.ok(batch.list.length<=9,'one shared set of person meshes per crowd');
 assert.ok(batch.list.every(m=>m.isInstancedMesh));
 const p={...personLook(2),x:0,z:0,heading:.5,speed:0,knockdown:{elapsed:1,duration:6.5,side:1}};
 batch.begin();batch.draw(p);batch.end();
 const m=new THREE.Matrix4();batch.meshes.torso.getMatrixAt(0,m);
 const up=new THREE.Vector3(m.elements[4],m.elements[5],m.elements[6]).normalize();assert.ok(Math.abs(up.y)<.2,'fallen torso lies on its side');
 batch.meshes.seg.getMatrixAt(0,m);assert.ok(m.elements.every(Number.isFinite));
 // Invisible people are skipped entirely rather than drawn at zero scale.
 batch.begin();batch.end();assert.ok(batch.list.every(mesh=>mesh.count===0));
});
