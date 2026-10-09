// Geometry for map extensions (areas added outside the original ±2400 m city
// snapshot). Metres, X east / Z south, origin at the Cathedral (src/geo.js).
import fs from 'node:fs';
import path from 'node:path';
import polygonClipping from 'polygon-clipping';
import proj4 from 'proj4';
import {ORIGIN,WORLD_EXTENT} from '../src/geo.js';

export const GK25='+proj=tmerc +lat_0=0 +lon_0=25 +k=1 +x_0=25500000 +y_0=0 +ellps=GRS80 +units=m +no_defs';
const origin=proj4('EPSG:4326',GK25,ORIGIN);
export const ORIGIN_GK25=origin;
export const local=([lon,lat])=>{const p=proj4('EPSG:4326',GK25,[lon,lat]);return [+(p[0]-origin[0]).toFixed(2),+(origin[1]-p[1]).toFixed(2)];};
export const wgs84=(x,z)=>proj4(GK25,'EPSG:4326',[origin[0]+x,origin[1]-z]);
export const extensionDir=id=>{if(!/^[a-z0-9-]+$/.test(id||''))throw Error('Usage: <extension id>, e.g. seurasaari');return path.join('extensions',id);};
export const readExtension=id=>JSON.parse(fs.readFileSync(path.join(extensionDir(id),'extension.json')));
export const readRoute=id=>JSON.parse(fs.readFileSync(path.join(extensionDir(id),'route.json')));
export const SNAPSHOT_SQUARE=[[[-WORLD_EXTENT,-WORLD_EXTENT],[WORLD_EXTENT,-WORLD_EXTENT],[WORLD_EXTENT,WORLD_EXTENT],[-WORLD_EXTENT,WORLD_EXTENT],[-WORLD_EXTENT,-WORLD_EXTENT]]];
export const rectangle=b=>[[[b[0],b[1]],[b[2],b[1]],[b[2],b[3]],[b[0],b[3]],[b[0],b[1]]]];
export const boxesOverlap=(a,b)=>a[0]<b[2]&&a[2]>b[0]&&a[1]<b[3]&&a[3]>b[1];

export function pointInRing(x,z,ring){let inside=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],b=ring[j];if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])inside=!inside;}return inside;}
export function pointInMulti(x,z,multi){for(const poly of multi){if(!pointInRing(x,z,poly[0]))continue;if(!poly.slice(1).some(h=>pointInRing(x,z,h)))return true;}return false;}
export function multiBounds(multi){const b=[Infinity,Infinity,-Infinity,-Infinity];for(const poly of multi)for(const p of poly[0]){b[0]=Math.min(b[0],p[0]);b[1]=Math.min(b[1],p[1]);b[2]=Math.max(b[2],p[0]);b[3]=Math.max(b[3],p[1]);}return b;}

// Douglas–Peucker with a distance tolerance; keeps both endpoints.
export function simplify(points,tolerance){
 if(points.length<3)return points;
 const keep=new Uint8Array(points.length);keep[0]=keep[points.length-1]=1;const stack=[[0,points.length-1]];
 while(stack.length){const [s,e]=stack.pop(),a=points[s],b=points[e],dx=b[0]-a[0],dz=b[1]-a[1],l=Math.hypot(dx,dz)||1;let best=-1,index=-1;
  for(let i=s+1;i<e;i++){const d=Math.abs((points[i][0]-a[0])*dz-(points[i][1]-a[1])*dx)/l;if(d>best){best=d;index=i;}}
  if(best>tolerance){keep[index]=1;stack.push([s,index],[index,e]);}}
 return points.filter((_,i)=>keep[i]);
}
export function simplifyRing(ring,tolerance){const half=Math.floor(ring.length/2),out=[...simplify(ring.slice(0,half+1),tolerance).slice(0,-1),...simplify(ring.slice(half),tolerance)];if(out.at(-1)[0]!==out[0][0]||out.at(-1)[1]!==out[0][1])out.push(out[0]);return out;}

// Round-capped buffer around polylines, unioned with extra polygons.
export function bufferPolylines(lines,width,extra=[],segments=12){
 const pieces=[];
 for(const line of lines){
  for(let i=1;i<line.length;i++){const a=line[i-1],b=line[i],dx=b[0]-a[0],dz=b[1]-a[1],l=Math.hypot(dx,dz);if(l<1e-6)continue;const nx=-dz/l*width,nz=dx/l*width;pieces.push([[[a[0]+nx,a[1]+nz],[b[0]+nx,b[1]+nz],[b[0]-nx,b[1]-nz],[a[0]-nx,a[1]-nz],[a[0]+nx,a[1]+nz]]]);}
  for(const p of line){const ring=[];for(let k=0;k<=segments;k++){const t=k/segments*Math.PI*2;ring.push([p[0]+Math.cos(t)*width,p[1]+Math.sin(t)*width]);}ring[segments]=ring[0];pieces.push([ring]);}
 }
 let result=[];for(let i=0;i<pieces.length;i+=200)result=polygonClipping.union(result,...pieces.slice(i,i+200));
 return extra.length?polygonClipping.union(result,...extra):result;
}
// surface: drivable/mapped band; context: wider band for buildings and skyline.
export function extensionRegions(route){
 const lines=route.centrelines.map(c=>c.points),island=route.island?[[route.island.ring]]:[];
 const shore=[...island.length?bufferPolylines([route.island.ring],route.buffers.islandShoreMetres,island):[],...(route.areas||[]).map(a=>[a.ring])];
 return {surface:bufferPolylines(lines,route.buffers.surfaceMetres,shore),context:bufferPolylines(lines,route.buffers.buildingMetres,shore)};
}

// Carriageway outlines along centrelines ({points, half: half-width}) wherever no mapped street area
// covers them (covered.at(x,z)) and skip(point) is false: motorways and ramps missing from a street
// register still get a drivable surface. One outline per uncovered run; quads if the clipper fails.
export function paveUncovered(lines,covered,skip=()=>false,step=4){
 const out=[],quads=(run,h)=>run.slice(1).map((b,i)=>{const a=run[i],l=Math.hypot(b[0]-a[0],b[1]-a[1])||1,nx=-(b[1]-a[1])/l*h,nz=(b[0]-a[0])/l*h;return [[[a[0]+nx,a[1]+nz],[b[0]+nx,b[1]+nz],[b[0]-nx,b[1]-nz],[a[0]-nx,a[1]-nz],[a[0]+nx,a[1]+nz]]];});
 const pave=(run,h)=>{const r=run.map(q=>q.map(v=>Math.round(v*100)/100));try{out.push(...bufferPolylines([r],h,[],8));}catch{out.push(...quads(r,h));}};
 for(const {points:pts,half} of lines){let run=[];
  for(let i=1;i<pts.length;i++){const a=pts[i-1],b=pts[i],n=Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/step));
   for(let k=0;k<n;k++){const at=t=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t],q=at((k+.5)/n);
    if(!covered.at(...q)&&!skip(q)){if(!run.length)run.push(at(k/n));run.push(at((k+1)/n));}else if(run.length){pave(run,half);run=[];}}}
  if(run.length)pave(run,half);}
 return out;
}
