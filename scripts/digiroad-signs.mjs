// Traffic signs, signals, crossings and stops from authoritative open data, merged into the street
// furniture layer that Mapillary detections build (scripts/mapillary-features.mjs runs this step).
//  - Digiroad (Finnish Transport Infrastructure Agency, Väylävirasto; CC BY 4.0) covers all of Finland:
//    traffic signs with code, value, extra plates and validity direction on the road link, traffic-light
//    points and public transport stops with bearing and shelter. Used automatically for Finnish cities.
//  - The city's own WFS (cities/<id>/city.json "official": crossings, signal junctions, stops) when listed.
//  - OpenStreetMap sign nodes (traffic_sign=FI:…, highway=give_way|stop; ODbL) fill in single signs.
// Every source becomes sign posts in the city's local frame, mounted kerbside (never in a lane), facing the
// traffic they govern. Duplicates are merged by distance, sign family and facing: an official sign keeps
// its code and facing and takes the detected (photographed) post position when Mapillary saw it too.
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fetchWfs,projector,parts} from './official-wfs.mjs';
import {surfaceIndex,snapOffCarriageway,dedupeExisting} from './mapillary-features.mjs';
import {finnishCode,finnishSign,signFace,signFamily} from '../src/sign-faces.js';

export const DIGIROAD={url:'https://avoinapi.vaylapilvi.fi/vaylatiedot/digiroad/wfs',licence:'CC BY 4.0',
 attribution:'Traffic signs, signals and stops from Digiroad, Finnish Transport Infrastructure Agency (Väylävirasto), CC BY 4.0',
 layers:{signs:'digiroad:dr_liikennemerkit',lights:'digiroad:dr_liikennevalo',stops:'digiroad:dr_pysakki',links:'digiroad:dr_tielinkki_tielinkin_tyyppi',
  speed:'digiroad:dr_nopeusrajoitus',vehicles:'digiroad:dr_ajoneuvokoht_rajoitus',buslanes:'digiroad:dr_joukkoliikennekaista',lanes:'digiroad:dr_kaistojen_lukumaara'}};
export const isFinnish=entry=>/Finland|Suomi/i.test(entry?.country||'');

// ---------- Geometry helpers (local frame: x east, z south; yaw: the face looks along (sin yaw, cos yaw)) ----------
const norm=([x,z])=>{const l=Math.hypot(x,z)||1;return [x/l,z/l];};
export const rightOf=([tx,tz])=>[-tz,tx]; // kerb side for traffic travelling along t (right-hand traffic)
export const facingTraffic=([tx,tz])=>+Math.atan2(-tx,-tz).toFixed(3); // a plate read by traffic travelling along t
export const travelFromBearing=deg=>{const b=deg*Math.PI/180;return [Math.sin(b),-Math.cos(b)];};
const angleDiff=(a,b)=>Math.abs(Math.atan2(Math.sin(a-b),Math.cos(a-b)));
// Direction of a polyline at the vertex/segment nearest to p.
export function tangentAt(points,[px,pz]){
 let best=Infinity,t=[1,0];
 for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i],dx=b[0]-a[0],dz=b[1]-a[1],L2=dx*dx+dz*dz;if(!L2)continue;
  const u=Math.max(0,Math.min(1,((px-a[0])*dx+(pz-a[1])*dz)/L2)),d=Math.hypot(a[0]+dx*u-px,a[1]+dz*u-pz);if(d<best){best=d;t=norm([dx,dz]);}}
 return t;
}
// Nearest traffic lane (mobility road edges, lanes offset right of the centreline) that has p on its right:
// the traffic that reads a kerbside sign standing at p. Returns its travel direction or null.
export function laneTravel(edges,{cell=25}={}){
 const g=new Map();
 for(const e of edges||[]){const p=e.points,l=e.lane||0;for(let i=1;i<p.length;i++){const a=p[i-1],b=p[i],L=Math.hypot(b[0]-a[0],b[1]-a[1]);if(!L)continue;
  const nx=(b[1]-a[1])/L*l,nz=-(b[0]-a[0])/L*l,s=[a[0]+nx,a[1]+nz,b[0]+nx,b[1]+nz];
  for(let x=Math.floor(Math.min(s[0],s[2])/cell);x<=Math.floor(Math.max(s[0],s[2])/cell);x++)for(let z=Math.floor(Math.min(s[1],s[3])/cell);z<=Math.floor(Math.max(s[1],s[3])/cell);z++){const k=`${x},${z}`;if(!g.has(k))g.set(k,[]);g.get(k).push(s);}}}
 return (x,z,reach=18)=>{let best=reach,t=null;const i0=Math.floor(x/cell),j0=Math.floor(z/cell);
  for(let i=i0-1;i<=i0+1;i++)for(let j=j0-1;j<=j0+1;j++)for(const s of g.get(`${i},${j}`)||[]){const dx=s[2]-s[0],dz=s[3]-s[1],L2=dx*dx+dz*dz,u=Math.max(0,Math.min(1,((x-s[0])*dx+(z-s[1])*dz)/L2)),qx=s[0]+dx*u,qz=s[1]+dz*u,d=Math.hypot(qx-x,qz-z);
   if(d<best&&(-dz*(x-qx)+dx*(z-qz))>0){best=d;t=norm([dx,dz]);}}
  return t;};
}
// From a point on (or near) the carriageway, walk towards `dir` until standing on clear ground (not
// carriageway, not inside a building) with `margin` to spare: the kerbside post position.
export function kerbside(x,z,dir,surfaces,{reach=16,margin=.45,step=.25}={}){
 const clear=(px,pz)=>!surfaces.carriageway.at(px,pz)&&!surfaces.buildings.at(px,pz);
 for(let r=0;r<=reach;r+=step){const px=x+dir[0]*r,pz=z+dir[1]*r;
  if(clear(px,pz)&&clear(px+dir[0]*margin,pz+dir[1]*margin)&&clear(px+dir[0]*margin*2,pz+dir[1]*margin*2))return {x:+(px+dir[0]*margin).toFixed(2),z:+(pz+dir[1]*margin).toFixed(2),moved:+(r+margin).toFixed(2)};}
 const p=snapOffCarriageway(x,z,surfaces);return p&&{...p};
}

