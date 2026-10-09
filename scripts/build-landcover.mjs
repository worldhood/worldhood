// Build categorical vegetation geometry from the already licensed 2025 reference
// orthophotos. No image is used as a runtime ground plane. This is inferred land
// cover, not a surveyed planting inventory; city surfaces always take precedence.
import {chromium} from '@playwright/test';
import {readFileSync,writeFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import polygonClipping from 'polygon-clipping';
import {SpatialIndex,pointInPolygon} from '../src/geo.js';
const city=JSON.parse(gunzipSync(readFileSync('public/data/city.pack'))),index=JSON.parse(readFileSync('public/data/aerial-index.json'));
const occupied=new SpatialIndex([...city.buildings,...city.roads,...city.pavement,...city.parks]);
const browser=await chromium.launch({headless:true,channel:'chrome'}),page=await browser.newPage();
await page.goto('http://localhost:5173/data/aerial-index.json');
const cell=3,runs=[];
try{for(const tile of index.tiles){
 const candidates=await page.evaluate(async ({tile,cell})=>{
  const image=new Image();image.src='/data/'+tile.file;await image.decode();
  const n=tile.size/cell,canvas=document.createElement('canvas');canvas.width=canvas.height=n;
  const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0,n,n);const rgba=ctx.getImageData(0,0,n,n).data,green=new Uint8Array(n*n);
  for(let i=0;i<green.length;i++){const r=rgba[i*4],g=rgba[i*4+1],b=rgba[i*4+2];green[i]=g-r>3&&g>b*1.07&&g>26&&g<190?1:0;}
  const cells=[];for(let z=1;z<n-1;z++)for(let x=1;x<n-1;x++){const i=z*n+x;if(green[i]&&green[i-1]+green[i+1]+green[i-n]+green[i+n]>=2)cells.push([x,z]);}return cells;
 },{tile,cell});
 const rows=new Map();
 for(const [gx,gz] of candidates){const x=tile.x+gx*cell,z=tile.z+gz*cell;
  // Corners and centre prevent lawns leaking across mapped narrow footpaths.
  if([[.15,.15],[2.85,.15],[.15,2.85],[2.85,2.85],[1.5,1.5]].some(([dx,dz])=>occupied.at(x+dx,z+dz)))continue;
  if(city.water.some(w=>pointInPolygon(x+1.5,z+1.5,w.rings)))continue;
  if(!rows.has(gz))rows.set(gz,[]);rows.get(gz).push(gx);
 }
 for(const [gz,xs] of rows){xs.sort((a,b)=>a-b);let start=xs[0],last=start;for(let i=1;i<=xs.length;i++){if(xs[i]===last+1){last=xs[i];continue;}runs.push([tile.x+start*cell,tile.z+gz*cell,(last-start+1)*cell,cell]);start=last=xs[i];}}
 console.log(tile.file,'vegetation cells',Array.from(rows.values()).reduce((s,r)=>s+r.length,0));
}}finally{await browser.close();}
const groups=new Map();for(const run of runs){const key=`${Math.floor(run[0]/600)},${Math.floor(run[1]/600)}`;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(run);}
function soften(ring){let r=ring.slice(0,-1);for(let pass=0;pass<2;pass++){const next=[];for(let i=0;i<r.length;i++){const a=r[i],b=r[(i+1)%r.length];next.push([a[0]*.8+b[0]*.2,a[1]*.8+b[1]*.2],[a[0]*.2+b[0]*.8,a[1]*.2+b[1]*.8]);}r=next;}r=r.map(p=>p.map(v=>+v.toFixed(2)));return [...r,r[0]];}
const polygons=[];for(const rows of groups.values()){const shapes=rows.map(([x,z,w,d])=>[[[x,z],[x+w,z],[x+w,z+d],[x,z+d],[x,z]]]);polygons.push(...polygonClipping.union(...shapes).map(rings=>rings.map(soften)));}
writeFileSync('public/data/landcover.json',JSON.stringify({source:'City of Helsinki 2025 orthophotography, CC BY 4.0',method:'Conservative categorical vegetation classification, unioned and softened into polygons; mapped roads, paths, parks, water and buildings excluded before smoothing. Approximate 3 metre source cells; not a survey.',cell,polygons}));
console.log('Saved',polygons.length,'vegetation polygons');
