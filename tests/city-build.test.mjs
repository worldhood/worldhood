import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {buildArgs,overpass,overpassSettings,parseOverpass,retryDelay,batches,fetchTransit,beginStage,checkBuild,stagePaths,carryOver,keepRegistered,parseStarts,placeStart,defaultStartName,headingFromBearing} from '../scripts/city-build-tools.mjs';
import {terrainZoom,zoomLadder,pickTiles,tilesCovering,registerTerrain} from '../scripts/city-terrain.mjs';

test('city:build takes the city id wherever npm puts it, with --refresh before or after',()=>{
 assert.deepEqual(buildArgs(['tampere']),{id:'tampere',refresh:false});
 assert.deepEqual(buildArgs(['tampere','--refresh']),{id:'tampere',refresh:true});
 assert.deepEqual(buildArgs(['--refresh','new-york']),{id:'new-york',refresh:true});
 assert.throws(()=>buildArgs([]),/Usage/);assert.throws(()=>buildArgs(['Tampere']),/Usage/);
 assert.throws(()=>buildArgs(['a','b']),/Usage/);assert.throws(()=>buildArgs(['tampere','--refesh']),/Unknown option --refesh/);
});

test('npm script arguments reach the script that reads them (npm appends them to the last command only)',()=>{
 const {scripts}=JSON.parse(fs.readFileSync('package.json','utf8'));
 for(const [name,line] of Object.entries(scripts)){const commands=line.split('&&').map(c=>c.trim());
  for(const c of commands.slice(0,-1)){const file=/^node (scripts\/\S+\.mjs)/.exec(c)?.[1];if(!file)continue;
   assert.ok(!/process\.argv/.test(fs.readFileSync(file,'utf8')),`${name}: ${file} reads arguments but is not the last command, so it never gets them`);}}
 assert.equal(scripts['city:build'],'node scripts/city-build.mjs');
 assert.match(fs.readFileSync('scripts/city-build.mjs','utf8'),/cities-readme\.mjs/,'city:build still updates the README cities table');
});

test('Overpass settings come from city.json with safe defaults and clear errors',()=>{
 assert.deepEqual(overpassSettings({}),{timeout:240,attempts:6,backoff:10,batch:40,types:['tram','light_rail','trolleybus','bus']});
 assert.deepEqual(overpassSettings({overpass:{timeout:600,transitBatch:10,transitTypes:['bus']}}).batch,10);
 assert.equal(overpassSettings({overpass:{timeout:600}}).timeout,600);
 assert.throws(()=>overpassSettings({overpass:{timeout:'long'}}),/overpass\.timeout/);
 assert.throws(()=>overpassSettings({overpass:{transitBatch:0}}),/overpass\.transitBatch/);
 assert.throws(()=>overpassSettings({overpass:{transitTypes:'bus'}}),/transitTypes/);
});

test('Overpass requests rotate over the servers with a growing wait, and treat timeout remarks as failures',async()=>{
 const calls=[],waits=[],answers=[()=>{throw Error('HTTP 504');},()=>'{"remark":"runtime error: Query timed out in \\"query\\"","elements":[]}',()=>'<html>busy</html>',()=>'{"elements":[{"type":"node","id":1}]}'];
 const request=async(endpoint,query,timeout)=>{calls.push({endpoint,query,timeout});return answers[calls.length-1]();};
 const json=await overpass('node(1);out;',{name:'test',timeout:90,attempts:5,backoff:5,endpoints:['https://a.example/api','https://b.example/api'],request,wait:async ms=>waits.push(ms),log:()=>{}});
 assert.equal(json.elements.length,1);
 assert.deepEqual(calls.map(c=>new URL(c.endpoint).host),['a.example','b.example','a.example','b.example']);
 assert.equal(calls[0].query,'[out:json][timeout:90];node(1);out;');assert.equal(calls[0].timeout,90);
 assert.deepEqual(waits,[5000,5000,10000]);
 assert.deepEqual([0,3,4,8,100].map(a=>retryDelay(a,10,4)),[10,10,20,40,300]);
 await assert.rejects(overpass('x',{attempts:2,backoff:0,request:async()=>{throw Error('HTTP 429');},wait:async()=>{},log:()=>{}}),/after 2 attempts: HTTP 429/);
 assert.throws(()=>parseOverpass('{"remark":"runtime error: out of memory"}'),/out of memory/);
});

test('transit routes are fetched per type: ids first, then geometry in batches of the configured size',async()=>{
 const asked=[],ids={tram:[3,1,2],bus:[5,4,3]};
 const query=async(name,body)=>{asked.push(name);
  const type=/route"="(\w+)"/.exec(body)?.[1];if(type)return {elements:ids[type].map(id=>({type:'relation',id}))};
  const list=/relation\(id:([\d,]+)\)/.exec(body)[1].split(',').map(Number);assert.match(body,/out geom\(1,2,3,4\);$/);
  return {elements:list.map(id=>({type:'relation',id,members:[]}))};};
 const {elements}=await fetchTransit(query,{bbox:'1,2,3,4',types:['tram','bus'],batch:2});
 assert.deepEqual(asked,['transit-tram-ids','transit-tram-2-0','transit-tram-2-1','transit-bus-ids','transit-bus-2-0','transit-bus-2-1']);
 assert.deepEqual(elements.map(e=>e.id),[1,2,3,4,5],'a relation in two route types is kept once');
 assert.deepEqual(batches([1,2,3,4,5],2),[[1,2],[3,4],[5]]);assert.deepEqual(batches([],3),[]);
});

