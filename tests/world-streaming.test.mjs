import test from 'node:test';
import assert from 'node:assert/strict';
import {SpatialIndex,insidePlayable,clearPlayableAreas} from '../src/geo.js';
import {mergeGraph,applyExtensions,activateExtension} from '../src/extensions.js';
import {prepareGraph,Mobility} from '../src/mobility.js';
import {PoliceSimulation} from '../src/police.js';
const rectangle=(x,z,w=10,h=10,kind='Ajorata')=>({kind,rings:[[[x,z],[x+w,z],[x+w,z+h],[x,z+h],[x,z]]]});
const graph=(a,b,signal=-1)=>({nodes:[a,b],edges:[{from:0,to:1,points:[a,b],lane:1.5,signal}]});
const emptyGraph=()=>({nodes:[],edges:[]});
const city=()=>({buildings:[],roads:[],pavement:[],parks:[],water:[],trees:[]});

test('spatial index appends collision polygons without replacing or duplicating original entries',()=>{
 const a=rectangle(0,0),b=rectangle(100,100),index=new SpatialIndex([a]);const cells=index.cells;index.add([b,a,b]);
 assert.equal(index.cells,cells);assert.equal(index.at(5,5),a);assert.equal(index.at(105,105),b);assert.equal(index.near(105,105).filter(x=>x===b).length,1);b.disabled=true;assert.equal(index.at(105,105),undefined);
});

test('prepared graph seams work near any city origin and keep existing route references and IDs',()=>{
 const base=prepareGraph(graph([0,0],[100,0])),edge=base.edges[0],outgoing=base.outgoing[0],points=edge.points;
 const ids=mergeGraph(base,graph([100.3,.1],[200,0],0),7);
 assert.deepEqual(ids,[1,2]);assert.equal(base.edges[0],edge);assert.equal(edge.points,points);assert.equal(base.outgoing[0],outgoing);assert.equal(edge.id,0);assert.equal(base.edges[1].id,1);assert.equal(base.edges[1].signal,7);assert.equal(base.outgoing[1][0],base.edges[1]);assert.ok(base.edges[1].length>99);assert.equal(base.outgoing.length,base.nodes.length);
});

test('an outer region loaded before its connector joins both already loaded graph ends',()=>{
 const base=prepareGraph(graph([0,0],[100,0]));mergeGraph(base,graph([300,0],[400,0]));const original=base.edges.slice();
 mergeGraph(base,graph([100.1,0],[300.2,0]));assert.equal(base.nodes.length,4);assert.equal(base.outgoing[1][0].to,2);assert.equal(base.outgoing[2][0],original[1]);assert.deepEqual(base.edges.slice(0,2),original);
});

test('live install preserves taken cars, people, police and collision index references, then opens the area explicitly',()=>{
 clearPlayableAreas();const data=city(),world={buildings:new SpatialIndex([]),cameraBuildings:new SpatialIndex([]),roads:new SpatialIndex([]),pavement:new SpatialIndex([]),trafficForbidden:new SpatialIndex([]),water:data.water};world.sightBuildings=world.cameraBuildings;
 const raw={roads:graph([0,0],[100,0]),walks:graph([0,5],[100,5]),signals:[]},mobility=new Mobility(raw,world,{cars:1,people:1,corridor:x=>x>100}),police=new PoliceSimulation(mobility.roads,world);
 const actor=mobility.cars[0],pedestrian=mobility.people[0],oldEdge=mobility.roads.edges[0];Object.assign(actor,{edge:oldEdge,s:20,playerTaken:true,plan:[oldEdge],knocked:true});Object.assign(pedestrian,{edge:mobility.walks.edges[0],s:10,conversationUntil:12});
 const unit={id:'patrol',edge:oldEdge,s:5};police.units.push(unit);police.heat=12;police.costs=[5,0];police.target={edge:oldEdge,s:0};police.time=3;police.contacts.set('vehicle:taken',2);
 const extension={id:'future-city',city:city(),buildings:{tiles:[{file:'new.bin'}],buildings:1},surfaces:[{file:'surface.bin',bbox:[100,0,200,10]}],mobility:{roads:graph([100,0],[200,0]),walks:graph([100,5],[200,5]),signals:[]},mapBounds:[100,0,5000,100],playable:[rectangle(4500,0).rings]};
 const building=rectangle(150,30);extension.city.buildings.push(building);extension.city.roads.push(rectangle(100,-5,100,10),rectangle(130,-3,2,2,'Koroke'));extension.city.pavement.push(rectangle(100,6,100,3));extension.city.water.push(rectangle(220,0));
 const roofIndex={tiles:[],buildings:0},surfaceIndex=[],options={data,roofIndex,surfaceIndex,mobility,world,police,activate:false},index=world.buildings;
 applyExtensions([extension],options);applyExtensions([extension],options);
 assert.equal(world.buildings,index);assert.equal(index.at(155,35),building);assert.equal(world.cameraBuildings.at(155,35),building);assert.equal(world.cameraBuildings.near(155,35).filter(x=>x===building).length,1);assert.equal(world.water.length,1);assert.equal(data.buildings.length,1);assert.equal(roofIndex.tiles.length,1);assert.equal(surfaceIndex.length,1);
 assert.equal(mobility.roads.edges.length,2);assert.equal(mobility.cars[0],actor);assert.equal(actor.edge,oldEdge);assert.equal(actor.plan[0],oldEdge);assert.equal(actor.playerTaken,true);assert.equal(actor.knocked,true);assert.equal(pedestrian.s,10);assert.equal(pedestrian.conversationUntil,12);assert.equal(mobility.corridorEdges.length,1);
 assert.equal(police.heat,12);assert.equal(police.units[0],unit);assert.equal(police.time,3);assert.equal(police.contacts.get('vehicle:taken'),2);assert.equal(police.incoming[2][0],mobility.roads.edges[1]);assert.deepEqual(police.costs,[]);assert.equal(police.target,null);
 assert.equal(insidePlayable(4505,5),false);activateExtension(extension);assert.equal(insidePlayable(4505,5),true);clearPlayableAreas();
});

test('repeated graph appends recompute signals from mapped IDs and refresh attached transit paths',()=>{
 const world={roads:{at:()=>true},buildings:{at:()=>false}},raw={roads:graph([0,0],[0,-50],0),walks:emptyGraph(),signals:[{p:[0,-50]}]},m=new Mobility(structuredClone(raw),world,{cars:0,people:0});
 const first=m.roads.edges[0],originalSignal=first.signal,paths=[];let busBindings=0;m.attachTrams({paths});m.attachBuses({paths,keepBaysClear(){busBindings++;}});
 m.appendRegion({roads:graph([0,-50],[0,-120],0),walks:emptyGraph(),signals:[{p:[0,-120]}]});m.appendRegion({roads:graph([0,-120],[0,-190],0),walks:emptyGraph(),signals:[{p:[0,-190]}]});
 assert.equal(first.signal,originalSignal);assert.equal(first.mappedSignal,0);assert.deepEqual(m.roads.edges.map(e=>e.mappedSignal),[0,1,2]);assert.equal(m.signalControl.axes.length,3);assert.equal(busBindings,3);assert.equal(m.roads.edges[2].signal,2);
});
