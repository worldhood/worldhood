// Short, local conversations with the pedestrians already in any city's world.
// No network requests or invented claims about real residents or local places.
import {pointInPolygon} from './geo.js';

export const TALK_DISTANCE=2.8;
export const CONVERSATION_DISTANCE=4;
export const CONVERSATION_TIMEOUT=28;
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const finitePosition=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.z);
const personLabel='Passerby';
const OPTIONS=Object.freeze([
 Object.freeze({id:'hello',label:'Hello!'}),
 Object.freeze({id:'day',label:"How's your day?"}),
 Object.freeze({id:'explore',label:'Any exploring tips?'}),
 Object.freeze({id:'bye',label:'See you around'}),
]);
const REPLIES=Object.freeze({
 hello:['Hi! Nice to meet you.','Hello there! Enjoy your walk.','Hey! Good to see a friendly face.'],
 day:["Pretty good. A little fresh air always helps.","Taking it easy today. Hope your day is going well, too.","Just out for a walk. It is nice to slow down sometimes."],
 explore:["I like exploring on foot. You notice little things you would drive right past.","Try a different street on the way back. You might find a new favourite corner.","A bicycle is a lovely way to see more. Stop whenever something catches your eye."],
});
const variant=id=>{let n=0;for(const c of String(id??''))n=(n*31+c.charCodeAt(0))>>>0;return n%3;};

function availablePerson(p,world){
 if(!finitePosition(p)||p.walking===false||p.edge===null||p.knocked||p.knockdown||p.running||p.hidden||p.visible===false)return false;
 if(p.pose==='cycle'||p.pose==='scooter'||Math.abs(p.speed||0)>2.2)return false;
 // Let people finish crossing the street instead of stopping them in traffic.
 if(p.edge?.crossing&&world?.roads?.at(p.x,p.z))return false;
 return true;
}

export function clearConversationPath(from,to,world){
 if(!finitePosition(from)||!finitePosition(to))return false;
 const length=distance(from,to);if(length>CONVERSATION_DISTANCE)return false;
 const n=Math.max(1,Math.ceil(length/.2));
 for(let i=0;i<=n;i++){
  const x=from.x+(to.x-from.x)*i/n,z=from.z+(to.z-from.z)*i/n;
  if(world?.buildings?.at(x,z))return false;
  if(!world?.roads?.at(x,z)&&!world?.pavement?.at(x,z)&&world?.water?.some(w=>pointInPolygon(x,z,w.rings)))return false;
 }
 return true;
}

export function nearestTalker(player,people,world,radius=TALK_DISTANCE){
 if(!finitePosition(player)||player.travelMode!=='walk')return null;
 let best=null,bestDistance=Math.min(radius,TALK_DISTANCE);
 for(const person of people||[]){
  if(!availablePerson(person,world)||person.conversation)continue;
  const d=distance(player,person);
  if(d>bestDistance||!clearConversationPath(player,person,world))continue;
  best=person;bestDistance=d;
 }
 return best;
}

export class PeopleInteraction {
 constructor(world){this.world=world;this.session=null;this.nearby=null;this.enabled=false;}
 reset(world=this.world){this.close();this.world=world;this.nearby=null;this.enabled=false;}
 update(dt,player,people,{enabled=true}={}){
  this.enabled=!!enabled&&player?.travelMode==='walk';
  if(!this.enabled){this.close();this.nearby=null;return;}
  const session=this.session;
  if(session){
   const p=session.person;
   session.idle+=Math.max(0,Number.isFinite(dt)?dt:0);
   if(!people?.includes(p)||!availablePerson(p,this.world)||distance(player,p)>CONVERSATION_DISTANCE||!clearConversationPath(player,p,this.world)||session.idle>=CONVERSATION_TIMEOUT){
    this.close();
   }else{
    p.speed=0;
    // All shared person models face down their local negative Z axis.
    p.heading=Math.atan2(p.x-player.x,p.z-player.z);
   }
  }
  this.nearby=this.session?null:nearestTalker(player,people,this.world);
 }
 interact(player,people,{enabled=this.enabled}={}){
  if(!enabled||player?.travelMode!=='walk')return {ok:false,message:'Step out and walk over to someone to say hello.'};
  if(this.session){this.close();return {ok:true,closed:true,message:'See you around!'};}
  // Validate at the moment of the input, even if the UI's previous target moved.
  const person=nearestTalker(player,people,this.world);
  if(!person)return {ok:false,message:'Walk a little closer to a passerby to talk.'};
  this.enabled=true;
  this.session={person,pose:person.pose,heading:person.heading,hadPose:Object.hasOwn(person,'pose'),hadHeading:Object.hasOwn(person,'heading'),idle:0,response:'Hi there! Taking a look around?'};
  person.conversation=true;person.pose='chat';person.speed=0;
  person.heading=Math.atan2(person.x-player.x,person.z-player.z);
  this.nearby=null;
  return {ok:true,message:this.session.response};
 }
 choose(id){
  if(!this.enabled||!this.session)return {ok:false};
  if(id==='bye'){this.close();return {ok:true,closed:true,message:'See you around!'};}
  const replies=Object.hasOwn(REPLIES,id)?REPLIES[id]:null;
  if(!replies)return {ok:false};
  this.session.response=replies[variant(this.session.person.id)];this.session.idle=0;
  return {ok:true,message:this.session.response};
 }
 close(){
  const session=this.session;if(!session)return false;
  const p=session.person;
  delete p.conversation;
  if(session.hadPose)p.pose=session.pose;else delete p.pose;
  if(session.hadHeading)p.heading=session.heading;else delete p.heading;
  // Resume with the normal acceleration; route / distance / waiting state is untouched.
  p.speed=0;this.session=null;
  return true;
 }
 snapshot(){
  const p=this.session?.person||this.nearby;
  return {active:!!this.session,nearby:!!this.nearby,person:p?{id:p.id,label:personLabel,x:p.x,z:p.z}:null,
   response:this.session?.response||'',choices:this.session?OPTIONS:[],timeLeft:this.session?Math.max(0,CONVERSATION_TIMEOUT-this.session.idle):0};
 }
}
