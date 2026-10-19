// Which OSM ways city:build keeps at street level, and the building footprints the car collides with.
// The game has one ground level: building passages, arcades and covered streets are kept as ground,
// tunnels below it are left out. The car collides with the mapped footprints with passages cut through
// and shallow overlaps with the carriageway trimmed off, so a mapped building edge that strays onto the
// street is not an invisible wall; city.buildings and the 3D buildings stay as mapped.
import polygonClipping from 'polygon-clipping';
import {bounds,segmentDistance,pointInPolygon} from '../src/geo.js';

const yes=v=>v!=null&&v!=='no';
export const underground=t=>(parseFloat(t.layer)||0)<0||(parseFloat(t.level)||0)<0||t.location==='underground';
// tunnel=building_passage, or covered=yes/arcade without a tunnel tag, at ground level: cut through the buildings.
// Other covered ways are kept as before but cut nothing.
export const passage=t=>!underground(t)&&(t.tunnel==='building_passage'||!yes(t.tunnel)&&['yes','arcade'].includes(t.covered));
export const keepWay=t=>t.area!=='yes'&&t.highway!=='proposed'&&t.highway!=='construction'&&(!yes(t.tunnel)||passage(t));

const ringArea=r=>{let a=0;for(let i=1;i<r.length;i++)a+=r[i-1][0]*r[i][1]-r[i][0]*r[i-1][1];return Math.abs(a/2);};
export const polygonArea=rings=>rings.reduce((s,r,i)=>s+(i?-1:1)*ringArea(r),0);
const multiArea=multi=>multi.reduce((s,p)=>s+polygonArea(p),0);
const overlaps=(a,b)=>a[0]<b[2]&&a[2]>b[0]&&a[1]<b[3]&&a[3]>b[1];
const safe=(f,fallback=[])=>{try{return f();}catch{return fallback;}};
// How far into `area` (a MultiPolygon) the piece reaches: its farthest point from the area's edge, sampled at
// the vertices and on a grid inside (a building straddling a street has every vertex on the kerbs).
export function depthInto(piece,area){
 const edges=area.flatMap(p=>p.flatMap(r=>r.slice(1).map((b,i)=>[r[i],b]))),[x0,z0,x1,z1]=bounds(piece),step=Math.max(.25,Math.sqrt((x1-x0)*(z1-z0)/400));
 const samples=piece.flatMap(r=>r);for(let x=x0+step/2;x<x1;x+=step)for(let z=z0+step/2;z<z1;z+=step)if(pointInPolygon(x,z,piece))samples.push([x,z]);
 let depth=0;for(const [x,z] of samples){let d=Infinity;for(const [a,b] of edges)d=Math.min(d,segmentDistance(x,z,a,b));depth=Math.max(depth,d);}
 return depth;
}
// The parts of a footprint lying on the carriageway: [{rings, area, depth}].
export function intrusions(rings,roads){
 const box=bounds(rings),near=roads.filter(r=>overlaps(r.bbox,box)).map(r=>r.rings);if(!near.length)return [];
 const area=safe(()=>polygonClipping.union(...near));
 return safe(()=>polygonClipping.intersection([rings],area)).map(p=>({rings:p,area:polygonArea(p),depth:depthInto(p,area)})).filter(p=>p.area>.01);
}
// Collision footprints as city.pack `collision` ({replaced: ids, buildings: pieces}; read by collisionBuildings in
// src/geo.js). Passages are always cut through; a carriageway overlap is trimmed when it reaches at most `maxDepth`
// metres into the street and trimming leaves at least `minKeep` of the building, so a kiosk or a building
// standing on a mapped parking area stays whole and solid.
export function collisionFootprints(buildings,{roads=[],passages=[],maxDepth=3,minKeep=.5}={}){
 const out=[],changed=new Set(),stats={buildings:buildings.length,passagesCut:0,trimmed:0,kept:0,trimmedArea:0};
 for(const b of buildings){
  const box=b.bbox||bounds(b.rings),through=passages.filter(p=>overlaps(p.bbox,box)).map(p=>p.rings);
  let rings=[b.rings],whole=polygonArea(b.rings);
  if(through.length){const cut=safe(()=>polygonClipping.difference(rings,...through),rings);if(multiArea(cut)<whole-.01){rings=cut;stats.passagesCut++;}}
  const pieces=intrusions(b.rings,roads),shallow=pieces.filter(p=>p.depth<=maxDepth);let solid=pieces.length>shallow.length;
  if(shallow.length){const cut=safe(()=>polygonClipping.difference(rings,...shallow.map(p=>[p.rings])),rings),removed=multiArea(rings)-multiArea(cut);
   if(multiArea(cut)>=minKeep*whole){rings=cut;stats.trimmed++;stats.trimmedArea+=removed;}else solid=true;}
  if(solid)stats.kept++;
  if(rings.length!==1||rings[0]!==b.rings)changed.add(b.id);
  for(const r of rings)if(polygonArea(r)>.05)out.push(r===b.rings?b:{...b,rings:r,bbox:bounds(r)});
 }
 stats.trimmedArea=Math.round(stats.trimmedArea);
 return {collision:{replaced:[...changed],buildings:out.filter(b=>changed.has(b.id))},stats};
}
// Survey for a built city: how many collision footprints reach into the carriageway, and how deep.
export function carriagewayIntrusions(buildings,roads,{minDepth=.1}={}){
 const hits=[];for(const b of buildings){const p=intrusions(b.rings,roads).filter(p=>p.depth>=minDepth);if(p.length)hits.push({id:b.id,area:p.reduce((s,q)=>s+q.area,0),depth:Math.max(...p.map(q=>q.depth))});}
 const depths=hits.map(h=>h.depth).sort((a,b)=>a-b),q=f=>+(depths[Math.min(depths.length-1,Math.floor(f*depths.length))]||0).toFixed(2);
 return {buildings:hits.length,area:Math.round(hits.reduce((s,h)=>s+h.area,0)),median:q(.5),p90:q(.9),max:q(1),over1m:depths.filter(d=>d>1).length,hits};
}
