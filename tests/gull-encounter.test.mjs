import test from 'node:test';
import assert from 'node:assert/strict';
import {GullEncounter,GULL_ENCOUNTER as RULES,gullFoodTarget} from '../src/gull-encounter.js';

const walker=extra=>({x:0,z:0,heading:0,speed:0,travelMode:'walk',...extra});
const cone=extra=>({item:{id:'soft-serve',encounter:'gulls',carry:'icecream'},state:'carry',age:1,...extra});
const gull=(id=1,extra={})=>({id,kind:'gull',x:5,y:4,z:0,...extra});
const tick=(sim,seconds,context,change=()=>{})=>{
 const drops=[];for(let t=0;t<seconds-1e-8;t+=.1){change(t);const event=sim.update(.1,context);if(event)drops.push(event);}
 return drops;
};
function fixture(){const sim=new GullEncounter(),player=walker(),hand=cone(),gulls=[gull()];return {sim,player,hand,gulls};}
function chase(f){tick(f.sim,RULES.gatherSeconds+.1,f);assert.equal(f.sim.snapshot().phase,'chase');return f.sim.birdTarget();}
function swoops(f,n=1){const target=f.sim.birdTarget();f.gulls=Array.from({length:n},(_,i)=>gull(i,{...target,id:i,encounterId:target.id,encounterPhase:'swoop'}));return f.gulls;}

test('ordinary food, handover, absent gulls and distant/non-gull birds never start a chase',()=>{
 const f=fixture();
 for(const hand of [null,cone({item:{id:'coffee'}}),cone({state:'handover'})]){
  tick(f.sim,4,{...f,hand});assert.equal(f.sim.birdTarget(),null);
 }
 for(const gulls of [[],[gull(1,{kind:'pigeon'})],[gull(1,{x:56})],[gull(1,{y:100})],[gull(1,{x:NaN})]]){
  tick(f.sim,4,{...f,gulls});assert.equal(f.sim.snapshot().phase,'idle');
 }
 assert.deepEqual(f.sim.drainMessages(),[]);
 tick(f.sim,.1,f);assert.equal(f.sim.snapshot().phase,'gather','a local gull is required to begin');
});

test('gather warning precedes chase, targets stay bounded and the controller does not alter actors or food',()=>{
 const f=fixture();f.gulls=Array.from({length:60},(_,i)=>gull(i));
 const before=JSON.stringify({player:f.player,hand:f.hand,gulls:f.gulls});
 tick(f.sim,2,f);const first=f.sim.birdTarget();assert.equal(first.phase,'gather');assert.equal(first.maxBirds,12);assert.equal(f.sim.snapshot().nearby,12);
 assert.equal(f.sim.drainMessages().length,1);
 tick(f.sim,.7,f);const next=f.sim.birdTarget();assert.equal(next.phase,'chase');assert.equal(next.id,first.id);
 assert.equal(f.sim.drainMessages().length,1);assert.deepEqual(f.sim.drainMessages(),[]);
 assert.equal(JSON.stringify({player:f.player,hand:f.hand,gulls:f.gulls}),before);
});

test('sustained close tagged swoops make a standing player drop exactly their cone once',()=>{
 const f=fixture();const target=chase(f);swoops(f,3);
 const drops=tick(f.sim,4,f);assert.equal(drops.length,1);const event=drops[0];
 assert.equal(event.reason,'gulls');assert.equal(event.hand,f.hand);assert.equal(event.item,f.hand.item);
 assert.equal(event.record.id,target.id);assert.equal(f.sim.birdTarget().phase,'dropped');assert.equal(f.sim.birdTarget().id,target.id);
 assert.equal(event.record.life,RULES.dropLife);assert.equal(event.record.y,.14);
 assert.deepEqual(tick(f.sim,2,f),[],'leaving the input hand unchanged cannot emit the same loss twice');
 assert.equal(f.sim.drop(f.player,f.hand),null,'manual input cannot duplicate an automatic drop');
});

