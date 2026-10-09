import {TRAM_DIMENSIONS} from './tram-simulation.js';
import {groundAt} from './terrain.js';
import {displayedSpeedKmh} from './physics.js';

// Hot zone around Helsinki Central Station: the station stops on Kaivokatu,
// Rautatientori and the Mikonkatu corner, and Mannerheimintie from the Forum
// corner (Simonkatu) past the Lasipalatsi stops to Postitalo. Inside the zone
// the tram feeders keep the platforms busy and trams rolling, and a crash –
// into a tram or the Sokos/Lasipalatsi front – calls a police surge
// (police.js SURGE): units arrive from close by and arrest a stopped car within
// seconds. The BUSTED screen then offers Continue (respawn on the spot) or
// Restart. Nothing in the HUD announces the zone or the trams; the only text
// is the wanted HUD and the BUSTED card. Outside the zone the ordinary
// pursuit rules hold.
// The zone is the union of four circles (local metres, -z north, -x west).
// Centres from public/data/trams.json stops and city.pack footprints: station
// stops H0201/H0202 (−621,−28)/(−631,−39); Lasipalatsi H0101/H0102
// (−803,−41)/(−797,−15); Mikonkatu stops (−376,−15)/(−385,−2) and Rautatientori
// (−406,−120); Forum = Mannerheimintie 14–20 (centroids −697,187 … −783,100);
// Postitalo = Mannerheiminaukio 1 (bbox x −824…−735, z −216…−110).
export const FINALE_ZONE={name:'Rautatientori',x:-626,z:-34,areas:[
 {name:'Rautatieasema',x:-626,z:-34,radius:125},
 {name:'Lasipalatsi',x:-797,z:-15,radius:140},
 {name:'Mikonkatu',x:-415,z:-60,radius:120},
 {name:'Forum',x:-720,z:110,radius:110},
]};
// World m/s (the HUD shows 70 % of world speed): 15 km/h into a tram, 30 km/h into a building front.
export const FINALE_TRIGGERS={tramSpeed:15/3.6,buildingSpeed:30/3.6,tramHits:2,level:4,repeatLevel:5,presence:{min:3,radius:150}};
export const FINALE_BUILDINGS=[{ratu:405,name:'Sokos'},{ratu:944,name:'Lasipalatsi'}];
export const CINEMATIC_SECONDS=2.6;
// Seconds before the same tram or front can be logged again; world m/s below which a wall touch is not a scrape.
export const CONTACT_WINDOW=3,MIN_CONTACT_SPEED=2;

// The zone area (circle) a point is in, or null. A zone without `areas` is one circle.
export const finaleArea=(p,zone=FINALE_ZONE)=>!p?null:(zone.areas||[zone]).find(a=>Math.hypot(p.x-a.x,p.z-a.z)<=a.radius)||null;
export const inFinaleZone=(p,zone=FINALE_ZONE)=>finaleArea(p,zone)!==null;
export const finaleBuilding=record=>record?FINALE_BUILDINGS.find(b=>b.ratu===record.ratu)?.name??null:null;
export const tramLabel=t=>t?.line?`tram ${t.line}${t.destination?` to ${t.destination}`:''}`:'a tram';

// The tram whose articulated body the car is touching. A tram's position is
// the centre of its front section (tram-simulation.js), so the body runs from
// the nose 4.85 m ahead of it to the tail 22.75 m behind, along its heading
// (forward is -sin/-cos, as for the car).
export const TRAM_NOSE=TRAM_DIMENSIONS.sections[0]/2,TRAM_TAIL=-TRAM_DIMENSIONS.centres[2]+TRAM_DIMENSIONS.sections[2]/2;
export function tramAt(car,trams,margin=3.4){
 let best=null,bestD=Infinity;
 for(const t of trams||[]){
  const line=t.line??t.path?.line,destination=t.destination??t.path?.destination;
  const h=t.heading||0,dx=car.x-t.x,dz=car.z-t.z,along=dx*Math.sin(h)+dz*Math.cos(h),side=Math.abs(dx*Math.cos(h)-dz*Math.sin(h));
  const d=Math.max(0,-along-TRAM_NOSE,along-TRAM_TAIL,side-TRAM_DIMENSIONS.width/2);
  if(d<margin&&d<bestD){bestD=d;best={id:t.id,line,destination,speed:t.speed||0,waiting:t.wait>0||!!t.waiting,x:t.x,z:t.z};}
 }
 return best;
}
// Which mapped building the car's nose (or tail, when reversing) is against.
export function buildingAhead(car,world,reverse=car.speed<0){
 const s=Math.sin(car.heading),c=Math.cos(car.heading),dir=reverse?-1:1;
 for(const ahead of [2.2,2.8,3.5])for(const lateral of [0,-.9,.9]){
  const x=car.x-s*ahead*dir+c*lateral,z=car.z-c*ahead*dir-s*lateral,b=world?.buildings?.at(x,z);
  if(b&&b.ratu!==undefined)return b;
 }
 return null;
}
export const formatDuration=seconds=>{const s=Math.max(0,Math.round(seconds));return s>=3600?`${Math.floor(s/3600)} h ${Math.floor(s%3600/60)} min`:s>=60?`${Math.floor(s/60)} min ${String(s%60).padStart(2,'0')} s`:`${s} s`;};
export const formatDistance=metres=>metres>=1000?`${(metres/1000).toFixed(2)} km`:`${Math.round(metres)} m`;
export function formatStats(stats){
 return [
  {label:'Distance',value:formatDistance(stats.distance||0)},
  {label:'Time',value:formatDuration(stats.elapsed||0)},
  {label:'Top speed',value:`${displayedSpeedKmh(stats.topSpeed||0)} km/h`},
  {label:'Damage',value:`${Math.round((stats.damage||0)*100)} %`},
  {label:'Wanted',value:`${'★'.repeat(stats.maxLevel||0)}${'☆'.repeat(5-(stats.maxLevel||0))}`},
 ];
}
const plural=(n,one,many=`${one}s`)=>`${n} ${n===1?one:many}`;

