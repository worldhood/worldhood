import test from 'node:test';
import assert from 'node:assert/strict';
import {keepWay,passage,underground,collisionFootprints,carriagewayIntrusions,intrusions,polygonArea} from '../scripts/city-footprints.mjs';
import {SpatialIndex,bounds,collisionBuildings} from '../src/geo.js';

const box=(x0,z0,x1,z1)=>[[x0,z0],[x1,z0],[x1,z1],[x0,z1],[x0,z0]];
const item=(id,ring,extra={})=>({id,rings:[ring],bbox:bounds([ring]),...extra});
const solidAfter=(buildings,options)=>{const {collision,stats}=collisionFootprints(buildings,options),list=collisionBuildings({buildings,collision});return {collision,stats,list,solid:new SpatialIndex(list)};};

test('building passages and covered streets are kept at ground level; tunnels below it are dropped',()=>{
 const kept=[{highway:'service',tunnel:'building_passage'},{highway:'footway',covered:'yes'},{highway:'footway',covered:'arcade'},{highway:'living_street',tunnel:'building_passage',layer:'0'},{highway:'residential'},{highway:'service',tunnel:'no',covered:'no'},{highway:'service',covered:'yes',layer:'-1'}];
 const dropped=[{highway:'trunk',tunnel:'yes',layer:'-2'},{highway:'service',tunnel:'yes'},{highway:'footway',tunnel:'yes',covered:'yes'},{highway:'service',tunnel:'building_passage',layer:'-1'},{highway:'proposed'},{highway:'pedestrian',area:'yes'}];
 for(const t of kept)assert.ok(keepWay(t),JSON.stringify(t));
 for(const t of dropped)assert.ok(!keepWay(t),JSON.stringify(t));
 assert.ok(passage({tunnel:'building_passage'})&&passage({covered:'yes'})&&!passage({highway:'residential'})&&!passage({tunnel:'yes'}));
 assert.ok(!passage({covered:'yes',layer:'-1'})&&!passage({covered:'yes',location:'underground'}),'a covered way below ground cuts no building above');
 assert.ok(underground({layer:'-1'})&&!underground({layer:'1'})&&!underground({}));
});

test('a passage is cut through the collision footprint; the rest of the building still collides',()=>{
 const house=item('house',box(0,0,20,10)),lane=item('lane',box(8,-5,12,15));
 const {collision,stats,list,solid}=solidAfter([house],{passages:[lane]});
 assert.equal(stats.passagesCut,1);assert.equal(list.length,2,'the passage splits the block in two');
 assert.deepEqual(collision.replaced,['house']);assert.ok(list.every(b=>b.id==='house'));
 assert.ok(!solid.at(10,5),'the car drives through the passage');assert.ok(!solid.at(9,2)&&!solid.at(11,8));
 assert.ok(solid.at(4,5)&&solid.at(16,5),'both halves stay solid');
 assert.equal(house.rings[0].length,5,'the mapped footprint (3D building) is untouched');
});

test('footprints reaching shallowly onto the carriageway are trimmed to the kerb, real buildings stay solid',()=>{
 const street=item('street',box(-50,10,50,20),{kind:'Ajorata'});
 const overhang=item('overhang',box(0,0,10,11.5)),apart=item('apart',box(20,0,30,9.5));
 const kiosk=item('kiosk',box(-30,12,-27,15)),bridge=item('bridge',box(-10,5,-5,25));
 const before=carriagewayIntrusions([overhang,apart,kiosk,bridge],[street]);
 assert.equal(before.buildings,3);assert.equal(before.max,5);
 assert.deepEqual(intrusions(overhang.rings,[street]).map(p=>[+p.area.toFixed(2),+p.depth.toFixed(2)]),[[15,1.5]]);
 const {collision,list:buildings,stats,solid}=solidAfter([overhang,apart,kiosk,bridge],{roads:[street],maxDepth:3});
 assert.deepEqual(collision.replaced,['overhang'],'only the trimmed building is stored again');
 assert.ok(!solid.at(5,10.8),'no invisible wall on the street');assert.ok(solid.at(5,9.5)&&solid.at(5,1),'the building behind the kerb still blocks');
 assert.ok(solid.at(25,5),'a building clear of the street is unchanged');assert.equal(buildings.find(b=>b.id==='apart'),apart);
 assert.ok(solid.at(-28.5,13.5),'a kiosk standing on the street (mostly on it) stays whole');
 assert.ok(solid.at(-7.5,15),'a building reaching deep across the street is a real obstacle and stays');
 assert.equal(stats.trimmed,1);assert.equal(stats.kept,2);
 assert.equal(carriagewayIntrusions(buildings.filter(b=>b.id==='overhang'),[street]).buildings,0);
 assert.ok(Math.abs(polygonArea(buildings.find(b=>b.id==='overhang').rings)-100)<.01);
});

test('collision pieces replace every part of a trimmed building, drawn footprints stay as mapped',()=>{
 const a=item('rel',box(0,0,10,11.5)),b=item('rel',box(30,0,40,5)),other=item('other',box(60,0,70,5)),street=item('street',box(-50,10,80,20));
 const city={buildings:[a,b,other],collision:collisionFootprints([a,b,other],{roads:[street]}).collision};
 assert.equal(collisionBuildings({buildings:city.buildings}),city.buildings,'a city without collision data collides with its footprints');
 const list=collisionBuildings(city);assert.equal(list.length,3);
 assert.ok(list.includes(b)&&list.includes(other),'the untouched outer of the same relation is kept once');
 assert.ok(!new SpatialIndex(list).at(5,11)&&new SpatialIndex(city.buildings).at(5,11));
 assert.equal(collisionBuildings({buildings:[a],collision:{replaced:['rel'],buildings:[]}}).length,0,'a building cut away entirely no longer collides');
});
