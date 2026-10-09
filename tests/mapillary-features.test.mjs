import test from 'node:test';
import assert from 'node:assert/strict';
import {classify,localFrame,yawFromBearing,projectFeatures,qualityFilter,mergeDuplicates,signPosts,surfaceIndex,snapOffCarriageway,placeItems,dedupeExisting,buildFurnitureLayer,cellsFor,facingOf}
 from '../scripts/mapillary-features.mjs';
import {signFace,PLATE_SIZE} from '../src/sign-faces.js';

const ORIGIN=[23.76163,61.4978],frame=localFrame(ORIGIN);
const YEAR=365.25*864e5,t=y=>Date.UTC(y,5,1);
const item=(kind,x,z,extra={})=>({id:extra.id||`${kind}-${x}-${z}`,value:extra.value||{lamp:'object--street-light',sign:'object--traffic-sign--front',bin:'object--trash-can','traffic-light':'object--traffic-light--general-upright'}[kind]||kind,kind,x,z,first:t(2022),last:t(2022),images:4,dir:null,cam:null,...extra});
// A 20 m wide east-west carriageway (z −10…10) with a building to the north and pavement either side.
const square=(x0,z0,x1,z1)=>[[[x0,z0],[x1,z0],[x1,z1],[x0,z1],[x0,z0]]];
const city={roads:[{kind:'Ajorata',rings:square(-100,-10,100,10)},{kind:'Pysäköintialue',rings:square(-100,30,-60,60)}],buildings:[{rings:square(-20,-40,20,-20)}],pavement:[{kind:'Jalkakäytävä',rings:square(-100,-20,100,-10)}],trees:[]};

test('detections are classified into hittable furniture, flat things and ignored things',()=>{
 assert.equal(classify('object--street-light'),'lamp');
 assert.equal(classify('object--traffic-light--pedestrians'),'crossing-light');
 assert.equal(classify('object--traffic-light--general-upright'),'traffic-light');
 assert.equal(classify('regulatory--no-parking--g1'),'sign');
 assert.equal(classify('object--traffic-sign--back'),'sign');
 assert.equal(classify('object--trash-can'),'bin');
 assert.equal(classify('object--junction-box'),'junction-box');
 assert.equal(classify('construction--barrier--temporary'),'barrier');
 assert.equal(classify('object--manhole'),'flat');
 assert.equal(classify('marking--discrete--crosswalk-zebra'),'flat');
 assert.equal(classify('object--sign--store'),null);
 assert.equal(classify('object--banner'),null);
});

test('projection matches the city build frame: origin at 0,0, x east, z south, metres',()=>{
 assert.deepEqual(frame.local(...ORIGIN),[0,0]);
 const [x,z]=frame.local(ORIGIN[0],ORIGIN[1]+.001);assert.ok(Math.abs(x)<.01);assert.ok(Math.abs(z+111.3)<.5,`north is −z (${z})`);
 const [e]=frame.local(ORIGIN[0]+.002,ORIGIN[1]);assert.ok(Math.abs(e-106.4)<1,`east is +x (${e})`);
 const [lon,lat]=frame.lonLat(50,-80),back=frame.local(lon,lat);assert.ok(Math.abs(back[0]-50)<.02&&Math.abs(back[1]+80)<.02,'round trip');
 const [p]=projectFeatures([{id:1,object_value:'object--street-light',geometry:{type:'Point',coordinates:[ORIGIN[0],ORIGIN[1]+.001]},first_seen_at:'2021-09-25T07:25:46+0000',last_seen_at:'2022-01-02T00:00:00+0000',aligned_direction:90,images:{data:[{geometry:{type:'Point',coordinates:ORIGIN}},{geometry:{type:'Point',coordinates:ORIGIN}}]}}],frame.local);
 assert.equal(p.kind,'lamp');assert.equal(p.images,2);assert.equal(new Date(p.last).getUTCFullYear(),2022);assert.deepEqual(p.cam,[0,0]);
});

test('facing: aligned_direction is the compass bearing the face looks towards',()=>{
 const close=(a,b)=>Math.abs(Math.atan2(Math.sin(a-b),Math.cos(a-b)))<1e-9;
 assert.ok(close(yawFromBearing(0),Math.PI),'north-facing plate: normal (0,−1)');
 assert.ok(close(yawFromBearing(90),Math.PI/2),'east-facing plate: normal (1,0)');
 assert.ok(close(facingOf({value:'object--traffic-sign--back',dir:90}),-Math.PI/2),'a sign seen from the back faces the other way');
 assert.ok(close(facingOf({value:'x',dir:null,cam:[0,10],x:0,z:0}),0),'without a bearing it faces the cameras');
});