test('gathering, untagged, high and duplicate birds cannot fake pressure',()=>{
 const f=fixture();const target=chase(f);
 f.gulls=[gull(1,{...target,id:1,encounterPhase:'swoop'}),gull(2,{...target,id:2,encounterId:target.id,encounterPhase:'gather'}),gull(3,{...target,id:3,y:5,encounterId:target.id,encounterPhase:'swoop'})];
 tick(f.sim,4,f);assert.equal(f.sim.snapshot().pressure,0);assert.equal(f.sim.snapshot().contacts,0);
 swoops(f);f.gulls=Array(40).fill(f.gulls[0]);f.sim.update(.1,f);assert.equal(f.sim.snapshot().contacts,1);
 assert.ok(f.sim.snapshot().pressure<.1,'the same bird counts only once');
});

test('running reduces loss pressure and travelling away permits escape without moving the player for them',()=>{
 const standing=fixture(),running=fixture();chase(standing);chase(running);swoops(standing,3);swoops(running,3);
 running.player.speed=4.8;
 const before={...running.player};tick(standing.sim,.5,standing);tick(running.sim,.5,running);
 assert.ok(running.sim.snapshot().pressure<standing.sim.snapshot().pressure/5);
 assert.deepEqual(running.player,before,'no automatic sprint or position changes');
 const drops=tick(running.sim,10,running,()=>{
  running.player.x+=.48;
  const target=gullFoodTarget(running.player);for(const b of running.gulls)Object.assign(b,target);
 });
 assert.equal(drops.length,0);assert.equal(running.sim.snapshot().outcome,'escaped');assert.equal(running.sim.birdTarget(),null);
 tick(running.sim,12,running);assert.equal(running.sim.birdTarget(),null,'the same hand object does not restart after escape');
});

test('encounters expire with food intact even if orbiting gulls keep following',()=>{
 const f=fixture(),target=chase(f);f.gulls=[gull(1,{...target,id:1,y:4,encounterId:target.id,encounterPhase:'chase'})];
 assert.deepEqual(tick(f.sim,RULES.lifetime+1,f),[]);assert.equal(f.sim.snapshot().outcome,'timeout');assert.equal(f.sim.birdTarget(),null);
 tick(f.sim,20,f);assert.equal(f.sim.snapshot().phase,'idle');assert.equal(f.hand.state,'carry');
});

test('manual drop keeps one cone for seven seconds, then clears the target and cools down',()=>{
 const f=fixture();chase(f);const old=f.sim.birdTarget();const event=f.sim.drop(f.player,f.hand);
 assert.equal(event.hand,f.hand);assert.equal(event.reason,'manual');assert.equal(event.record.id,old.id);assert.equal(f.sim.snapshot().dropped.item,f.hand.item);
 const context={...f,hand:null};tick(f.sim,6.9,context);assert.equal(f.sim.birdTarget().phase,'dropped');
 tick(f.sim,.2,context);assert.equal(f.sim.snapshot().dropped,null);assert.equal(f.sim.birdTarget(),null);assert.equal(f.sim.snapshot().phase,'cooldown');
 tick(f.sim,RULES.cooldown+.1,context);assert.equal(f.sim.snapshot().phase,'idle');
 const quiet=new GullEncounter(),hand=cone(),drop=quiet.drop(f.player,hand);assert.equal(drop.hand,hand);assert.equal(quiet.birdTarget(),null,'manual litter does not invent gull activity');
 tick(quiet,8,{player:f.player,hand:null,gulls:[]});assert.equal(quiet.snapshot().dropped,null);
});

test('paused and invalid time steps do not start or advance encounters or dropped food',()=>{
 const f=fixture();for(const dt of [0,-1,NaN,Infinity]){assert.equal(f.sim.update(dt,f),null);assert.equal(f.sim.snapshot().phase,'idle');}
 chase(f);swoops(f,3);f.sim.update(.1,f);const before=f.sim.snapshot(),target=f.sim.birdTarget();
 for(const dt of [0,-1,NaN,Infinity])f.sim.update(dt,f);
 assert.deepEqual(f.sim.snapshot(),before);assert.deepEqual(f.sim.birdTarget(),target);
 f.sim.drop(f.player,f.hand);const dropped=f.sim.snapshot();f.sim.update(0,{...f,hand:null});assert.deepEqual(f.sim.snapshot(),dropped);
 f.sim.update(1e6,{...f,hand:null});assert.equal(f.sim.snapshot().dropped.age,RULES.maxStep,'a stalled frame cannot instantly age out the food');
});

