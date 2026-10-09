import {readFileSync,writeFileSync} from 'node:fs';
import proj4 from 'proj4';
const projection=proj4('EPSG:4326','+proj=tmerc +lat_0=0 +lon_0=25 +k=1 +x_0=25500000 +y_0=0 +ellps=GRS80 +units=m +no_defs');
const origin=projection.forward([24.9522,60.1701]);
const project=p=>{const q=projection.forward(p.slice(0,2));return [+(q[0]-origin[0]).toFixed(2),+(origin[1]-q[1]).toFixed(2)];};
const features=JSON.parse(readFileSync('data/raw/traffic-lines.json')).features;
const signals=JSON.parse(readFileSync('data/raw/traffic-lights.json')).features.map(f=>({p:project(f.geometry.coordinates),name:f.properties.risteys}));
function graph(walking){
 const nodes=[],edges=[],cells=new Map();
 function node(p){
  const x=Math.floor(p[0]),z=Math.floor(p[1]);
  for(let i=x-1;i<=x+1;i++)for(let j=z-1;j<=z+1;j++)for(const id of cells.get(`${i},${j}`)||[])if(Math.hypot(nodes[id][0]-p[0],nodes[id][1]-p[1])<.75)return id;
  const id=nodes.length;nodes.push(p);const key=`${x},${z}`;if(!cells.has(key))cells.set(key,[]);cells.get(key).push(id);return id;
 }
 for(const f of features){
  const p=f.properties;
  if(/Alikulku|tunneli/.test(p.silta_alikulku))continue;
  if(walking?!/Jalkakäytävä|jalkakäytävä|Suojatie|Puistotie|Kulkuväylä aukiolla/.test(p.alatyyppi):p.paatyyppi!=='Katu')continue;
  const lines=f.geometry.type==='LineString'?[f.geometry.coordinates]:f.geometry.type==='MultiLineString'?f.geometry.coordinates:[];
  for(const line of lines){
   const points=line.map(project);if(points.some(q=>Math.abs(q[0])>2350||Math.abs(q[1])>2350))continue;
   const a=node(points[0]),b=node(points.at(-1));if(a===b)continue;
   const oneWay=/Yksisuuntainen/.test(p.yksisuuntaisuus),reverse=/vastaan/.test(p.yksisuuntaisuus);
   const add=(from,to,path)=>{let length=0;for(let i=1;i<path.length;i++)length+=Math.hypot(path[i][0]-path[i-1][0],path[i][1]-path[i-1][1]);if(length<.5)return;
    const end=path.at(-1);let signal=-1,best=27;signals.forEach((s,i)=>{const d=Math.hypot(s.p[0]-end[0],s.p[1]-end[1]);if(d<best){best=d;signal=i;}});
    edges.push({from,to,points:path,length:+length.toFixed(2),lane:walking?0:oneWay?.35:1.45,crossing:p.alatyyppi==='Suojatie',signal});};
   if(walking||!oneWay||!reverse)add(a,b,points);
   if(walking||!oneWay||reverse)add(b,a,[...points].reverse());
  }
 }
 return {nodes,edges};
}
const roads=graph(false),walks=graph(true);
writeFileSync('public/data/mobility.json',JSON.stringify({source:'City of Helsinki / Liikennevaylat and Liikennevalot_piste, CC BY 4.0',note:'Measured routes and signalised junction locations; traffic volumes, speeds and light timings are simulated.',signals,roads,walks}));
console.log(`Roads: ${roads.nodes.length} nodes / ${roads.edges.length} directed edges. Walks: ${walks.nodes.length} nodes / ${walks.edges.length} directed edges.`);
