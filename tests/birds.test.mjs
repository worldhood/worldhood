import test from 'node:test';
import assert from 'node:assert/strict';
import {shoreSamples,planBirds,createBirdLife,createBirdRenderer,birdGeometry,inWater,BIRD_KINDS,createBirds} from '../src/birds.js';
import {marketGullColony} from '../src/market-life.js';

const box=(x0,z0,x1,z1)=>[[x0,z0],[x1,z0],[x1,z1],[x0,z1]];
// A small city: a lake with an island, a square, a lawn, a row of street trees and a fountain basin.
function city(){
 return {radius:1500,extent:1000,
  water:[{kind:'lake',rings:[box(200,-200,600,200),box(380,-20,420,20)]},{kind:'basin',rings:[box(-5,-5,-1,-1)]},{kind:'Merialue',rings:[box(-1000,600,-600,1000)]}],
  pavement:[{kind:'Aukiot',name:'Tori',rings:[box(-80,-40,-20,20)]},{kind:'Jalkakäytävä',rings:[box(170,-100,198,100)]}],
  parks:[{kind:'Nurmikko',rings:[box(-400,-400,-300,-300)]}],
  trees:Array.from({length:8},(_,i)=>({p:[-200+i*6,200],height:12})),roads:[],buildings:[]};
}

test('shore samples follow water outlines with normals into the water, skipping the data edge and basins',()=>{
 const d=city(),shore=shoreSamples(d.water,{extent:d.extent,radius:d.radius});
 assert.ok(shore.length>100);
 for(const s of shore)assert.ok(inWater(d.water,s.x+s.nx*3,s.z+s.nz*3),`normal at ${s.x},${s.z} points into water`);
 assert.ok(shore.some(s=>Math.abs(s.x-400)<=21&&Math.abs(s.z)<=21),'the island shore is a shore too');
 assert.ok(!shore.some(s=>s.x<0&&s.x>-10),'fountain basins are not gull water');
 assert.ok(!shore.some(s=>s.x===-1000&&s.z>600||s.z===1000),'edges on the clipping box are not shoreline');
});

test('flocks come from the map: gulls over water, pigeons on squares, crows on lawns, sparrows in trees',()=>{
 const d=city(),plan=planBirds(d,{seed:3}),by=k=>plan.flocks.filter(f=>f.kind===k);
 assert.ok(by('gull').length>=2);for(const f of by('gull'))assert.ok(inWater(d.water,f.x,f.z),'gull flocks circle over water');
 assert.ok(by('gull').some(f=>f.perches.length>0),'quay perches along the shore');
 assert.ok(by('gull').every(f=>f.spots.every(s=>!inWater(d.water,s.x,s.z))),'walking gulls stay on land');
 const pigeons=by('pigeon');assert.equal(pigeons.length,1);assert.ok(pigeons[0].spots.every(s=>s.x>-80&&s.x<-20&&s.z>-40&&s.z<20),'pigeons feed on the square');
 const crows=plan.flocks.filter(f=>f.kind==='crow'||f.kind==='jackdaw');assert.equal(crows.length,1);assert.ok(crows[0].spots.every(s=>s.x>-400&&s.x<-300));
 const sparrows=by('sparrow');assert.equal(sparrows.length,1);assert.ok(sparrows[0].perches.every(p=>p.y>3&&p.y<12),'sparrows sit in the crowns');
 assert.deepEqual(planBirds(d,{seed:3}).flocks.map(f=>[f.kind,f.x,f.z]),plan.flocks.map(f=>[f.kind,f.x,f.z]),'deterministic');
 const extra=planBirds(d,{colonies:[{kind:'gull',name:'Harbour',x:400,z:100,count:12}]});assert.equal(extra.flocks.at(-1).name,'Harbour');
});

test('pigeons burst into flight when the car comes close, circle, and settle again once it has gone',()=>{
 const d=city(),life=createBirdLife(planBirds(d,{seed:5})),f=life.plan.flocks.find(f=>f.kind==='pigeon'),viewer={x:-50,z:-10};
 assert.ok(f.birds.every(b=>b.state==='ground'));
 const startY=Math.max(...f.birds.map(b=>b.y));
 const target=f.birds[0],car={x:target.x+9,z:target.z,speed:8};
 for(let i=0;i<20;i++)life.step(1/30,{viewer,threats:[car]});
 const flying=f.birds.filter(b=>b.state==='flee'||b.state==='soar').length;
 assert.ok(flying>=f.birds.length*.5,`${flying}/${f.birds.length} took off`);
 for(let i=0;i<30;i++)life.step(1/30,{viewer,threats:[car]});
 assert.ok(Math.max(...f.birds.map(b=>b.y))>startY+1.5,'up in the air');
 assert.ok(f.birds.every(b=>Math.hypot(b.x-target.x,b.z-target.z)<40),'they stay around their square');
 const away={x:900,z:900,speed:0};for(let i=0;i<30*40;i++)life.step(1/30,{viewer,threats:[away]});
 assert.ok(f.birds.filter(b=>b.state==='ground').length>=f.birds.length*.7,'back down pecking after a while');
});