export class Finale{
 constructor({zone=FINALE_ZONE,triggers=FINALE_TRIGGERS,doc=null}={}){this.zone=zone;this.triggers=triggers;this.doc=doc;this.reset();}
 reset(){
  this.inZone=false;this.triggered=false;this.bigCrashes=0;this.tramHits=0;this.offences=new Map();
  this.stats={elapsed:0,distance:0,topSpeed:0,damage:0,maxLevel:0,knocked:0};this.sampleAt=0;this.time=0;this.contacts=new Map();
  this.cinematic=null;this.ended=false;this.summary=null;this.arrested=false;
  this.doc?.body.classList.remove('finale-zone','arrest-cinematic');
 }
 get active(){return this.inZone&&!this.arrested;}
 // Per physics step. Keeps the zone flag, the police pressure, tram presence and run stats.
 step(dt,car,{police=null,tramSim=null,knockables=null,started=true}={}){
  if(!car||this.arrested)return;
  this.time+=dt;
  const inZone=inFinaleZone(car,this.zone);
  if(inZone!==this.inZone){this.inZone=inZone;this.doc?.body.classList.toggle('finale-zone',inZone);}
  police?.setPressure(inZone);
  if(!started)return;
  this.stats.elapsed+=dt;this.stats.distance=car.distance||0;this.stats.topSpeed=Math.max(this.stats.topSpeed,Math.abs(car.speed||0));
  this.stats.damage=car.damage||0;if(police)this.stats.maxLevel=Math.max(this.stats.maxLevel,police.level);
  if(inZone&&tramSim?.guarantee)tramSim.guarantee(car,this.triggers.presence);
  if(this.stats.elapsed>=this.sampleAt){this.sampleAt=this.stats.elapsed+.5;const k=knockables?.snapshot?.();if(k)this.stats.knocked=Math.max(this.stats.knocked,k.knocked||0);}
 }
 offence(key,text){const o=this.offences.get(key);if(o)o.count++;else this.offences.set(key,{text,count:1});}
 // Persistent contact (a wall held at walking pace, a tram pushing the car
 // back every tick) is one offence, not one per physics step.
 recent(key,window=CONTACT_WINDOW){const last=this.contacts.get(key)??-Infinity;this.contacts.set(key,this.time);return this.time-last<window;}
 // Transit contact from main.js (player stopped dead by a tram or bus).
 transitImpact(car,speed,trams,police){
  const tram=tramAt(car,trams);if(!tram||this.recent(`tram:${tram.id}`))return null;
  const hard=speed>=this.triggers.tramSpeed,big=this.inZone&&hard;this.tramHits+=this.inZone?1:0;
  this.offence(`tram:${tram.id}:${hard?'crash':'bump'}`,`${hard?'Crashed into':'Bumped'} ${tramLabel(tram)}`);
  if(big||(this.inZone&&this.tramHits>=this.triggers.tramHits))this.trigger(`You hit ${tramLabel(tram)}`,police);
  return {tram,big};
 }
 // Building contact from main.js (driveStep reported collision==='building').
 buildingImpact(car,speed,world,police){
  if(speed<MIN_CONTACT_SPEED)return null;
  const record=buildingAhead(car,world),name=finaleBuilding(record);
  if(!name){if(speed>=this.triggers.buildingSpeed&&!this.recent('building'))this.offence('building',record?.name?`Hit a building on ${record.name}`:'Hit a building');return null;}
  if(this.recent(`front:${name}`))return null;
  const hard=speed>=this.triggers.buildingSpeed,big=this.inZone&&hard;
  this.offence(`${hard?'ram':'scrape'}:${name}`,`${hard?'Rammed':'Scraped'} ${name}`);
  if(big)this.trigger(`You hit ${name}`,police);
  return {name,big};
 }
 // Police incidents (police.onIncident) feed the offence list.
 incident(kind,id){
  if(kind==='pedestrian')this.offence(String(id).startsWith('cyclist')?'cyclist':'pedestrian',String(id).startsWith('cyclist')?'Knocked down a cyclist':'Hit a pedestrian');
  else if(kind==='police')this.offence('police','Rammed a police car');
  else if(kind==='vehicle'&&id!=='transit')this.offence('vehicle','Crashed into another car');
 }
 trigger(message,police){
  this.bigCrashes++;this.triggered=true;
  const level=this.bigCrashes>=2?this.triggers.repeatLevel:this.triggers.level;
  police?.escalate({level,message:`${message} — police are coming.`});
  return level;
 }
 // Arrest: freeze, start the cinematic, build the summary for the end screen.
 arrest({car,police,knockables}={}){
  if(this.arrested)return this.summary;
  this.arrested=true;this.cinematic={time:0,heading:car?.heading||0};this.ended=false;
  if(police)this.stats.maxLevel=Math.max(this.stats.maxLevel,police.level);
  const k=knockables?.snapshot?.();if(k)this.stats.knocked=Math.max(this.stats.knocked,k.knocked||0);
  const offences=[...this.offences.values()].map(o=>o.count>1?`${o.text} × ${o.count}`:o.text);
  if(this.stats.knocked)offences.push(`Knocked over ${plural(this.stats.knocked,'bollard, bin or scooter','bollards, bins and scooters')}`);
  if(!offences.length)offences.push('Failed to stop for the police');
  // Plain arcade-style card: where the arrest happened, what was done, the run's numbers.
  const area=finaleArea(car,this.zone);
  this.summary={finale:this.triggered,title:'BUSTED',kicker:area?`HELSINKI POLICE · ${area.name.toUpperCase()}`:'HELSINKI POLICE',
   subtitle:'Pursuit over.',offences,stats:formatStats(this.stats),raw:{...this.stats}};
  this.doc?.body.classList.add('arrest-cinematic');
  return this.summary;
 }
 // Advances the cinematic; returns true exactly once, when the end screen should appear.
 // `hold`: the officers' arrest scene (src/roadblock.js) is still playing.
 cinematicStep(dt,hold=false){
  if(!this.cinematic)return false;this.cinematic.time+=dt;
  if(this.ended||hold||this.cinematic.time<CINEMATIC_SECONDS)return false;
  this.ended=true;this.doc?.body.classList.remove('arrest-cinematic');if(this.doc)renderEndScreen(this.doc,this.summary);return true;
 }
 // Slow pull-back behind the stopped car, sweeping gently; stays behind so a
 // nose-in crash against a building front keeps the camera on the street.
 cameraPose(car){
  if(!this.cinematic||!car)return null;
  const t=Math.min(this.cinematic.time,8),a=this.cinematic.heading+.4-t*.2,r=11+t*1.4,h=3.6+t*.8;
  const g=groundAt(car.x,car.z);return {position:[car.x+Math.sin(a)*r,h+g,car.z+Math.cos(a)*r],target:[car.x,1.1+g,car.z]};
 }
 dismiss(){this.cinematic=null;this.ended=false;this.arrested=false;this.doc?.body.classList.remove('arrest-cinematic');}
 // Continue after an arrest (respawn on the spot): same run, offences and trigger armed again.
 resume(){this.dismiss();this.offences.clear();this.contacts.clear();this.triggered=false;this.bigCrashes=0;this.tramHits=0;this.summary=null;}
 snapshot(){return {zone:this.zone.name,inZone:this.inZone,triggered:this.triggered,bigCrashes:this.bigCrashes,tramHits:this.tramHits,arrested:this.arrested,ended:this.ended,offences:[...this.offences.values()].map(o=>({...o})),stats:{...this.stats}};}
}

// BUSTED screen DOM (index.html #busted-overlay). Pure text, no innerHTML from data.
export function renderEndScreen(doc,summary){
 const el=id=>doc.getElementById(id);if(!summary||!el('busted-overlay'))return;
 el('busted-kicker').textContent=summary.kicker;el('busted-title').textContent=summary.title;el('busted-subtitle').textContent=summary.subtitle;
 const list=el('busted-offences');list.replaceChildren(...summary.offences.map(text=>{const li=doc.createElement('li');li.textContent=text;return li;}));
 const stats=el('busted-stats');stats.replaceChildren(...summary.stats.map(({label,value})=>{const d=doc.createElement('div');const v=doc.createElement('strong');v.textContent=value;const l=doc.createElement('span');l.textContent=label;d.append(v,l);return d;}));
 el('busted-overlay').classList.toggle('finale',!!summary.finale);
}
