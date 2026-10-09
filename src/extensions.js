import {dataUrl} from './cities.js';
import {registerPlayableArea,registerWaterClip,WORLD_EXTENT} from './geo.js';

// Map extensions: extra areas built by scripts/build-extension.mjs into
// public/data/extensions/<id>/ and listed in public/data/extensions/index.json.
// Each carries the main snapshot's formats, so merging is concatenation plus
// re-indexing the mobility graph across the seam.
export async function loadExtensions(json,unpack){
 let index;
 try{index=await json(dataUrl('extensions/index.json'));}catch{return [];}
 return Promise.all(index.extensions.map(async e=>{
  const [city,buildings,surfaces,mobility]=await Promise.all([
   unpack(dataUrl(`${e.dir}/city.pack`)).then(b=>JSON.parse(new TextDecoder().decode(b))),
   json(dataUrl(`${e.dir}/buildings3d-index.json`)),json(dataUrl(`${e.dir}/surface-index.json`)),json(dataUrl(`${e.dir}/mobility.json`))]);
  return {...e,city,buildings,surfaces,mobility};
 }));
}

// Extension graphs keep lines that leave the main graph's ±2350 m box, so
// their seam endpoints coincide with main-graph nodes (same 0.75 m snapping).
export function mergeGraph(base,extra,signalOffset){
 const cell=p=>`${Math.floor(p[0])},${Math.floor(p[1])}`,cells=new Map();
 base.nodes.forEach((p,i)=>{if(Math.abs(p[0])<2300&&Math.abs(p[1])<2300)return;const k=cell(p);if(!cells.has(k))cells.set(k,[]);cells.get(k).push(i);});
 const remap=extra.nodes.map(p=>{
  const x=Math.floor(p[0]),z=Math.floor(p[1]);
  for(let i=x-1;i<=x+1;i++)for(let j=z-1;j<=z+1;j++)for(const n of cells.get(`${i},${j}`)||[])if(Math.hypot(base.nodes[n][0]-p[0],base.nodes[n][1]-p[1])<.75)return n;
  base.nodes.push(p);return base.nodes.length-1;
 });
 for(const e of extra.edges)base.edges.push({...e,from:remap[e.from],to:remap[e.to],signal:e.signal>=0?e.signal+signalOffset:-1});
 return remap;
}

export function applyExtensions(extensions,{data,roofIndex,surfaceIndex,mobility}){
 const view=[-WORLD_EXTENT,-WORLD_EXTENT,WORLD_EXTENT,WORLD_EXTENT];
 for(const e of extensions){
  for(const key of ['buildings','roads','pavement','parks','water','trees'])data[key].push(...e.city[key]);
  roofIndex.tiles.push(...e.buildings.tiles);roofIndex.buildings+=e.buildings.buildings;
  surfaceIndex.push(...e.surfaces);
  const offset=mobility.signals.length;mobility.signals.push(...e.mobility.signals);
  mergeGraph(mobility.roads,e.mobility.roads,offset);mergeGraph(mobility.walks,e.mobility.walks,offset);
  registerPlayableArea(e.playable);if(e.waterClip)registerWaterClip(e.waterClip);
  for(const [i,v] of e.mapBounds.entries())view[i]=i<2?Math.min(view[i],v):Math.max(view[i],v);
 }
 // Square map frame around everything, centred on the union of areas.
 const size=Math.max(view[2]-view[0],view[3]-view[1])+200;
 return {cx:(view[0]+view[2])/2,cz:(view[1]+view[3])/2,size,playable:extensions.map(e=>e.playable)};
}
