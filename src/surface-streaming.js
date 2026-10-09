import {createSpatialStreamer} from './spatial-streaming.js';

// Surface files contain whole polygons assigned to a centroid bucket. Their
// actual vertex bounds, not the bucket's filename, determine when to load.
export function surfaceBounds(values){
 const b=[Infinity,Infinity,-Infinity,-Infinity];
 for(let i=0;i<values.length;i+=6){const x=Math.fround(values[i]),z=Math.fround(values[i+2]);if(!Number.isFinite(x)||!Number.isFinite(z))continue;b[0]=Math.min(b[0],x);b[1]=Math.min(b[1],z);b[2]=Math.max(b[2],x);b[3]=Math.max(b[3],z);}
 return b.every(Number.isFinite)?b:null;
}
export const surfaceRecord=(file,values)=>({file,bbox:surfaceBounds(values)});
export function createSurfaceStreamer(options){return createSpatialStreamer({...options,keyOf:r=>r.file,boundsOf:r=>r.bbox});}