test('a slow car far off does not scatter them; a walker makes the nearest hop aside or go up',()=>{
 const d=city(),life=createBirdLife(planBirds(d,{seed:5})),f=life.plan.flocks.find(f=>f.kind==='pigeon'),viewer={x:-50,z:-10};
 const b=f.birds[0];
 for(let i=0;i<30;i++)life.step(1/30,{viewer,threats:[{x:b.x+25,z:b.z,speed:3}]});
 assert.ok(f.birds.every(x=>x.state==='ground'),'25 m away at walking pace: still pecking');
 const before={x:b.x,z:b.z},walker={x:b.x+.6,z:b.z};
 for(let i=0;i<20;i++)life.step(1/30,{viewer,people:[[walker]]});
 assert.ok(b.state!=='ground'||Math.hypot(b.x-before.x,b.z-before.z)>.15,'moved away from the walker');
});

test('gulls circle over the water and the flock only updates near the viewer',()=>{
 const d=city(),life=createBirdLife(planBirds(d,{seed:9})),gulls=life.plan.flocks.filter(f=>f.kind==='gull');
 for(let i=0;i<300;i++)life.step(1/30,{viewer:{x:400,z:0}});
 for(const f of gulls)for(const b of f.birds)if(b.state==='soar')assert.ok(Math.hypot(b.x-f.x,b.z-f.z)<f.radius*1.5+10&&b.y>3,'soaring above the flock centre');
 const far=createBirdLife(planBirds(d,{seed:9})),pos=far.birds.map(b=>[b.x,b.y,b.z]);
 for(let i=0;i<60;i++)far.step(1/30,{viewer:{x:5000,z:5000}});
 assert.deepEqual(far.birds.map(b=>[b.x,b.y,b.z]),pos,'flocks far from the viewer stay frozen');
});

test('birds draw in one instanced call with finite, culled instances',()=>{
 const g=birdGeometry();assert.ok(g.attributes.position.array.every(Number.isFinite));assert.ok(g.attributes.position.count/3<400,'cheap bird');
 const birds=createBirds(city(),{seed:2});assert.equal(birds.group.children.length,1);
 birds.update(1/30,{viewer:{x:400,z:0},threats:[],people:[]});
 const mesh=birds.renderer.mesh;assert.ok(mesh.count>0&&mesh.count<=birds.life.birds.length);
 assert.ok(mesh.instanceMatrix.array.slice(0,mesh.count*16).every(Number.isFinite));
 for(const b of birds.life.birds)if(Math.hypot(b.x-400,b.z)>BIRD_KINDS[b.kind].view)assert.ok(true);
 birds.update(1/30,{viewer:{x:9000,z:9000}});assert.equal(mesh.count,0);assert.equal(mesh.visible,false);
});

test('Kauppatori colony: gulls over the canopies, on stall ridges and the fountain, walking the square and out over the harbour',()=>{
 const sq=box(20,250,215,342),d={pavement:[{name:'Kauppatori',kind:'Aukiot',rings:[sq]}],roads:[],buildings:[],water:[{kind:'Merialue',rings:[box(-200,345,700,900)]}]};
 const shore=shoreSamples(d.water,{});
 const colonies=marketGullColony(d,[{x:80,z:290,w:6,d:4},{x:140,z:300,w:6,d:4}],{shore,inWater:(x,z)=>inWater(d.water,x,z)});
 const total=colonies.reduce((a,c)=>a+c.count,0);assert.ok(total>=70,`${total} gulls`);
 const canopy=colonies.find(c=>/canopies/.test(c.name));assert.ok(canopy.perches.some(p=>p.y>3),'ridge perches');assert.ok(canopy.alt[1]<10,'low over the stalls');
 const walkers=colonies.find(c=>/square/.test(c.name));assert.ok(walkers.walkers>=10&&walkers.spots.length>=3);
 assert.ok(colonies.filter(c=>/Eteläsatama/.test(c.name)).every(c=>inWater(d.water,c.x,c.z)),'harbour flocks over the water');
 const life=createBirdLife(planBirds({...d,parks:[],trees:[]},{colonies}));assert.ok(life.birds.filter(b=>b.kind==='gull').length>=total);
});
