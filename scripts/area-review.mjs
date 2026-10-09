// Area review: describe each checkpoint of an area as text (Jev is text-only),
// ask Jev narrow typed questions about it, and turn the answers into a sign-off
// with code-owned policy. Pure functions; scripts/review-area.mjs does the I/O.

const box=(x,z,r)=>[x-r,z-r,x+r,z+r];
const hits=(b,q)=>b[0]<q[2]&&b[2]>q[0]&&b[1]<q[3]&&b[3]>q[1];
const near=(p,x,z,r)=>Math.hypot(p[0]-x,p[1]-z)<=r;
const count=list=>list.reduce((m,k)=>(m[k]=(m[k]||0)+1,m),{});

// What the game actually contains around a point, from the same data it renders.
export function inventory({city,buildings,mobility,trams},x,z,radius=120){
 const q=box(x,z,radius),parts=buildings.tiles.flatMap(t=>t.parts).filter(p=>hits(p.bbox,q));
 const byBuilding=new Map();for(const p of parts){const b=byBuilding.get(p.id)||{...p,textured:false};b.textured||=!!p.texture;byBuilding.set(p.id,b);}
 const list=[...byBuilding.values()],footprint=b=>(b.bbox[2]-b.bbox[0])*(b.bbox[3]-b.bbox[1]);
 const footprints=new Map(city.buildings.filter(b=>b.ratu).map(b=>[String(b.ratu),b]));
 const surfaces=(items)=>items.filter(p=>hits(p.bbox,q));
 const roads=surfaces(city.roads),pavement=surfaces(city.pavement),parks=surfaces(city.parks);
 const edges=mobility.walks.edges.filter(e=>e.crossing&&near(e.points[0],x,z,radius));
 return {
  radiusMetres:radius,
  buildings:{measured3d:list.length,withPhotoTexture:list.filter(b=>b.textured).length,plainShell:list.filter(b=>!b.textured).length,
   largest:list.sort((a,b)=>footprint(b)-footprint(a)).slice(0,8).map(b=>({address:footprints.get(String(b.ratu))?.address||b.address||'unknown address',name:footprints.get(String(b.ratu))?.name||undefined,heightMetres:Math.round(b.height||0),footprintM2:Math.round(footprint(b)),photoTexture:b.textured}))},
  streets:[...new Set([...roads,...pavement].map(r=>r.name).filter(Boolean))].slice(0,12),
  roadSurfaces:count(roads.map(r=>r.material||'unknown')),
  pavementKinds:count(pavement.map(p=>p.kind||'unknown')),
  bridges:pavement.concat(roads).filter(p=>/Silta/.test(p.kind)).map(p=>`${p.name||'bridge'} (${p.material||'unknown material'})`),
  parks:count(parks.map(p=>p.kind||'unknown')),
  water:city.water.some(w=>hits(w.bbox,q)),
  trees:{registered:city.trees.filter(t=>!t.inferred&&near(t.p,x,z,radius)).length,inferred:city.trees.filter(t=>t.inferred&&near(t.p,x,z,radius)).length},
  trafficSignals:mobility.signals.filter(s=>near(s.p,x,z,radius)).length,
  pedestrianCrossings:edges.length,
  trams:(lines=>lines.length?{linesRunningHere:lines,note:'Rails are drawn in the street and green-and-cream articulated trams on these HSL lines drive through and stop here during play.'}:'No tram rails or trams here.')([...new Set((trams?.paths||[]).filter(t=>t.points.some(p=>near(p,x,z,radius))).map(t=>t.line))]),
  simulated:['car traffic on the municipal road graph','pedestrians on mapped pavements'],
  knownGaps:['ground is flat (no slopes)','no street signs or lamp posts beyond hand-built core landmarks']
 };
}

export const NEXT_STEP={
 none:'Nothing important is missing for a demo',
 reference_observations:'Cannot judge well: street-level observations of this place are missing or too thin',
 municipal_data:'Missing or wrong city data (buildings, streets, water) that a data refresh or wider area would fix',
 procedural_detail:'Generic street detail is missing (signs, lamp posts, markings, kerbs, furniture, trams) that code can generate from data',
 bespoke_landmark:'A specific famous building or object needs a hand-modelled, reference-guided reconstruction',
 gameplay:'The place looks right but driving there is blocked, confusing or not fun'
};

