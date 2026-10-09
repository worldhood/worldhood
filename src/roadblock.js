import * as THREE from 'three';
import {createPersonBatch,advanceGait,personLook} from './person-model.js';
import {createDoor} from './angry-drivers.js';
import {groundAt} from './terrain.js';
import {carSamples} from './physics.js';

// Police roadblock on Simonkatu, beside Forum, between the Mannerheimintie
// junction and the Annankatu corner – the end of the station run (Rautatientori
// → Kaivokatu → straight across Mannerheimintie between Sokos and Forum →
// Simonkatu). A game set piece, not a record of a real
// police operation. It stands at the start of Simonkatu, right by the
// Mannerheimintie junction.
//  • Coming near (deploy radius) sets up a line of parked, flashing patrol cars
//    across Simonkatu with officers on foot and a spike strip in front.
//  • Reaching the junction – or knocking over a lamp, bin or anything else
//    around it – is an instant five stars, with extra pursuit units.
//  • The strip shreds the tyres (physics.js FLAT_TYRES); the crippled car is
//    arrested within seconds.
// Every arrest, here or anywhere else, plays the officers' scene: they run to
// the car, open the driver's door, pull the driver out, put them against the
// car with hands on the roof, cuff them behind the back and walk them to the
// nearest patrol car. The BUSTED card appears while the cuffs go on.
// Local metres, -z north. Simonkatu leaves the Mannerheimintie junction at
// about (-805,47) and runs south-west along Forum (RATU 588) to Annankatu at
// about (-970,165); its centre line passes (-836,80) and (-880,110).
export const ROADBLOCK={
 name:'Simonkatu by Forum',
 approach:{x:-.826,z:.563},         // direction of travel along Simonkatu from Mannerheimintie
 // Simonkatu here is two carriageways with a tree median: the near one by Forum
 // (about -8…+5 m across from these centres) and the far one (about -33…-26 m).
 strip:{x:-809,z:61,maxHalf:60},    // spike strip centre, at the Lasipalatsi / Forum corner; spans building to building (≤ maxHalf each side)
 line:{x:-821,z:69,maxHalf:45,spacing:5.4}, // patrol car line, 14 m past the strip
 deployRadius:340,
 zone:{x:-785,z:35,radius:70},      // five stars on entry: from the middle of the Mannerheimintie junction on
 knockRadius:150,                   // knocking anything over within this radius: five stars
 pressureRadius:220,
 minUnits:6,
 arrestCrawl:{speed:1.2,time:1,limit:7},
};
const dist=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const ease=v=>{v=Math.min(1,Math.max(0,v));return v*v*(3-2*v);};
const lerp=(a,b,t)=>a+(b-a)*t;
const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
// Heading whose forward vector (-sin h, -cos h) points along (x, z).
export const headingAlong=(x,z)=>Math.atan2(-x,-z);
const clearGround=(world,x,z)=>!world.buildings.at(x,z)&&!!(world.roads.at(x,z)||world.pavement.at(x,z));

