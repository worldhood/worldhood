import test from 'node:test';
import assert from 'node:assert/strict';
import {clipTriangleHeight} from '../src/geometry-clipping.js';
import {provisionalWindows} from '../src/provisional-facades.js';
import {createSugarCubeFront,isSugarCubeFront} from '../src/sugar-cube.js';
import {createPalaceLife} from '../src/palace-life.js';
import {overviewCameraPose,drivingCameraPose} from '../src/driving-camera.js';
import {createForumFront,isForumFront} from '../src/forum-building.js';
import {BIND_BILLBOARDS} from '../src/bind-ads.js';
test('Forum receives physical street elevations and a large campaign panel',()=>{
 const meshes=createForumFront();assert.ok(meshes.length>0&&meshes.length<=12);
 for(const m of meshes){assert.equal(m.material.map,null);assert.ok(m.geometry.attributes.position.array.every(Number.isFinite));}
 assert.equal(isForumFront(588,{normal:{x:.601,z:.799},d:-355.24}),true);
 assert.equal(isForumFront(588,{normal:{x:.601,z:.799},d:-401.54}),false);
 const ad=BIND_BILLBOARDS.find(p=>p.ratu===588);assert.ok(ad.campaign&&ad.width*ad.height>=300);
});
test('Follow is modestly raised while High remains a separate overhead view',()=>{
 for(const zoom of [36,120,240]){const car={x:0,z:0},drive=drivingCameraPose(car,0,zoom),follow=overviewCameraPose(car,0,zoom),high=overviewCameraPose(car,0,zoom,true);assert.ok(follow.position[1]>drive.position[1]);assert.ok(follow.position[1]<=13);assert.ok(follow.position[2]<=22);assert.ok(high.position[1]>follow.position[1]*2);}
});
test('cathedral height clipping retains faces spanning both cutoffs',()=>{
 const triangles=clipTriangleHeight([[0,0,0],[12,60,0],[24,0,0]],25,40);
 assert.ok(triangles.length>=2);
 const vertices=triangles.flat();assert.ok(vertices.every(v=>v[1]>=25&&v[1]<=40));
 assert.ok(vertices.some(v=>v[1]===25));assert.ok(vertices.some(v=>v[1]===40));
 for(const [a,b,c] of triangles)assert.ok((b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])<=0);
 assert.deepEqual(clipTriangleHeight([[0,0,0],[1,1,0],[2,0,0]],25,40),[]);
});
test('interim bays stay on actual wall triangles and avoid disconnected gaps',()=>{
 const rectangle=(x0,x1)=>[{local:[[x0,0],[x1,0],[x1,14]]},{local:[[x0,0],[x1,14],[x0,14]]}];
 const face={s0:0,s1:30,y0:0,y1:14,triangles:[...rectangle(0,9),...rectangle(21,30)]};
 const windows=provisionalWindows(face);assert.ok(windows.length>0);
 assert.ok(windows.every(w=>w.x+w.w<9||w.x>21));
 assert.deepEqual(provisionalWindows({...face,triangles:[]}),[]);
 assert.deepEqual(provisionalWindows({...face,y0:4}),[]);
});
test('Sugar Cube replacement is bounded, physical and limited to designated source planes',()=>{
 const meshes=createSugarCubeFront();assert.ok(meshes.length<25);
 for(const m of meshes){assert.equal(m.material.map,null);assert.ok(m.geometry.attributes.position.array.every(Number.isFinite));m.geometry.computeBoundingBox();const b=m.geometry.boundingBox;assert.ok(b.min.x>315&&b.max.x<390&&b.min.z>210&&b.max.z<280);}
 assert.equal(isSugarCubeFront(1707,{normal:{x:-.832,z:-.555},d:-402.47}),true);
 assert.equal(isSugarCubeFront(1707,{normal:{x:-.832,z:-.555},d:-380}),false);
 assert.equal(isSugarCubeFront(23,{normal:{x:-.832,z:-.555},d:-402.47}),false);
});
test('palace has two sentries and an explicitly fictional animated couple',()=>{
 const life=createPalaceLife();assert.equal(life.group.userData.guards,2);assert.equal(life.group.userData.balconyFigures,2);assert.equal(life.group.userData.fictional,true);
 life.update(1,{x:224,z:228});assert.equal(life.group.visible,true);
 life.group.traverse(m=>{if(m.isMesh)assert.ok(m.geometry.attributes.position.array.every(Number.isFinite));});
 life.update(2,{x:10000,z:10000});assert.equal(life.group.visible,false);
});
