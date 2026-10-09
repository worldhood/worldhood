import test from 'node:test';
import assert from 'node:assert/strict';
import {personLook,advanceGait,posePerson,createJoints,JOINT,PROPORTIONS,STANCE} from '../src/person-model.js';

const look=personLook(2026,{height:1.75,stride:1,stoop:0,phoneWalk:false,accessory:null});
function moving(speed,direction=1){
 const actor={speed,running:speed>2.5,pose:'walk',gaitDirection:direction},gait={};
 for(let i=0;i<120;i++)advanceGait(actor,gait,1/60,look);
 return {actor,gait};
}
const floor=(PROPORTIONS.ankle-.028)*look.height;

test('walking, running and reversing keep a supporting foot planted without sideways drift or floor penetration',()=>{
 for(const speed of [.4,1.3,2,2.6,4.8])for(const direction of [-1,1]){
  const {actor,gait}=moving(speed,direction),previous=createJoints(),current=createJoints(),dt=1/240;
  let planted=0,worst=0,airborne=0;
  for(let i=0;i<480;i++){
   posePerson(actor,look,gait,previous);advanceGait(actor,gait,dt,look);posePerson(actor,look,gait,current);
   for(const side of [0,3]){
    const heel=JOINT.heelL+side,toe=JOINT.toeL+side,ankle=JOINT.ankleL+side;
    assert.ok(current[heel+1]>=floor-1e-6&&current[toe+1]>=floor-1e-6,'shoe stays above the floor while rolling');
    if([previous,current].every(j=>Math.abs(j[heel+1]-floor)<1e-6&&Math.abs(j[toe+1]-floor)<1e-6)){
     planted++;worst=Math.max(worst,Math.abs((current[ankle+2]-previous[ankle+2])/dt-speed*direction),Math.abs((current[ankle]-previous[ankle])/dt));
    }
   }
   if(Math.min(...[JOINT.heelL,JOINT.heelR,JOINT.toeL,JOINT.toeR].map(j=>current[j+1]))>floor+.01)airborne++;
  }
  assert.ok(planted>15,`support measured at ${speed} m/s, direction ${direction}`);
  assert.ok(worst<.03,`support foot slips ${worst.toFixed(3)} m/s at ${speed} m/s`);
  if(speed<=2)assert.equal(airborne,0,'walking always keeps ground contact');
  if(speed===4.8)assert.ok(airborne>0,'running includes flight between foot contacts');
 }
});

test('heel strike, toe-off and the cycle wrap have continuous joint positions',()=>{
 for(const speed of [.4,1.3,2.6,4.8]){
  const {actor,gait}=moving(speed),before=createJoints(),after=createJoints(),stance=STANCE-.25*gait.gaitRun;
  for(const phase of [0,Math.PI/2,(.25+stance)*Math.PI*2]){
   gait.gaitPhase=phase-1e-6;posePerson(actor,look,gait,before);
   gait.gaitPhase=phase+1e-6;posePerson(actor,look,gait,after);
   const jump=Math.max(...after.map((n,i)=>Math.abs(n-before[i])));
   assert.ok(jump<1e-5,`joint jumps ${jump} m at ${speed} m/s, phase ${phase}`);
  }
 }
});

test('an abrupt speed change eases the stride instead of snapping the limbs, then settles to idle',()=>{
 const {actor,gait}=moving(4.8),before=createJoints(),after=createJoints();gait.gaitPhase=Math.PI/2;
 posePerson(actor,look,gait,before);actor.speed=0;actor.running=false;advanceGait(actor,gait,0,look);posePerson(actor,look,gait,after);
 assert.deepEqual(after,before,'changing speed without elapsed time does not change the visual pose');
 advanceGait(actor,gait,1/60,look);posePerson(actor,look,gait,after);
 for(const j of [JOINT.ankleL,JOINT.ankleR,JOINT.handL,JOINT.handR])assert.ok(Math.hypot(...[0,1,2].map(i=>after[j+i]-before[j+i]))<.12,'first braking frame is eased');
 for(let i=0;i<120;i++)advanceGait(actor,gait,1/60,look);
 posePerson(actor,look,gait,after);
 assert.ok(gait.gaitWalk<1e-5&&gait.gaitRun<1e-5&&gait.gaitSpeed<1e-8);
 assert.ok(Math.abs(after[JOINT.ankleL+2]-after[JOINT.ankleR+2])<1e-5,'feet return to an idle stance');
});

test('market carrying and eating keep the right hand target while the free arm follows the gait',()=>{
 for(const hold of [0,1]){
  const {actor,gait}=moving(1.6),j=createJoints();actor.hold=hold;let wrist=null,freeMin=Infinity,freeMax=-Infinity;
  for(let i=0;i<24;i++){
   gait.gaitPhase=i/24*Math.PI*2;posePerson(actor,look,gait,j);assert.ok(j.every(Number.isFinite));
   const now=Array.from(j.slice(JOINT.wristR,JOINT.wristR+3));
   if(wrist)assert.ok(Math.hypot(...now.map((n,k)=>n-wrist[k]))<1e-6,'held item stays in the requested hand position');
   wrist=now;freeMin=Math.min(freeMin,j[JOINT.handL+2]);freeMax=Math.max(freeMax,j[JOINT.handL+2]);
  }
  assert.ok(freeMax-freeMin>.2,'the other arm still swings naturally');
 }
});