// ---------- Digiroad ----------
// liiksuunta / ajosuunta: 4 = along the link's digitising direction, 3 = against it; stops (vaik_suunt): 2 along, 3 against.
export const digiroadTravel=(tangent,dir,{along=4,against=3}={})=>dir===against?[-tangent[0],-tangent[1]]:dir===along?tangent:null;
const plateCodes=p=>[1,2,3,4,5].map(i=>p[`kilpityyp${i}`]).filter(Boolean);
// Sign features (native CRS) + link features → [{id,code,value,plates,x,z,travel,surveyed}].
export function digiroadSigns(signs,links,{project,today=new Date().toISOString().slice(0,10)}){
 const geometry=new Map();for(const f of links?.features||[])geometry.set(f.properties.link_id,{points:parts(f.geometry).flat().map(project),dir:f.properties.ajosuunta});
 const out=[];
 for(const f of signs.features||[]){const p=f.properties;if(p.tila&&!/^[34]$/.test(String(p.tila)))continue; // 3 in use, 4 in temporary use
  if(!current(p.ens_vo_pv,p.viim_vo_pv,today))continue;
  const side=+p.sijaintitr,structure=+p.rakenne;if(side===3||[3,4,5].includes(structure))continue; // over the lane: gantries and bridges, not kerbside posts
  const fi=finnishCode(p.tyyppi||'',p.arvo)||(p.vanhakoodi?finnishCode(String(p.vanhakoodi),p.arvo):null);if(!fi)continue;
  const surveyed=Number(p.maasto_x)&&Number(p.maasto_y),[x,z]=project(surveyed?[+p.maasto_x,+p.maasto_y]:f.geometry.coordinates),link=geometry.get(p.link_id);
  let travel=link?digiroadTravel(tangentAt(link.points,[x,z]),p.liiksuunta):null;
  // A no-entry sign stands at the exit of a one-way link and is read by traffic coming the wrong way.
  if(travel&&fi.code==='C17'&&link.dir===p.liiksuunta)travel=[-travel[0],-travel[1]];
  out.push({id:String(p.id),code:fi.code,value:fi.value,plates:plateCodes(p).map(c=>finnishCode(c)?.code).filter(Boolean),x,z,travel,surveyed:!!surveyed,text:p.paamerktxt||'',side:side===2?'left':side===4?'island':'right'});
 }
 return out;
}

// ---------- Regulations that start somewhere (Digiroad linear assets) ----------
// Speed limits, vehicle restrictions and bus lanes are stored per link stretch, not as signs. Where a stretch
// begins for traffic arriving from a stretch with another value, the law requires its sign there: the sign
// is placed `into` metres inside the stretch, kerbside, facing the arriving traffic.
// Link: {points (local), length (native metres), nodes:[startKey,endKey], dir: 2 both, 3 against, 4 along}.
export function linkGraph(links,project){
 const byId=new Map(),key=([x,z])=>`${Math.round(x)},${Math.round(z)}`,at=new Map();
 for(const f of links.features||[]){const raw=parts(f.geometry).flat();if(raw.length<2)continue;const points=raw.map(project);let length=0;for(let i=1;i<raw.length;i++)length+=Math.hypot(raw[i][0]-raw[i-1][0],raw[i][1]-raw[i-1][1]);
  const l={id:f.properties.link_id,points,length,dir:+f.properties.ajosuunta||2,nodes:[key(points[0]),key(points.at(-1))]};byId.set(l.id,l);for(const n of l.nodes){if(!at.has(n))at.set(n,[]);at.get(n).push(l);}}
 return {byId,at};
}
// Point and travel direction `m` native metres along a link.
export function alongLink(link,m){
 const pts=link.points,scale=link.length?1:0;let total=0;const seg=[];for(let i=1;i<pts.length;i++){const d=Math.hypot(pts[i][0]-pts[i-1][0],pts[i][1]-pts[i-1][1]);seg.push(d);total+=d;}
 let s=Math.max(0,Math.min(total,m*(link.length?total/link.length:scale)));
 for(let i=0;i<seg.length;i++){if(s<=seg[i]||i===seg.length-1){const a=pts[i],b=pts[i+1],t=seg[i]?Math.min(1,s/seg[i]):0;return {x:a[0]+(b[0]-a[0])*t,z:a[1]+(b[1]-a[1])*t,t:norm([b[0]-a[0],b[1]-a[1]])};}s-=seg[i];}
}
// assets: [{id,link,from,to,dir (1 both, 2 along, 3 against),value,codes}]; unknown: whether a neighbour without
// this asset counts as a different value (a restriction starts) or as missing data (speed limits).
export function regulationStarts(assets,graph,{into=3,missingIsDifferent=true,tolerance=1}={}){
 const byLink=new Map();for(const a of assets){if(!byLink.has(a.link))byLink.set(a.link,[]);byLink.get(a.link).push(a);}
 const covers=(a,along)=>a.dir===1||(along?a.dir===2:a.dir===3);
 const drivable=(link,along)=>link.dir===2||link.dir===(along?4:3);
 const out=[];
 for(const a of assets){const link=graph.byId.get(a.link);if(!link)continue;
  for(const along of [true,false]){if(!covers(a,along)||!drivable(link,along))continue;
   const m=along?a.from:a.to,interior=along?m>tolerance:m<link.length-tolerance;let before=[];
   if(interior){const prev=(byLink.get(link.id)||[]).find(b=>b!==a&&covers(b,along)&&(along?Math.abs(b.to-m)<tolerance:Math.abs(b.from-m)<tolerance));before=[prev?prev.value:null];}
   else{const node=link.nodes[along?0:1];
    for(const l of graph.at.get(node)||[]){if(l===link)continue;
     for(const [end,toward] of [[0,false],[1,true]]){if(l.nodes[end]!==node||!drivable(l,toward))continue; // l arrives at the node
      const v=(byLink.get(l.id)||[]).find(b=>covers(b,toward)&&(toward?b.to>=l.length-tolerance:b.from<=tolerance));before.push(v?v.value:null);}}}
   const differs=before.some(v=>v===null?missingIsDifferent:v!==a.value);if(!differs)continue;
   const p=alongLink(link,along?Math.min(a.to,m+into):Math.max(a.from,m-into)),travel=along?p.t:[-p.t[0],-p.t[1]];
   out.push({id:a.id,codes:a.codes,x:p.x,z:p.z,travel,link:link.id});}
 }
 return out;
}
const VEHICLE={2:'C2',3:'C1',4:'C3',5:'C9',6:'C3',7:'C2',9:'C6',10:'C10',11:'C11',12:'C13',13:'C4',14:'C5',23:'C2',26:'C16',27:'C7'};
const VEHICLE_NAME={5:'linja-autoja',8:'takseja',21:'huoltoajoa',22:'tontille ajoa',11:'polkupyöriä',10:'mopoja'};
export function digiroadRegulations(src,graph,project){
 const list=[];
 const asset=(f,extra)=>{const p=f.properties;return {id:String(p.id),link:p.link_id,from:+p.alku_m||0,to:+p.loppu_m||0,dir:+p.vaik_suunt||1,...extra};};
 const speed=(src['digiroad-speed']?.features||[]).map(f=>asset(f,{value:String(f.properties.arvo),codes:[`C32[${f.properties.arvo}]`]}));
 // Several prohibited types at one place are separate records with one id: one sign per id, exceptions on a text plate.
 const groups=new Map();for(const f of src['digiroad-vehicles']?.features||[]){const p=f.properties,code=VEHICLE[p.kiell_ajon];if(!code)continue;const k=`${p.id}:${p.link_id}`;if(!groups.has(k))groups.set(k,{f,codes:new Set(),exceptions:new Set(String(p.poikkeus||'').replace(/[[\]]/g,'').split(',').filter(Boolean))});groups.get(k).codes.add(code);}
 const vehicles=[...groups.values()].map(g=>asset(g.f,{value:[...g.codes].sort().join('+')+'|'+[...g.exceptions].sort(),codes:[...[...g.codes].sort(),...(g.exceptions.size||g.f.properties.tarkenne?['H24']:[])]}));
 const lanes=(src['digiroad-buslanes']?.features||[]).map(f=>asset(f,{value:'bus',codes:['E9.1']}));
 for(const [kind,assets,missing] of [['speed',speed,false],['vehicles',vehicles,true],['bus-lane',lanes,true]])
  for(const r of regulationStarts(assets,graph,{missingIsDifferent:missing}))list.push({...r,kind});
 return list;
}

