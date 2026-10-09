import polygonClipping from 'polygon-clipping';
import {SpatialIndex,bounds} from './geo.js';

// Every placed object has a deliberate physical role. Breakable objects use
// their own moving-body simulation; overhead signs and decoration don't turn
// their full visual bounds into a wall across the road.
export const OBJECT_MODES=Object.freeze(['solid','breakable','overhead','decoration']);
export function objectBehavior(item,mode){
 if(!OBJECT_MODES.includes(mode))throw Error(`Unknown world object mode: ${mode}`);
 item.collisionMode=mode;return item;
}
export function solidBox({id,name,x,z,width,depth,yaw=0}){
 if(![x,z,width,depth,yaw].every(Number.isFinite)||width<=0||depth<=0)throw Error('A solid box needs a finite positive footprint');
 const c=Math.cos(yaw),s=Math.sin(yaw),ring=[[-width/2,-depth/2],[width/2,-depth/2],[width/2,depth/2],[-width/2,depth/2]].map(([a,b])=>[x+a*c+b*s,z-a*s+b*c]);
 return objectBehavior({id,name,rings:[ring],bbox:bounds([ring])},'solid');
}
const EPSILON=1e-8,REACH=4;
const ignored=(item,ignore)=>item.disabled||item.playerTaken||ignore?.includes(item);
function footprint(p,{halfWidth=.98,halfLength=2.3}={}){
 const c=Math.cos(p.heading||0),s=Math.sin(p.heading||0);
 return [[-halfWidth,-halfLength],[halfWidth,-halfLength],[halfWidth,halfLength],[-halfWidth,halfLength]].map(([x,z])=>[p.x+x*c+z*s,p.z-x*s+z*c]);
}
function area(ring){let n=0;for(let i=0;i<ring.length;i++){const a=ring[i],b=ring[(i+1)%ring.length];n+=a[0]*b[1]-b[0]*a[1];}return Math.abs(n)/2;}
function overlapArea(ring,item){
 const a=bounds([ring]),b=item.bbox;
 if(a[0]>=b[2]||a[2]<=b[0]||a[1]>=b[3]||a[3]<=b[1])return 0;
 const intersection=polygonClipping.intersection([ring],item.rings);
 return intersection.reduce((total,rings)=>total+Math.max(0,area(rings[0])-rings.slice(1).reduce((n,r)=>n+area(r),0)),0);
}

export class WorldObjects{
 constructor(items=[]){this.items=new Set();this.index=new SpatialIndex([],16);this.add(items);}
 add(items){
  for(const item of items){
   if(!item||this.items.has(item))continue;
   const mode=item.collisionMode??(item.breakable?'breakable':'solid');
   objectBehavior(item,mode);
   if(mode==='solid'){
    if(!item.rings?.length)throw Error(`Solid world object ${item.id||item.name||''} has no footprint`);
    item.bbox??=bounds(item.rings);
    const b=item.bbox;
    // Index expanded bounds, not just the post's tiny centre cell: a car can
    // touch a post in the adjacent cell before its centre reaches that cell.
    this.index.add([{item,bbox:[b[0]-REACH,b[1]-REACH,b[2]+REACH,b[3]+REACH]}]);
   }
   this.items.add(item);
  }
  return this;
 }
 overlap(p,options={}){
  const ring=footprint(p,options);
  for(const {item} of this.index.near(p.x,p.z))if(!ignored(item,options.ignore)&&overlapArea(ring,item)>EPSILON)return item;
  return null;
 }
 blocksStep(from,to,options={}){
  const turn=Math.atan2(Math.sin((to.heading||0)-(from.heading||0)),Math.cos((to.heading||0)-(from.heading||0)));
  const n=Math.max(1,Math.ceil(Math.hypot(to.x-from.x,to.z-from.z)/.15),Math.ceil(Math.abs(turn)/.04)),initial=new Map();
  const first=footprint(from,options);
  for(let i=1;i<=n;i++){
   const t=i/n,p={x:from.x+(to.x-from.x)*t,z:from.z+(to.z-from.z)*t,heading:(from.heading||0)+turn*t},ring=footprint(p,options);
   for(const {item} of this.index.near(p.x,p.z)){
    if(ignored(item,options.ignore))continue;
    const overlap=overlapArea(ring,item);if(overlap<=EPSILON)continue;
    if(!initial.has(item))initial.set(item,overlapArea(first,item));
    // A player already touching an object can back or slide out. A new
    // contact must stop before even a narrow post passes inside the body.
    if(overlap>initial.get(item)+EPSILON)return item;
   }
  }
  return null;
 }
 snapshot(){const modes=Object.fromEntries(OBJECT_MODES.map(mode=>[mode,0]));for(const item of this.items)modes[item.collisionMode]++;return {count:this.items.size,...modes};}
}