// What the game has at a landmark's real position: the measured buildings
// there, whether they carry the municipal photo texture, and their size.
export function featureEvidence({buildings,city},points,radius=35){
 if(!points?.length)return 'No fixed position; judge from the whole scene inventory.';
 const parts=buildings.tiles.flatMap(t=>t.parts),addresses=new Map(city.buildings.filter(b=>b.ratu).map(b=>[String(b.ratu),b.address]));
 const found=new Map();
 for(const [x,z] of points)for(const p of parts){const b=p.bbox,dx=Math.max(b[0]-x,0,x-b[2]),dz=Math.max(b[1]-z,0,z-b[3]);if(Math.hypot(dx,dz)>radius)continue;
  const e=found.get(p.id)||{address:addresses.get(String(p.ratu))||'unknown',heightMetres:Math.round(p.height||0),footprintM2:Math.round((b[2]-b[0])*(b[3]-b[1])),photoTexture:false,distanceMetres:Math.round(Math.hypot(dx,dz))};
  e.photoTexture||=!!p.texture;found.set(p.id,e);}
 const list=[...found.values()].sort((a,b)=>b.footprintM2-a.footprintM2).slice(0,4);
 // Bridges, squares and paths are mapped surfaces, not buildings.
 const surfaces=[...city.roads,...city.pavement].filter(p=>points.some(([x,z])=>Math.hypot(Math.max(p.bbox[0]-x,0,x-p.bbox[2]),Math.max(p.bbox[1]-z,0,z-p.bbox[3]))<=radius))
  .map(p=>`${p.name||'unnamed'}: ${p.kind||'surface'}${p.material?` (${p.material})`:''}`);
 const evidence={};
 if(list.length)Object.assign(evidence,{measuredBuildingsAtThisPosition:list,note:'Measured municipal 3D model with the city\'s photographic facade texture, unless photoTexture is false (then a plain grey shell).'});
 if(surfaces.length)evidence.mappedSurfacesAtThisPosition=[...new Set(surfaces)].slice(0,8);
 return Object.keys(evidence).length?evidence:'Nothing at this position in the game.';
}

// One request per checkpoint: independent questions over the same state.
export function questionsFor(knownFor){
 const q={
  recognisable:{type:'score',instructions:'Someone who knows this real place well sees the game scene described in `game_inventory`, together with `reference_observations` of the real place. How recognisable is it?',
   criteria:['Not recognisable: it could be any city','Vaguely familiar: the street layout fits but nothing distinctive is there','Recognisable: the main buildings and street character match','Unmistakable: distinctive landmarks and street details are clearly present']},
  demo_ready:{type:'noul',instructions:'Is this scene good enough to show in a public demo video of a driving game set in this real city, without an obvious gap that a local would immediately point out?',
   criteria:{true:'A local would accept it as this place with no glaring omission',false:'A local would notice something important missing, wrong or empty'}},
  next_step:{type:'choice',instructions:'Which kind of work would most improve how this place looks and plays in the game?',criteria:NEXT_STEP}
 };
 knownFor.forEach((f,i)=>{q[`missing_${i}`]={type:'noul',instructions:{feature:f.name,description:f.description||null,game_evidence_at_its_real_position:f.evidence??'Not checked',question:'Using `game_evidence_at_its_real_position` and `game_inventory`, is `feature` missing from the game scene or represented only as a generic, unrecognisable shape?'},
  criteria:{true:'Missing, or present only generically',false:'Clearly present in a recognisable form'}};});
 return q;
}

export function reviewState(area,checkpoint,inv,notes={}){
 return {city:area.city||'Helsinki',area:area.title,place:checkpoint.name,
  reference_observations:notes.observations?.length?{source:notes.source||'contributor notes',observations:notes.observations}:'No street-level observations have been recorded for this place yet.',
  game_inventory:inv,
  area_limitations:area.limitations||[]};
}

// Code-owned sign-off policy. Thresholds are starting points to tune on real reviews.
export const POLICY={signOff:{demoReady:.8,recognisable:2,confidence:.55},missing:.5,humanBand:[.4,.8]};
export function verdict(answers,knownFor,policy=POLICY){
 const ready=answers.demo_ready.noul,rec=answers.recognisable,step=answers.next_step;
 const missing=knownFor.map((f,i)=>({...f,probability:answers[`missing_${i}`]?.noul??0})).filter(f=>f.probability>policy.missing);
 const blocking=missing.filter(f=>f.mustHave);
 let status='needs-work';
 if(ready>=policy.signOff.demoReady&&rec.score>=policy.signOff.recognisable&&rec.confidence>=policy.signOff.confidence&&!blocking.length)status='signed-off';
 else if(ready>=policy.humanBand[0]&&ready<policy.humanBand[1]&&!blocking.length)status='human-review';
 return {status,demoReady:+ready.toFixed(3),recognisable:+rec.score.toFixed(2),recognisableConfidence:+rec.confidence.toFixed(2),
  nextStep:step.choice,nextStepConfidence:+step.confidence.toFixed(2),missing:missing.map(f=>({name:f.name,mustHave:!!f.mustHave,probability:+f.probability.toFixed(3)}))};
}