// ---------- Sign posts ----------
// post: {kind:'sign',x,z,plates:[{code,face,yaw}],src,refs:{source:[ids]},anchor}. Plates sharing a location
// and facing go on one post; extra plates hang under their main sign.
const plate=(code,yaw)=>{const f=signFace(code);return {code:f.code,face:f.face,yaw:+(+yaw).toFixed(3),shape:f.shape};};
export function groupPosts(posts,{share=1.2,maxPlates=5}={}){
 const out=[];
 for(const p of posts){const q=out.find(o=>Math.hypot(o.x-p.x,o.z-p.z)<share&&o.src===p.src);
  if(q){for(const pl of p.plates)if(!q.plates.some(o=>o.face===pl.face&&angleDiff(o.yaw,pl.yaw)<.5))q.plates.push(pl);for(const [k,v] of Object.entries(p.refs))q.refs[k]=[...new Set([...(q.refs[k]||[]),...v])];continue;}
  out.push({...p,plates:[...p.plates],refs:{...p.refs}});}
 for(const o of out)o.plates=o.plates.slice(0,maxPlates);
 return out;
}
export function digiroadPosts(signs,surfaces,lanes){
 const posts=[];let unplaced=0;
 for(const s of signs){
  const sign=finnishSign(`FI:${s.code}`,s.value);if(sign.device)continue; // I-series: delineators and other devices, not plates
  const travel=s.travel||lanes(s.x,s.z);if(!travel){unplaced++;continue;}
  const r=rightOf(travel),out=s.side==='left'?[-r[0],-r[1]]:r;
  const at=s.surveyed||(s.side==='island'&&!surfaces.carriageway.at(s.x,s.z))?{x:s.x,z:s.z}:kerbside(s.x,s.z,out,surfaces);if(!at){unplaced++;continue;}
  const yaw=facingTraffic(travel),plates=[plate(sign.code,yaw),...s.plates.map(c=>plate(`FI:${c}`,yaw))];
  posts.push({kind:'sign',x:at.x,z:at.z,plates,src:s.src||'digiroad',refs:{digiroad:[s.id]},surveyed:s.surveyed});
 }
 return {posts:groupPosts(posts),unplaced};
}

// ---------- Pedestrian crossings (city register lines, kerb to kerb) ----------
// A marked crossing (E1 sign) gets a sign at each kerb read by the traffic that has that kerb on its right;
// a signal-controlled one gets a pedestrian signal head at each kerb facing the far side.
export function crossingFurniture(crossings,surfaces,{setback=.8}={}){
 const signs=[],lights=[];
 for(const c of crossings){const [a,b]=c.ends,across=norm([b[0]-a[0],b[1]-a[1]]),axis=[-across[1],across[0]];
  for(const [end,other,out] of [[a,b,[-across[0],-across[1]]],[b,a,across]]){
   if(c.signalled){const at=kerbside(end[0]-out[0],end[1]-out[1],out,surfaces,{reach:6,margin:.35});if(at)lights.push({kind:'crossing-light',x:at.x,z:at.z,yaw:+Math.atan2(other[0]-end[0],other[1]-end[1]).toFixed(3),src:c.src,refs:{[c.src]:[c.id]}});continue;}
   if(!c.signs)continue;
   const travel=(rightOf(axis)[0]*out[0]+rightOf(axis)[1]*out[1])>0?axis:[-axis[0],-axis[1]];
   const at=kerbside(end[0]-out[0]-travel[0]*setback,end[1]-out[1]-travel[1]*setback,out,surfaces,{reach:6});
   if(at)signs.push({kind:'sign',x:at.x,z:at.z,plates:[plate('FI:E1',facingTraffic(travel))],src:c.src,refs:{[c.src]:[c.id]}});
  }
 }
 return {signs,lights};
}