const tmp=()=>fs.mkdtempSync(path.join(os.tmpdir(),'city-stage-'));
const fill=(dir,files)=>{for(const [f,v] of Object.entries(files)){fs.mkdirSync(path.dirname(path.join(dir,f)),{recursive:true});fs.writeFileSync(path.join(dir,f),v);}};
const list=dir=>fs.readdirSync(dir).sort();

test('a complete build replaces the old city only once it passes the check',()=>{
 const root=tmp();fill(path.join(root,'x'),{'city.pack':'old','mobility.json':'{}'});
 const stage=beginStage(root,'x');fill(stage.stage,{'city.pack':'new','mobility.json':'{}','surfaces/0.bin.pack':'s'});
 assert.equal(fs.readFileSync(path.join(root,'x/city.pack'),'utf8'),'old','the playable city is untouched while building');
 stage.commit();stage.abort();
 assert.equal(fs.readFileSync(path.join(root,'x/city.pack'),'utf8'),'new');assert.ok(fs.existsSync(path.join(root,'x/surfaces/0.bin.pack')));
 assert.deepEqual(list(root),['x'],'no staging or previous folder is left behind');
 fs.rmSync(root,{recursive:true});
});

test('a failed or incomplete build keeps the previous version and cleans up',()=>{
 const root=tmp();fill(path.join(root,'x'),{'city.pack':'old','mobility.json':'{}'});
 const half=beginStage(root,'x');fill(half.stage,{'city.pack':'new'});
 assert.throws(()=>half.commit(),/mobility\.json missing.*/);half.abort();
 assert.equal(fs.readFileSync(path.join(root,'x/city.pack'),'utf8'),'old');assert.deepEqual(list(root),['x']);
 // A download that dies mid-way: the process exits, abort() runs.
 const dead=beginStage(root,'x');fill(dead.stage,{'buildings3d/0.pack':'b'});dead.abort();assert.deepEqual(list(root),['x']);
 // A first build that fails leaves nothing.
 const fresh=beginStage(root,'y');fresh.abort();assert.deepEqual(list(root),['x']);
 fs.rmSync(root,{recursive:true});
});

test('files other commands add to a city survive a rebuild',()=>{
 const root=tmp();fill(path.join(root,'x'),{'city.pack':'old','mobility.json':'{}','places/square/front.jpg':'j','extensions/index.json':'{"extensions":[1]}','furniture.json':'[]','trams.json':'old'});
 const stage=beginStage(root,'x');assert.deepEqual(carryOver(stage.out,stage.stage),['extensions','places','furniture.json']);
 fill(stage.stage,{'city.pack':'new','mobility.json':'{}'});stage.commit();
 assert.deepEqual(list(path.join(root,'x')),['city.pack','extensions','furniture.json','mobility.json','places']);
 assert.equal(fs.readFileSync(path.join(root,'x/places/square/front.jpg'),'utf8'),'j');
 assert.deepEqual(carryOver(path.join(root,'none'),root),[]);
 fs.rmSync(root,{recursive:true});
});

test('the registry entry keeps what other commands registered, and their credits',()=>{
 const prev={id:'x',fetchedAt:'old',counts:{buildings:1,furniture:{placed:5}},furniture:'furniture.json',terrain:{zoom:15},attribution:'Map data © OSM (openstreetmap.org/copyright). Street furniture from Mapillary (mapillary.com), CC BY-SA 4.0. Elevation: Mapterhorn.'};
 const next={id:'x',fetchedAt:'new',counts:{buildings:2},attribution:'Map data © OSM (openstreetmap.org/copyright).'};
 const e=keepRegistered(prev,next);
 assert.deepEqual(e.counts,{buildings:2,furniture:{placed:5}});assert.equal(e.furniture,'furniture.json');assert.equal(e.fetchedAt,'new');
 assert.equal(e.terrain,undefined,'terrain comes only from the new build');
 assert.equal(e.attribution,'Map data © OSM (openstreetmap.org/copyright). Street furniture from Mapillary (mapillary.com), CC BY-SA 4.0.');
 assert.equal(keepRegistered(undefined,next),next);
});

test('files over the hosting limit fail the check',()=>{
 const root=tmp();fill(root,{'city.pack':'x'.repeat(50),'mobility.json':'{}','surfaces/big.pack':'x'.repeat(200)});
 assert.throws(()=>checkBuild(root,{maxBytes:100}),/surfaces\/big\.pack is 0\.0 MiB/);
 assert.doesNotThrow(()=>checkBuild(root,{maxBytes:1000}));
 fs.rmSync(root,{recursive:true});
});

