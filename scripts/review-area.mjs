// node scripts/review-area.mjs <id> [--dry-run]
// Asks Jev (TypeSafe System One) to review every checkpoint of an area and
// writes extensions/<id>/review.json. Reads TYPESAFE_API_KEY from the
// environment or from the git-ignored .env.local. Without a key, or with
// --dry-run, it writes extensions/<id>/review-request.json for inspection.
import fs from 'node:fs';
import path from 'node:path';
import {gunzipSync} from 'node:zlib';
import {inventory,questionsFor,reviewState,verdict,featureEvidence,POLICY} from './area-review.mjs';
import {local} from './extension-geometry.mjs';
import {env} from './env.mjs';
import {mergeGraph} from '../src/extensions.js';

const id=process.argv[2],dry=process.argv.includes('--dry-run');
if(!/^[a-z0-9-]+$/.test(id||''))throw Error('Usage: npm run area:review -- <extension id> [--dry-run]');
const key=env('TYPESAFE_API_KEY'),MODEL=process.env.TYPESAFE_MODEL||'jev-latest';
const read=f=>JSON.parse(fs.readFileSync(f));
const ext=read(path.join('extensions',id,'extension.json')),registry=read('public/data/extensions/index.json').extensions.find(e=>e.id===id);
if(!registry)throw Error(`Build the area first: npm run extension:build -- ${id}`);
const notesFile=path.join('extensions',id,'reference-notes.json'),notes=fs.existsSync(notesFile)?read(notesFile):{};

// The scene the player sees: core snapshot + this area, merged like the game does.
const city=JSON.parse(gunzipSync(fs.readFileSync('public/data/city.pack'))),extCity=JSON.parse(gunzipSync(fs.readFileSync(`public/data/${registry.dir}/city.pack`)));
for(const k of ['buildings','roads','pavement','parks','water','trees'])city[k].push(...extCity[k]);
const buildings=read('public/data/buildings3d-index.json');buildings.tiles.push(...read(`public/data/${registry.dir}/buildings3d-index.json`).tiles);
const mobility=read('public/data/mobility.json'),extMobility=read(`public/data/${registry.dir}/mobility.json`),offset=mobility.signals.length;
mobility.signals.push(...extMobility.signals);mergeGraph(mobility.walks,extMobility.walks,offset);
const trams=read('public/data/trams.json');

const area={title:ext.title,city:'Helsinki',limitations:ext.limitations};
const requests=registry.checkpoints.map(cp=>{
 const knownFor=(ext.knownFor||[]).filter(f=>f.near===cp.name).map(f=>({...f,evidence:featureEvidence({buildings,city},(f.at||[]).map(local))}));
 return {checkpoint:cp.name,knownFor,body:{model:MODEL,state:reviewState(area,cp,inventory({city,buildings,mobility,trams},cp.position[0],cp.position[2]),notes[cp.name]),questions:questionsFor(knownFor)}};
});
if(dry||!key){
 fs.writeFileSync(path.join('extensions',id,'review-request.json'),JSON.stringify(requests,null,1));
 console.log(`${key?'Dry run':'No TYPESAFE_API_KEY (env or .env.local)'}: wrote ${requests.length} requests to extensions/${id}/review-request.json`);
 process.exit(0);
}
async function ask(body){
 for(let attempt=0;;attempt++){
  const r=await fetch('https://api.typesafe.ai/v1/systemone',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify(body)});
  if(r.ok)return r.json();
  if((r.status===429||r.status===529)&&attempt<5){await new Promise(res=>setTimeout(res,Number(r.headers.get('retry-after'))*1000||1000*2**attempt));continue;}
  throw Error(`TypeSafe ${r.status}: ${(await r.text()).slice(0,300)}`);
 }
}
const results=[];let tokens=0,model='';
for(const req of requests){
 const res=await ask(req.body);tokens+=res.usage?.input_tokens||0;model=res.model;
 results.push({checkpoint:req.checkpoint,...verdict(res.answers,req.knownFor),answers:res.answers});
 console.log(`${results.at(-1).status.padEnd(12)} ${req.checkpoint}  ready ${results.at(-1).demoReady}  next: ${results.at(-1).nextStep}`);
}
const summary=results.reduce((m,r)=>(m[r.status]=(m[r.status]||0)+1,m),{});
fs.writeFileSync(path.join('extensions',id,'review.json'),JSON.stringify({area:id,model,reviewedAt:new Date().toISOString(),policy:POLICY,inputTokens:tokens,summary,checkpoints:results},null,1));
console.log(JSON.stringify({summary,inputTokens:tokens,model}));
