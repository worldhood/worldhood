import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Scene} from 'three';
import {policeConfig,POLICE_DEFAULTS,mergeColours,beaconShades,tramMarks,cityLiveries} from '../src/city-liveries.js';
import {setPoliceLivery,policeLivery,createPoliceBody,POLICE_BLUE,POLICE_LIME,POLICE_WHITE} from '../src/police-model.js';
import {createPoliceRenderer} from '../src/police-renderer.js';
import {setPoliceUniform,POLICE_UNIFORM} from '../src/person-model.js';
import {officerLook} from '../src/roadblock.js';
import {setBusLivery,BUS_COLOURS} from '../src/bus-renderer.js';
import {setTramLivery,ARTIC_COLOURS} from '../src/tram-model.js';

// Canvas stand-in that records the text drawn into the livery atlas.
function withDocument(run){
 const drawn=[],ctx=new Proxy({},{get:(t,k)=>k==='fillText'?s=>drawn.push(s):k==='measureText'?s=>({width:String(s).length*10}):k==='createRadialGradient'?()=>({addColorStop(){}}):()=>{},set:()=>true});
 const original=globalThis.document;globalThis.document={createElement:()=>({getContext:()=>ctx})};
 try{return run(drawn);}finally{if(original===undefined)delete globalThis.document;else globalThis.document=original;}
}

test('police config defaults are the Finnish Poliisi values Helsinki, Espoo and Tampere use',()=>{
 const p=policeConfig();
 assert.equal(p.label,'POLIISI');assert.equal(p.website,'www.poliisi.fi');assert.equal(p.emergency,'112');assert.equal(p.emblem,true);assert.equal(p.siren,'wail-yelp');
 assert.deepEqual(p.car,{body:POLICE_WHITE,band:POLICE_BLUE,accent:POLICE_LIME,lettering:POLICE_WHITE,bar:'#2448a6'});
 assert.deepEqual(p.uniform,{jacket:'#1b2436',trousers:'#1a2232',vest:'#d4e03c',reflective:'#c8ccd0'});
 assert.deepEqual(p.lights,['#1f5cff','#1f5cff']);
 assert.deepEqual(policeConfig(p),p,'resolving twice changes nothing');
 const registry=JSON.parse(readFileSync('public/cities/index.json','utf8'));
 for(const city of registry.cities)assert.equal(cityLiveries(city).police.label,city.id.startsWith('copenhagen')?'POLITI':'POLIISI',`${city.id} keeps its own police`);
});

test('a city overrides police text, colours, beacons and siren; bad values fall back',()=>{
 const p=policeConfig({label:' POLICE ',emergency:'999',siren:'hi-lo',car:{band:'#123456',accent:'yellow',wheel:'#000000'},lights:['#ff2020','#1f5cff'],uniform:{vest:'#abcdef'}});
 assert.equal(p.label,'POLICE');assert.equal(p.emergency,'999');assert.equal(p.siren,'hi-lo');
 assert.equal(p.website,'','another country does not inherit the Finnish web address');assert.equal(p.emblem,false,'nor the Finnish-style badge');
 assert.equal(p.car.band,'#123456');assert.equal(p.car.accent,POLICE_DEFAULTS.car.accent,'non-hex colour ignored');assert.equal(p.car.wheel,undefined,'unknown key ignored');
 assert.deepEqual(p.lights,['#ff2020','#1f5cff']);assert.equal(p.uniform.vest,'#abcdef');assert.equal(p.uniform.jacket,POLICE_DEFAULTS.uniform.jacket);
 assert.deepEqual(policeConfig({lights:'#ff0000'}).lights,['#ff0000','#ff0000'],'one colour lights both sides');
 assert.equal(policeConfig({siren:'klaxon',label:''}).siren,'wail-yelp');assert.equal(policeConfig({label:''}).label,'POLIISI');
 assert.equal(policeConfig({label:'X'.repeat(40)}).label,'POLIISI','overlong label rejected');
 assert.equal(policeConfig({label:'POLITIE',emblem:true,website:'politie.example'}).emblem,true);
 assert.equal(policeConfig('nonsense').label,'POLIISI');
});

test('beacon shades: the default blue keeps its tuned shades, other colours derive theirs',()=>{
 assert.deepEqual(beaconShades('#1f5cff'),{lens:'#2a52b8',flash:'#1f5cff',halo:'#3f86ff',pool:'#2a62ff'});
 const red=beaconShades('#FF2020');assert.equal(red.flash,'#ff2020');assert.equal(red.pool,'#ff2020');
 assert.ok(parseInt(red.lens.slice(1,3),16)<255&&parseInt(red.halo.slice(5,7),16)>0x20,'dimmer lens, whiter halo');
});

