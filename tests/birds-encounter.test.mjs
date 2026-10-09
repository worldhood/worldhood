import test from 'node:test';
import assert from 'node:assert/strict';
import {createBirdLife,createBirdRenderer,createGullCalls,GULL_ENCOUNTER} from '../src/birds.js';

const flock=(extra={})=>({id:0,kind:'gull',x:0,z:0,radius:12,alt:[5,7],count:20,walkers:8,spots:[{x:5,z:0},{x:-5,z:0}],perches:[],ground:.12,...extra});
const fixture=()=>createBirdLife({flocks:[flock(),flock({id:1,kind:'pigeon',x:20,count:5,walkers:5,spots:[{x:20,z:0}]}),flock({id:2,x:300,count:4,walkers:0})]},{seed:4});
const target=(extra={})=>({id:'cone-1',phase:'gather',x:0,y:1.2,z:0,maxBirds:12,...extra});
const selected=life=>life.birds.filter(b=>b.encounterId!==undefined);
const finite=b=>[b.x,b.y,b.z,b.vx,b.vy,b.vz,b.heading,b.pitch,b.bank,b.flap,b.fold,b.peck].every(Number.isFinite);

test('a cone recruits at most twelve existing nearby gulls once, and introduces them gradually',()=>{
 const life=fixture(),original=new Set(life.birds),food=target({maxBirds:999});life.step(1/60,{viewer:food,encounter:food});
 const chosen=selected(life),ids=chosen.map(b=>b.id);
 assert.equal(chosen.length,GULL_ENCOUNTER.limit);assert.ok(chosen.every(b=>original.has(b)&&b.kind==='gull'&&b.flock.id===0));
 assert.ok(chosen.filter(b=>b.encounterPhase==='waiting').length>=10,'a whole flock does not launch in the same frame');
 for(let i=0;i<90;i++)life.step(1/30,{viewer:food,encounter:food});
 assert.ok(selected(life).every(b=>b.encounterPhase==='gather'),'nearby birds join over the gathering interval');
 const outsider=life.birds.find(b=>b.kind==='gull'&&!ids.includes(b.id));outsider.x=0;outsider.y=1.2;outsider.z=0;
 for(let i=0;i<30;i++)life.step(1/30,{viewer:food,encounter:food});
 assert.deepEqual(selected(life).map(b=>b.id),ids,'the selection is not rerolled every frame');
 assert.equal(life.birds.length,original.size);assert.ok(life.birds.filter(b=>b.kind!=='gull').every(b=>b.encounterId===undefined));
 life.clearEncounter();assert.equal(selected(life).length,0);
 life.step(0,{viewer:food,encounter:target({id:'elsewhere',x:3000,z:3000})});assert.equal(selected(life).length,0,'no nearby gulls means no invented flock');
});

test('walking draws staggered low passes with real hand contact, bounded movement and separate bird bodies',()=>{
 const life=fixture(),food=target(),hitIds=new Set();let contact=0,peakContacts=0;
 for(let frame=0;frame<30*23;frame++){
  const time=frame/30;food.phase=time<2.6?'gather':'chase';food.x=Math.max(0,time-2.6)*1.3;
  const before=life.birds.map(b=>[b.x,b.y,b.z]);life.step(1/30,{viewer:food,encounter:food,range:6});let touching=0;
  const gulls=selected(life);
  for(const b of gulls){
   assert.ok(finite(b));const p=before[b.id];assert.ok(Math.hypot(b.x-p[0],b.y-p[1],b.z-p[2])<=8.5/30,'a gull never teleports to the hand');
   if(b.encounterPhase==='swoop'&&Math.hypot(b.x-food.x,b.z-food.z)<1.3&&Math.abs(b.y-food.y)<.9){contact+=1/30;hitIds.add(b.id);touching++;}
   if(time>3)for(const other of gulls)if(other!==b)assert.ok(Math.hypot(b.x-other.x,b.y-other.y,b.z-other.z)>.37,'approaches do not pile all bodies into one point');
  }
  peakContacts=Math.max(peakContacts,touching);
 }
 assert.ok(contact>4&&hitIds.size>=6,'pressure can come from visible birds passing the hand');assert.ok(peakContacts<=4,'swoops are staggered');
 assert.ok(food.x>life.plan.flocks[0].radius+6&&life.plan.flocks[0].active,'a recruited flock stays active after walking away from its home range');
 const renderer=createBirdRenderer(life);renderer.update(food);assert.equal(renderer.mesh.isInstancedMesh,true);assert.ok(renderer.mesh.count>=selected(life).length&&renderer.mesh.count<=life.birds.length);
});

