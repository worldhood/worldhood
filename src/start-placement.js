import {SpatialIndex} from './geo.js';

// Start points sit in a traffic lane: on the carriageway, clear of kerbs, islands and pavement,
// facing the lane's direction of travel, away from junctions. Used by the area builders and the tests.
export const START_MARGIN=.6; // metres of clear carriageway around the car body
const NOT_CARRIAGEWAY=/Koroke|Erotus|Katuraide|Pysäköinti|Tonttiliittymä/;
export function startSurfaces(roads,pavement){
 return {drive:new SpatialIndex(roads.filter(r=>!NOT_CARRIAGEWAY.test(r.kind||''))),blocked:new SpatialIndex([...pavement,...roads.filter(r=>NOT_CARRIAGEWAY.test(r.kind||''))])};
}
const local=(p,lx,lz)=>{const s=Math.sin(p.heading),c=Math.cos(p.heading);return [p.x+lx*c+lz*s,p.z-lx*s+lz*c];};
// The car body (±1 m by ±2.3 m) plus `margin`, and `runway` metres of carriageway ahead.
export function startClear(p,{drive,blocked},{margin=START_MARGIN,runway=8}={}){
 const ok=([x,z])=>!!drive.at(x,z)&&!blocked.at(x,z);
 for(let lx=-1-margin;lx<=1+margin+1e-9;lx+=(1+margin)/4)for(let lz=-2.3-margin;lz<=2.3+margin+1e-9;lz+=(2.3+margin)/6)if(!ok(local(p,lx,lz)))return false;
 for(let d=4;d<=runway;d+=2)if(!ok(local(p,0,-2.3-d)))return false;
 return true;
}
const angle=a=>Math.abs(((a%(2*Math.PI))+3*Math.PI)%(2*Math.PI)-Math.PI);
// Lane positions of directed road edges near `start`; the closest that is clear wins, with a 20 m
// penalty for turning round from the intended heading.
export function laneStart(start,edges,surfaces,{reach=60,junction=8,step=1}={}){
 let best=null;
 for(const e of edges){
  if(e.crossing||!e.points?.length)continue;const pts=e.points;let along=0;
  if(pts.every(([x,z])=>Math.hypot(x-start.x,z-start.z)>reach+(e.length||0)))continue;
  const total=e.length??pts.reduce((s,p,i)=>i?s+Math.hypot(p[0]-pts[i-1][0],p[1]-pts[i-1][1]):0,0);
  for(let i=1;i<pts.length;i++){
   const a=pts[i-1],b=pts[i],l=Math.hypot(b[0]-a[0],b[1]-a[1]);if(!l)continue;const dx=(b[0]-a[0])/l,dz=(b[1]-a[1])/l,lane=e.lane||0;
   for(let t=0;t<l;t+=step){
    const s=along+t;if(s<junction||s>total-junction)continue;
    const p={x:a[0]+dx*t-dz*lane,z:a[1]+dz*t+dx*lane,heading:Math.atan2(-dx,-dz)};
    const score=Math.hypot(p.x-start.x,p.z-start.z)+(start.heading==null?0:10*(1-Math.cos(angle(p.heading-start.heading))));
    if(score>reach||best&&score>=best.score||!startClear(p,surfaces))continue;
    best={score,p};
   }
   along+=l;
  }
 }
 return best&&{...start,x:+best.p.x.toFixed(2),z:+best.p.z.toFixed(2),heading:+best.p.heading.toFixed(4)};
}