// ---------- Public transport stops ----------
// E6 (bus) / E7 (tram) plate on a post at the stop, double-sided; a shelter behind it, parallel to the kerb.
export function stopFurniture(stops,surfaces,lanes,{avoid=()=>false}={}){
 const signs=[],shelters=[];let unplaced=0;
 for(const s of stops){
  const travel=s.travel||lanes(s.x,s.z,25);if(!travel){unplaced++;continue;}
  const away=rightOf(travel),at=kerbside(s.x,s.z,away,surfaces,{reach:8});if(!at){unplaced++;continue;}
  const code=s.tram?'FI:E7':'FI:E6',yaw=facingTraffic(travel);
  signs.push({kind:'sign',x:at.x,z:at.z,plates:[plate(code,yaw),plate(code,yaw+Math.PI)],src:s.src,refs:{[s.src]:[s.id]},stop:s.name});
  if(!s.shelter)continue;
  // The shelter opens towards the road; try a little further back if the first spot is not clear.
  const yawShelter=+Math.atan2(-away[0],-away[1]).toFixed(3),[w,d]=[3.6,1.5];
  for(const back of [1.3,1.9,2.6]){const x=at.x+away[0]*back+travel[0]*2.4,z=at.z+away[1]*back+travel[1]*2.4;
   const corners=[[-w/2,-d/2],[w/2,-d/2],[w/2,d/2],[-w/2,d/2],[0,0]].map(([u,v])=>[x+u*travel[0]+v*away[0],z+u*travel[1]+v*away[1]]);
   if(corners.some(([px,pz])=>surfaces.carriageway.at(px,pz)||surfaces.buildings.at(px,pz))||avoid(x,z))continue;
   shelters.push({kind:'shelter',x:+x.toFixed(2),z:+z.toFixed(2),yaw:yawShelter,src:s.src,refs:{[s.src]:[s.id]},stop:s.name});break;}
 }
 return {signs,shelters,unplaced};
}

// ---------- Signalised junctions ----------
// An operating junction with no generated signal posts (OSM had no signal there) and no detected heads
// gets a post per approach: kerbside, a few metres before the end of each lane that enters it.
export function junctionPosts(junctions,edges,existingLights,surfaces,{reach=28,covered=40,setback=4}={}){
 const posts=[];let covered_=0;
 for(const j of junctions){if(!j.active)continue;
  if(existingLights.filter(l=>Math.hypot(l.x-j.x,l.z-j.z)<covered).length>=2){covered_++;continue;}
  const used=new Set();
  for(const e of edges){const p=e.points;if(p.length<2)continue;const end=p.at(-1),prev=p.at(-2);if(Math.hypot(end[0]-j.x,end[1]-j.z)>reach)continue;
   if(Math.hypot(...p[0].map((v,i)=>v-[j.x,j.z][i]))<reach)continue; // starts inside the junction too: an internal link
   const t=norm([end[0]-prev[0],end[1]-prev[1]]),key=Math.round(Math.atan2(t[0],t[1])/1.2);if(used.has(key))continue;
   const lane=e.lane||0,sx=end[0]-t[0]*setback-t[1]*lane,sz=end[1]-t[1]*setback+t[0]*lane,at=kerbside(sx,sz,rightOf(t),surfaces,{reach:14});if(!at)continue;used.add(key);
   posts.push({kind:'traffic-light',x:at.x,z:at.z,yaw:facingTraffic(t),src:j.src,refs:{[j.src]:[j.id]}});}
 }
 return {posts,covered:covered_};
}

// ---------- OpenStreetMap sign nodes ----------
// traffic_sign=FI:C32[40];FI:H24 …, highway=give_way|stop (B5/B6). On a way: direction=forward|backward
// (else towards the nearer end, where the junction is); standalone: direction=<degrees> is where the face looks.
const CARDINAL={N:0,NNE:22.5,NE:45,ENE:67.5,E:90,ESE:112.5,SE:135,SSE:157.5,S:180,SSW:202.5,SW:225,WSW:247.5,W:270,WNW:292.5,NW:315,NNW:337.5};
export function osmSigns(elements,{local,prefix='FI'}){
 const nodes=new Map(),ways=[];for(const e of elements)if(e.type==='node')nodes.set(e.id,e);else if(e.type==='way')ways.push(e);
 const parent=new Map();for(const w of ways)(w.nodes||[]).forEach((id,i)=>{if(!parent.has(id))parent.set(id,{w,i});});
 const out=[];
 for(const n of nodes.values()){const t=n.tags||{};if(!t.traffic_sign&&!/^(give_way|stop)$/.test(t.highway||''))continue;
  let codes=String(t.traffic_sign||'').split(/[;,]\s*(?=[A-Z]{2}:|\d|[A-I]\d)/).map(s=>s.trim()).filter(Boolean);
  if(codes.length&&!codes[0].startsWith(`${prefix}:`))codes=codes[0].includes(':')?[]:codes.map(c=>`${prefix}:${c}`); // another country's codes: not ours to draw
  if(!codes.length&&t.highway==='give_way')codes=[`${prefix}:B5`];if(!codes.length&&t.highway==='stop')codes=[`${prefix}:B6`];
  codes=codes.map(c=>c.startsWith(`${prefix}:`)?c:`${prefix}:${c}`).filter(c=>finnishCode(c));if(!codes.length)continue;
  const [x,z]=local(n.lon,n.lat),dir=t['traffic_sign:direction']||t.direction||'',ref=parent.get(n.id);let travel=null,facing=null;
  if(ref){const ids=ref.w.nodes,i=ref.i,pts=ids.map(id=>nodes.get(id)).filter(Boolean).map(m=>local(m.lon,m.lat)),k=Math.min(Math.max(i,1),pts.length-1);
   if(pts.length>1){const tan=norm([pts[k][0]-pts[k-1][0],pts[k][1]-pts[k-1][1]]);
    if(/^forward$/i.test(dir))travel=tan;else if(/^backward$/i.test(dir))travel=[-tan[0],-tan[1]];
    else if(!/both/i.test(dir))travel=i>=ids.length/2?tan:[-tan[0],-tan[1]];}}
  else if(dir){const deg=CARDINAL[String(dir).toUpperCase()]??parseFloat(dir);if(Number.isFinite(deg)){const b=deg*Math.PI/180;facing=+Math.atan2(Math.sin(b),-Math.cos(b)).toFixed(3);}}
  out.push({id:String(n.id),codes,x,z,travel,facing,onWay:!!ref});
 }
 return out;
}
export function osmPosts(signs,surfaces,lanes){
 const posts=[];let unplaced=0;
 for(const s of signs){let travel=s.travel,yaw=s.facing;
  if(!travel&&yaw===null)travel=lanes(s.x,s.z);
  if(travel)yaw=facingTraffic(travel);if(yaw===null||yaw===undefined){unplaced++;continue;}
  const away=travel?rightOf(travel):null,at=away?kerbside(s.x,s.z,away,surfaces):surfaces.carriageway.at(s.x,s.z)?snapOffCarriageway(s.x,s.z,surfaces):{x:s.x,z:s.z};
  if(!at){unplaced++;continue;}
  posts.push({kind:'sign',x:at.x,z:at.z,plates:s.codes.map(c=>plate(c,yaw)),src:'osm',refs:{osm:[s.id]}});
 }
 return {posts:groupPosts(posts),unplaced};
}

