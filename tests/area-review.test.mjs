import test from 'node:test';
import assert from 'node:assert/strict';
import {inventory,featureEvidence,questionsFor,reviewState,verdict,NEXT_STEP} from '../scripts/area-review.mjs';

const square=(x,z,s)=>[[[x,z],[x+s,z],[x+s,z+s],[x,z+s],[x,z]]];
const data={
 city:{buildings:[{ratu:7,address:'Mannerheimintie 30',bbox:[0,0,20,20]}],
  roads:[{name:'Mannerheimintie',kind:'Ajorata',material:'Asfaltti',bbox:[-50,-5,50,5],rings:square(-50,-5,10)}],
  pavement:[{name:'Seurasaaren silta',kind:'Kevyt liikenne (Silta)',material:'Puu',bbox:[100,0,110,60],rings:square(100,0,10)}],
  parks:[],water:[],trees:[{p:[5,5]},{p:[6,6],inferred:true}]},
 buildings:{tiles:[{parts:[{id:'A',ratu:7,bbox:[0,0,20,20],height:37,texture:null},{id:'B',ratu:8,bbox:[30,30,40,40],height:12,texture:'t.jpg'}]}]},
 mobility:{signals:[{p:[1,1]}],walks:{edges:[{crossing:true,points:[[2,2],[3,3]]}]}},
 trams:{paths:[{line:'4',points:[[0,0],[10,0]]}]}
};
test('inventory reports what the game holds around a point',()=>{
 const inv=inventory(data,10,10,60);
 assert.equal(inv.buildings.measured3d,2);assert.equal(inv.buildings.plainShell,1);
 assert.equal(inv.buildings.largest[0].address,'Mannerheimintie 30');
 assert.deepEqual(inv.trams.linesRunningHere,['4']);assert.equal(inv.trees.registered,1);assert.equal(inv.trees.inferred,1);
 assert.equal(inv.trafficSignals,1);assert.equal(inv.pedestrianCrossings,1);
});
test('landmark evidence names the building and surfaces at its real position',()=>{
 const e=featureEvidence(data,[[10,10]]);
 assert.equal(e.measuredBuildingsAtThisPosition[0].photoTexture,false);assert.equal(e.measuredBuildingsAtThisPosition[0].heightMetres,37);
 assert.match(featureEvidence(data,[[105,30]]).mappedSurfacesAtThisPosition[0],/Silta.*Puu/);
 assert.equal(featureEvidence(data,[[900,900]]),'Nothing at this position in the game.');
 assert.match(featureEvidence(data,[]),/No fixed position/);
});
test('questions are typed, bounded and carry each landmark with its evidence',()=>{
 const q=questionsFor([{name:'Parliament House',evidence:{x:1}}]);
 assert.deepEqual(Object.keys(q),['recognisable','demo_ready','next_step','missing_0']);
 assert.equal(q.recognisable.criteria.length,4);assert.deepEqual(Object.keys(q.next_step.criteria),Object.keys(NEXT_STEP));
 assert.equal(q.missing_0.instructions.game_evidence_at_its_real_position.x,1);
 assert.equal(reviewState({title:'T'},{name:'P'},{}).reference_observations.startsWith('No street-level'),true);
});
const answers=(ready,score,conf,missing=[])=>({demo_ready:{noul:ready},recognisable:{score,confidence:conf},next_step:{choice:'none',confidence:.9},...Object.fromEntries(missing.map((m,i)=>[`missing_${i}`,{noul:m}]))});
test('sign-off policy: confident and complete passes, borderline goes to a person, gaps block',()=>{
 const must=[{name:'Bridge',mustHave:true}];
 assert.equal(verdict(answers(.9,2.4,.7,[.1]),must).status,'signed-off');
 assert.equal(verdict(answers(.9,2.4,.7,[.8]),must).status,'needs-work');
 assert.equal(verdict(answers(.6,2.4,.7,[.1]),must).status,'human-review');
 assert.equal(verdict(answers(.9,2.4,.3,[.1]),must).status,'needs-work');
 assert.deepEqual(verdict(answers(.2,1,.5,[.8]),must).missing.map(m=>m.name),['Bridge']);
});
