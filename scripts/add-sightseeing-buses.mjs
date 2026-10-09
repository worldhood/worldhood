// Sightseeing double-decker circuit around Kauppatori / Esplanadi / Senate Square plus the
// Eteläranta tour-bus stop. Demo traffic on measured directed roads (mobility.json edges with
// the harbour lane corrections), swept with the full 2.55 m × 11.4 m double-decker footprint by
// usableBusPaths. Not a licensed operator's timetable or a surveyed lane centre.
// Run after densify-buses.mjs:  node scripts/add-sightseeing-buses.mjs
import {readFileSync,writeFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {SpatialIndex} from '../src/geo.js';
import {busFitsRoad,busOverlaps,busPose,busSamples,safeBusSweep,usableBusPaths} from '../src/bus-simulation.js';
import {prepareGraph} from '../src/mobility.js';
import {correctHarbourLanes} from '../src/road-safety.js';
const city=JSON.parse(gunzipSync(readFileSync('public/data/city.pack'))),data=JSON.parse(readFileSync('public/data/bus-corridors.json'));
const world={buildings:new SpatialIndex(city.buildings),roads:new SpatialIndex(city.roads.filter(r=>!/Koroke/.test(r.kind))),trafficForbidden:new SpatialIndex(city.roads.filter(r=>/Koroke/.test(r.kind)))};
const graph=prepareGraph(correctHarbourLanes(JSON.parse(readFileSync('public/data/mobility.json'))).roads);
const edge=(from,to)=>{const e=graph.edges.find(e=>e.from===from&&e.to===to);if(!e)throw Error(`no edge ${from}->${to}`);return e;};
// Circuit: Eteläranta north past the market → Pohjoisesplanadi west past Havis Amanda → Unioninkatu
// south → Eteläesplanadi east → Eteläranta. Closed at node 749. (Northbound links to Senate Square and
// the Erottaja end of the park are not in the directed network or run over mapped islands, which the
// full-footprint check rightly rejects, so the circuit stays on the Kauppatori end of the Esplanadi.)
export const RING=[749,2242,2243,457,458,750,751,1427,3848,2251,2248,2249,2592,1416,2244,3396,2383,749];
// Centreline nudges (metres) where the municipal lane line hugs an island on the inside of a curve.
const NUDGE={458:[-1.2,0],750:[-1.2,.4]};
// Nodes dropped from the centreline so a junction corner can be filleted across them (2244 sits 10 m past the Unioninkatu turn).
const SKIP=new Set([2244]);
export const TAIL=[752,578,1379,2384,1401,649,1417,748,749]; // Eteläranta northbound from the Olympia approach
const REFERENCE='Demo sightseeing circuit on measured directed roads (Helsinki municipal network); the hop-on-hop-off loop is interpreted, not a licensed operator timetable';
function chain(nodes){const pts=[];for(let i=1;i<nodes.length;i++){const e=edge(nodes[i-1],nodes[i]);for(const [j,p]of e.points.entries())if(i===1||j>0){const n=j===0?NUDGE[nodes[i-1]]:j===e.points.length-1?NUDGE[nodes[i]]:null;if(j===e.points.length-1&&SKIP.has(nodes[i]))continue;pts.push([p[0]+(n?.[0]||0),p[1]+(n?.[1]||0)]);}}return pts;}
const dedupe=pts=>pts.filter((p,i)=>!i||Math.hypot(p[0]-pts[i-1][0],p[1]-pts[i-1][1])>.3);
// Ramer–Douglas–Peucker: drop near-collinear vertices so corners can be filleted across them.
export function simplify(pts,tolerance=.7){
 if(pts.length<3)return pts;const [a,b]=[pts[0],pts.at(-1)];let worst=0,at=0;
 for(let i=1;i<pts.length-1;i++){const p=pts[i],dx=b[0]-a[0],dz=b[1]-a[1],l=Math.hypot(dx,dz)||1,d=Math.abs((p[0]-a[0])*dz-(p[1]-a[1])*dx)/l;if(d>worst){worst=d;at=i;}}
 return worst>tolerance?[...simplify(pts.slice(0,at+1),tolerance).slice(0,-1),...simplify(pts.slice(at),tolerance)]:[a,b];
}
// Tangent arc at every corner so the swept body check (≤ 1/8 rad per metre) passes; an 11 m bus cannot pivot on a node.
export function fillet(pts,radius=11){
 const out=[pts[0]];
 for(let i=1;i<pts.length-1;i++){const a=out.at(-1),b=pts[i],c=pts[i+1];
  const l1=Math.hypot(b[0]-a[0],b[1]-a[1]),l2=Math.hypot(c[0]-b[0],c[1]-b[1]),h1=Math.atan2(b[1]-a[1],b[0]-a[0]),h2=Math.atan2(c[1]-b[1],c[0]-b[0]);
  const turn=Math.atan2(Math.sin(h2-h1),Math.cos(h2-h1));if(Math.abs(turn)<.06){out.push(b);continue;}
  const tan=Math.tan(Math.abs(turn)/2),r=Math.min(radius,Math.min(l1*.85,l2*.85)/tan),t=r*tan,s=Math.sign(turn);
  const p0=[b[0]-Math.cos(h1)*t,b[1]-Math.sin(h1)*t],cx=p0[0]-s*Math.sin(h1)*r,cz=p0[1]+s*Math.cos(h1)*r,n=Math.max(2,Math.ceil(Math.abs(turn)*r/1.5));
  for(let k=0;k<=n;k++){const phi=h1-s*Math.PI/2+turn*k/n;out.push([cx+Math.cos(phi)*r,cz+Math.sin(phi)*r]);}
 }
 out.push(pts.at(-1));return dedupe(out);
}
const arc=pts=>pts.slice(1).reduce((s,p,i)=>s+Math.hypot(p[0]-pts[i][0],p[1]-pts[i][1]),0);
function build(id,parts){
 const pts=fillet(simplify(dedupe(parts.flat()))).map(p=>p.map(v=>+v.toFixed(3)));
 const paths=usableBusPaths({paths:[{id,kind:'tourist',verified:true,line:'',destination:'CITY TOUR',speedLimitKmh:30,demoStaging:true,points:pts,reference:REFERENCE}]},world);
 if(paths.length!==1)diagnose(pts);
 return {paths,pts};
}
// Prints every pose along the centreline that fails the footprint or sweep check, with the surface under it.
function diagnose(pts){
 const all=new SpatialIndex(city.roads),path=prepareGraph({nodes:[0,1],edges:[{points:pts,from:0,to:1,lane:0}]}).edges[0];let prev=null;
 for(let s=8;s<=path.length-8;s+=3){const p=busPose(path,s,'tourist'),fits=busFitsRoad(p,world),sweep=!prev||safeBusSweep(prev,p,world);
  if(!fits||!sweep){const why=new Set();for(const [x,z]of busSamples(p)){const r=world.roads.at(x,z),b=world.buildings.at(x,z),f=world.trafficForbidden.at(x,z);if(!r||b||f){const a=all.at(x,z);why.add(`${r?r.name+'/'+r.kind:'no road'}${a&&!r?' ('+a.name+'/'+a.kind+')':''}${b?' building':''}${f?' island':''}`);}}
   console.log(`  s=${s} at ${p.x.toFixed(1)},${p.z.toFixed(1)} heading ${(p.heading*180/Math.PI).toFixed(0)}° ${fits?'':'NO FIT '}${sweep?'':'SWEEP '}${[...why].join(' | ')}`);}
  prev=p;}
}
const ring=chain(RING).slice(0,-1);
function loopPath(id,tailNodes,rotateNode){
 const start=ring.findIndex(p=>{const n=graph.nodes[rotateNode];return Math.hypot(p[0]-n[0],p[1]-n[1])<1.5;});if(start<0)throw Error(`ring has no node ${rotateNode}`);
 const circuit=[...ring.slice(start),...ring.slice(0,start),ring[start]];
 // Overlap the closing stretch by ~34 m so the usable `end` lies on the same spot as `loopTo`.
 const over=[];for(let i=1,acc=0;i<circuit.length&&acc<34;i++){over.push(circuit[i]);acc+=Math.hypot(circuit[i][0]-circuit[i-1][0],circuit[i][1]-circuit[i-1][1]);}
 const tail=tailNodes?chain(tailNodes).slice(0,-1):[];
 const {paths,pts}=build(id,[tail,circuit,over]);
 if(paths.length!==1)throw Error(`${id}: expected one continuous usable section over ${arc(pts).toFixed(0)} m, got ${JSON.stringify(paths.map(p=>[Math.round(p.start),Math.round(p.end)]))}`);
 const [p]=paths,end=busPose(p,p.end,'tourist');let loopTo=null,best=Infinity;
 for(let s=p.start;s<p.end-30;s+=.25){const q=busPose(p,s,'tourist'),d=Math.hypot(q.x-end.x,q.z-end.z)+Math.abs(Math.atan2(Math.sin(q.heading-end.heading),Math.cos(q.heading-end.heading)))*3;if(d<best){best=d;loopTo=s;}}
 if(best>.35)throw Error(`${id}: loop does not close (${best.toFixed(2)} m at s=${loopTo}; usable ${p.start}–${p.end.toFixed(1)} of ${p.length.toFixed(1)} m, end pose ${end.x.toFixed(1)},${end.z.toFixed(1)})`);
 const {cumulative,...rest}=p;return {...rest,loopTo:+loopTo.toFixed(2)};
}
const additions=[
 loopPath('sightseeing-loop-etelaranta',TAIL,749),      // enters from the Olympia approach, then circles
 loopPath('sightseeing-loop-esplanadi',null,751),         // starts at Havis Amanda, westbound
];
// Tour-bus stop on the quay side of Eteläranta opposite the market: standing double-deckers
// clear of the northbound car lane (cars run 0.35 m right of the polyline at x≈12).
const bays=[];
for(const z of [330,344]){let found=null;for(const x of [17.3,17,16.8,17.6,16.5]){const p={kind:'tourist',x,z,heading:0,stopId:'sightseeing-etelaranta',platform:'',line:'',destination:'CITY TOUR',demoStaging:true,radius:420,reference:'Hop-on-hop-off stop on Eteläranta at Kauppatori (interpreted position on the mapped carriageway, not photo-surveyed)'};
 if(busFitsRoad(p,world)&&!bays.some(b=>busOverlaps(p,b,1))){found=p;break;}}
 if(!found)throw Error('no road-clear standing position for the Eteläranta tour-bus stop at z='+z);bays.push(found);
}
data.paths=[...data.paths.filter(p=>!String(p.id).startsWith('sightseeing-')),...additions];
data.sightseeingBays=bays;
data.sightseeingNote='Two sightseeing circuits (one double-decker each, plus the observed Unioninkatu segment) around Kauppatori, Havis Amanda and the east end of the Esplanadi plus standing tour buses on Eteläranta. Demo density; not a licensed operator route or timetable.';
writeFileSync('public/data/bus-corridors.json',JSON.stringify(data));
console.log(JSON.stringify({loops:additions.map(p=>({id:p.id,length:+p.length.toFixed(1),start:p.start,end:+p.end.toFixed(1),loopTo:p.loopTo,offset:p.offset,points:p.points.length})),bays:bays.map(b=>[b.x,b.z])},null,1));
