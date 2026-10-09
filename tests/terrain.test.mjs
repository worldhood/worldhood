import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {encodeTerrain,decodeTerrain,setTerrain,groundAt,waterAt,lakeAt,groundPose,footprintBase,liftBuildings,hasTerrain} from '../src/terrain.js';
import {drapeGeometry,settleObject,subdivideGeometry,createLakeGeometry} from '../src/terrain-mesh.js';
import {makeCar,driveStep} from '../src/physics.js';
import {drivingCameraPose} from '../src/driving-camera.js';
import {SpatialIndex} from '../src/geo.js';
import {blur,levelWater,findLakes,stampBridges,bridgeChains,conditionRoads,readPng} from '../scripts/city-terrain.mjs';

// Synthetic fields: size×size samples, `cell` metres apart, centred on the origin.
function field(fn,{size=81,cell=2,water=null,lake=null}={}){
 const extent=(size-1)*cell/2,ground=new Float32Array(size*size);
 for(let j=0;j<size;j++)for(let i=0;i<size;i++)ground[j*size+i]=fn(i*cell-extent,j*cell-extent);
 return {size,cell,extent,base:0,ground,water,lake};
}
const flatWorld=()=>{const e=new SpatialIndex([]);return {buildings:e,roads:new SpatialIndex([{rings:[[[-500,-500],[500,-500],[500,500],[-500,500],[-500,-500]]],kind:'Ajorata'}]),pavement:e,water:[]};};

test('height field round-trips through the pack format within its 1 cm quantisation',()=>{
 const size=33,ground=new Float32Array(size*size),water=new Float32Array(size*size).fill(NaN),lake=new Float32Array(size*size).fill(NaN);
 for(let i=0;i<ground.length;i++){ground[i]=80+Math.sin(i*.37)*12+i*.003;if(i%7===0)water[i]=77.31;if(i>900)lake[i]=95.42;}
 const bytes=encodeTerrain({size,cell:3,extent:48,base:89,ground,water,lake,source:'test'}),t=decodeTerrain(bytes);
 assert.equal(t.size,size);assert.equal(t.cell,3);assert.equal(t.extent,48);assert.equal(t.source,'test');
 for(let i=0;i<ground.length;i++){
  assert.ok(Math.abs(t.ground[i]-(ground[i]-89))<=.0051,`ground ${i}`);
  assert.equal(Number.isNaN(t.water[i]),Number.isNaN(water[i]));if(!Number.isNaN(water[i]))assert.ok(Math.abs(t.water[i]-(77.31-89))<.006);
  assert.equal(Number.isNaN(t.lake[i]),Number.isNaN(lake[i]));
 }
 assert.throws(()=>decodeTerrain(new Uint8Array(16)),/terrain/);
});

test('ground lookup is bilinear, clamps at the edges and is flat (0) without terrain',()=>{
 setTerrain(null);assert.equal(hasTerrain(),false);assert.equal(groundAt(123,-45),0);assert.deepEqual(groundPose(5,5,1),{y:0,pitch:0,roll:0});
 setTerrain(field((x,z)=>.1*x-.05*z+3));
 for(const [x,z] of [[0,0],[1.3,-7.7],[33.1,20.9],[-79.9,79.9]])assert.ok(Math.abs(groundAt(x,z)-(.1*x-.05*z+3))<1e-4);
 assert.ok(Math.abs(groundAt(500,0)-groundAt(80,0))<1e-6,'clamped beyond the field');
 setTerrain(null);
});