test('quality: few photos, very old, temporary and recaptured-but-gone detections are dropped',()=>{
 const keep=item('lamp',0,0),few=item('lamp',50,0,{images:1}),old=item('lamp',100,0,{last:t(2012)}),barrier=item('barrier',150,0,{value:'construction--barrier--temporary',last:t(2021)});
 const stale=item('lamp',200,0,{last:t(2017)}),newer=[1,2,3,4,5].map(i=>item('flat',200+i,0,{value:'marking--discrete--stop-line',last:t(2023)}));
 const {kept,dropped}=qualityFilter([keep,few,old,barrier,stale],[keep,few,old,barrier,stale,...newer]);
 assert.deepEqual(kept.map(k=>k.id),[keep.id]);
 assert.deepEqual(dropped,{fewImages:1,old:1,stale:1,temporary:1});
 // Unrecaptured spots keep their old detections.
 assert.equal(qualityFilter([stale],[stale]).kept.length,1);
});

test('two detector pipelines reporting one lamp become one object with both ids',()=>{
 const {kept,merged}=mergeDuplicates([item('lamp',0,0,{id:'a',images:3}),item('lamp',1.5,.5,{id:'b',images:7}),item('lamp',8,0,{id:'c'}),
  item('sign',20,0,{id:'s1',value:'regulatory--no-parking--g1'}),item('sign',20.3,0,{id:'s2',value:'regulatory--keep-right--g1'})]);
 assert.equal(merged,1);
 const lamp=kept.find(k=>k.mly.includes('a'));assert.deepEqual(lamp.mly,['b','a'],'best-evidenced detection keeps its position');assert.equal(lamp.x,1.5);
 assert.equal(kept.filter(k=>k.kind==='sign').length,2,'different sign codes are different signs');
});

test('sign posts: plates within 1.5 m share a post, complementary plates hang lowest, untyped detections fold in',()=>{
 const signs=[item('sign',0,0,{value:'complementary--texts-two-lines--g1',dir:0,mly:['c']}),item('sign',.4,0,{value:'regulatory--no-parking--g1',dir:0,mly:['p']}),
  item('sign',.2,.3,{value:'regulatory--no-parking--g1',dir:180,mly:['q']}),item('sign',1.8,0,{value:'object--traffic-sign--front',mly:['g']}),item('sign',30,0,{value:'object--traffic-sign--front',dir:90,mly:['h']})]
  .map(s=>({...s,mly:s.mly}));
 const {posts,absorbed}=signPosts(signs);
 assert.equal(posts.length,2);assert.equal(absorbed,1);
 const [post,generic]=posts;
 assert.deepEqual(post.plates.map(p=>p.face),['no-parking','no-parking','complementary-text']);
 assert.notEqual(post.plates[0].yaw,post.plates[1].yaw,'back-to-back plates keep their own facing');
 assert.deepEqual(post.mly.sort(),['c','g','p','q']);
 assert.equal(generic.plates[0].face,'generic-plate');
});

test('Finnish sign faces for the common Mapillary codes, family-shaped plates for the rest',()=>{
 assert.deepEqual([signFace('regulatory--no-parking--g1').face,signFace('regulatory--no-parking--g1').shape],['no-parking','circle']);
 assert.equal(signFace('regulatory--keep-right--g1').style,'arrow');
 assert.deepEqual([signFace('information--pedestrians-crossing--g1').face,signFace('information--pedestrians-crossing--g1').shape],['pedestrians-crossing','square']);
 assert.deepEqual([signFace('regulatory--maximum-speed-limit-40--g1').face,signFace('regulatory--maximum-speed-limit-40--g1').text],['speed-40','40']);
 assert.equal(signFace('regulatory--yield--g1').shape,'triangle-down');
 assert.equal(signFace('warning--roadworks--g1').shape,'triangle');
 const unknown=signFace('warning--slippery-road-surface--g1');assert.deepEqual([unknown.face,unknown.shape,unknown.known],['generic-warning','triangle',false]);
 assert.equal(signFace('regulatory--something-new--g3').shape,'circle');
 assert.equal(signFace('complementary--texts-three-lines--g1').shape,'small');
 for(const code of ['regulatory--stop--g1','information--general-directions--g1','complementary--chevron-left--g1'])assert.ok(PLATE_SIZE[signFace(code).shape],code);
});

