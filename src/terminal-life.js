import {SpatialIndex,pointInPolygon,bounds} from './geo.js';
import polygonClipping from 'polygon-clipping';
import {createInstancedPeople} from './market-life.js';
import {prepareGraph,routePoint,approachingPedestrian} from './mobility.js';
import {sweptContact} from './contact-geometry.js';

// The terminal's private forecourt is absent from the municipal pavement
// layer. This small authored apron follows the existing terminal frontage;
// roads, buildings, cycle paths, water and placed furniture still veto it.
const APRON=[[[252,937],[271,924],[303,977],[281,981],[252,970]]];
const DOORS=[[275,944],[284,956],[293,968]];
const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
export function terminalWalkingPlan(city,walks,obstacles=[]){
 // Clip once to the local walking area. In particular the original coastline
 // spans kilometres: testing all its vertices for every footstep is expensive.
 // Clipping preserves exact boundaries, unlike a coarse walkability grid.
 const area=[[[35,620],[325,620],[325,990],[35,990],[35,620]]];
 const localIndex=items=>new SpatialIndex(items.flatMap(p=>{
  const b=p.bbox||bounds(p.rings);if(b[0]>325||b[2]<35||b[1]>990||b[3]<620)return [];
  return polygonClipping.intersection(p.rings,area).map(rings=>({rings,bbox:bounds(rings)}));
 }),8);
 const pavement=localIndex(city.pavement.filter(p=>/jalkakäytävä|Jalankulkualue/.test(p.kind)));
 const blocked=localIndex([...city.roads,...city.buildings,...city.water,...obstacles,...city.pavement.filter(p=>/pyör/i.test(p.kind))]);
 const contains=(index,x,z)=>index.near(x,z).some(p=>x>=p.bbox[0]&&x<=p.bbox[2]&&z>=p.bbox[1]&&z<=p.bbox[3]&&pointInPolygon(x,z,p.rings));
 const safe=(x,z,r=.28)=>x>35+r&&x<325-r&&z>620+r&&z<990-r&&[[0,0],[-r,0],[r,0],[0,-r],[0,r]].every(([dx,dz])=>!contains(blocked,x+dx,z+dz)&&(contains(pavement,x+dx,z+dz)||pointInPolygon(x+dx,z+dz,APRON)));
 const segmentSafe=(a,b)=>{const n=Math.ceil(distance(a,b)/.25);for(let i=0;i<=n;i++){const t=n?i/n:0;if(!safe(a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t))return false;}return true;};
 const routes=[];
 const apronLoops=[
  [DOORS[0],[267,948],[258,967],[263,967],[272,951],DOORS[0]],
  [DOORS[1],[275,956],[267,970],[272,972],[281,960],DOORS[1]],
  [DOORS[2],[282,963],[275,974],[282,976],[293,971],DOORS[2]],
 ];
 for(const points of apronLoops){
  const routed=[points[0]];let valid=true;
  for(const b of points.slice(1)){
   const a=routed.at(-1);
   if(!segmentSafe(a,b)){
    const dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz);let detour;
    // Walk around a canopy column or planter, not through it. Reject the
    // entire route if no fully validated short detour exists.
    for(const offset of [.75,-.75,1.25,-1.25,1.75,-1.75,2.5,-2.5]){
     const via=t=>[a[0]+dx*t-dz/length*offset,a[1]+dz*t+dx/length*offset],q=via(.33),r=via(.67);
     if(segmentSafe(a,q)&&segmentSafe(q,r)&&segmentSafe(r,b)){detour=[q,r];break;}
    }
    if(!detour){valid=false;break;}routed.push(...detour);
   }
   routed.push(b);
  }
  if(valid)routes.push({kind:'terminal',loop:true,points:routed});
 }
 // Sample the measured waterfront footway, snapping only into adjacent
 // pedestrian polygons. Dedicated cycle lanes are always excluded.
 const source=walks.edges.find(e=>e.from===1712&&e.to===664);
 if(source){
  const edge=prepareGraph({nodes:[0,1],edges:[{...source,from:0,to:1,lane:0}]}).edges[0];let chain=[];
  const flush=()=>{if(chain.length>12)routes.push({kind:'waterfront',points:chain});chain=[];};
  for(let s=2;s<edge.length-2;s+=1){
   const p=routePoint(edge,s,0);let chosen;
   for(const offset of [0,.4,-.4,.8,-.8,1.2,-1.2,1.6,-1.6,2,-2,2.5,-2.5,3,-3,3.5,-3.5]){
    const q=[p.x+Math.cos(p.heading)*offset,p.z-Math.sin(p.heading)*offset];
    if(safe(...q)&&(!chain.length||segmentSafe(chain.at(-1),q))){chosen=q;break;}
   }
   if(chosen)chain.push(chosen);else flush();
  }flush();
 }
 const graph=prepareGraph({nodes:routes.flatMap(r=>[r.points[0],r.points.at(-1)]),edges:routes.map((r,i)=>({...r,from:i*2,to:i*2+1,lane:0}))});
 return {routes:graph.edges,safe,segmentSafe};
}

