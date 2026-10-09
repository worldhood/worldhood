// Sea and pond polygons, and land cover areas, from OpenStreetMap (© OpenStreetMap contributors, ODbL) inside a box.
// Coastline ways have land on their left (geographic orientation). Points here are [x, n] with n
// pointing north (n = −z of the game frame), so the usual counter-clockwise rules hold.
import polygonClipping from 'polygon-clipping';

const same=(a,b)=>Math.abs(a[0]-b[0])<1e-6&&Math.abs(a[1]-b[1])<1e-6;
// Join ways that continue one another (end of one = start of the next) into chains.
export function joinWays(ways){
 const chains=ways.map(w=>w.slice()).filter(w=>w.length>1);let joined=true;
 while(joined){joined=false;
  for(let i=0;i<chains.length&&!joined;i++)for(let j=0;j<chains.length;j++){if(i===j)continue;
   if(same(chains[i].at(-1),chains[j][0])&&!same(chains[i][0],chains[i].at(-1))){chains[i].push(...chains[j].slice(1));chains.splice(j,1);joined=true;break;}}}
 return chains;
}
const inside=(p,b)=>p[0]>=b[0]&&p[0]<=b[2]&&p[1]>=b[1]&&p[1]<=b[3];
// Liang–Barsky: the part of segment a→b inside box b ([minX,minN,maxX,maxN]) as [t0,t1] or null.
function clipT(a,c,b){
 let t0=0,t1=1;const dx=c[0]-a[0],dy=c[1]-a[1];
 for(const [p,q] of [[-dx,a[0]-b[0]],[dx,b[2]-a[0]],[-dy,a[1]-b[1]],[dy,b[3]-a[1]]]){
  if(p===0){if(q<0)return null;continue;}const r=q/p;if(p<0){if(r>t1)return null;if(r>t0)t0=r;}else{if(r<t0)return null;if(r<t1)t1=r;}}
 return [t0,t1];
}
// Open chain → pieces inside the box, each starting and ending on its boundary.
export function clipChain(chain,box){
 const pieces=[];let cur=null;
 for(let i=1;i<chain.length;i++){
  const a=chain[i-1],c=chain[i],t=clipT(a,c,box);
  if(!t){if(cur){pieces.push(cur);cur=null;}continue;}
  const p0=[a[0]+(c[0]-a[0])*t[0],a[1]+(c[1]-a[1])*t[0]],p1=[a[0]+(c[0]-a[0])*t[1],a[1]+(c[1]-a[1])*t[1]];
  if(!cur)cur=[p0];else if(!same(cur.at(-1),p0))cur.push(p0);
  cur.push(p1);if(t[1]<1){pieces.push(cur);cur=null;}
 }
 if(cur)pieces.push(cur);
 return pieces.filter(p=>p.length>1);
}
// Position along the box perimeter, counter-clockwise from the bottom-left corner.
function perimeter(p,b){const w=b[2]-b[0],h=b[3]-b[1],e=1e-6;
 if(Math.abs(p[1]-b[1])<e)return p[0]-b[0];if(Math.abs(p[0]-b[2])<e)return w+p[1]-b[1];if(Math.abs(p[1]-b[3])<e)return w+h+b[2]-p[0];return 2*w+h+b[3]-p[1];}