test('carriageway snapping: kerbside items move to the pavement edge, mid-road and in-building ones are dropped',()=>{
 const surfaces=surfaceIndex(city);
 const p=snapOffCarriageway(10,-9.2,surfaces);assert.ok(p,'near the kerb');assert.ok(p.z<-10&&p.z>-11,`just onto the pavement (${p.z})`);assert.ok(p.moved>.8&&p.moved<1.6);
 assert.equal(snapOffCarriageway(10,0,surfaces),null,'10 m from either kerb: a lamp hung over the road');
 const {placed,dropped,snapped}=placeItems([item('lamp',10,-9.2),item('lamp',10,0),item('lamp',0,-30),item('lamp',-80,40),item('lamp',500,-15)],surfaces,{radius:300});
 assert.deepEqual(dropped,{outside:1,building:1,carriageway:1});assert.equal(snapped,1);
 assert.deepEqual(placed.map(p=>[Math.abs(p.x-10)<1.5||p.x,p.z<-10]),[[true,true],[-80,false]],'parking areas are not carriageway');
 // Traffic lanes count as carriageway even where no road polygon was mapped.
 const lanes=surfaceIndex({roads:[],buildings:[]},{roads:{edges:[{points:[[-50,100],[50,100]],lane:0}]}});
 assert.ok(lanes.carriageway.at(0,100.8));assert.ok(!lanes.carriageway.at(0,102));
});

test('doubles of objects the city already places are dropped; a detection inside a tree trunk too',()=>{
 const existing=[{kind:'traffic-light',x:0,z:0,source:'osm-signal'},{kind:'tree',x:50,z:0}];
 const {kept,dropped}=dedupeExisting([item('traffic-light',4,3),item('crossing-light',6,0),item('traffic-light',30,0),item('lamp',50.3,0),item('lamp',3,0)],existing);
 assert.deepEqual(dropped,{duplicate:2,clash:1});
 assert.deepEqual(kept.map(k=>k.x),[30,3],'a lamp beside a signal post is not a double');
});

test('end to end: features in, furniture.json items with provenance out',()=>{
 const at=(x,z)=>frame.lonLat(x,z),f=(id,value,x,z,extra={})=>({id,object_value:value,geometry:{type:'Point',coordinates:at(x,z)},first_seen_at:'2022-05-01T10:00:00+0000',last_seen_at:'2022-05-01T10:00:00+0000',aligned_direction:0,images:{data:[1,2,3].map(()=>({geometry:{type:'Point',coordinates:at(x,z-5)}}))},...extra});
 const features=[f('1','object--street-light',10,-11),f('2','object--street-light',10.8,-11.4),f('3','regulatory--no-parking--g1',-30,-12),f('4','object--traffic-sign--front',-29,-12),
  f('5','object--manhole',0,0),f('6','object--sign--store',0,-15),f('7','object--trash-can',40,-9.5),f('8','object--street-light',0,0),f('9','object--junction-box',60,-14)];
 const {items,counts,faces}=buildFurnitureLayer(features,{local:frame.local,city,existing:[],radius:1000});
 assert.equal(counts.fetched,9);assert.equal(counts.flat,1);assert.equal(counts.ignored,1);assert.equal(counts.mergedDetections,1);assert.equal(counts.placement.carriageway,1);
 assert.deepEqual(items.map(i=>i.k).sort(),['bin','junction-box','lamp','sign']);
 const lamp=items.find(i=>i.k==='lamp');assert.deepEqual(lamp.mly.sort(),['1','2']);assert.equal(lamp.src,'mapillary');
 assert.ok(Math.abs(lamp.yaw)<.01,'lamp arm reaches south over the road');
 const sign=items.find(i=>i.k==='sign');assert.deepEqual(sign.faces,['no-parking']);assert.deepEqual(sign.mly.sort(),['3','4']);
 assert.deepEqual(faces,[{face:'no-parking',code:'regulatory--no-parking'}]);
 const bin=items.find(i=>i.k==='bin');assert.ok(bin.z<-10&&bin.moved,'bin on the road edge was moved onto the pavement');
});

test('fetch tiling covers the box with small cells',()=>{
 const cells=cellsFor([23.7,61.4,23.71,61.405]);
 assert.equal(cells.length,Math.ceil(.01/.003)*Math.ceil(.005/.0015));
 assert.ok(cells.every(([w,s,e,n])=>e>w&&n>s&&e-w<=.0030001&&n-s<=.0015001));
 assert.equal(Math.max(...cells.map(c=>c[2])),23.71);assert.equal(Math.max(...cells.map(c=>c[3])),61.405);
});