// Walk from a centre along a perpendicular until a mapped building is in the way.
// The strip runs on under poles, kerb islands, tree medians and verges, so there is no way round it.
export function spanAcross(world,centre,perp,maxHalf,step=.5){
 const wall=(x,z)=>world.buildings.at(x,z)?.ratu!==undefined;
 const reach=sign=>{let d=0;while(d+step<=maxHalf&&!wall(centre.x+perp.x*sign*(d+step),centre.z+perp.z*sign*(d+step)))d+=step;return d;};
 return {a:{x:centre.x-perp.x*reach(-1),z:centre.z-perp.z*reach(-1)},b:{x:centre.x+perp.x*reach(1),z:centre.z+perp.z*reach(1)}};
}
// The layout, fitted to the loaded map: strip ends, patrol cars, officer posts.
export function planRoadblock(world,config=ROADBLOCK){
 const d=config.approach,len=Math.hypot(d.x,d.z),fx=d.x/len,fz=d.z/len,perp={x:fz,z:-fx};
 const strip=spanAcross(world,config.strip,perp,config.strip.maxHalf);
 const face=headingAlong(-fx,-fz),cars=[],officers=[];
 const fits=(x,z,heading)=>carSamples({heading},x,z).every(([a,b])=>clearGround(world,a,b));
 const slots=[0];for(let i=1;i*config.line.spacing<=config.line.maxHalf;i++)slots.push(i*config.line.spacing,-i*config.line.spacing);
 for(const s of slots){
  const x=config.line.x+perp.x*s,z=config.line.z+perp.z*s;
  // Classic angled block: alternate cars turned ±35° off the oncoming direction.
  const heading=face+(cars.length%2?.6:-.6);
  if(fits(x,z,heading))cars.push({x,z,heading,s});else if(fits(x,z,face))cars.push({x,z,heading:face,s});
 }
 cars.sort((a,b)=>a.s-b.s);
 // Officers stand in the gaps, a step behind the cars, and at both ends.
 const posts=[];for(let i=0;i+1<cars.length;i++)posts.push((cars[i].s+cars[i+1].s)/2);
 if(cars.length){posts.push(cars[0].s-3.4,cars.at(-1).s+3.4);}
 for(const s of posts){
  const x=config.line.x+perp.x*s+fx*2.6,z=config.line.z+perp.z*s+fz*2.6;
  if(clearGround(world,x,z))officers.push({x,z,heading:face});
 }
 return {strip,cars:cars.map(({x,z,heading})=>({x,z,heading})),officers,forward:{x:fx,z:fz},perp,face};
}

// Did the car body cross or touch the strip between two positions?
export function crossesStrip(from,to,strip,halfDepth=2.3){
 const ax=strip.a.x,az=strip.a.z,ex=strip.b.x-ax,ez=strip.b.z-az,L=Math.hypot(ex,ez);if(L<1)return false;
 const ux=ex/L,uz=ez/L,side=p=>(p.x-ax)*uz-(p.z-az)*ux,along=p=>(p.x-ax)*ux+(p.z-az)*uz;
 const s0=side(from),s1=side(to),t=along(to);
 if(t<-1||t>L+1)return false;
 return Math.abs(s1)<halfDepth||Math.sign(s0)!==Math.sign(s1);
}

// Finnish police patrol uniform: dark navy jacket with POLIISI across the back
// (or a hi-vis vest over it), navy trousers, duty belt, black boots, peaked cap.
const OFFICER_LOOK={shirt:'#1b2436',trousers:'#1a2232',hat:'#1b2436',hairStyle:'police',shoes:'#121214',coat:0,skirt:false,bagType:null,
 uniform:'jacket',outer:'uniform',scarf:null,accessory:null,phoneWalk:false,stoop:0,age:'adult',stride:1};
const VEST_LOOK={...OFFICER_LOOK,uniform:'vest'};
export const officerLook=(seed,vest=false)=>personLook(9000+seed*13,vest?VEST_LOOK:OFFICER_LOOK);

// Arrest timeline, seconds after the door officers reach the car.
// pull: out of the seat; drag: turned to the car beside the rear door; down:
// leaned over, palms on the roof; cuff: wrists taken behind the back and
// cuffed; up: straightened and turned; walk: escorted to the patrol car.
// Fast: door to cuffs in about two seconds. `card` is when the
// BUSTED card comes up – while the cuffs are going on; the scene keeps playing behind it.
export const ARREST={reach:3,run:7,door:.35,pull:[.15,.8],drag:[.8,1.35],down:[1.35,1.65],cuff:[1.65,3.4],up:[3.4,4.2],walk:[4.2,7],card:2.2};