// Digiroad traffic lights: a point on every link that enters a signalled junction, at most 5 m before it.
// Where nothing stands there yet (no generated post, no detected head), a post kerbside for that approach.
// A junction that already has posts (two or more within `junction` metres) keeps exactly those.
export function digiroadLightPosts(lights,graph,project,existingLights,surfaces,{covered=12,junction=30,inside=()=>true}={}){
 const posts=[],have=[...existingLights];let skipped=0;
 for(const f of lights.features||[]){const [x,z]=project(f.geometry.coordinates),link=graph.byId.get(f.properties.link_id);if(!link||!inside(x,z)){skipped++;continue;}
  if(have.some(l=>Math.hypot(l.x-x,l.z-z)<covered)||existingLights.filter(l=>Math.hypot(l.x-x,l.z-z)<junction).length>=2){skipped++;continue;}
  const pts=link.points,t=tangentAt(pts,[x,z]),toEnd=Math.hypot(pts.at(-1)[0]-x,pts.at(-1)[1]-z)<Math.hypot(pts[0][0]-x,pts[0][1]-z),travel=toEnd?t:[-t[0],-t[1]];
  const at=kerbside(x,z,rightOf(travel),surfaces,{reach:14});if(!at){skipped++;continue;}
  const post={kind:'traffic-light',x:at.x,z:at.z,yaw:facingTraffic(travel),src:'digiroad',refs:{digiroad:[String(f.properties.id)]}};posts.push(post);have.push(post);}
 return {posts,skipped};
}

// ---------- Merging ----------
// Two plates are the same sign when they show the same family of face (speed limits whatever the number)
// and look the same way (within `turn` radians).
export const sameSign=(a,b,turn=1.1)=>signFamily(a.face)===signFamily(b.face)&&angleDiff(a.yaw??0,b.yaw??0)<turn;
const generic=face=>/^generic|^fi-device$/.test(face);
// Official posts from several sources, highest priority first: a later post whose every plate is already
// shown nearby (within `radius`) by an earlier one is a duplicate; its refs join the kept post.
export function mergeOfficial(lists,{radius=8}={}){
 const kept=[];let duplicates=0;
 for(const list of lists)for(const p of list){
  const twin=kept.find(k=>Math.hypot(k.x-p.x,k.z-p.z)<radius&&p.plates.every(pl=>k.plates.some(o=>sameSign(o,pl))));
  if(twin){for(const [k,v] of Object.entries(p.refs))twin.refs[k]=[...new Set([...(twin.refs[k]||[]),...v])];duplicates++;continue;}
  kept.push({...p,refs:{...p.refs}});
 }
 return {posts:kept,duplicates};
}
// Official posts against Mapillary furniture items ({k:'sign',x,z,faces,yaws,mly}). A Mapillary post within
// `radius` showing the same sign is that sign: the merged post keeps the official code and facing, stands
// where the photos put it (unless the official position was surveyed), keeps its other plates, and records
// both provenances. Untyped detections ("a sign") within `absorb` facing the same way are the official sign.
export function mergeWithDetections(official,items,{radius=10,absorb=3,clash=.9}={}){
 const mly=items.filter(i=>i.k==='sign').map(i=>({item:i,plates:i.faces.map((face,j)=>({face,yaw:i.yaws?.[j]??i.yaw}))}));
 const out=[],stats={matchedPosts:0,matchedPlates:0,absorbedGeneric:0,sharedPost:0,officialOnly:0};
 // Closest same-sign pairs first, each post used once (a detection is never claimed by a farther official sign).
 const pairs=[];
 official.forEach((p,pi)=>{for(const m of mly){const d=Math.hypot(m.item.x-p.x,m.item.z-p.z);if(d>radius)continue;
  const n=p.plates.filter(pl=>m.plates.some(o=>!generic(o.face)&&sameSign(o,pl))).length;if(n)pairs.push({pi,m,d,n});}});
 pairs.sort((a,b)=>b.n-a.n||a.d-b.d);const twin=new Map();
 for(const q of pairs)if(!twin.has(q.pi)&&!q.m.used){twin.set(q.pi,q.m);q.m.used=true;}
 official.forEach((p,pi)=>{
  const best=twin.get(pi);
  if(best){
   const remaining=best.plates.filter(o=>!p.plates.some(pl=>sameSign(o,pl))&&!(generic(o.face)&&p.plates.some(pl=>angleDiff(pl.yaw,o.yaw)<1.1)));
   stats.matchedPosts++;stats.matchedPlates+=best.plates.length-remaining.length;
   const at=p.surveyed?p:best.item;
   out.push({...p,x:at.x,z:at.z,plates:[...p.plates,...remaining],src:`${p.src}+mapillary`,refs:{...p.refs,mapillary:best.item.mly||[]},seen:best.item.seen,replaces:best.item});
   return;}
  // No photographed twin: absorb untyped detections it explains; share a post that already stands here.
  for(const m of mly){if(m.used||Math.hypot(m.item.x-p.x,m.item.z-p.z)>absorb)continue;
   if(m.plates.every(o=>generic(o.face)&&p.plates.some(pl=>angleDiff(pl.yaw,o.yaw)<1.1))){m.used=true;stats.absorbedGeneric++;p={...p,refs:{...p.refs,mapillary:[...(p.refs.mapillary||[]),...(m.item.mly||[])]},absorbed:[...(p.absorbed||[]),m.item]};}}
  const host=mly.find(m=>!m.used&&Math.hypot(m.item.x-p.x,m.item.z-p.z)<clash);
  if(host){host.used=true;stats.sharedPost++;out.push({...p,x:host.item.x,z:host.item.z,plates:[...host.plates,...p.plates],src:`${p.src}+mapillary`,refs:{...p.refs,mapillary:[...(p.refs.mapillary||[]),...(host.item.mly||[])]},seen:host.item.seen,replaces:host.item});return;}
  stats.officialOnly++;out.push(p);
 });
 const replaced=new Set(out.flatMap(p=>[p.replaces,...(p.absorbed||[])]).filter(Boolean));
 return {posts:out,items:items.filter(i=>!replaced.has(i)),stats};
}

