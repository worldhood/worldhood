// Per-building façade descriptions for cities built from OpenStreetMap (cities/<id>/facades.json,
// copied next to the city's runtime data). Written by a person or a coding agent from open
// street-level photos; this module checks them and fills defaults for src/facade-renderer.js.
// Words and numbers only: never image pixels.

export const SHAPES=['rect','square','arch','ribbon','none'];
export const GROUND=['shops','arcade','solid','glass'];
export const MATERIALS=['render','brick','stone','glass','concrete','metal','timber'];
const HEX=/^#[0-9a-f]{6}$/i;

const num=(v,min,max)=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max;
function checkWindows(w,where,errors){
 if(w==null)return;
 if(typeof w!=='object'){errors.push(`${where}: must be an object`);return;}
 if(w.shape!=null&&!SHAPES.includes(w.shape))errors.push(`${where}.shape: one of ${SHAPES.join(', ')}`);
 for(const [k,min,max] of [['pitch',.6,12],['width',.2,10],['height',.2,6]])if(w[k]!=null&&!num(w[k],min,max))errors.push(`${where}.${k}: number ${min}–${max}`);
 for(const k of ['frame','glass'])if(w[k]!=null&&!HEX.test(w[k]))errors.push(`${where}.${k}: #rrggbb colour`);
}

// Returns a list of problems; empty when the file is usable.
export function validateFacades(data){
 const errors=[];
 if(!data||typeof data!=='object')return ['facades file must be a JSON object'];
 if(data.schemaVersion!==1)errors.push('schemaVersion must be 1');
 if(!data.buildings||typeof data.buildings!=='object')return [...errors,'buildings must map building ids to façades'];
 if(data.groups!=null&&!Array.isArray(data.groups))errors.push('groups must be a list of {ids, facade}');
 const entries=[...Object.entries(data.buildings).map(([id,b])=>[`buildings["${id}"]`,b]),...(data.groups||[]).map((g,i)=>[`groups[${i}].facade`,g?.facade])];
 (data.groups||[]).forEach((g,i)=>{if(!Array.isArray(g?.ids)||!g.ids.length)errors.push(`groups[${i}].ids: list of building ids`);});
 for(const [at,b] of entries){
  if(!b||typeof b!=='object'){errors.push(`${at}: must be an object`);continue;}
  if(!HEX.test(b.wall||''))errors.push(`${at}.wall: #rrggbb colour required`);
  for(const k of ['wallLower','roof','cornice','trim'])if(b[k]!=null&&!HEX.test(b[k]))errors.push(`${at}.${k}: #rrggbb colour`);
  if(b.material!=null&&!MATERIALS.includes(b.material))errors.push(`${at}.material: one of ${MATERIALS.join(', ')}`);
  if(b.storeys!=null&&!(Number.isInteger(b.storeys)&&b.storeys>=1&&b.storeys<=40))errors.push(`${at}.storeys: whole number 1–40`);
  if(b.height!=null&&!num(b.height,2,150))errors.push(`${at}.height: metres 2–150`);
  if(b.groundStorey!=null&&!num(b.groundStorey,2,9))errors.push(`${at}.groundStorey: metres 2–9`);
  if(b.lowerStoreys!=null&&!(Number.isInteger(b.lowerStoreys)&&b.lowerStoreys>=1))errors.push(`${at}.lowerStoreys: whole number ≥ 1`);
  checkWindows(b.windows,`${at}.windows`,errors);
  for(const [k,w] of Object.entries(b.storeyWindows||{})){if(!/^-?\d+$/.test(k))errors.push(`${at}.storeyWindows: keys are storey numbers (0 = ground, -1 = top)`);checkWindows(w,`${at}.storeyWindows["${k}"]`,errors);}
  const g=b.ground;
  if(g!=null){
   if(!GROUND.includes(g.type))errors.push(`${at}.ground.type: one of ${GROUND.join(', ')}`);
   for(const k of ['band','awning','frame','canopy'])if(g[k]!=null&&!HEX.test(g[k]))errors.push(`${at}.ground.${k}: #rrggbb colour`);
   if(g.pitch!=null&&!num(g.pitch,1,15))errors.push(`${at}.ground.pitch: metres 1–15`);
  }
  const e=b.evidence;
  if(!e||!Array.isArray(e.photos))errors.push(`${at}.evidence.photos: list the reference photos used`);
  else for(const p of e.photos)if(!p||!/^\w+$/.test(String(p.id||''))||!/^\d{4}-\d\d-\d\d$/.test(p.captured||''))errors.push(`${at}.evidence.photos: each needs an id and captured date (YYYY-MM-DD)`);
  if(e&&!num(e.confidence,0,1))errors.push(`${at}.evidence.confidence: 0–1`);
 }
 return errors;
}