test('if the swap itself fails the old city is put back',()=>{
 const root=tmp();fill(path.join(root,'x'),{'city.pack':'old','mobility.json':'{}'});
 let renames=0;const io={...fs,renameSync:(a,b)=>{if(++renames===2)throw Error('EXDEV');fs.renameSync(a,b);}};
 const stage=beginStage(root,'x',{io});fill(stage.stage,{'city.pack':'new','mobility.json':'{}'});
 assert.throws(()=>stage.commit(),/EXDEV/);stage.abort();
 assert.equal(fs.readFileSync(path.join(root,'x/city.pack'),'utf8'),'old');assert.deepEqual(list(root),['x']);
 assert.deepEqual(Object.keys(stagePaths('public/cities','x')),['out','stage','previous']);
 fs.rmSync(root,{recursive:true});
});

test('terrain zoom comes from city.json and falls back when the source lacks it',async()=>{
 assert.equal(terrainZoom({}),15);assert.equal(terrainZoom({terrainZoom:13}),13);
 assert.throws(()=>terrainZoom({terrainZoom:22}),/terrainZoom/);assert.throws(()=>terrainZoom({terrainZoom:14.5}),/terrainZoom/);
 assert.deepEqual(zoomLadder(13),[13,12,11,10]);assert.deepEqual(zoomLadder(10),[10]);
 const corners=[[23.74,61.49],[23.78,61.49],[23.78,61.51],[23.74,61.51]],t15=tilesCovering(corners,15),t14=tilesCovering(corners,14);
 assert.ok(t15.length>t14.length&&t14.length>=9);
 const asked=[],logs=[];
 const got=await pickTiles([15,14,13],z=>tilesCovering(corners,z),async(z,x,y)=>{asked.push(z);return z<15||x!==t15[3][0]||y!==t15[3][1];},m=>logs.push(m));
 assert.equal(got.zoom,14);assert.deepEqual(got.tiles,t14);assert.equal(asked.filter(z=>z===15).length,4,'stops at the first missing tile');
 assert.match(logs[0],/no z15 tile.*trying z14/);
 await assert.rejects(pickTiles([11,10],()=>[[0,0]],async()=>false),/no terrain tiles for this area from z11 down to z10/);
 await assert.rejects(pickTiles([15,14],()=>[[0,0]],async()=>{throw Error('HTTP 503');}),/HTTP 503/,'a server error is not a missing zoom');
 const entry=registerTerrain({attribution:'Map data.'},{source:'Elevation: X.',zoom:14});
 assert.equal(entry.attribution,'Map data. Elevation: X.');registerTerrain(entry,{source:'Elevation: X.'});assert.equal(entry.attribution,'Map data. Elevation: X.');
});

test('start points: snapped or exact, with heading, district, street and a default',()=>{
 const local=(lon,lat)=>[lon*100,lat*100];
 const starts=parseStarts({starts:[{name:'Square',at:[1,2]},{name:'Quay',position:[3,4],heading:90,district:'Harbour',street:'Laituri'}]},local);
 assert.deepEqual(starts[0],{name:'Square',p:[100,200],exact:false,heading:null,district:null,street:null});
 assert.equal(starts[1].exact,true);assert.equal(starts[1].heading,headingFromBearing(90));
 assert.equal(headingFromBearing(0),0);assert.equal(headingFromBearing(90),-1.5708);assert.equal(headingFromBearing(270),1.5708);
 assert.deepEqual(parseStarts({},local),[]);
 for(const [bad,re] of [[{starts:[{at:[1,2]}]},/needs a "name"/],[{starts:[{name:'A'}]},/"at" or "position"/],[{starts:[{name:'A',at:[1,2],position:[1,2]}]},/not both/],
  [{starts:[{name:'A',at:[1,2]},{name:'A',at:[1,2]}]},/used twice/],[{starts:[{name:'A',at:[1,2],heading:'north'}]},/compass degrees/],[{starts:{}},/must be a list/],[{defaultStart:3},/defaultStart/]])
  assert.throws(()=>parseStarts(bad,local),re);
 const snap=p=>{if(p[0]>250)throw Error('no road');return {x:p[0]+1,z:p[1]+1,name:'Main street'};},headingAt=()=>0.5;
 assert.deepEqual(placeStart(starts[0],{snap,headingAt,district:'Town'}),{name:'Square',district:'Town',street:'Main street',x:101,z:201,heading:.5});
 assert.deepEqual(placeStart(starts[1],{snap,headingAt,district:'Town'}),{name:'Quay',district:'Harbour',street:'Laituri',x:300,z:400,heading:-1.5708},'exact even with no street nearby');
 assert.throws(()=>placeStart({...starts[0],p:[300,0]},{snap,headingAt,district:'Town'}),/no road/);
 const landmarks=[{name:'Square'},{name:'Quay'}];
 assert.equal(defaultStartName({},landmarks),'Square');assert.equal(defaultStartName({defaultStart:'Quay'},landmarks),'Quay');
 assert.throws(()=>defaultStartName({defaultStart:'Pier'},landmarks),/not a start; the starts are: Square, Quay/);
});