test('water levelling keeps lakes dead flat and keeps the step at a dam',()=>{
 const size=60,dem=new Float32Array(size*size),mask=new Uint8Array(size*size);
 // Two basins side by side, joined at x=30: 95 m above, 77 m below, lidar noise of ±4 cm on the water.
 for(let y=10;y<50;y++)for(let x=5;x<55;x++){const i=y*size+x;mask[i]=1;dem[i]=(x<30?95:77)+(Math.sin(i*12.9898)*.04);}
 const w=levelWater(dem,mask,size,4,2);
 const upper=[],lower=[];for(let y=14;y<46;y++)for(let x=9;x<51;x++){if(x<26)upper.push(w[y*size+x]);if(x>34)lower.push(w[y*size+x]);}
 const spread=a=>Math.max(...a)-Math.min(...a);
 assert.ok(spread(upper)<.08&&spread(lower)<.08,`flat within the noise: ${spread(upper)}, ${spread(lower)}`);
 assert.ok(Math.abs(upper[0]-95)<.05&&Math.abs(lower[0]-77)<.05,'levels kept');
 assert.ok(!Number.isNaN(w[30*size+4])&&Number.isNaN(w[30*size+1]),'levels spread just onto the banks');
 // Water surfaces in the elevation model are exactly level: they stay exactly level.
 for(let i=0;i<dem.length;i++)if(mask[i])dem[i]=i%size<30?95:77;const exact=levelWater(dem,mask,size,4,0);
 for(let i=0;i<dem.length;i++)if(mask[i])assert.equal(exact[i],dem[i]);
 // Smoothing the land never touches cells it is told to keep.
 const keep=new Uint8Array(size*size).fill(1),b=blur(dem,size,2,keep);assert.deepEqual([...b],[...dem]);
});

test('lakes come from large dead-flat areas only, away from mapped land',()=>{
 const size=80,dem=new Float32Array(size*size),none=new Uint8Array(size*size),land=new Uint8Array(size*size);
 for(let i=0;i<dem.length;i++)dem[i]=100+Math.sin(i*1.7)*.3; // rough ground
 for(let y=5;y<70;y++)for(let x=5;x<60;x++)dem[y*size+x]=95.4; // a lake
 for(let y=72;y<78;y++)for(let x=70;x<78;x++)dem[y*size+x]=90; // a small flat yard
 for(let y=30;y<40;y++)for(let x=30;x<40;x++)land[y*size+x]=1; // a mapped pier
 const lake=findLakes(dem,none,land,size,{minArea:500});
 assert.ok(Math.abs(lake[20*size+20]-95.4)<1e-4);assert.ok(Number.isNaN(lake[35*size+35]),'mapped land stays land');
 assert.ok(Number.isNaN(lake[75*size+75]),'small flat areas are not lakes');assert.ok(Number.isNaN(lake[2*size+2]));
});

test('a bridge is a straight deck between its banks, not dipped into the river',()=>{
 const size=101,cell=2,extent=100,ground=new Float32Array(size*size);
 // A 30 m deep gorge along z across x∈[-40,40]; banks at 10 m.
 for(let j=0;j<size;j++)for(let i=0;i<size;i++){const x=i*cell-extent;ground[j*size+i]=Math.abs(x)<40?-20:10;}
 const chains=bridgeChains([{nodes:[1,2],points:[[-50,0],[0,0]],half:5},{nodes:[2,3],points:[[0,0],[50,0]],half:5}]);
 assert.equal(chains.length,1,'split ways are chained');
 const out=stampBridges(ground,size,cell,extent,chains),at=(x,z)=>out[Math.round((z+extent)/cell)*size+Math.round((x+extent)/cell)];
 for(const x of [-30,0,30])assert.ok(Math.abs(at(x,0)-10)<1e-6,`deck at ${x}: ${at(x,0)}`);
 assert.equal(at(0,40),-20,'the river away from the bridge stays');
});

test('streets are smoothed along their own line: unmapped dips and kerb spikes vanish, slopes stay',()=>{
 const size=101,cell=2,extent=100,ground=new Float32Array(size*size);
 for(let j=0;j<size;j++)for(let i=0;i<size;i++){const x=i*cell-extent,z=j*cell-extent;ground[j*size+i]=.06*x+(Math.abs(x-20)<5?-6:0)+(Math.abs(x+30)<2&&Math.abs(z)<3?1.5:0);}
 const out=conditionRoads(ground,ground,size,cell,extent,[[[-90,0],[90,0]]]),at=(x,z)=>out[Math.round((z+extent)/cell)*size+Math.round((x+extent)/cell)];
 for(let x=-70;x<=70;x+=2)assert.ok(Math.abs(at(x,0)-.06*x)<.6,`road at ${x}: ${at(x,0).toFixed(2)} vs ${(.06*x).toFixed(2)}`);
 assert.ok(at(20,60)<-4,'the dip away from the street is untouched');
});

