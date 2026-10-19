// The parts of city:build (scripts/city-build.mjs) that decide rather than compute geometry: command line,
// Overpass requests (retries, timeouts, batched transit), the staged output folder and start points.
// Pure or with injected I/O, so tests/city-build.test.mjs runs them without the network.
import fs from 'node:fs';
import path from 'node:path';

// ---------- Command line ----------
export const USAGE='Usage: npm run city:build -- <id> [--refresh]';
export function buildArgs(argv){
 const flags=argv.filter(a=>a.startsWith('-')),ids=argv.filter(a=>!a.startsWith('-')),unknown=flags.filter(f=>f!=='--refresh');
 if(unknown.length)throw Error(`Unknown option ${unknown.join(' ')}. ${USAGE}`);
 if(ids.length!==1||!/^[a-z0-9-]+$/.test(ids[0]))throw Error(USAGE);
 return {id:ids[0],refresh:flags.includes('--refresh')};
}

// ---------- Overpass ----------
export const OVERPASS_ENDPOINTS=['https://overpass-api.de/api/interpreter','https://overpass.private.coffee/api/interpreter','https://overpass.kumi.systems/api/interpreter','https://maps.mail.ru/osm/tools/overpass/api/interpreter'];
export const TRANSIT_TYPES=['tram','light_rail','trolleybus','bus'];
// city.json "overpass": {timeout (s per query), attempts, backoffSeconds, transitBatch (relations per request), transitTypes}.
export function overpassSettings(def={}){
 const o=def.overpass||{},num=(key,fallback,min,max)=>{const v=o[key]??fallback;if(!Number.isFinite(v)||v<min||v>max)throw Error(`city.json overpass.${key} must be a number from ${min} to ${max}`);return v;};
 const types=o.transitTypes??TRANSIT_TYPES;
 if(!Array.isArray(types)||types.some(t=>!/^[a-z_]+$/.test(t)))throw Error('city.json overpass.transitTypes must be a list of OSM route values, e.g. ["tram","bus"]');
 return {timeout:Math.round(num('timeout',240,10,3600)),attempts:Math.round(num('attempts',6,1,20)),backoff:num('backoffSeconds',10,0,600),batch:Math.round(num('transitBatch',40,1,1000)),types};
}
// Each attempt moves to the next server; the wait doubles after every full round over them (at most 5 minutes).
export const retryDelay=(attempt,base,servers=OVERPASS_ENDPOINTS.length)=>Math.min(300,base*2**Math.floor(attempt/servers));
// Overpass answers a query that ran out of time or memory with HTTP 200 and a remark; that is a failure too.
export function parseOverpass(text){
 const json=JSON.parse(text);
 if(/runtime error|timed out|out of memory/i.test(json.remark||''))throw Error(json.remark.slice(0,120));
 if(!Array.isArray(json.elements))throw Error('no elements in the answer');
 return json;
}
export async function postOverpass(endpoint,query,timeout){
 const r=await fetch(endpoint,{method:'POST',body:new URLSearchParams({data:query}),headers:{'User-Agent':'worldhood/0.1 (city build)'},signal:AbortSignal.timeout((timeout+60)*1000)});
 if(!r.ok)throw Error(`HTTP ${r.status}`);
 return r.text();
}
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
export async function overpass(body,{name='query',timeout=240,attempts=6,backoff=10,endpoints=OVERPASS_ENDPOINTS,request=postOverpass,wait=sleep,log=console.log}={}){
 const query=`[out:json][timeout:${timeout}];${body}`;let last;
 for(let attempt=0;attempt<attempts;attempt++){const endpoint=endpoints[attempt%endpoints.length];
  try{return parseOverpass(await request(endpoint,query,timeout));}
  catch(error){last=error;if(attempt===attempts-1)break;const s=retryDelay(attempt,backoff,endpoints.length);
   log(`  ${name}: ${new URL(endpoint).host} failed (${String(error.message).slice(0,80)}), retry ${attempt+2}/${attempts} in ${s} s`);await wait(s*1000);}
 }
 throw Error(`Overpass failed for ${name} after ${attempts} attempts: ${last?.message}`);
}
export const batches=(list,size)=>Array.from({length:Math.ceil(list.length/size)},(_,i)=>list.slice(i*size,(i+1)*size));
// Public transport routes, one route type at a time: the relation ids first (a light query), then their
// geometry clipped to the city box in batches, so a large city never sends one huge mixed request.
// `query(name, body)` returns Overpass JSON (cached by name in city-build.mjs).
export async function fetchTransit(query,{bbox,types=TRANSIT_TYPES,batch=40}){
 const elements=[],seen=new Set();
 for(const type of types){
  const ids=[...new Set((await query(`transit-${type}-ids`,`relation["type"="route"]["route"="${type}"](${bbox});out ids;`)).elements.filter(e=>e.type==='relation').map(e=>e.id))].sort((a,b)=>a-b);
  for(const [i,part] of batches(ids,batch).entries())
   for(const e of (await query(`transit-${type}-${batch}-${i}`,`relation(id:${part.join(',')});out geom(${bbox});`)).elements)if(e.type==='relation'&&!seen.has(e.id)){seen.add(e.id);elements.push(e);}
 }
 return {elements};
}