export function createTerminalLife(city,walks,obstacles=[]){
 const plan=terminalWalkingPlan(city,walks,obstacles),records=[];
 for(const route of plan.routes){
  const count=route.kind==='terminal'?9:Math.max(2,Math.ceil(route.length/12));
  for(let i=0;i<count;i++){
   const index=records.length,s=route.length*(i+.5)/count,p=routePoint(route,s),direction=route.kind==='terminal'||i%3?1:-1;
   records.push({...p,id:`terminal-person-${index}`,route,s,direction,initialS:s,initialDirection:direction,
    heading:p.heading+(direction<0?Math.PI:0),pose:'walk',speed:0,cruise:.85+(index%6)*.095,
    wait:0,stridePhase:index*1.73,suitcase:route.kind==='terminal'?index%5!==0:index%5===0,bag:false,
    height:1.59+(index%7)*.038,body:.88+(index%4)*.065,edge:{terminal:true,crossing:false},walking:true});
  }
 }
 const crowd=createInstancedPeople(records,{safe:plan.safe,center:{x:185,z:875},externalMotion:true,luggage:true,name:'Terminal arrivals and waterfront pedestrians'});
 let time=0;
 const reset=crowd.reset;
 // Keep right when the pavement has room, so opposing walkers can pass
 // instead of meeting head-on on the same mathematical centre line.
 const passingOffsets=new Map();
 const walkingPoint=(p,s)=>{
  const base=routePoint(p.route,s),heading=base.heading+(p.direction<0?Math.PI:0);
  const key=`${p.route.from}:${p.direction}:${Math.floor(s)}`;
  if(!passingOffsets.has(key)){
   const offset=[.55,.4,0].find(o=>plan.segmentSafe([base.x,base.z],[base.x+Math.cos(heading)*o,base.z-Math.sin(heading)*o]))??0;
   passingOffsets.set(key,offset);
  }
  const offset=passingOffsets.get(key);
  return {...base,x:base.x+Math.cos(heading)*offset,z:base.z-Math.sin(heading)*offset};
 };
 const update=(dt,player)=>{
  const step=Math.min(.08,Math.max(0,dt));time+=step;
  if(player&&Math.hypot(player.x-185,player.z-875)>650){crowd.group.visible=false;return;}
  for(const p of crowd.people){
   if(p.knockdown){p.speed=0;continue;}
   if(p.conversation){p.speed=0;continue;}
   if(p.wait>0){p.wait=Math.max(0,p.wait-step);p.speed=0;p.pose=p.suitcase?'chat':'phone';continue;}
   p.pose='walk';const target=walkingPoint(p,p.s+p.direction*1);
   const blocked=(player&&(Math.hypot(p.x-player.x,p.z-player.z)<2.7||approachingPedestrian(p,player)))||crowd.people.some(q=>q!==p&&Math.hypot(q.x-target.x,q.z-target.z)<.48);
   const desired=blocked?0:p.cruise;p.speed+=Math.max(-4*step,Math.min(1.5*step,desired-p.speed));
   const s=Math.max(.1,Math.min(p.route.length-.1,p.s+p.direction*p.speed*step)),q=walkingPoint(p,s);
   // Lateral separation eases in rather than snapping a body sideways.
   const blend=1-Math.exp(-step*5);q.x=p.x+(q.x-p.x)*blend;q.z=p.z+(q.z-p.z)*blend;
   // A cached passing offset can cease to fit at a curb bend. Return to
   // the validated centre line instead of leaving the walker stuck there.
   if(!plan.segmentSafe([p.x,p.z],[q.x,q.z]))Object.assign(q,routePoint(p.route,s));
   if(plan.segmentSafe([p.x,p.z],[q.x,q.z])&&(!player||!sweptContact(player,player,q,true))){
    p.s=s;p.x=q.x;p.z=q.z;const heading=q.heading+(p.direction<0?Math.PI:0);
    p.heading+=Math.atan2(Math.sin(heading-p.heading),Math.cos(heading-p.heading))*(1-Math.exp(-step*6));p.stridePhase+=p.speed*step*5.2;
   }else p.speed=0;
   if(s<=.1||s>=p.route.length-.1){
    if(p.route.loop){p.s=.1;p.wait=1+(Number(p.id.split('-').at(-1))%3);}
    else{p.direction*=-1;p.wait=.6;}
   }
  }
  crowd.update(step,player);
 };
 const snapshot=()=>({people:crowd.people.length,passengers:crowd.people.filter(p=>p.route.kind==='terminal').length,walkers:crowd.people.filter(p=>p.route.kind==='waterfront').length,suitcases:crowd.people.filter(p=>p.suitcase).length,drawCalls:crowd.batch.drawCalls,active:crowd.group.visible,actors:crowd.people.map(p=>({id:p.id,x:p.x,z:p.z,heading:p.heading,speed:p.speed,kind:p.route.kind,suitcase:p.suitcase,fallen:!!p.knockdown}))});
 crowd.group.userData={people:records.length,drawCalls:crowd.batch.drawCalls,reference:'Illustrative terminal arrivals, authored forecourt and validated municipal waterfront footways'};
 return {...crowd,plan,update,snapshot,reset(){time=0;reset();for(const p of crowd.people){p.s=p.initialS;p.direction=p.initialDirection;p.wait=0;p.speed=0;p.heading=routePoint(p.route,p.s).heading+(p.direction<0?Math.PI:0);delete p.knockdown;}}};
}