test('the PNG reader decodes filtered RGB rows',async()=>{
 const zlib=await import('node:zlib'),w=3,h=2,raw=Buffer.from([1,10,20,30,11,21,31,12,22,32, 2,1,1,1,1,1,1,1,1,1]); // Sub, then Up filter
 const chunk=(t,d)=>{const l=Buffer.alloc(4);l.writeUInt32BE(d.length);return Buffer.concat([l,Buffer.from(t),d,Buffer.alloc(4)]);};
 const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(w,0);ihdr.writeUInt32BE(h,4);ihdr[8]=8;ihdr[9]=2;
 const png=Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ihdr),chunk('IDAT',zlib.deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]);
 const {rgb}=readPng(png);assert.deepEqual([...rgb],[10,20,30,21,41,61,33,63,93,11,21,31,22,42,62,34,64,94]);
});

test('draped surfaces follow the ground between their original corners; shaders can recover the layer height',()=>{
 setTerrain(field((x,z)=>Math.sin(x/9)*3+z*.05));
 const g=new THREE.PlaneGeometry(60,60);g.rotateX(-Math.PI/2);g.translate(0,.07,0);
 const d=drapeGeometry(g.toNonIndexed(),{maxEdge:3,mark:true}),p=d.attributes.position,lift=d.attributes.terrainY;
 assert.ok(p.count>100,'large triangles are split');
 for(let i=0;i<p.count;i++){const x=p.getX(i),z=p.getZ(i);assert.ok(Math.abs(p.getY(i)-(groundAt(x,z)+.07))<1e-5);assert.ok(Math.abs(p.getY(i)-lift.getX(i)-.07)<1e-5);}
 // Midpoint of every final triangle stays within 5 cm of the ground (no road sinking into the hill).
 for(let i=0;i<p.count;i+=3){const x=(p.getX(i)+p.getX(i+1)+p.getX(i+2))/3,z=(p.getZ(i)+p.getZ(i+1)+p.getZ(i+2))/3,y=(p.getY(i)+p.getY(i+1)+p.getY(i+2))/3;assert.ok(Math.abs(y-.07-groundAt(x,z))<.05);}
 const sub=subdivideGeometry(new THREE.BoxGeometry(1,1,20).toNonIndexed(),4);assert.ok(sub.attributes.position.count>36&&sub.attributes.normal);
 setTerrain(null);assert.equal(drapeGeometry(g),g,'flat cities keep their geometry');
});

test('objects sit on the ground: buildings on their lowest corner, furniture, instances and placed groups',()=>{
 setTerrain(field((x,z)=>x*.2));
 // A 10×10 m building from x=10 to 20: the downhill corner (x=10, ground 2) carries it.
 const ring=[[10,0],[20,0],[20,10],[10,10]],array=[],part={start:0,count:0};
 for(const [x,z] of ring)for(const y of [0,12])array.push(x,y,z,0,0);part.count=array.length/5;
 liftBuildings(array,[part]);assert.ok(Math.abs(part.base-2)<1e-5);assert.ok(Math.abs(Math.min(...array.filter((_,i)=>i%5===1))-2)<1e-5);
 assert.ok(Math.abs(footprintBase([ring])-2)<1e-5);
 const root=new THREE.Group(),post=new THREE.Mesh(new THREE.CylinderGeometry(.1,.1,3).translate(30,1.5,0)),inst=new THREE.InstancedMesh(new THREE.BoxGeometry(),new THREE.MeshBasicMaterial(),1),placed=new THREE.Group();
 inst.setMatrixAt(0,new THREE.Matrix4().makeTranslation(-20,0,5));placed.position.set(40,0,0);placed.add(new THREE.Mesh(new THREE.BoxGeometry()));
 const landmark=new THREE.Group();landmark.userData.building=true;landmark.add(new THREE.Mesh(new THREE.BoxGeometry(10,8,10).translate(-5,4,0)));
 root.add(post,inst,placed,landmark);settleObject(root);
 post.geometry.computeBoundingBox();assert.ok(Math.abs(post.geometry.boundingBox.min.y-6)<.03,'post foot on the ground');
 const m=new THREE.Matrix4();inst.getMatrixAt(0,m);assert.ok(Math.abs(m.elements[13]+4)<1e-5,'instance lifted');
 assert.ok(Math.abs(placed.position.y-8)<1e-5,'placed group moved as a whole');
 assert.ok(Math.abs(landmark.position.y+2)<1e-4,'landmark stands on its lowest ground');
 setTerrain(null);
});