// ---------- Staged output ----------
// The new city is built next to the playable one and swapped in only when complete, so a failed download
// or terrain step never leaves a city half-built or gone.
export const MAX_FILE_BYTES=24*1024*1024; // static host limit with a margin (tests/hosting.test.mjs)
export const REQUIRED_FILES=['city.pack','mobility.json'];
export const stagePaths=(root,id)=>({out:path.join(root,id),stage:path.join(root,`.${id}.staging`),previous:path.join(root,`.${id}.previous`)});
const filesIn=(dir,io)=>io.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?filesIn(path.join(dir,e.name),io):[path.join(dir,e.name)]);
export function checkBuild(dir,{required=REQUIRED_FILES,maxBytes=MAX_FILE_BYTES,io=fs}={}){
 const problems=required.filter(f=>!io.existsSync(path.join(dir,f))).map(f=>`${f} missing`);
 for(const f of io.existsSync(dir)?filesIn(dir,io):[]){const size=io.statSync(f).size;if(size>=maxBytes)problems.push(`${path.relative(dir,f)} is ${(size/1048576).toFixed(1)} MiB (limit ${(maxBytes/1048576).toFixed(0)} MiB)`);}
 if(problems.length)throw Error(`Build check failed, the previous version stays: ${problems.join('; ')}`);
}
// Files other commands add to a built city (extension regions, place photo textures, Mapillary furniture),
// carried from the current city into the new one so a rebuild keeps them; city:build regenerates what it can.
export const CARRIED=['extensions','places','furniture.json'];
export function carryOver(from,to,{names=CARRIED,io=fs}={}){
 const kept=names.filter(n=>io.existsSync(path.join(from,n)));
 for(const n of kept)io.cpSync(path.join(from,n),path.join(to,n),{recursive:true});
 return kept;
}
// The registry entry keeps what those commands registered (furniture, places, their credits) unless the new
// build sets it itself; terrain is always the new build's own.
export function keepRegistered(prev,next){
 if(!prev)return next;const out={...next,counts:{...prev.counts,...next.counts}};
 for(const [k,v] of Object.entries(prev))if(!(k in out)&&k!=='terrain')out[k]=v;
 for(const s of (prev.attribution||'').split(/(?<=\.) (?=\p{Lu})/u))if(s&&!s.startsWith('Elevation:')&&!out.attribution.includes(s))out.attribution+=` ${s}`;
 return out;
}
// Starts an empty staging folder. commit() checks it and swaps it in (restoring the old folder if the swap
// fails); abort() removes it unless it was committed, so it is safe to call on every exit.
export function beginStage(root,id,{io=fs,check=checkBuild}={}){
 const p=stagePaths(root,id);let done=false;
 io.rmSync(p.stage,{recursive:true,force:true});io.rmSync(p.previous,{recursive:true,force:true});io.mkdirSync(p.stage,{recursive:true});
 return {...p,
  commit(){check(p.stage,{io});const had=io.existsSync(p.out);if(had)io.renameSync(p.out,p.previous);
   try{io.renameSync(p.stage,p.out);}catch(error){if(had)io.renameSync(p.previous,p.out);throw error;}
   done=true;io.rmSync(p.previous,{recursive:true,force:true});},
  abort(){if(!done)io.rmSync(p.stage,{recursive:true,force:true});}};
}

// ---------- Start points ----------
// city.json "starts": [{name, at:[lon,lat]}] is moved onto the nearest drivable street; "position" instead of
// "at" is used exactly as given. Optional per start: heading (compass degrees, 0 = north, 90 = east),
// district and street (shown in the game; default the city name and the nearest street).
export const headingFromBearing=deg=>{const r=-deg*Math.PI/180;return +Math.atan2(Math.sin(r),Math.cos(r)).toFixed(4);};
const lonLat=v=>Array.isArray(v)&&v.length===2&&v.every(Number.isFinite)&&Math.abs(v[0])<=180&&Math.abs(v[1])<=90;
export function parseStarts(def,local){
 const list=def.starts??[],names=new Set();
 if(!Array.isArray(list))throw Error('city.json "starts" must be a list');
 const starts=list.map((s,i)=>{const at=`city.json starts[${i}]${s?.name?` (${s.name})`:''}`;
  if(typeof s?.name!=='string'||!s.name.trim())throw Error(`${at}: needs a "name"`);
  if(names.has(s.name))throw Error(`${at}: the name is used twice`);names.add(s.name);
  if(s.at!=null&&s.position!=null)throw Error(`${at}: give "at" (snapped to a street) or "position" (exact), not both`);
  const exact=s.position!=null,where=exact?s.position:s.at;
  if(!lonLat(where))throw Error(`${at}: needs "at" or "position" as [lon, lat]`);
  if(s.heading!=null&&!Number.isFinite(s.heading))throw Error(`${at}: "heading" is compass degrees (0 = north, 90 = east)`);
  for(const k of ['district','street'])if(s[k]!=null&&typeof s[k]!=='string')throw Error(`${at}: "${k}" must be text`);
  return {name:s.name,p:local(...where),exact,heading:s.heading==null?null:headingFromBearing(s.heading),district:s.district||null,street:s.street||null};});
 if(def.defaultStart!=null&&typeof def.defaultStart!=='string')throw Error('city.json "defaultStart" must be the name of a start');
 return starts;
}
// One start in the game's landmark format. `snap(p)` → nearest drivable point {x,z,name} (throws when there is
// none); `headingAt(x,z)` → heading along the nearest car edge.
export function placeStart(s,{snap,headingAt,district}){
 let road=null;try{road=snap(s.p);}catch(error){if(!s.exact)throw error;}
 const x=s.exact?s.p[0]:road.x,z=s.exact?s.p[1]:road.z;
 return {name:s.name,district:s.district||district,street:s.street||road?.name||'',x,z,heading:s.heading??headingAt(x,z)};
}
export function defaultStartName(def,landmarks){
 if(def.defaultStart==null)return landmarks[0].name;
 if(!landmarks.some(l=>l.name===def.defaultStart))throw Error(`city.json "defaultStart" "${def.defaultStart}" is not a start; the starts are: ${landmarks.map(l=>l.name).join(', ')}`);
 return def.defaultStart;
}