// ---------- Fetching ----------
const ENDPOINTS=['https://overpass-api.de/api/interpreter','https://overpass.private.coffee/api/interpreter','https://overpass.kumi.systems/api/interpreter'];
function overpass(file,query,refresh){
 if(fs.existsSync(file)&&!refresh)return JSON.parse(fs.readFileSync(file));
 for(let attempt=0;attempt<6;attempt++){
  try{const text=execFileSync('curl',['-sS','-f','--max-time','300','-A','worldhood/0.1 (city build)','--data-urlencode',`data=[out:json][timeout:240];${query}`,ENDPOINTS[attempt%ENDPOINTS.length]],{encoding:'utf8',maxBuffer:1<<30});
   const json=JSON.parse(text);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,text);console.log(`  osm signs: ${json.elements.length} elements`);return json;}
  catch(error){console.log(`  osm signs: retry ${attempt+1} (${String(error.message).slice(0,80)})`);execFileSync('sleep',[String(10+attempt*10)]);}
 }
 throw Error('Overpass failed for sign nodes');
}
// Everything the official layer needs for one city, from cache or the network.
export function loadSources({id,entry,def,frame,refresh=false}){
 const R=entry.radius||1500,RAW=path.join('data/raw/cities',id),[w,s]=frame.lonLat(-R-150,R+150),[e,n]=frame.lonLat(R+150,-R-150),bbox=[w,s,e,n].map(v=>+v.toFixed(5));
 const src={};
 if(isFinnish(entry)){console.log('Fetching Digiroad (Väylävirasto) signs, signals and stops…');
  for(const [k,layer] of Object.entries(DIGIROAD.layers))src[`digiroad-${k}`]=fetchWfs({url:DIGIROAD.url,layer,bbox,refresh,file:path.join(RAW,'digiroad',`${layer.split(':')[1]}.json`)});}
 const o=def?.official||{};
 for(const k of ['crossings','signals','stops'])if(o[k]?.layer)src[`city-${k}`]=fetchWfs({url:o.wfs,layer:o[k].layer,bbox,refresh,file:path.join(RAW,'city-wfs',`${o[k].layer.split(':').pop()}.json`)});
 const [lon0,lat0]=entry.origin,around=`(around:${Math.round(R*1.05)},${lat0},${lon0})`;
 src.osm=overpass(path.join(RAW,'osm-signs.json'),`(node["traffic_sign"]${around};node["highway"~"^(give_way|stop)$"]${around};)->.s;.s out;way(bn.s)["highway"];out body;>;out skel qt;`,refresh);
 return src;
}