test('lakes and mapped water keep their own flat levels',()=>{
 const size=41,lake=new Float32Array(size*size).fill(NaN),water=new Float32Array(size*size).fill(NaN);
 for(let j=0;j<20;j++)for(let i=0;i<size;i++)lake[j*size+i]=6.2;for(let j=30;j<size;j++)for(let i=0;i<10;i++)water[j*size+i]=-7.7;
 setTerrain(field(()=>0,{size,water,lake}));
 assert.equal(lakeAt(0,-30),6.199999809265137);assert.equal(lakeAt(0,30),null);assert.ok(Math.abs(waterAt(-35,35)+7.7)<1e-5);assert.equal(waterAt(30,-30),null);
 const g=createLakeGeometry({spread:1}),p=g.attributes.position;for(let i=0;i<p.count;i++)assert.ok(Math.abs(p.getY(i)-6.15)<1e-4);
 const car=makeCar(0,-10);car.heading=0;car.speed=10;const e=new SpatialIndex([]),r=driveStep(car,new Set(['KeyW']),.1,{buildings:e,roads:e,pavement:e,water:[]});assert.equal(r.collision,'water','no driving into a lake');
 setTerrain(null);
});

test('car on a slope: wheels on the ground, nose up uphill, gravity slows the climb and pulls downhill',()=>{
 const grade=.08;setTerrain(field((x,z)=>-grade*z,{size:401,cell:2})); // rises towards -z, the way a car with heading 0 faces
 const up=makeCar(0,300),flat=makeCar(0,300),down=makeCar(0,-300,Math.PI);
 assert.ok(Math.abs(up.y-groundAt(0,300))<.02);assert.ok(up.pitch>.07&&up.pitch<.09,'nose up');assert.ok(down.pitch<-.07,'nose down');assert.ok(Math.abs(up.roll)<1e-6);
 const keys=new Set(['KeyW']);for(let i=0;i<240;i++)driveStep(up,keys,1/60,flatWorld());
 setTerrain(null);for(let i=0;i<240;i++)driveStep(flat,keys,1/60,flatWorld());
 setTerrain(field((x,z)=>-grade*z,{size:401,cell:2}));
 assert.ok(up.speed<flat.speed-1,`uphill ${up.speed.toFixed(2)} < flat ${flat.speed.toFixed(2)}`);
 assert.ok(Math.abs(up.y-groundAt(up.x,up.z))<.05&&up.y>=groundAt(up.x,up.z)-1e-6,'on the ground, not clipping');
 // Coasting: downhill keeps speed longer than uphill.
 const a=makeCar(0,0),b=makeCar(0,0,Math.PI);a.speed=b.speed=12;
 for(let i=0;i<120;i++){driveStep(a,new Set(),1/60,flatWorld());driveStep(b,new Set(),1/60,flatWorld());}
 assert.ok(b.speed>a.speed+1,`downhill ${b.speed.toFixed(2)} > uphill ${a.speed.toFixed(2)}`);
 // Side slope: rolls, camera stays above the ground behind the car.
 setTerrain(field((x,z)=>.1*x,{size:201,cell:2}));const side=makeCar(0,0);assert.ok(side.roll>.09,'right side up');
 const cam=drivingCameraPose(side,0,150);assert.ok(cam.position[1]>groundAt(cam.position[0],cam.position[2])+1);assert.ok(cam.target[1]>side.y);
 setTerrain(null);
});