const area=r=>{let s=0;for(let i=0;i<r.length;i++){const a=r[i],c=r[(i+1)%r.length];s+=a[0]*c[1]-c[0]*a[1];}return s/2;};
const close=r=>same(r[0],r.at(-1))?r:[...r,r[0]];
// Land polygons in the box from coastline chains; water = box − land.
export function coastlineWater(ways,box){
 const chains=joinWays(ways),islands=[],pieces=[];
 for(const c of chains){if(same(c[0],c.at(-1))){if(c.some(p=>inside(p,box))&&area(c)>0)islands.push([close(c)]);}else pieces.push(...clipChain(c,box));}
 const boxRing=[[box[0],box[1]],[box[2],box[1]],[box[2],box[3]],[box[0],box[3]],[box[0],box[1]]],land=[...islands];
 if(pieces.length){
  const corners=[[box[0],box[1]],[box[2],box[1]],[box[2],box[3]],[box[0],box[3]]].map(p=>({p,t:perimeter(p,box)})),L=2*(box[2]-box[0]+box[3]-box[1]);
  const used=new Set();
  for(let s=0;s<pieces.length;s++){if(used.has(s))continue;const ring=[];let i=s;
   for(let guard=0;guard<pieces.length+1;guard++){used.add(i);ring.push(...pieces[i]);
    // Walk counter-clockwise from this exit to the nearest entry, picking up corners on the way.
    const t0=perimeter(pieces[i].at(-1),box),ahead=t=>((t-t0)%L+L)%L;
    let next=-1,best=Infinity;pieces.forEach((q,k)=>{const d=ahead(perimeter(q[0],box));if(d<best||(d===best&&k===s)){best=d;next=k;}});
    for(const c of corners.filter(c=>ahead(c.t)>0&&ahead(c.t)<best).sort((a,b)=>ahead(a.t)-ahead(b.t)))ring.push(c.p);
    if(next===s||used.has(next)){break;}i=next;}
   if(ring.length>2)land.push([close(ring)]);
  }
 }
 if(!land.length)return [[boxRing]];
 return polygonClipping.difference([[boxRing]],...land);
}
// Overpass `out geom` reply → water multipolygon in the game frame ([x,z]), within box (game frame).
export function osmWater(reply,toLocal,box){
 const g=box&&[box[0],-box[3],box[2],-box[1]],geo=w=>w.geometry.map(p=>{const [x,z]=toLocal([p.lon,p.lat]);return [x,-z];});
 const coast=reply.elements.filter(e=>e.type==='way'&&e.tags?.natural==='coastline').map(geo);
 let water=coast.length?coastlineWater(coast,g):[];
 const ponds=[];
 for(const e of reply.elements){if(e.tags?.natural!=='water')continue;
  if(e.type==='way'&&e.geometry?.length>3&&same([e.geometry[0].lon,e.geometry[0].lat],[e.geometry.at(-1).lon,e.geometry.at(-1).lat]))ponds.push([geo(e)]);
  if(e.type==='relation'){const outer=joinWays((e.members||[]).filter(m=>m.role==='outer'&&m.geometry).map(geo)).filter(r=>same(r[0],r.at(-1)));for(const r of outer)ponds.push([r]);}
 }
 const clip=[[[g[0],g[1]],[g[2],g[1]],[g[2],g[3]],[g[0],g[3]],[g[0],g[1]]]];
 if(ponds.length)water=polygonClipping.union(water,...ponds.map(p=>polygonClipping.intersection(p,clip)).filter(p=>p.length));
 return water.map(poly=>poly.map(r=>r.map(([x,n])=>[x,-n])));
}
// Land cover areas (landuse / leisure / natural) → [{id, kind, tag, rings}] in the game frame, kinds named like the
// municipal park registers (Nurmi, Niitty, Metsä, Pensas, Avokallio, Kenttä) so they draw and behave the same.
// Ordered from the most specific cover to the broadest: where areas overlap, the earlier one wins.
export const OSM_LAND=[['natural=bare_rock','Avokallio'],['leisure=pitch','Kenttä'],['leisure=playground','Leikkipaikka'],['natural=scrub','Pensas'],
 ['natural=wood','Metsä'],['landuse=forest','Metsä'],['landuse=meadow','Niitty'],['natural=grassland','Niitty'],['natural=heath','Niitty'],['landuse=grass','Nurmi'],
 ['landuse=village_green','Nurmi'],['landuse=allotments','Kasvimaa'],['leisure=garden','Nurmi'],['landuse=cemetery','Nurmi'],['leisure=golf_course','Nurmi'],
 ['landuse=recreation_ground','Nurmi'],['leisure=common','Nurmi'],['leisure=park','Nurmi']];
export function osmLandcover(reply,toLocal){
 const geo=g=>g.map(p=>toLocal([p.lon,p.lat])),closed=r=>r.length>3&&same(r[0],r.at(-1)),out=[];
 for(const e of reply.elements||[]){const rank=OSM_LAND.findIndex(([t])=>{const [k,v]=t.split('=');return e.tags?.[k]===v;});if(rank<0)continue;
  let polys=[];
  if(e.type==='way'&&e.geometry&&closed(e.geometry.map(p=>[p.lon,p.lat])))polys=[[geo(e.geometry)]];
  if(e.type==='relation'){const ring=role=>joinWays((e.members||[]).filter(m=>m.role===role&&m.geometry).map(m=>geo(m.geometry))).filter(closed);
   const outer=ring('outer'),inner=ring('inner');if(outer.length)polys=inner.length?polygonClipping.difference(outer.map(r=>[r]),...inner.map(r=>[r])):outer.map(r=>[r]);}
  for(const rings of polys)out.push({id:`osm-${e.type}-${e.id}`,kind:OSM_LAND[rank][1],tag:OSM_LAND[rank][0],rank,rings});
 }
 return out.sort((a,b)=>a.rank-b.rank);
}
