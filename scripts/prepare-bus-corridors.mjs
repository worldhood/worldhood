import {readFileSync,writeFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {SpatialIndex} from '../src/geo.js';
import {usableBusPaths,stationBayPoses} from '../src/bus-simulation.js';
import {prepareGraph,routePoint} from '../src/mobility.js';
const city=JSON.parse(gunzipSync(readFileSync('public/data/city.pack'))),data=JSON.parse(readFileSync('public/data/buses.json'));
const world={buildings:new SpatialIndex(city.buildings),roads:new SpatialIndex(city.roads.filter(r=>!/Koroke/.test(r.kind))),trafficForbidden:new SpatialIndex(city.roads.filter(r=>/Koroke/.test(r.kind)))};
const paths=[];if(process.argv.includes('--compact-existing')){for(const p of JSON.parse(readFileSync('public/data/bus-corridors.json')).paths)paths.push({...prepareGraph({nodes:[0,1],edges:[{...p,from:0,to:1}]}).edges[0],id:p.id});}else for(const path of data.paths){const valid=usableBusPaths({paths:[path]},world);paths.push(...valid);console.log(path.line,valid.length,'clear sections');}
const compact=paths.map(p=>{const from=Math.max(0,p.start-8),to=Math.min(p.length,p.end+8),a=routePoint(p,from,0),b=routePoint(p,to,0),points=[[a.x,a.z],...p.points.filter((_,i)=>p.cumulative[i]>from&&p.cumulative[i]<to),[b.x,b.z]].map(p=>p.map(v=>+v.toFixed(3)));const {cumulative,...rest}=p;return {...rest,points,start:p.start-from,end:p.end-from,length:to-from};});
const stationBays=stationBayPoses(data,world);console.log('Road-clear station standing buses',stationBays);
writeFileSync('public/data/bus-corridors.json',JSON.stringify({...data,stationBays,clearancePrecomputed:true,clearanceNote:'Static municipal road/building/island checks, 0.5 m body sampling and swept full bus body. Live authored furniture checked again at runtime. Not surveyed lane centres.',paths:compact}));
console.log('Saved',paths.length,'usable corridors');