test('police cars, beacons and siren follow the city config; Finnish atlas text by default',()=>withDocument(drawn=>{
 try{
  createPoliceBody('van');
  assert.ok(drawn.includes('POLIISI')&&drawn.includes('www.poliisi.fi')&&drawn.includes('112'));
  drawn.length=0;setPoliceLivery({label:'POLIZEI',emergency:'110',car:{band:'#2c6e3f',bar:'#0f3fd0'},lights:['#ff2020','#2040ff'],siren:'hi-lo'});
  const van=createPoliceBody('van');
  assert.ok(drawn.includes('POLIZEI')&&drawn.includes('110'));assert.ok(!drawn.includes('POLIISI')&&!drawn.includes('www.poliisi.fi'));
  assert.equal(van.userData.numberColour,'#2c6e3f');assert.equal(van.getObjectByName('blue').material.color.getHexString(),'0f3fd0');
  const scene=new Scene(),sim={units:[{id:'police-0',x:0,z:0,heading:0,speed:0}],time:0,player:{x:0,z:5}};
  createPoliceRenderer(scene,sim).update(1/60);const car=scene.children[0];
  assert.equal(car.userData.policeLights[0].material.emissive.getHexString(),'ff2020');assert.equal(car.userData.policeLights[2].material.emissive.getHexString(),'2040ff');
  assert.equal(policeLivery().siren,'hi-lo');
 }finally{setPoliceLivery();}
 assert.equal(policeLivery().label,'POLIISI');
}));

test('uniforms carry the city label and colours; officers dress to match',()=>{
 try{
  assert.equal(officerLook(1).shirt,'#1b2436');
  const u=setPoliceUniform(policeConfig({label:'POLICE',uniform:{jacket:'#101820',vest:'#e0e020'}}));
  assert.equal(u.text,'POLICE');assert.equal(u.navy,'#101820');assert.equal(u.vest,'#e0e020');assert.equal(u.trousers,'#1a2232');
  const jacket=officerLook(1),vest=officerLook(2,true);
  assert.equal(jacket.shirt,'#101820');assert.equal(jacket.hat,'#101820');assert.equal(jacket.uniform,'jacket');assert.equal(vest.uniform,'vest');
 }finally{setPoliceUniform(policeConfig());}
 assert.equal(POLICE_UNIFORM.text,'POLIISI');assert.equal(POLICE_UNIFORM.navy,'#1b2436');
});

test('bus and tram liveries: every colour can be set, the rest keep the Helsinki defaults',()=>{
 assert.deepEqual(mergeColours({a:'#000000'},{a:'#ffffff',b:'#ffffff'}),{a:'#ffffff'});
 try{
  assert.deepEqual(setBusLivery({}),BUS_COLOURS);
  const bus=setBusLivery({paint:'#1f4e9c',roof:'#eeeeee',displayText:'#ffaa00',tail:'red'});
  assert.equal(bus.paint,'#1f4e9c');assert.equal(bus.roof,'#eeeeee');assert.equal(bus.displayText,'#ffaa00');assert.equal(bus.tail,BUS_COLOURS.tail);
 }finally{setBusLivery();}
 try{
  assert.deepEqual(setTramLivery({}),{...ARTIC_COLOURS,operator:['HSL','HRT'],logo:true,marks:'#ecefee',fleet:'#d9ab3c'});
  const tram=setTramLivery({green:'#b3372a',wheel:'#111111',operator:['NYSSE'],fleet:'#ffffff'});
  assert.equal(tram.green,'#b3372a');assert.equal(tram.wheel,'#111111');assert.equal(tram.yellow,ARTIC_COLOURS.yellow);
  assert.deepEqual(tram.operator,['NYSSE']);assert.equal(tram.logo,false,'own operator text drops the default ring mark');assert.equal(tram.fleet,'#ffffff');
 }finally{setTramLivery();}
 assert.deepEqual(tramMarks({operator:[]}).operator,[]);assert.deepEqual(tramMarks({operator:'A'}).operator,['A']);
 assert.deepEqual(tramMarks({operator:['ONE','TWO','THREE']}).operator,['ONE','TWO']);
 const tampere=JSON.parse(readFileSync('cities/tampere/city.json','utf8'));
 assert.equal(cityLiveries(tampere).tram.green,'#b3372a');assert.equal(cityLiveries({}).police.label,'POLIISI');
 assert.deepEqual(cityLiveries(tampere).tram.operator,['TAMPERE','RATIKKA'],'Tampere trams carry their own plain-text lettering, not HSL HRT');assert.equal(cityLiveries(tampere).tram.logo,false);
 const registered=JSON.parse(readFileSync('public/cities/index.json','utf8')).cities.find(c=>c.id==='tampere');
 assert.deepEqual(registered.liveries.tram,tampere.liveries.tram,'the built registry has the city.json livery');
});