// ---------- The official layer (pure given the sources) ----------
// Validity dates (Digiroad: ens_vo_pv first day, viim_vo_pv last day; ISO or d.m.yyyy).
const day=v=>{const t=String(v||'').trim();if(!t)return null;const m=/^(\d{1,2})\.(\d{1,2})\.(\d{4})/.exec(t);return m?`${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`:t.slice(0,10);};
export const current=(from,to,today)=>{const a=day(from),b=day(to);return (!a||a<=today)&&(!b||b>=today);};
const truthy=v=>String(v??'').trim()==='1'||/^(true|yes|kyllä|k)$/i.test(String(v??'').trim());
export function buildOfficialLayer(src,{local,city,mobility,def,radius=Infinity,lightsNow=[],avoid=[],avoidShelters=[],today=new Date().toISOString().slice(0,10)}){
 const surfaces=surfaceIndex(city,mobility),lanes=laneTravel(mobility?.roads?.edges),counts={sources:{},merge:{},placement:{}},inside=(x,z)=>Math.hypot(x,z)<=radius;
 const near=list=>(x,z)=>list.some(([ax,az,r])=>Math.hypot(ax-x,az-z)<r),blocked=near(avoid),noShelter=(x,z)=>blocked(x,z)||near(avoidShelters)(x,z);
 const proj=layer=>projector(layer.crs,local);
 // Digiroad signs.
 let dr={posts:[],unplaced:0},reg={posts:[],unplaced:0},graph=null;
 if(src['digiroad-signs']){const P=proj(src['digiroad-signs']),list=digiroadSigns(src['digiroad-signs'],{features:(src['digiroad-links']?.features||[])},{project:P}).filter(s=>inside(s.x,s.z));
  dr=digiroadPosts(list,surfaces,lanes);counts.sources.digiroadSigns={records:list.length,posts:dr.posts.length,unplaced:dr.unplaced};}
 // Where speed limits, vehicle restrictions and bus lanes begin (Digiroad stretches): their signs.
 if(src['digiroad-links']){graph=linkGraph(src['digiroad-links'],proj(src['digiroad-links']));
  const starts=digiroadRegulations(src,graph).filter(r=>inside(r.x,r.z)),list=starts.map(r=>{const [main,...rest]=r.codes,fi=finnishCode(main);return {id:r.id,code:fi.code,value:fi.value,plates:rest,x:r.x,z:r.z,travel:r.travel,side:'right',src:'digiroad'};});
  reg=digiroadPosts(list,surfaces,lanes);const k={};for(const r of starts)k[r.kind]=(k[r.kind]||0)+1;counts.sources.digiroadRegulationStarts={...k,posts:reg.posts.length,unplaced:reg.unplaced};}
 // Crossings from the city register.
 const cfg=def?.official||{},crossings=[];
 if(src['city-crossings']){const c=cfg.crossings,P=proj(src['city-crossings']);
  for(const f of src['city-crossings'].features){const p=f.properties,pts=parts(f.geometry).flat().map(P);if(pts.length<2||truthy(p[c.removed]))continue;
   const kind=String(p[c.marking]||'');if(c.unmarked&&new RegExp(c.unmarked).test(kind))continue;
   const ends=[pts[0],pts.at(-1)];if(!inside(...ends[0])||Math.hypot(ends[1][0]-ends[0][0],ends[1][1]-ends[0][1])<3)continue;
   crossings.push({id:String(p[c.id||'seq_id']??f.id),ends,signs:truthy(p[c.signs])&&!(c.cycleOnly&&new RegExp(c.cycleOnly).test(kind)),signalled:truthy(p[c.signalled]),src:'city'});}}
 const lightPoints=src['digiroad-lights']?src['digiroad-lights'].features.map(f=>proj(src['digiroad-lights'])(f.geometry.coordinates)):[];
 // A crossing next to a Digiroad traffic light is signal-controlled even if the register says otherwise.
 for(const c of crossings)if(!c.signalled&&lightPoints.some(([x,z])=>c.ends.some(e=>Math.hypot(e[0]-x,e[1]-z)<6)))c.signalled=true;
 const cr=crossingFurniture(crossings,surfaces);counts.sources.crossings={records:crossings.length,signalled:crossings.filter(c=>c.signalled).length,signs:cr.signs.length,lights:cr.lights.length};
 // Stops: the city's register (current positions), bearing and shelter from Digiroad when linked; Digiroad alone otherwise.
 const drStops=new Map(),stops=[];
 if(src['digiroad-stops']){const P=proj(src['digiroad-stops']);
  for(const f of src['digiroad-stops'].features){const p=f.properties,[x,z]=P(f.geometry.coordinates),b=parseFloat(p.l_suuntima);if(!current(p.ens_vo_pv,p.viim_vo_pv,today))continue;
   drStops.set(String(p.valtak_id),{id:String(p.valtak_id),name:p.nimi_su,x,z,travel:Number.isFinite(b)?travelFromBearing(b):null,shelter:String(p.katos)==='2',tram:/\[1\]/.test(p.pys_tyyppi||''),virtual:/\[5\]/.test(p.pys_tyyppi||''),src:'digiroad'});}}
 if(src['city-stops']){const c=cfg.stops,P=proj(src['city-stops']);
  for(const f of src['city-stops'].features){const p=f.properties;if(!f.geometry)continue;const [x,z]=P(parts(f.geometry)[0][0]),d=drStops.get(String(p[c.digiroad]));if(d)d.used=true;
   stops.push({id:String(p[c.id||'id']??f.id),name:p[c.name],x,z,travel:d?.travel||null,shelter:!!String(p[c.shelter]??'').trim()||!!d?.shelter,tram:(c.tram||[]).map(String).includes(String(p[c.type])),src:'city'});}}
 // Without a city register Digiroad's stops are the stops; with one, the register is current and Digiroad only adds bearings and shelters.
 if(!src['city-stops'])for(const d of drStops.values())if(!d.virtual)stops.push(d);
 const st=stopFurniture(stops.filter(s=>inside(s.x,s.z)),surfaces,lanes,{avoid:noShelter});counts.sources.stops={records:stops.filter(s=>inside(s.x,s.z)).length,signs:st.signs.length,shelters:st.shelters.length,unplaced:st.unplaced};
 // Signal junctions.
 const junctions=[];
 if(src['city-signals']){const c=cfg.signals,P=proj(src['city-signals']);
  for(const f of src['city-signals'].features){const p=f.properties;const [x,z]=P(parts(f.geometry)[0][0]);if(!inside(x,z))continue;junctions.push({id:String(p[c.id||'id']??f.id),name:p[c.name],x,z,active:!c.state||String(p[c.state])===c.active,src:'city'});}}
 const lp=graph&&src['digiroad-lights']?digiroadLightPosts(src['digiroad-lights'],graph,proj(src['digiroad-lights']),lightsNow,surfaces,{inside}):{posts:[],skipped:0};
 const jp=junctionPosts(junctions,mobility?.roads?.edges||[],[...lightsNow,...lp.posts],surfaces);counts.sources.digiroadLights={points:lightPoints.length,addedPosts:lp.posts.length};counts.sources.signals={junctions:junctions.length,active:junctions.filter(j=>j.active).length,alreadyCovered:jp.covered,addedPosts:jp.posts.length,digiroadLightPoints:lightPoints.length};
 // OpenStreetMap sign nodes.
 let os={posts:[],unplaced:0};
 if(src.osm){const list=osmSigns(src.osm.elements,{local}).filter(s=>inside(s.x,s.z));os=osmPosts(list,surfaces,lanes);counts.sources.osm={records:list.length,posts:os.posts.length,unplaced:os.unplaced};}
 // Official sources against each other, then signs against the city's existing objects (trees, generated signal posts).
 const official=mergeOfficial([dr.posts,cr.signs,st.signs,reg.posts,os.posts]);counts.merge.officialDuplicates=official.duplicates;
 const signs=official.posts.filter(p=>!blocked(p.x,p.z));counts.placement.placeObjects=official.posts.length-signs.length;
 const lights=[...cr.lights,...lp.posts,...jp.posts].filter(p=>!blocked(p.x,p.z)),shelters=st.shelters;
 return {signs,lights,shelters,counts,surfaces};
}