test('dropped food brings gulls down to distinct feeding spots, then cancellation releases them without teleporting',()=>{
 const life=fixture(),food=target();
 for(let i=0;i<210;i++)life.step(1/30,{viewer:food,encounter:{...food,phase:i<78?'gather':'chase'}});
 food.phase='dropped';food.y=.12;let peck=0;
 for(let i=0;i<210;i++){
  life.step(1/30,{viewer:food,encounter:food});for(const b of selected(life))if(b.encounterPhase==='feeding')peck=Math.max(peck,b.peck);
 }
 const feeding=selected(life).filter(b=>b.encounterPhase==='feeding');assert.ok(feeding.length>=10,'most of the nearby flock lands during the dropped-cone interval');assert.ok(peck>.6);
 for(const b of feeding){assert.equal(b.state,'ground');assert.ok(b.fold>.7);assert.ok(b.y>=food.y+.2*b.scale-1e-6,'feet do not enter the pavement');}
 const positions=life.birds.map(b=>[b.x,b.y,b.z]);life.clearEncounter();assert.deepEqual(life.birds.map(b=>[b.x,b.y,b.z]),positions);
 assert.equal(selected(life).length,0);assert.equal(life.snapshot().encounter,null);assert.ok(life.snapshot().returning>0);
 for(let i=0;i<30*45;i++)life.step(1/30,{viewer:food});
 assert.equal(life.snapshot().returning,0);assert.ok(life.birds.every(finite));assert.ok(life.birds.filter(b=>b.flock.id===0).every(b=>Math.hypot(b.x,b.z)<32),'the original flock resumes its home area');
});

test('a swept flight check diverts gulls over a solid canopy instead of through it',()=>{
 const life=createBirdLife({flocks:[flock({x:-6,count:8,walkers:8,spread:.4,spots:[{x:-6,z:-1},{x:-6,z:1}]})]},{seed:2});
 const food=target({x:8,maxBirds:8}),inside=p=>p.x>=0&&p.x<=3&&Math.abs(p.z)<3&&p.y<3.5;
 let rejections=0,overRoof=0;
 const safeFlight=(from,to)=>{const n=Math.max(1,Math.ceil(Math.hypot(to.x-from.x,to.y-from.y,to.z-from.z)/.05));for(let i=0;i<=n;i++){const t=i/n;if(inside({x:from.x+(to.x-from.x)*t,y:from.y+(to.y-from.y)*t,z:from.z+(to.z-from.z)*t})){rejections++;return false;}}return true;};
 for(let frame=0;frame<30*20;frame++){
  food.phase=frame<78?'gather':'chase';life.step(1/30,{viewer:food,encounter:food,safeFlight});
  for(const b of selected(life)){assert.ok(!inside(b),'a rejected move is never committed');assert.ok(finite(b));if(b.x>=0&&b.x<=3&&Math.abs(b.z)<3&&b.y>=3.5)overRoof++;}
 }
 assert.ok(rejections>0,'the test exercises blocked low flight');assert.ok(overRoof>0,'blocked gulls can climb and continue');
 assert.ok(selected(life).some(b=>b.x>4),'the flock gets past the obstacle without teleporting');
 life.clearEncounter();for(let i=0;i<30*30;i++){life.step(1/30,{viewer:food,safeFlight});for(const b of life.birds)assert.ok(!inside(b),'returning birds also respect the flight check');}
});

function audioContext(){
 const context={currentTime:0,destination:{},oscillators:[]},param=()=>({value:0,setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){}});
 context.createOscillator=()=>{const o={frequency:param(),ended:false,connect(){},disconnect(){},start(t){this.startTime=t;},stop(t=context.currentTime){this.stopTime=t;}};context.oscillators.push(o);return o;};
 context.createBiquadFilter=()=>({frequency:param(),Q:param(),connect(){},disconnect(){}});context.createGain=()=>({gain:param(),connect(){},disconnect(){}});
 context.tick=dt=>{context.currentTime+=dt;for(const o of context.oscillators)if(!o.ended&&context.currentTime>=o.stopTime){o.ended=true;o.onended?.();}};
 return context;
}

test('encounter chatter has a bounded cadence and global mute immediately stops scheduled calls',()=>{
 const calls=createGullCalls(),context=audioContext(),life={encounterActive:true,birds:[{kind:'gull',x:2,y:2,z:0,flock:{active:true}}]},listener={x:0,z:0};let peak=0;
 for(let i=0;i<600;i++){context.tick(1/60);calls.update(context,true,life,listener,1/60);peak=Math.max(peak,context.oscillators.filter(o=>!o.ended).length);}
 assert.ok(context.oscillators.length>=10&&context.oscillators.length<=24,'chatter comes in short groups, not every frame');assert.ok(peak<=3,'groups do not accumulate audio nodes');
 // Force another scheduled group before muting.
 life.encounterActive=false;calls.update(context,true,life,listener,0);life.encounterActive=true;context.tick(.21);calls.update(context,true,life,listener,.21);
 const before=context.oscillators.length;calls.update(context,false,life,listener,0);
 assert.ok(context.oscillators.every(o=>o.ended||o.stopTime<=context.currentTime),'mute cancels even calls scheduled later in the group');
 for(let i=0;i<120;i++)calls.update(context,false,life,listener,1/60);assert.equal(context.oscillators.length,before);
 calls.reset();
});
