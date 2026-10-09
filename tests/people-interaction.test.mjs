import test from 'node:test';
import assert from 'node:assert/strict';
import {SpatialIndex} from '../src/geo.js';
import {PeopleInteraction,nearestTalker,clearConversationPath,TALK_DISTANCE,CONVERSATION_TIMEOUT} from '../src/people-interaction.js';
import {createInstancedPeople} from '../src/market-life.js';

const rect=(x,z,w,d)=>({rings:[[[x,z],[x+w,z],[x+w,z+d],[x,z+d]]]});
const world=({walls=[],water=[],roads=[]}={})=>({buildings:new SpatialIndex(walls),water,roads:new SpatialIndex(roads),pavement:new SpatialIndex([])});
const player=(extra={})=>({x:0,z:0,heading:0,speed:0,travelMode:'walk',...extra});
const person=(extra={})=>({id:'walker-1',x:0,z:-2,heading:1,speed:1.1,walking:true,edge:{crossing:false},s:40,pose:'walk',...extra});

test('the nearest available pedestrian can be greeted only on foot and within reach',()=>{
 const w=world(),a=person(),b=person({id:'closer',x:1,z:0}),p=player();
 assert.equal(nearestTalker(p,[a,b],w),b);
 for(const mode of ['car','bike','scooter'])assert.equal(nearestTalker(player({travelMode:mode}),[a,b],w),null);
 assert.equal(nearestTalker(p,[person({x:TALK_DISTANCE+.01,z:0})],w),null);
 assert.equal(nearestTalker(p,[person({edge:null}),person({running:true}),person({knockdown:{}}),person({walking:false})],w),null);
 assert.equal(nearestTalker(p,[person({edge:{crossing:true}})],world({roads:[rect(-1,-3,2,2)]})),null,'do not stop someone in a crossing');
});

test('talking cannot reach through a building or across open water, but a mapped bridge is allowed',()=>{
 const p=player(),a=person(),barrier=rect(-1,-1.4,2,.8);
 assert.equal(clearConversationPath(p,a,world({walls:[barrier]})),false);
 assert.equal(nearestTalker(p,[a],world({walls:[barrier]})),null);
 assert.equal(clearConversationPath(p,a,world({water:[barrier]})),false);
 assert.equal(clearConversationPath(p,a,world({water:[barrier],roads:[rect(-1,-3,2,4)]})),true);
 assert.equal(clearConversationPath(p,person({z:-10000}),world()),false,'reject an oversized ray before sampling');
 assert.equal(clearConversationPath(p,person({x:NaN}),world()),false);
});

test('a greeting stops just the selected pedestrian, faces them toward the player, and leaves route state intact',()=>{
 const a=person(),b=person({id:'other',z:-2.5}),p=player(),chat=new PeopleInteraction(world()),old={edge:a.edge,s:a.s,heading:a.heading,pose:a.pose};
 chat.update(.01,p,[a,b]);assert.equal(chat.snapshot().nearby,true);
 assert.equal(chat.interact(p,[a,b]).ok,true);
 assert.equal(chat.snapshot().active,true);assert.equal(a.conversation,true);assert.equal(a.speed,0);assert.equal(a.pose,'chat');
 assert.equal(a.edge,old.edge);assert.equal(a.s,old.s);assert.equal(b.speed,1.1);assert.equal(b.conversation,undefined);
 assert.ok(Math.abs(Math.cos(a.heading)+1)<1e-9,'NPC faces the player behind them');
 p.x=1;chat.update(.1,p,[a,b]);assert.equal(a.heading,Math.atan2(-1,-2));
 assert.equal(chat.close(),true);assert.equal(chat.close(),false);
 assert.equal(a.conversation,undefined);assert.equal(a.pose,old.pose);assert.equal(a.heading,old.heading);assert.equal(a.s,old.s);assert.equal(a.edge,old.edge);
});