test('finish, mount, replacement, disabled play and teleport cancel before any stale drop',()=>{
 for(const change of [f=>({...f,hand:null}),f=>({...f,player:walker({travelMode:'bike'})}),f=>({...f,hand:cone()}),f=>({...f,enabled:false}),f=>({...f,player:walker({x:100})})]){
  const f=fixture();chase(f);swoops(f,3);tick(f.sim,.6,f);const replacement=change(f);
  assert.equal(f.sim.update(.1,replacement),null);assert.equal(f.sim.birdTarget(),null);assert.equal(f.sim.snapshot().dropped,null);
 }
 const f=fixture();chase(f);f.hand.state='using';f.sim.update(.1,f);assert.equal(f.sim.snapshot().phase,'chase','the held cone remains attractive while being eaten');
 f.sim.update(.1,{...f,hand:null});assert.equal(f.sim.snapshot().outcome,'finished');
 const reused=fixture();chase(reused);swoops(reused,3);reused.hand.item={...reused.hand.item,id:'new-cone'};
 assert.equal(reused.sim.update(.1,reused),null);assert.equal(reused.sim.snapshot().outcome,'replaced');assert.equal(reused.sim.birdTarget(),null);
});

test('new hand identities can start later and reset clears all state without reusing target ids',()=>{
 const f=fixture();chase(f);const first=f.sim.birdTarget().id;
 f.sim.update(.1,{...f,hand:cone()});tick(f.sim,RULES.cooldown+.1,{...f,hand:null});
 f.hand=cone();f.sim.update(.1,f);assert.equal(f.sim.snapshot().phase,'gather');assert.notEqual(f.sim.birdTarget().id,first);
 const second=f.sim.birdTarget().id;f.sim.drop(f.player,f.hand);f.sim.reset();
 assert.equal(f.sim.snapshot().phase,'idle');assert.equal(f.sim.snapshot().dropped,null);assert.equal(f.sim.birdTarget(),null);assert.deepEqual(f.sim.drainMessages(),[]);
 f.sim.update(.1,f);assert.notEqual(f.sim.birdTarget().id,second);
});

test('an exact rendered hand guides swoops; invalid or stale hand positions use the local fallback',()=>{
 const p=walker({heading:Math.PI/2}),exact={x:-.45,y:1.6,z:-.2};
 assert.deepEqual(gullFoodTarget(p,exact),exact);const fallback=gullFoodTarget(p);assert.ok(Math.abs(fallback.x+.25)<1e-8);assert.ok(Math.abs(fallback.z+.3)<1e-8);assert.equal(fallback.y,1.2);
 for(const bad of [{x:NaN,y:1,z:0},{x:0,y:200,z:0},{x:40,y:1,z:0}])assert.deepEqual(gullFoodTarget(p,bad),gullFoodTarget(p));
 const f=fixture();f.foodTarget=exact;f.sim.update(.1,f);const target=f.sim.birdTarget();assert.equal(target.x,exact.x);assert.equal(target.y,exact.y);
 const drop=f.sim.drop(f.player,f.hand,exact);assert.equal(drop.record.x,exact.x);assert.equal(drop.record.startY,exact.y);
});

test('actual bird approach passes cause standing loss and allow a running player to escape',async()=>{
 const {createBirdLife}=await import('../src/birds.js');
 for(const speed of [0,4.8]){
  const plan={flocks:[{id:0,kind:'gull',x:6,z:0,radius:9,alt:[3,7],count:12,walkers:6,spots:[{x:6,z:0}],perches:[],ground:.12,spread:1}]};
  const life=createBirdLife(plan,{seed:5}),sim=new GullEncounter(),player=walker({heading:-Math.PI/2,speed});
  let hand=cone(),drop=null;
  for(let frame=0;frame<1200;frame++){
   if(sim.snapshot().phase==='chase')player.x+=speed/30;
   const event=sim.update(1/30,{player,hand,gulls:life.birds});if(event){drop=event;hand=null;}
   life.step(1/30,{viewer:player,threats:[player],encounter:sim.birdTarget()});
   if(drop||sim.snapshot().outcome==='escaped'||sim.snapshot().outcome==='timeout')break;
  }
  assert.equal(life.birds.length,12,'the encounter recruits existing birds');
  if(speed===0){assert.equal(drop?.reason,'gulls');assert.equal(sim.birdTarget().phase,'dropped');}
  else{assert.equal(drop,null);assert.equal(sim.snapshot().outcome,'escaped');assert.ok(player.x>=RULES.escapeDistance);}
 }
});
