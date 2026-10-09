// A cone attracts existing local gulls; this controller never moves the player,
// creates birds, changes inventory or reads a particular city's coordinates.
// Apply a returned drop with MarketShop.drop({hand:event.hand}) so inventory
// replacement between input and application cannot remove a different item.
export const GULL_ENCOUNTER=Object.freeze({
 range:55,maxBirds:12,gatherSeconds:2.6,lifetime:36,
 contactRadius:1.3,contactHeight:.9,minChaseSeconds:3,
 pressureRate:.55,runPressureRate:.03,
 escapeDistance:34,escapeSeconds:1.5,dropLife:7,cooldown:6,
 teleportDistance:18,maxStep:.25,
});

const finite=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.z);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const gap=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const walking=p=>finite(p)&&(p.travelMode?p.travelMode==='walk':p.walking!==false);
const cone=h=>h&&typeof h==='object'&&h.item?.encounter==='gulls'&&(h.state==='carry'||h.state==='using');
const gull=b=>b?.kind==='gull'&&finite(b)&&Number.isFinite(b.y)&&!b.disabled&&!b.hidden&&b.visible!==false;

// x/z are world coordinates; y is height above the local ground, like birds.y.
// A stale renderer hand from another location falls back to the current player.
export function gullFoodTarget(player,foodTarget){
 if(!finite(player))return null;
 if(finite(foodTarget)&&Number.isFinite(foodTarget.y)&&foodTarget.y>=.15&&foodTarget.y<=2.6&&gap(foodTarget,player)<=2.5){
  return {x:foodTarget.x,y:foodTarget.y,z:foodTarget.z};
 }
 const a=Number.isFinite(player.heading)?player.heading:0;
 return {x:player.x+Math.cos(a)*.3-Math.sin(a)*.25,y:1.2,z:player.z-Math.sin(a)*.3-Math.cos(a)*.25};
}

function nearbyGulls(birds,point){
 let count=0;const seen=new Set();
 for(const b of birds){
  if(!gull(b)||Math.hypot(b.x-point.x,b.y-point.y,b.z-point.z)>GULL_ENCOUNTER.range)continue;
  const key=b.id??b;if(seen.has(key))continue;seen.add(key);
  if(++count===GULL_ENCOUNTER.maxBirds)break;
 }
 return count;
}

function pursuingGulls(birds,target){
 let contacts=0,nearest=Infinity,count=0;const seen=new Set();
 for(const b of birds){
  if(!gull(b)||b.encounterId!==target.id||b.flock?.active===false||b.encounterPhase==='return')continue;
  const key=b.id??b;if(seen.has(key))continue;seen.add(key);
  const d=gap(b,target);nearest=Math.min(nearest,d);
  if(b.encounterPhase==='swoop'&&d<=GULL_ENCOUNTER.contactRadius&&Math.abs(b.y-target.y)<=GULL_ENCOUNTER.contactHeight)contacts++;
  if(++count===GULL_ENCOUNTER.maxBirds)break;
 }
 return {contacts,nearest,count};
}