// One building's description with every renderer default filled in.
export function normaliseFacade(b,partHeight){
 const height=b.height??partHeight,glassWalls=b.material==='glass';
 const storeys=b.storeys??Math.max(1,Math.round((height-.6)/3.3));
 const groundStorey=Math.min(b.groundStorey??(storeys>1?Math.min(4.2,height*.3):height-.3),height-.3);
 const windows={shape:'rect',pitch:2.6,width:1.2,height:1.55,frame:'#e8e4da',glass:'#35464f',...b.windows};
 return {...b,height,storeys,groundStorey,windows,material:b.material||'render',
  wallLower:b.wallLower||null,lowerStoreys:b.lowerStoreys??1,
  trim:b.trim||b.cornice||null,roof:b.roof||'#4c5154',
  ground:b.ground===null?null:{type:glassWalls?'glass':'shops',pitch:4,band:'#2e3134',frame:'#2b2d2f',...b.ground},
  storeyWindows:b.storeyWindows||{}};
}

// Floor bands of a wall of the given height: [{index,y0,y1}] from the ground up.
export function storeyBands(spec,wallHeight){
 const n=spec.storeys,parapet=n>1?Math.min(1,wallHeight*.04):0,g=Math.min(spec.groundStorey,wallHeight);
 if(n===1)return [{index:0,y0:0,y1:wallHeight-parapet}];
 const h=Math.max(1.8,(wallHeight-g-parapet)/(n-1)),out=[{index:0,y0:0,y1:g}];
 for(let i=1;i<n&&g+i*h<=wallHeight-parapet+.01;i++)out.push({index:i,y0:g+(i-1)*h,y1:g+i*h});
 return out;
}

// Window style for one storey: storey-specific overrides (top storey as -1) over the default.
export function storeyStyle(spec,index,count){
 const own=spec.storeyWindows[index]??(index===count-1?spec.storeyWindows[-1]:undefined);
 return own?{...spec.windows,...own}:spec.windows;
}

// Lookup used at load time: attach each description to its building parts and apply height fixes.
// Groups give many small similar structures (shelters, kiosks) one shared description.
export function facadeFor(data,id){
 return data?.buildings?.[id]||data?.groups?.find(g=>g.ids.includes(id))?.facade||null;
}
export function attachFacades(index,data){
 if(!data?.buildings)return 0;let n=0;
 for(const t of index.tiles)for(const p of t.parts){const f=facadeFor(data,p.id);if(f){p.facade=normaliseFacade(f,p.sourceHeight??p.height);n++;}}
 return n;
}
// Measured shells use OSM or estimated heights. When the photos (facade.height) or the city's 3D
// building parts (measuredHeight, set from a place file) give a different height, stretch the
// part's vertices (in place, before any mesh is built) so every level of detail agrees.
export function applyFacadeHeights(array,parts){
 for(const p of parts){
  const want=p.facade?.height??p.measuredHeight;if(!want)continue;
  p.sourceHeight??=p.height;if(Math.abs(want-p.sourceHeight)<.05)continue; // tiles reload from the original data
  const k=want/p.sourceHeight;for(let i=p.start;i<p.start+p.count;i++)array[i*5+1]*=k;
  p.height=want;
 }
}