// ---------- Into furniture.json ----------
// items: the Mapillary layer's items; returns the merged item list, the faces used and counts.
export function mergeIntoFurniture(layer,official,{existing=[]}={}){
 const m=mergeWithDetections(official.signs,layer.items);
 const r3=v=>+(+v).toFixed(3),r2=v=>+(+v).toFixed(2),ids=refs=>Object.fromEntries(Object.entries(refs).filter(([k])=>k!=='mapillary'));
 // New objects must not stand inside trees or generated posts; lights too close to an existing head are that head.
 const fresh=dedupeExisting([...m.posts.filter(p=>!p.replaces).map(p=>({...p,kind:'sign'})),...official.lights,...official.shelters],[...existing,...layer.items.filter(i=>!m.posts.some(p=>p.replaces===i)).map(i=>({kind:i.k,x:i.x,z:i.z}))],{radius:{'traffic-light':3,sign:.8,shelter:2},clash:.6});
 const keep=new Set([...fresh.kept,...m.posts.filter(p=>p.replaces)]);
 const signItem=p=>({k:'sign',x:r2(p.x),z:r2(p.z),yaw:r3(p.plates[0].yaw),faces:p.plates.map(pl=>pl.face),yaws:p.plates.map(pl=>r3(pl.yaw)),src:p.src,...(p.refs.mapillary?.length?{mly:p.refs.mapillary}:{}),ref:ids(p.refs),...(p.seen?{seen:p.seen}:{})});
 const added=[...keep].map(p=>p.kind==='sign'||p.plates?signItem(p):{k:p.kind,x:r2(p.x),z:r2(p.z),yaw:r3(p.yaw),src:p.src,ref:ids(p.refs),...(p.stop?{stop:p.stop}:{})});
 const items=[...m.items,...added].sort((a,b)=>a.k.localeCompare(b.k)||a.x-b.x);
 const codes=new Map(layer.faces.map(f=>[f.face,f.code]));for(const p of keep)for(const pl of p.plates||[])if(!codes.has(pl.face))codes.set(pl.face,pl.code);
 const used=new Set(items.flatMap(i=>i.faces||[]));
 const faces=[...codes].filter(([f])=>used.has(f)).sort((a,b)=>a[0].localeCompare(b[0])).map(([face,code])=>({face,code}));
 return {items,faces,stats:{...m.stats,clashDropped:fresh.dropped}};
}

// Objects a photo-built place already stands there (place-build.mjs): signs keep clear of its lamps and masts;
// no shelters inside the place (it builds its own stops) or beside its shelters and canopies.
export function placeAvoidance(places){
 const avoid=[],avoidShelters=[];
 for(const pl of places){avoid.push(...(pl.dropFurniture||[]).map(([x,z,r])=>[x,z,r+.3]));
  avoidShelters.push([pl.centre[0],pl.centre[1],60],...(pl.shelters||[]).map(s=>[s.x,s.z,8]));
  for(const c of [pl.busCanopies].flat().filter(Boolean)){const [a,b]=[c.from,c.to],n=Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/4);for(let i=0;i<=n;i++)avoidShelters.push([a[0]+(b[0]-a[0])*i/n,a[1]+(b[1]-a[1])*i/n,(c.width||8)/2+3]);}
  for(const p of pl.platforms||[]){const r=p.ring||[];if(!r.length)continue;const cx=r.reduce((n,q)=>n+q[0],0)/r.length,cz=r.reduce((n,q)=>n+q[1],0)/r.length;avoidShelters.push([cx,cz,Math.max(...r.map(q=>Math.hypot(q[0]-cx,q[1]-cz)))+3]);}}
 return {avoid,avoidShelters};
}
// City build step: official signs, signals and stops merged into the Mapillary layer (or alone without it).
export function addOfficialFurniture({id,entry,frame,city,mobility,layer,existing,lightsNow,refresh=false}){
 const defFile=path.join('cities',id,'city.json'),def=fs.existsSync(defFile)?JSON.parse(fs.readFileSync(defFile)):{};
 if(!isFinnish(entry)&&!def.official?.crossings&&!def.official?.signals&&!def.official?.stops)return null;
 const places=(entry.places||[]).map(p=>path.join('public/cities',id,'places',`${p}.json`)).filter(f=>fs.existsSync(f)).map(f=>JSON.parse(fs.readFileSync(f)));
 const src=loadSources({id,entry,def,frame,refresh});
 const official=buildOfficialLayer(src,{local:frame.local,city,mobility,def,radius:entry.radius||1500,lightsNow,...placeAvoidance(places)});
 const merged=mergeIntoFurniture(layer,official,{existing});
 const bySrc={};for(const i of merged.items){const k=`${i.k}:${i.src||'mapillary'}`;bySrc[k]=(bySrc[k]||0)+1;}
 const credits=[isFinnish(entry)&&DIGIROAD.attribution,def.official?.crossings&&`Pedestrian crossings, signal junctions and stops from ${def.official.provider||'the city'} open data, ${def.official.licence||'CC BY 4.0'}`].filter(Boolean); // OpenStreetMap (sign nodes) is credited for every city already
 return {...merged,counts:{...official.counts,merge:{...official.counts.merge,...merged.stats},bySource:bySrc},credits};
}