export function createRoadblock(scene,{world,police,carModel}){
 const group=new THREE.Group();group.name='Police roadblock';scene.add(group);
 const plan=planRoadblock(world);
 // Spike strip: yellow/black hinged segments with two rows of steel spikes.
 const stripGroup=new THREE.Group();stripGroup.name='Spike strip';group.add(stripGroup);
 {const {a,b}=plan.strip,L=Math.hypot(b.x-a.x,b.z-a.z),n=Math.max(1,Math.round(L/.5)),spikes=Math.round(L/.12);
  stripGroup.position.set((a.x+b.x)/2,.13+groundAt((a.x+b.x)/2,(a.z+b.z)/2),(a.z+b.z)/2);stripGroup.rotation.y=Math.atan2(-(b.z-a.z),b.x-a.x);
  const seg=new THREE.InstancedMesh(new THREE.BoxGeometry(.5,.045,.34),new THREE.MeshStandardMaterial({roughness:.7}),n);
  const m=new THREE.Matrix4(),c=new THREE.Color();
  for(let i=0;i<n;i++){m.makeTranslation(-L/2+(i+.5)*L/n,.022,0);seg.setMatrixAt(i,m);seg.setColorAt(i,c.set(i%2?'#1c1c1c':'#e2c11d'));}
  const spike=new THREE.InstancedMesh(new THREE.ConeGeometry(.018,.07,4),new THREE.MeshStandardMaterial({color:'#c9ccd0',metalness:.85,roughness:.3}),spikes*2);
  for(let i=0;i<spikes*2;i++){m.makeTranslation(-L/2+((i>>1)+.5)*L/spikes,.08,i%2?.08:-.08);spike.setMatrixAt(i,m);}
  seg.receiveShadow=true;stripGroup.add(seg,spike);}
 const batch=createPersonBatch(16,{name:'Police officers',police:true});group.add(batch.group);
 const posts=plan.officers.map((p,i)=>({...p,post:{...p},look:officerLook(i,i%2===0),gait:{},speed:0,pose:i===Math.floor(plan.officers.length/2)?'stop':'belt',groundY:.13,id:`officer-${i}`}));
 const currentVehicle=()=>{
  let paint=null;carModel.traverse(o=>{if(!paint&&o.isMesh&&o.material.name==='paint')paint=o.material;});
  return {spec:{belt:.95,...carModel.userData.spec},material:paint,paint:paint?.color||new THREE.Color('#9aa0a0')};
 };
 let deployed=false,standDown=false,alerted=false,burst=null,crawl=0,knockedNear=0,time=0,scene_=null,camera=null;
 group.visible=false;

 function deploy(on){
  deployed=on;group.visible=on||!!scene_;stripGroup.visible=on;
  police.setParked(on?plan.cars:[]);
 }
 function knockedAround(knockables){
  let n=0;for(const b of knockables?.bodies||[])if(b.knocked&&Math.hypot(b.x-ROADBLOCK.zone.x,b.z-ROADBLOCK.zone.z)<ROADBLOCK.knockRadius)n++;return n;
 }
 function alert(message){
  if(alerted||police.busted)return;alerted=true;police.minUnits=ROADBLOCK.minUnits;
  police.escalate({level:5,message});
 }
 // Per physics step, after finale.step (it re-sets police pressure every step).
 function step(dt,car,previous,{started=true,knockables=null,onBurst=null}={}){
  time+=dt;if(!car||!started||standDown||police.busted)return;
  const d=dist(car,ROADBLOCK.zone);
  if(!deployed&&d<ROADBLOCK.deployRadius)deploy(true);
  if(!deployed)return;
  if(d<ROADBLOCK.pressureRadius&&police.level)police.setPressure(true);
  if(d<ROADBLOCK.zone.radius)alert('Roadblock on Mannerheimintie — every unit is on you!');
  const k=knockedAround(knockables);if(k>knockedNear&&d<ROADBLOCK.knockRadius)alert('You wrecked the street by the roadblock — five stars!');knockedNear=k;
  if(!burst&&previous&&crossesStrip(previous,car,plan.strip)&&Math.abs(car.speed)>.5){
   burst={time};car.flat=1;alert('Spike strip! Tyres shredded.');police.minUnits=ROADBLOCK.minUnits;onBurst?.();
  }
  if(burst){
   crawl=Math.abs(car.speed)<ROADBLOCK.arrestCrawl.speed?crawl+dt:0;
   if(crawl>=ROADBLOCK.arrestCrawl.time||time-burst.time>=ROADBLOCK.arrestCrawl.limit){car.speed=0;police.arrestNow('Stopped on the spike strip — busted.');}
  }
 }
 // Officers idle at their posts; the middle one holds a palm up at the oncoming car.
 function animatePosts(dt,car){
  for(const o of posts){if(o.busy)continue;
   if(car){const want=Math.atan2(-(car.x-o.x),-(car.z-o.z)),near=dist(o,car)<90;o.heading+=wrap((near?want:o.post.heading)-o.heading)*Math.min(1,dt*4);}
   o.speed=0;advanceGait(o,o.gait,dt,o.look);
  }
 }

 // ---------------- arrest scene ----------------
 // Car-local → world: x to the car's right, z towards its rear.
 function local(car,x,z){const s=Math.sin(car.heading),c=Math.cos(car.heading);return {x:car.x+c*x+s*z,z:car.z-s*x+c*z};}
 function startArrest(car){
  if(scene_||!car)return;
  const squad=[];
  // Roadblock officers close by join in; otherwise two officers jump out of each of the nearest patrol cars.
  if(deployed)for(const o of [...posts].sort((a,b)=>dist(a,car)-dist(b,car)))if(dist(o,car)<55&&squad.length<6){o.busy=true;squad.push(o);}
  const units=[...police.units].sort((a,b)=>dist(a,car)-dist(b,car));
  for(const u of units){if(squad.length>=6)break;
   for(const side of [-1,1]){if(squad.length>=6)break;const s=Math.sin(u.heading),c=Math.cos(u.heading);
    const o={x:u.x+c*1.6*side,z:u.z-s*1.6*side,heading:u.heading,look:officerLook(40+squad.length,squad.length%2===1),gait:{},speed:0,groundY:.13,spawned:true,id:`officer-x${squad.length}`};squad.push(o);}
  }
  while(squad.length<4){const p=local(car,(squad.length%2?3:-3),14);squad.push({...p,heading:car.heading,look:officerLook(70+squad.length,squad.length%2===1),gait:{},speed:0,groundY:.13,spawned:true,id:`officer-y${squad.length}`});}
  // Two nearest to the driver's door (front left) do the arrest; the rest ring the car.
  const door=local(car,-1.4,-.2);squad.sort((a,b)=>dist(a,door)-dist(b,door));
  const ring=[[-2.9,-3.3],[2.4,-3.5],[2.6,3.1],[-2.7,3.6],[.4,-5.6],[0,5.8]];
  squad.forEach((o,i)=>{o.role=i===0?'lead':i===1?'second':'ring';o.slot=i===0?[-1.95,1.05]:i===1?[-2,2.05]:ring[(i-2)%ring.length];o.pose=null;o.running=true;});
  const doorMesh=createDoor(currentVehicle());doorMesh.root.position.set(car.x,.12+groundAt(car.x,car.z),car.z);doorMesh.root.rotation.y=car.heading;group.add(doorMesh.root);group.visible=true;
  const driver={x:car.x,z:car.z,heading:car.heading,speed:0,groundY:.13,look:personLook(4242,{bagType:null,accessory:null,phoneWalk:false,stoop:0}),gait:{},hidden:true,pose:null};
  // Walked to the left rear door of the nearest patrol car, or back along the street.
  const unit=units.find(u=>dist(u,car)<14&&dist(u,car)>4),s=Math.sin(unit?.heading||0),c=Math.cos(unit?.heading||0);
  const patrol=unit?{x:unit.x-c*1.6+s*.6,z:unit.z+s*1.6+c*.6}:local(car,-2.6,9);
  scene_={car:{x:car.x,z:car.z,heading:car.heading},t:0,doorAt:null,squad,door:doorMesh,driver,patrol,walkFrom:null};
 }
 function moveTo(o,target,speed,dt,face){
  const dx=target.x-o.x,dz=target.z-o.z,d=Math.hypot(dx,dz);
  if(d>.05){const step=Math.min(d,speed*dt);o.x+=dx/d*step;o.z+=dz/d*step;o.speed=dt>0?step/dt:0;o.heading+=wrap(Math.atan2(-dx,-dz)-o.heading)*Math.min(1,dt*10);}
  else{o.speed=0;if(face!==undefined)o.heading+=wrap(face-o.heading)*Math.min(1,dt*8);}
  return d;
 }
 const face=(o,p)=>Math.atan2(-(p.x-o.x),-(p.z-o.z));
 function updateArrest(dt){
  const S=scene_;if(!S)return;S.t+=dt;const car=S.car,out=car.heading+Math.PI/2,A=ARREST;
  const [lead,second]=S.squad,driver=S.driver;
  if(S.doorAt===null){
   for(const o of S.squad){o.running=true;moveTo(o,local(car,...o.slot),A.run,dt,face(o,car));}
   if((dist(lead,local(car,...lead.slot))<.3&&dist(second,local(car,...second.slot))<.3)||S.t>=A.reach){
    // Late runners are hurried into place so the scene keeps its pace.
    for(const o of [lead,second]){const p=local(car,...o.slot);o.x=p.x;o.z=p.z;}S.doorAt=S.t;
   }
  }
  if(S.doorAt!==null){
   const t=S.t-S.doorAt;
   S.door.hinge.rotation.y=-1.1*ease(t/A.door);S.door.recess.visible=t>.02;
   for(const o of S.squad.slice(2)){o.running=dist(o,local(car,...o.slot))>2;moveTo(o,local(car,...o.slot),o.running?A.run:1.6,dt,face(o,car));o.pose=o===S.squad[2]?'stop':o.speed<.1?'belt':null;}
   // Driver: pulled from the seat, put against the car, cuffed, stood up, walked to the patrol car.
   driver.hidden=t<A.pull[0];driver.knockdown=null;
   const pull=ease((t-A.pull[0])/(A.pull[1]-A.pull[0])),drag=ease((t-A.drag[0])/(A.drag[1]-A.drag[0])),lean=ease((t-A.down[0])/(A.down[1]-A.down[0])),rise=ease((t-A.up[0])/(A.up[1]-A.up[0]));
   const px=driver.x,pz=driver.z,toCar=car.heading-Math.PI/2;
   if(t<A.walk[0]){
    // Out of the seat, round the open door to the rear door, a half step back to lean in.
    const p=local(car,lerp(lerp(-.45,-1.5,pull),-1.6-.22*lean*(1-rise),drag),lerp(-.25,.95,drag));driver.x=p.x;driver.z=p.z;
    driver.heading=t<A.drag[0]?out:t<A.up[0]?wrap(out+wrap(toCar-out)*drag):wrap(toCar+wrap(face(driver,S.patrol)-toCar)*rise);
   }else{
    // Walking pace, a little quicker if the patrol car is far, arriving by the end of the walk.
    S.walkFrom??={x:driver.x,z:driver.z};
    const pace=Math.min(2.2,Math.max(1.1,dist(S.walkFrom,S.patrol)/(A.walk[1]-A.walk[0])));
    moveTo(driver,S.patrol,pace,dt);
   }
   driver.speed=dt>0?Math.min(2.4,Math.hypot(driver.x-px,driver.z-pz)/dt):0;
   driver.groundY=.13-.75*(1-ease(pull*1.4));
   const cuffed=t>=A.cuff[0]+.55;
   driver.pose=cuffed?'cuffed':t>=A.down[0]?'handsOnCar':t>=A.pull[0]?'grab':null;
   driver.lean=t<A.up[0]?lean*(cuffed?.22:.42):.22*(1-rise);driver.headPitch=t>=A.down[0]&&t<A.up[1]?.25*(1-rise):0;
   // The arresting pair: hands on the driver while pulling and turning; the lead
   // cuffs from behind while the second holds the upper arm; then one each side, escorting.
   const fx=-Math.sin(driver.heading),fz=-Math.cos(driver.heading),rx=Math.cos(driver.heading),rz=-Math.sin(driver.heading);
   const at=(side,back)=>({x:driver.x+rx*side-fx*back,z:driver.z+rz*side-fz*back});
   if(t>=A.pull[0]){
    const against=t>=A.down[0]&&t<A.up[0];
    for(const [o,sgn] of [[lead,-1],[second,1]]){
     let target,pose,look;
     if(t<A.down[0]){target=at(sgn*.75,0);pose='grab';look=driver;}
     else if(against&&o===lead){target=at(-.12,.62);pose=t<A.cuff[0]?'grab':'cuffing';look=at(0,-1);}
     else if(against){target=at(-.7,.3);pose='escort';o.escortSide=1;look=at(0,-.6);}
     else{target=at(sgn*.62,.12);pose='escort';o.escortSide=-sgn;look=at(sgn*.62,-2);}
     o.running=false;moveTo(o,target,t<A.drag[1]?3:2.4,dt,face(o,look));o.pose=pose;
    }
   }else for(const o of [lead,second]){o.pose=null;o.heading+=wrap(face(o,local(car,-1,-.2))-o.heading)*Math.min(1,dt*8);}
  }
  for(const o of S.squad)advanceGait(o,o.gait,dt,o.look);
  if(!driver.hidden)advanceGait(driver,driver.gait,dt,driver.look);
  // Camera: low, beside the driver's side, looking at the driver; stays out of buildings.
  const focus=driver.hidden?local(car,-1.2,0):driver;
  const options=[[-4.6,7.5],[-7,4.5],[-7.5,-3.5],[-3,-9],[7,-8]].map(([x,z])=>local(car,x,z));
  const clear=p=>{const n=8;for(let i=0;i<=n;i++){const x=p.x+(focus.x-p.x)*i/n,z=p.z+(focus.z-p.z)*i/n;if((world.cameraBuildings||world.buildings).at(x,z))return false;}return true;};
  const eye=options.find(clear)||options[0],h=2.7+Math.min(1.2,S.t*.08);
  if(!camera)camera={x:eye.x,z:eye.z,tx:focus.x,tz:focus.z};
  const k=1-Math.exp(-dt*2.5);camera.x+=(eye.x-camera.x)*k;camera.z+=(eye.z-camera.z)*k;camera.tx+=(focus.x-camera.tx)*k;camera.tz+=(focus.z-camera.tz)*k;camera.h=h;
 }
 return {
  group,plan,step,startArrest,
  get deployed(){return deployed;},get burst(){return !!burst;},
  get playing(){return !!scene_&&(scene_.doorAt===null||scene_.t-scene_.doorAt<ARREST.card);},
  get active(){return !!scene_;},
  update(dt,viewer){
   animatePosts(dt,viewer);updateArrest(dt);
   batch.begin(viewer);
   if(deployed)for(const o of posts)if(!o.busy)batch.draw(o,o.look,o.gait,time);
   if(scene_){for(const o of scene_.squad)batch.draw(o,o.look,o.gait,time);if(!scene_.driver.hidden)batch.draw(scene_.driver,scene_.driver.look,scene_.driver.gait,time);}
   batch.end();
  },
  cameraPose(){if(!scene_||!camera)return null;const g=groundAt(camera.tx,camera.tz);return {position:[camera.x,camera.h+g,camera.z],target:[camera.tx,1+g,camera.tz]};},
  // End the arrest scene (Continue/Restart). `stand` also clears the roadblock for the rest of this run.
  clearArrest(){if(scene_){group.remove(scene_.door.root);scene_.door.dispose();}scene_=null;camera=null;for(const o of posts){o.busy=false;Object.assign(o,o.post);o.pose='belt';o.knockdown=null;}if(posts.length)posts[Math.floor(posts.length/2)].pose='stop';group.visible=deployed;},
  standDown(){this.clearArrest();standDown=true;burst=null;crawl=0;police.minUnits=0;deploy(false);},
  reset(){this.clearArrest();standDown=false;alerted=false;burst=null;crawl=0;knockedNear=0;police.minUnits=0;deploy(false);},
  snapshot(){return {deployed,standDown,alerted,burst:!!burst,strip:plan.strip,cars:plan.cars.length,officers:posts.length,arrest:scene_?{t:+scene_.t.toFixed(2),doorAt:scene_.doorAt,squad:scene_.squad.length,driver:{x:scene_.driver.x,z:scene_.driver.z,hidden:scene_.driver.hidden,pose:scene_.driver.pose,prone:!!scene_.driver.knockdown,lean:+(scene_.driver.lean||0).toFixed(2)},patrol:scene_.patrol,officers:scene_.squad.slice(0,2).map(o=>({x:o.x,z:o.z,pose:o.pose}))}:null};},
 };
}
