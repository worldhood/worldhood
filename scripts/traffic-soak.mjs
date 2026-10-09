import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {Mobility,signalGreen} from '../src/mobility.js';
import {SpatialIndex} from '../src/geo.js';
import {createSenateSquare} from '../src/cathedral.js';
const city=JSON.parse(gunzipSync(readFileSync('public/data/city.pack'))),data=JSON.parse(readFileSync('public/data/mobility.json'));
let seed=123456;const random=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);
const world={buildings:new SpatialIndex([...city.buildings,...createSenateSquare().obstacles]),roads:new SpatialIndex(city.roads.filter(p=>!/Koroke/.test(p.kind))),pavement:new SpatialIndex(city.pavement)};
const sim=new Mobility(data,world,{random}),player={...city.landmarks[0],heading:0,speed:0};sim.reset(player);
for(let i=0;i<3600;i++){sim.step(.05,player);if(i%600===599)console.log('seconds',Math.round(sim.time),'active',sim.cars.filter(a=>a.edge).length,'moving',sim.cars.filter(a=>a.edge&&a.speed>1).length,'moving nearby',sim.cars.filter(a=>a.edge&&a.speed>1&&Math.hypot(a.x-player.x,a.z-player.z)<150).length);}
for(const a of sim.cars.filter(a=>a.edge&&a.speed<.1).slice(0,12)){
 const dx=-Math.sin(a.heading),dz=-Math.cos(a.heading),blocks=[player,...sim.cars,...sim.people.filter(p=>p.edge?.crossing)].filter(b=>b!==a&&b.edge!==null&&(b.x-a.x)*dx+(b.z-a.z)*dz>0&&(b.x-a.x)*dx+(b.z-a.z)*dz<6.1&&Math.abs((b.x-a.x)*dz-(b.z-a.z)*dx)<2.1);
 console.log({id:a.id,x:a.x,z:a.z,remaining:a.edge.length-a.s,green:signalGreen(a.edge,sim.time),stuck:a.stuck,blocks:blocks.map(b=>({id:b.id,walking:b.walking,onRoad:!!world.roads.at(b.x,b.z),speed:b.speed,heading:b.heading}))});
}