export class GullEncounter{
 constructor(){this.serial=0;this.reset();}
 reset(){
  // Keep ids monotonic: a bird returning from the previous play session must
  // never count as contact with a newly purchased cone after reset.
  this.session=null;this.dropped=null;this.cooldown=0;this.outcome=null;
  this.messages=[];this.seen=new WeakSet();this.droppedHands=new WeakSet();
  this.lastPlayer=null;this.localGulls=0;this.dropLure=false;
 }
 say(message){this.messages.push(message);if(this.messages.length>6)this.messages.shift();}
 finish(reason,{message=''}={}){
  if(this.session||this.dropped)this.cooldown=GULL_ENCOUNTER.cooldown;
  this.session=null;this.dropped=null;this.dropLure=false;this.localGulls=0;this.outcome=reason;
  if(message)this.say(message);
 }
 start(player,hand,target){
  this.seen.add(hand);this.outcome=null;
  this.session={id:`gull-cone-${++this.serial}`,hand,item:hand.item,phase:'gather',age:0,phaseAge:0,
   anchor:{x:player.x,z:player.z},target,pressure:0,contacts:0,pursuing:0,running:false,escape:0};
  this.say('The gulls have spotted your ice cream.');
 }
 update(dt,{player,hand,gulls=[],enabled=true,foodTarget}={}){
  const step=Number.isFinite(dt)?clamp(dt,0,GULL_ENCOUNTER.maxStep):0;
  const birds=Array.isArray(gulls)?gulls:[],previous=this.lastPlayer;
  this.lastPlayer=finite(player)?{x:player.x,z:player.z}:null;
  if(!enabled||!walking(player)){
   if(this.session||this.dropped)this.finish(!enabled?'disabled':finite(player)?'mounted':'invalid-player');
   this.localGulls=0;return null;
  }
  const moved=previous?gap(player,previous):0;
  if((this.session||this.dropped)&&moved>GULL_ENCOUNTER.teleportDistance){
   this.finish('teleport');if(cone(hand))this.seen.add(hand);return null;
  }
  // Check identity before pressure or an automatic drop. An eaten/replaced cone
  // ends the old chase even when the inventory changed during a paused frame.
  if(this.session&&(this.session.hand!==hand||this.session.item!==hand?.item||!cone(hand))){
   this.finish(hand&&(this.session.hand!==hand||this.session.item!==hand.item)?'replaced':'finished');return null;
  }
  if(step===0)return null;
  const target=gullFoodTarget(player,foodTarget);
  this.localGulls=nearbyGulls(birds,target);
  if(this.dropped){
   this.dropped.age=Math.min(this.dropped.life,this.dropped.age+step);
   this.dropLure||=nearbyGulls(birds,this.dropped)>0;
   if(this.dropped.age>=this.dropped.life)this.finish('dropped');
   return null;
  }
  if(this.cooldown>0){this.cooldown=Math.max(0,this.cooldown-step);if(this.cooldown>0)return null;}
  if(!this.session){
   if(!cone(hand)||this.seen.has(hand)||!this.localGulls)return null;
   this.start(player,hand,target);
  }
  const s=this.session;
  s.age+=step;s.phaseAge+=step;s.target=target;
  const speed=Number.isFinite(player.speed)?Math.abs(player.speed):moved/step;
  s.running=speed>=3.2;
  if(s.age>=GULL_ENCOUNTER.lifetime){this.finish('timeout',{message:'The gulls lose interest.'});return null;}
  if(s.phase==='gather'){
   if(s.phaseAge<GULL_ENCOUNTER.gatherSeconds)return null;
   s.phase='chase';s.phaseAge-=GULL_ENCOUNTER.gatherSeconds;
   this.say('They’re after the cone. Run, or drop it to distract them.');
  }
  const {contacts,nearest,count}=pursuingGulls(birds,{...target,id:s.id});
  s.contacts=contacts;s.pursuing=count;
  const distance=gap(player,s.anchor);
  const leaving=distance>=GULL_ENCOUNTER.escapeDistance&&s.running||distance>=55||nearest>14&&(distance>=15||s.phaseAge>5);
  s.escape=leaving?s.escape+step:Math.max(0,s.escape-step*2);
  if(s.escape>=GULL_ENCOUNTER.escapeSeconds){this.finish('escaped',{message:'You got away with your ice cream.'});return null;}
  // Only visible, tagged swoops close to the actual hand build pressure. Running
  // greatly reduces that gain and lets gaps between passes restore your grip.
  const gain=contacts?Math.min(contacts,3)*(s.running?GULL_ENCOUNTER.runPressureRate:GULL_ENCOUNTER.pressureRate):s.running?-.55:-.08;
  s.pressure=clamp(s.pressure+gain*step,0,1);
  if(contacts&&s.pressure>=1&&s.phaseAge>=GULL_ENCOUNTER.minChaseSeconds)return this.releaseCone(player,hand,'gulls',foodTarget);
  return null;
 }
 releaseCone(player,hand,reason,foodTarget){
  if(!walking(player)||!cone(hand)||this.droppedHands.has(hand))return null;
  const target=gullFoodTarget(player,foodTarget),active=this.session?.hand===hand?this.session:null;
  this.seen.add(hand);this.droppedHands.add(hand);
  this.dropped={id:active?.id||`gull-cone-${++this.serial}`,item:hand.item,x:target.x,y:.14,z:target.z,
   heading:Number.isFinite(player.heading)?player.heading:0,startY:target.y,age:0,life:GULL_ENCOUNTER.dropLife};
  this.dropLure=!!active||this.localGulls>0;
  this.session=null;this.cooldown=0;this.outcome=reason;
  this.say(reason==='gulls'?'A gull swoops at your hand. The cone falls!':this.dropLure?'You drop the cone. The gulls go after it.':'You drop the cone.');
  return {drop:true,reason,hand,item:hand.item,record:{...this.dropped}};
 }
 drop(player,hand,foodTarget){return this.releaseCone(player,hand,'manual',foodTarget);}
 birdTarget(){
  if(this.session){const s=this.session;return {id:s.id,phase:s.phase,...s.target,age:s.age,maxBirds:GULL_ENCOUNTER.maxBirds};}
  if(this.dropped&&this.dropLure){const d=this.dropped;return {id:d.id,phase:'dropped',x:d.x,y:d.y,z:d.z,age:d.age,maxBirds:GULL_ENCOUNTER.maxBirds};}
  return null;
 }
 snapshot(){
  const s=this.session;
  return {phase:s?.phase||(this.dropped?'dropped':this.cooldown>0?'cooldown':'idle'),id:s?.id||this.dropped?.id||null,
   age:s?.age||this.dropped?.age||0,pressure:s?.pressure||0,running:s?.running||false,contacts:s?.contacts||0,
   pursuing:s?.pursuing||0,nearby:this.localGulls,maxBirds:GULL_ENCOUNTER.maxBirds,
   cooldown:this.cooldown,outcome:this.outcome,dropped:this.dropped?{...this.dropped}:null};
 }
 drainMessages(){const messages=this.messages;this.messages=[];return messages;}
}