test('a crowd pedestrian stays in place during a conversation and resumes its walk after goodbye',()=>{
 const crowd=createInstancedPeople([{id:'local',x:0,z:0,heading:0,pose:'walk',phase:0}],{safe:()=>true}),a=crowd.people[0],p=player({x:2}),chat=new PeopleInteraction(world());
 chat.update(0,p,crowd.people);assert.equal(chat.interact(p,crowd.people).ok,true);
 const start=[a.x,a.z];
 for(let i=0;i<60;i++){chat.update(1/30,p,crowd.people);crowd.update(1/30,p);}
 assert.deepEqual([a.x,a.z],start);assert.equal(a.speed,0);
 assert.equal(chat.choose('bye').closed,true);
 for(let i=0;i<60;i++)crowd.update(1/30,p);
 assert.ok(Math.hypot(a.x-start[0],a.z-start[1])>.1,'NPC resumes its own route');
});

test('walk-away, blocked sight, removing the NPC, pause, mounting and timeout all release the pedestrian',()=>{
 const scenarios=[
  ({p})=>{p.x=10;},
  ({chat})=>{chat.world=world({walls:[rect(-1,-1.4,2,.8)]});},
  ({people})=>{people.length=0;},
  ({flags})=>{flags.enabled=false;},
  ({p})=>{p.travelMode='bike';},
  ({chat,p,people})=>{chat.update(CONVERSATION_TIMEOUT,p,people);},
  ({a})=>{a.knockdown={};},
  ({a})=>{a.edge=null;},
 ];
 for(const change of scenarios){
  const a=person(),p=player(),people=[a],flags={enabled:true},chat=new PeopleInteraction(world());
  assert.equal(chat.interact(p,people,flags).ok,true);change({a,p,people,flags,chat});chat.update(.01,p,people,flags);
  assert.equal(chat.snapshot().active,false);assert.equal(a.conversation,undefined);assert.equal(a.pose,'walk');
 }
});

test('replies remain local scripted choices and activity extends the short conversation',()=>{
 const a=person({id:'<script>alert(1)</script>'}),p=player(),chat=new PeopleInteraction(world());chat.interact(p,[a],{enabled:true});
 chat.update(CONVERSATION_TIMEOUT-1,p,[a]);
 const before=chat.snapshot();assert.equal(before.timeLeft,1);assert.doesNotThrow(()=>JSON.stringify(before));
 for(const choice of ['hello','day','explore']){const answer=chat.choose(choice);assert.equal(answer.ok,true);assert.ok(answer.message.length>10);assert.equal(chat.snapshot().timeLeft,CONVERSATION_TIMEOUT);}
 assert.equal(chat.choose('__proto__').ok,false);assert.equal(chat.choose('constructor').ok,false);
 assert.equal(chat.choose('bye').closed,true);assert.equal(chat.choose('hello').ok,false);
});

test('interact rechecks a stale target and cannot open while disabled, and reset clears all old-city state',()=>{
 const a=person(),p=player(),chat=new PeopleInteraction(world());chat.update(.01,p,[a]);
 a.x=20;assert.equal(chat.interact(p,[a]).ok,false,'a previously nearby person moved away');a.x=0;
 assert.equal(chat.interact(p,[a],{enabled:false}).ok,false);
 assert.equal(chat.interact(p,[a],{enabled:true}).ok,true);
 const next=world();chat.reset(next);assert.equal(chat.world,next);assert.equal(chat.snapshot().active,false);assert.equal(chat.snapshot().nearby,false);assert.equal(a.conversation,undefined);
});

test('conversations also work with standing people that have no pose or heading properties',()=>{
 const a={id:'standing',x:2,z:0,walking:true,speed:0},p=player({x:0}),chat=new PeopleInteraction(world());
 assert.equal(chat.interact(p,[a],{enabled:true}).ok,true);assert.equal(a.pose,'chat');
 assert.equal(chat.interact(p,[a],{enabled:true}).closed,true);
 assert.equal(Object.hasOwn(a,'pose'),false);assert.equal(Object.hasOwn(a,'heading'),false);
});
