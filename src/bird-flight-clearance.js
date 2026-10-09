import {SpatialIndex,pointInPolygon} from './geo.js';

// Low food-seeking flights need the same city geometry as the player. Heights
// here, like birds.js, are relative to local ground. No city names or locations.
export function createBirdFlightClearance({buildings=null,stalls=[],water=[]}={}){
 const canopies=new SpatialIndex(stalls.map(s=>{
  const c=Math.cos(s.facing||0),n=Math.sin(s.facing||0);
  const ring=[[-s.w/2,-s.d/2],[s.w/2,-s.d/2],[s.w/2,s.d/2],[-s.w/2,s.d/2]].map(([x,z])=>[s.x+x*c+z*n,s.z-x*n+z*c]);
  return {rings:[ring],height:3.3};
 }),16);
 const waterIndex=new SpatialIndex(water),radius=.18;
 const finite=p=>p&&[p.x,p.y,p.z].every(Number.isFinite);
 function clear(p){
  if(p.y<radius)return false;
  // A small cross covers the bird's body; this avoids accepting a centre point
  // while its head passes through the edge of a counter or wall.
  for(const [dx,dz] of [[0,0],[radius,0],[-radius,0],[0,radius],[0,-radius]]){
   const x=p.x+dx,z=p.z+dz;
   for(const index of [buildings,canopies])for(const b of index?.near(x,z)||[]){
    if(b.disabled||!pointInPolygon(x,z,b.rings))continue;
    const height=Number.isFinite(b.height)?b.height:Number.isFinite(b.h)?b.h:18;
    if(p.y-radius<height)return false;
   }
   if(p.y<.6&&waterIndex.at(x,z))return false;
  }
  return true;
 }
 return (from,to)=>{
  if(!finite(from)||!finite(to))return false;
  const distance=Math.hypot(to.x-from.x,to.y-from.y,to.z-from.z);
  // Normal flight moves <1m per step. Reject discontinuities instead of doing
  // an unbounded scan or letting a teleport skip the intervening buildings.
  if(distance>8)return false;
  const steps=Math.max(1,Math.ceil(distance/.25));
  for(let i=1;i<=steps;i++){
   const t=i/steps;
   if(!clear({x:from.x+(to.x-from.x)*t,y:from.y+(to.y-from.y)*t,z:from.z+(to.z-from.z)*t}))return false;
  }
  return true;
 };
}
